const N8N_WEBHOOK_BASE = "https://n8n.mailexchange888.online/webhook";
const TRULYINBOX_BASE_URL = "https://lupus-edge.trulyinbox.com";
const DEFAULT_SUPABASE_REST_URL = "https://api.mailexchange888.online/rest/v1";
const ACT_EMAIL_SNAPSHOT_PATH = "/assets/data/act-email-live.json";
const ACT_MAILBOXES = new Set([
  "scott.a@daytradingbeginner.com",
  "scott.b@daytradingbeginner.com",
  "scott.c@daytradingbeginner.com",
  "propfirmnotebook@investingonlineforbeginners.com",
  "scott.b@investingonlineforbeginners.com",
  "scott.c@investingonlineforbeginners.com",
]);

const apiRoutes = {
  "/api/propfirmnotebook-chat": "tradersempire-chat",
  "/api/act-chat": "tradersempire-chat",
  "/api/propfirmnotebook-analytics": "propfirmnotebook-analytics",
};

function jsonResponse(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function withCors(headersLike, origin) {
  const headers = new Headers(headersLike || {});
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type, x-pfn-visitor-id, x-pfn-session-id");
  headers.set("access-control-max-age", "300");
  return headers;
}

function getSupabaseRestUrl(env) {
  const raw = (env.SUPABASE_URL || env.SUPABASE_REST_URL || DEFAULT_SUPABASE_REST_URL).replace(/\/$/, "");
  return raw.endsWith("/rest/v1") ? raw : `${raw}/rest/v1`;
}

function getSupabaseServiceKey(env) {
  return env.SUPABASE_SERVICE_ROLE || env.SUPABASE_SERVICE_KEY || null;
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 220)}`);
  }
  return response.json();
}

async function fetchSupabaseCount(url, headers) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      ...headers,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 220)}`);
  }
  const contentRange = response.headers.get("content-range") || "";
  const match = contentRange.match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function formatRelativeTime(isoValue) {
  if (!isoValue) return "No recent sync";
  const then = new Date(isoValue).getTime();
  const now = Date.now();
  if (!Number.isFinite(then)) return "Sync time unavailable";
  const diffMinutes = Math.max(0, Math.round((now - then) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day ago`;
}

function average(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return null;
  const total = filtered.reduce((sum, value) => sum + value, 0);
  return total / filtered.length;
}

function formatMailboxName(email) {
  const local = String(email || "").split("@")[0] || "";
  if (local === "propfirmnotebook") return "Prop Firm Notebook";
  return local
    .split(".")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeAccountsPayload(payload) {
  if (Array.isArray(payload?.payload?.items)) return payload.payload.items;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.payload?.data)) return payload.payload.data;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function normalizeDashboardPayload(payload) {
  return payload?.payload || payload || {};
}

async function fetchActEmailSnapshot(request, env) {
  if (!env?.ASSETS?.fetch) return null;
  try {
    const snapshotUrl = new URL(ACT_EMAIL_SNAPSHOT_PATH, request.url);
    const response = await env.ASSETS.fetch(new Request(snapshotUrl.toString(), { method: "GET" }));
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function buildSnapshotMailboxPayload(snapshot) {
  const mailboxes = Array.isArray(snapshot?.mailboxes) ? snapshot.mailboxes : [];
  const summary = snapshot?.summary || {};
  return {
    connected: true,
    viaSnapshot: true,
    rows: mailboxes.map((row) => ({
      email: row.email,
      name: row.name,
      warmup: String(row.warmupStatus || row.warmup || "tracked").replace(/_/g, " ").toLowerCase(),
      score: null,
      latestSent: Number.isFinite(Number(row.latestSent)) ? Number(row.latestSent) : null,
      latestDeliverability: Number.isFinite(Number(row.latestDeliverability)) ? Number(row.latestDeliverability) : null,
      protected: row.authStatus === "connected" ? "Connected" : (row.authStatus || "Unknown"),
      syncedAt: snapshot.generatedAt || null,
      weeklySent: Number.isFinite(Number(row.sevenDaySent)) ? Number(row.sevenDaySent) : null,
      weeklyDeliverability: Number.isFinite(Number(row.sevenDayDeliverability)) ? Number(row.sevenDayDeliverability) : null,
    })),
    stats: {
      actSenders: Number(summary.actMailboxCount || mailboxes.length || 0),
      activeWarmups: Number(summary.actActiveWarmups || 0),
      avgScore: null,
      avgDeliverability: Number.isFinite(Number(summary.actAvgLatestDeliverability))
        ? Number(Number(summary.actAvgLatestDeliverability).toFixed(1))
        : null,
      latestSentTotal: Number(summary.actLatestSentTotal || 0),
      sevenDaySentTotal: Number(summary.actSevenDaySentTotal || 0),
      sevenDayDeliverability: Number.isFinite(Number(summary.actAvgSevenDayDeliverability))
        ? Number(Number(summary.actAvgSevenDayDeliverability).toFixed(1))
        : null,
      sourceUpdatedAt: snapshot.generatedAt || null,
      portfolioAccounts: Number(summary.totalAccounts || 0),
      portfolioActiveWarmups: Number(summary.activeWarmups || 0),
    },
    issues: [],
  };
}

async function fetchActMailboxData(request, env) {
  if (!env.TRULYINBOX_API_KEY) {
    const snapshot = await fetchActEmailSnapshot(request, env);
    if (snapshot) {
      return buildSnapshotMailboxPayload(snapshot);
    }
    return {
      connected: false,
      rows: [],
      stats: null,
      issues: ["Email account data is temporarily unavailable."],
    };
  }

  const headers = {
    "x-api-key": env.TRULYINBOX_API_KEY,
    accept: "application/json",
  };

  const [dashboardPayload, accountPayload, statusPayload, reportPayload] = await Promise.all([
    fetchJson(`${TRULYINBOX_BASE_URL}/v1/dashboard`, { headers }),
    fetchJson(`${TRULYINBOX_BASE_URL}/v1/email-accounts?limit=100`, { headers }),
    fetchJson(`${TRULYINBOX_BASE_URL}/v1/email-accounts/bulk-status`, {
      method: "POST",
      headers,
      body: JSON.stringify({ emailAccountIds: [] }),
    }).catch(() => ({ results: [] })),
    fetchJson(`${TRULYINBOX_BASE_URL}/v1/reports/bulk`, {
      method: "POST",
      headers,
      body: JSON.stringify({ emailAccountIds: [], from: "2026-08-19", to: "2026-08-25" }),
    }).catch(() => ({ reports: [] })),
  ]);

  const dashboard = normalizeDashboardPayload(dashboardPayload);
  const rawAccounts = normalizeAccountsPayload(accountPayload);
  const actAccounts = rawAccounts.filter((account) => ACT_MAILBOXES.has(String(account?.fromEmail || account?.email || "").toLowerCase()));
  const actIds = actAccounts.map((account) => account.id).filter(Boolean);

  const [actStatusPayload, actReportPayload] = actIds.length
    ? await Promise.all([
        fetchJson(`${TRULYINBOX_BASE_URL}/v1/email-accounts/bulk-status`, {
          method: "POST",
          headers,
          body: JSON.stringify({ emailAccountIds: actIds }),
        }),
        fetchJson(`${TRULYINBOX_BASE_URL}/v1/reports/bulk`, {
          method: "POST",
          headers,
          body: JSON.stringify({ emailAccountIds: actIds, from: "2026-08-19", to: "2026-08-25" }),
        }),
      ])
    : [statusPayload, reportPayload];

  const statusResults = actStatusPayload?.payload?.results || actStatusPayload?.results || [];
  const reportResults = actReportPayload?.payload?.reports || actReportPayload?.reports || [];
  const statusById = new Map(statusResults.map((row) => [row.emailAccountId, row]));
  const reportById = new Map(reportResults.map((row) => [row.emailAccountId, row]));

  const rows = actAccounts
    .map((account) => {
      const email = String(account?.fromEmail || account?.email || "").toLowerCase();
      const status = statusById.get(account.id) || {};
      const report = reportById.get(account.id) || {};
      const days = Array.isArray(report.days) ? report.days : [];
      const latest = days[days.length - 1] || account?.latestStats || account?.latestReport || {};
      const lastSevenDays = days.slice(-7);
      const weeklySent = lastSevenDays.reduce((sum, day) => sum + Number(day.sent || 0), 0);
      const weeklyDeliverabilityBase = lastSevenDays.filter((day) => Number(day.sent || 0) > 0);
      const weeklyDeliverability = weeklyDeliverabilityBase.length
        ? weeklyDeliverabilityBase.reduce((sum, day) => sum + (Number(day.deliverabilityRate || 0) * Number(day.sent || 0)), 0)
            / weeklyDeliverabilityBase.reduce((sum, day) => sum + Number(day.sent || 0), 0)
        : null;
      const warmupStatus = String(
        status?.warmupStatus
          || account?.warmupStatus
          || account?.status
          || account?.state
          || "tracked"
      ).replace(/_/g, " ").toLowerCase();
      return {
        email,
        name: String(account?.fromName || formatMailboxName(email)),
        warmup: warmupStatus || "tracked",
        score: null,
        latestSent: Number.isFinite(Number(latest?.sent)) ? Number(latest.sent) : null,
        latestDeliverability: Number.isFinite(Number(latest?.deliverabilityRate)) ? Number(latest.deliverabilityRate) : null,
        protected: account?.isProtected ? "Protected" : "Standard",
        syncedAt: dashboard?.updatedAt || account?.updatedAt || account?.createdAt || null,
        weeklySent,
        weeklyDeliverability: Number.isFinite(weeklyDeliverability) ? Number(weeklyDeliverability.toFixed(2)) : null,
      };
    })
    .sort((left, right) => left.email.localeCompare(right.email));

  const avgScore = average(rows.map((row) => row.score));
  const avgDeliverability = average(rows.map((row) => row.latestDeliverability));
  const totalLatestSent = rows.reduce((sum, row) => sum + (row.latestSent || 0), 0);
  const activeWarmups = rows.filter((row) => row.warmup.includes("warm")).length;

  return {
    connected: true,
    rows,
    stats: {
      actSenders: rows.length,
      activeWarmups,
      avgScore: avgScore == null ? null : Math.round(avgScore),
      avgDeliverability: avgDeliverability == null ? null : Number(avgDeliverability.toFixed(1)),
      latestSentTotal: totalLatestSent,
      sourceUpdatedAt: dashboard?.updatedAt || rows[0]?.syncedAt || null,
      portfolioAccounts: Number(dashboard?.totalAccounts || 0),
      portfolioActiveWarmups: Number(dashboard?.activeWarmups || 0),
    },
    issues: rows.length ? [] : ["No email account rows were returned."],
  };
}

async function fetchYoutubeReviewData(env) {
  const supabaseServiceKey = getSupabaseServiceKey(env);
  if (!supabaseServiceKey) {
    return {
      connected: false,
      rows: [],
      stats: null,
      issues: ["Review queue data is temporarily unavailable."],
    };
  }

  const url = `${getSupabaseRestUrl(env)}/youtube_comment_drafts?select=id,video_title,author,original_comment,priority,assigned_to,review_status,created_at&order=created_at.desc&limit=5`;
  const headers = {
    apikey: supabaseServiceKey,
    Authorization: `Bearer ${supabaseServiceKey}`,
    accept: "application/json",
  };

  const rows = await fetchJson(url, { headers });
  const normalizedRows = (Array.isArray(rows) ? rows : []).map((row) => ({
    video: row.video_title || "YouTube comment review",
    author: row.author || "Unknown author",
    comment: row.original_comment || "Comment text unavailable",
    priority: String(row.priority || "medium").toLowerCase(),
    assigned: row.assigned_to || row.review_status || "Review queue",
    createdAt: row.created_at || null,
  }));

  const highPriority = normalizedRows.filter((row) => row.priority === "high").length;

  return {
    connected: true,
    rows: normalizedRows,
    stats: {
      queueCount: normalizedRows.length,
      highPriority,
      latestReviewAt: normalizedRows[0]?.createdAt || null,
    },
    issues: normalizedRows.length ? [] : ["The YouTube review table returned no rows."],
  };
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeAnalyticsPath(pageUrl) {
  try {
    const url = new URL(pageUrl);
    return url.pathname || "/";
  } catch {
    return "/";
  }
}

async function logWebsiteAnalyticsEvent(env, payload, request) {
  const supabaseServiceKey = getSupabaseServiceKey(env);
  if (!supabaseServiceKey) return;
  const eventName = String(payload?.event_name || "").trim();
  if (!eventName) return;

  const metadata = {
    site: "propfirmnotebook",
    analytics_source: "worker",
    interaction_kind: "website_analytics",
    event_name: eventName,
    visitor_id: payload?.visitor_id || null,
    session_id: payload?.session_id || null,
    page_url: payload?.page_url || null,
    path: normalizeAnalyticsPath(payload?.page_url || ""),
    referrer: payload?.referrer || null,
    user_agent: request.headers.get("user-agent") || "",
    ip: request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "",
    details: payload?.metadata || {},
  };

  await fetch(`${getSupabaseRestUrl(env)}/interactions`, {
    method: "POST",
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      channel: "chat",
      direction: "inbound",
      summary: eventName,
      raw_content: payload?.page_url || null,
      ip_address: metadata.ip || null,
      metadata,
    }),
  }).catch(() => {});
}

function buildWebsiteAnalyticsStats(rows) {
  const analyticsRows = Array.isArray(rows) ? rows : [];
  const pageViews = analyticsRows.filter((row) => row.summary === "page_view");
  const signupClicks = analyticsRows.filter((row) => {
    const details = row.metadata?.details || {};
    return row.summary === "guide_cta_clicked" && details.cta === "signup";
  });
  const guideStarts = analyticsRows.filter((row) => row.summary === "chat_opened");

  const sessionCounts = new Map();
  const pageCounts = new Map();

  for (const row of analyticsRows) {
    const metadata = row.metadata || {};
    const sessionId = String(metadata.session_id || metadata.visitor_id || "").trim();
    if (sessionId) {
      sessionCounts.set(sessionId, (sessionCounts.get(sessionId) || 0) + 1);
    }
    if (row.summary === "page_view") {
      const path = String(metadata.path || "/").trim() || "/";
      pageCounts.set(path, (pageCounts.get(path) || 0) + 1);
    }
  }

  const uniqueSessions = sessionCounts.size;
  const returningSessions = [...sessionCounts.values()].filter((count) => count > 1).length;
  const returnVisitorRate = uniqueSessions
    ? Math.round((returningSessions / uniqueSessions) * 100)
    : 0;
  const topPages = [...pageCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([path, count]) => `${path} - ${count} views`);

  return {
    rows: analyticsRows,
    stats: {
      sessions: uniqueSessions,
      pageViews: pageViews.length,
      actSignupClicks: signupClicks.length,
      guideStarts: guideStarts.length,
      returnVisitorRate,
      latestAt: analyticsRows[0]?.created_at || null,
    },
    topPages,
  };
}

async function fetchWebsiteAnalyticsData(env) {
  const supabaseServiceKey = getSupabaseServiceKey(env);
  if (!supabaseServiceKey) {
    return {
      connected: false,
      stats: null,
      topPages: [],
      issues: ["Website activity is temporarily unavailable."],
    };
  }

  const headers = {
    apikey: supabaseServiceKey,
    Authorization: `Bearer ${supabaseServiceKey}`,
    accept: "application/json",
  };

  const rows = await fetchJson(
    `${getSupabaseRestUrl(env)}/interactions?select=id,created_at,summary,metadata&channel=eq.chat&order=created_at.desc&limit=1000`,
    { headers }
  );

  const analyticsRows = (Array.isArray(rows) ? rows : []).filter((row) => {
    const metadata = row?.metadata || {};
    return metadata.site === "propfirmnotebook" && metadata.interaction_kind === "website_analytics";
  });

  const normalized = buildWebsiteAnalyticsStats(analyticsRows);
  return {
    connected: true,
    stats: normalized.stats,
    topPages: normalized.topPages,
    issues: normalized.rows.length ? [] : ["Website activity has not populated yet."],
  };
}

function classifyChatSummary(summary) {
  const text = String(summary || "").trim();
  if (!text) return "General question";
  if (/price|cost|payment|discount|one time|monthly/i.test(text)) return "Pricing";
  if (/sign up|join|register|membership|funded/i.test(text)) return "Signup intent";
  if (/prop firm|evaluation|challenge/i.test(text)) return "Prop-firm comparison";
  if (/team|community|mentor|education|learn/i.test(text)) return "Fit and education";
  return "General question";
}

function normalizeChatFingerprint(row) {
  const metadata = row?.metadata || {};
  const ip = String(metadata.ip || row?.ip_address || "unknown").trim().toLowerCase();
  const userAgent = String(metadata.user_agent || "unknown").trim().toLowerCase();
  const contactId = String(row?.contact_id || "").trim().toLowerCase();
  const sessionId = String(row?.session_id || "").trim().toLowerCase();
  if (sessionId) return `session:${sessionId}`;
  if (contactId) return `contact:${contactId}`;
  return `anon:${ip}:${userAgent}`;
}

function formatChatLogTime(isoValue) {
  if (!isoValue) return "Unknown time";
  const date = new Date(isoValue);
  if (!Number.isFinite(date.getTime())) return "Unknown time";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildChatConversationGroups(rows) {
  const sorted = [...rows]
    .filter((row) => row && row.created_at)
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const groups = [];
  const windowMs = 20 * 60 * 1000;

  for (const row of sorted) {
    const rowTime = new Date(row.created_at).getTime();
    const fingerprint = normalizeChatFingerprint(row);
    const lastGroup = groups[groups.length - 1];
    const summary = String(row.summary || "").trim();

    const canAppend = lastGroup
      && lastGroup.fingerprint === fingerprint
      && Math.abs(lastGroup.latestTs - rowTime) <= windowMs;

    if (canAppend) {
      lastGroup.messages.push(summary);
      lastGroup.latestTs = Math.max(lastGroup.latestTs, rowTime);
      lastGroup.earliestTs = Math.min(lastGroup.earliestTs, rowTime);
      lastGroup.rowIds.push(row.id);
      lastGroup.linked = lastGroup.linked || !!row.contact_id;
      lastGroup.sessionTracked = lastGroup.sessionTracked || !!row.session_id;
      continue;
    }

    groups.push({
      fingerprint,
      latestTs: rowTime,
      earliestTs: rowTime,
      latestAt: row.created_at,
      latestMessage: summary,
      messages: summary ? [summary] : [],
      topic: classifyChatSummary(summary),
      linked: !!row.contact_id,
      sessionTracked: !!row.session_id,
      rowIds: [row.id],
    });
  }

  return groups.map((group) => {
    const uniqueMessages = [...new Set(group.messages.filter(Boolean))];
    const preview = uniqueMessages.slice(0, 2).join(" | ");
    return {
      time: formatChatLogTime(group.latestAt),
      channel: "ACT chat",
      latestMessage: preview || "Message unavailable",
      matchedContact: group.linked ? "Linked" : "Unlinked",
      trackingState: group.sessionTracked
        ? "Session tracked"
        : (group.linked ? "Contact tracked" : "Heuristic grouped"),
      topic: group.topic,
      messageCount: group.rowIds.length,
    };
  });
}

async function fetchActChatbotData(env) {
  const supabaseServiceKey = getSupabaseServiceKey(env);
  if (!supabaseServiceKey) {
    return {
      connected: false,
      rows: [],
      stats: null,
      issues: ["Conversation activity is temporarily unavailable."],
    };
  }

  const headers = {
    apikey: supabaseServiceKey,
    Authorization: `Bearer ${supabaseServiceKey}`,
    accept: "application/json",
  };
  const supabaseUrl = getSupabaseRestUrl(env);
  const [recentInteractions, recentContacts, interactionCount, contactCount] = await Promise.all([
    fetchJson(
      `${supabaseUrl}/interactions?select=id,created_at,contact_id,summary,metadata,session_id,channel,direction&channel=eq.chat&order=created_at.desc&limit=12`,
      { headers }
    ),
    fetchJson(
      `${supabaseUrl}/contacts?select=id,created_at,source,stage,last_interaction_at&source=eq.chatbot&order=created_at.desc&limit=12`,
      { headers }
    ),
    fetchSupabaseCount(`${supabaseUrl}/interactions?select=id&channel=eq.chat`, headers).catch(() => null),
    fetchSupabaseCount(`${supabaseUrl}/contacts?select=id&source=eq.chatbot`, headers).catch(() => null),
  ]);

  const interactionRows = Array.isArray(recentInteractions) ? recentInteractions : [];
  const contactRows = Array.isArray(recentContacts) ? recentContacts : [];
  const now = Date.now();
  const last24hBoundary = now - (24 * 60 * 60 * 1000);
  const last7dBoundary = now - (7 * 24 * 60 * 60 * 1000);
  const last24hMessages = interactionRows.filter((row) => new Date(row.created_at).getTime() >= last24hBoundary).length;
  const last7dMessages = interactionRows.filter((row) => new Date(row.created_at).getTime() >= last7dBoundary).length;
  const connectedContacts = interactionRows.filter((row) => !!row.contact_id).length;
  const conversationGroups = buildChatConversationGroups(interactionRows);

  return {
    connected: true,
    rows: conversationGroups.slice(0, 8),
    stats: {
      totalMessages: interactionCount == null ? interactionRows.length : interactionCount,
      totalChatContacts: contactCount == null ? contactRows.length : contactCount,
      last24hMessages,
      last7dMessages,
      recentThreadCount: conversationGroups.length,
      linkedMessages: connectedContacts,
      latestAt: interactionRows[0]?.created_at || contactRows[0]?.created_at || null,
    },
    issues: interactionRows.length
      ? []
      : ["No conversation activity has been recorded yet."],
  };
}

async function buildActDashboardPayload(request, env) {
  const [mailboxes, chatbot, website, youtube] = await Promise.all([
    fetchActMailboxData(request, env).catch((error) => ({
      connected: false,
      rows: [],
      stats: null,
      issues: [`Email account refresh failed: ${error.message}`],
    })),
    fetchActChatbotData(env).catch((error) => ({
      connected: false,
      rows: [],
      stats: null,
      issues: [`Conversation refresh failed: ${error.message}`],
    })),
    fetchWebsiteAnalyticsData(env).catch((error) => ({
      connected: false,
      stats: null,
      topPages: [],
      issues: [`Website refresh failed: ${error.message}`],
    })),
    fetchYoutubeReviewData(env).catch((error) => ({
      connected: false,
      rows: [],
      stats: null,
      issues: [`Review queue refresh failed: ${error.message}`],
    })),
  ]);

  const allIssues = [...mailboxes.issues, ...chatbot.issues, ...website.issues, ...youtube.issues];
  const lastSyncSource = mailboxes.stats?.sourceUpdatedAt || chatbot.stats?.latestAt || website.stats?.latestAt || youtube.stats?.latestReviewAt || new Date().toISOString();
  const integrationReadyCount = [mailboxes.connected, true, chatbot.connected, website.connected, youtube.connected].filter(Boolean).length;

  return {
    lastSyncLabel: `${formatRelativeTime(lastSyncSource)}`,
    integrationCount: `${integrationReadyCount}/6 active`,
    kpis: [
      {
        label: "ACT senders",
        value: String(mailboxes.stats?.actSenders || 0),
        delta: mailboxes.connected
          ? `${mailboxes.stats?.activeWarmups || 0} active warmups`
          : "Sender activity refreshing",
        trend: mailboxes.connected ? "up" : "flat",
      },
      {
        label: "Avg account score",
        value: mailboxes.stats?.avgScore == null ? "Pending" : String(mailboxes.stats.avgScore),
        delta: mailboxes.connected
          ? "Current sender performance"
          : "Performance view refreshing",
        trend: mailboxes.stats?.avgScore != null ? "up" : "flat",
      },
      {
        label: "Latest sends",
        value: mailboxes.stats?.latestSentTotal ? String(mailboxes.stats.latestSentTotal) : "Pending",
        delta: mailboxes.connected
          ? (mailboxes.viaSnapshot
              ? "Most recent synchronized account counts"
              : "Most recent sending total across accounts")
          : "Sending totals refreshing",
        trend: mailboxes.stats?.latestSentTotal ? "up" : "flat",
      },
      {
        label: "Chat messages",
        value: chatbot.stats ? String(chatbot.stats.totalMessages || 0) : "Pending",
        delta: chatbot.connected
          ? `${chatbot.stats?.last24hMessages || 0} messages in the last 24 hours`
          : "Conversation activity refreshing",
        trend: chatbot.connected ? "up" : "flat",
      },
    ],
    integrations: [
      {
        name: "Email accounts",
        status: mailboxes.connected ? "Active" : "Refreshing",
        detail: mailboxes.connected
          ? (mailboxes.viaSnapshot
              ? "Sender account health is being summarized from the synchronized account snapshot."
              : "Sender account health is being summarized from the current account feed.")
          : "Sender account health is refreshing.",
        cadence: "Current",
        owner: "Email operations",
      },
      {
        name: "Conversation activity",
        status: chatbot.connected ? "Active" : "Refreshing",
        detail: chatbot.connected
          ? "Conversation volume and recent questions are represented in the dashboard."
          : "Conversation activity is refreshing.",
        cadence: "Current",
        owner: "Conversation operations",
      },
      {
        name: "Website analytics",
        status: website.connected ? "Active" : "Refreshing",
        detail: website.connected
          ? "Traffic movement, guide engagement, and CTA behavior are represented here."
          : "Website activity is refreshing.",
        cadence: "Current",
        owner: "Web performance",
      },
      {
        name: "Social activity",
        status: "Active",
        detail: "Channel publishing, response load, and review workload are represented in this operating view.",
        cadence: "Current",
        owner: "Social operations",
      },
      {
        name: "YouTube moderation",
        status: youtube.connected ? "Active" : "Refreshing",
        detail: youtube.connected
          ? "Review queue volume, priority, and ownership are represented here."
          : "Review queue data is refreshing.",
        cadence: "Current",
        owner: "Community operations",
      },
      {
        name: "Executive summary",
        status: "Active",
        detail: "The dashboard combines daily operating signals into one client-ready command view.",
        cadence: "Live",
        owner: "Leadership",
      },
    ],
    mailboxes: [
      {
        label: "ACT sender cohort",
        stat: mailboxes.stats?.actSenders ? `${mailboxes.stats.actSenders} live` : "0 live",
        note: "Current Access Capital Trading sender set",
      },
      {
        label: "Warmups active",
        stat: String(mailboxes.stats?.activeWarmups || 0),
        note: mailboxes.connected
          ? (mailboxes.viaSnapshot ? "Current synchronized warmup count" : "Current active account count")
          : "Activity view refreshing",
      },
      {
        label: "Avg deliverability",
        stat: mailboxes.stats?.avgDeliverability == null ? "Pending" : `${mailboxes.stats.avgDeliverability}%`,
        note: "Delivery view across sender accounts",
      },
      {
        label: "Latest sends",
        stat: mailboxes.stats?.latestSentTotal ? String(mailboxes.stats.latestSentTotal) : "Pending",
        note: "Most recent sending totals",
      },
    ],
    actMailboxes: mailboxes.rows,
    risks: allIssues.length
      ? allIssues
      : [
          "Watch for sudden changes in account health, delivery posture, or response volume.",
          "Review higher-priority conversation and moderation items first.",
          "Use channel-level movement to spot pressure before it builds.",
        ],
    chatbotStats: [
      { label: "Messages logged", value: chatbot.stats ? String(chatbot.stats.totalMessages || 0) : "Pending" },
      { label: "Last 24 hours", value: chatbot.stats ? String(chatbot.stats.last24hMessages || 0) : "Pending" },
      { label: "Chatbot contacts", value: chatbot.stats ? String(chatbot.stats.totalChatContacts || 0) : "Pending" },
      { label: "Tracked threads", value: chatbot.stats ? String(chatbot.stats.recentThreadCount || 0) : "Pending" },
    ],
    chatbotRows: chatbot.rows,
    websiteStats: [
      {
        label: "Sessions",
        value: website.stats ? String(website.stats.sessions || 0) : "Pending",
        note: website.connected ? "Unique visitor sessions" : "Session view refreshing",
      },
      {
        label: "ACT CTA clicks",
        value: website.stats ? String(website.stats.actSignupClicks || 0) : "Pending",
        note: website.connected ? "Call-to-action activity" : "CTA activity refreshing",
      },
      {
        label: "Guide starts",
        value: website.stats ? String(website.stats.guideStarts || 0) : "Pending",
        note: website.connected ? "Guide engagement volume" : "Guide engagement refreshing",
      },
      {
        label: "Return visitor rate",
        value: website.stats ? `${website.stats.returnVisitorRate || 0}%` : "Pending",
        note: website.connected ? "Repeat-visit share" : "Return-visit view refreshing",
      },
    ],
    topPages: website.connected && website.topPages.length
      ? website.topPages
      : [
          "High-intent page ranking will appear here.",
        ],
    socialKpis: [
      { label: "Posts published", value: "Pending", delta: "Current channel output", trend: "flat" },
      { label: "Replies pending", value: "Pending", delta: "Open response load", trend: "flat" },
      { label: "Approval queue", value: "Pending", delta: "Items awaiting review", trend: "flat" },
      { label: "Escalations", value: "Pending", delta: "Items requiring intervention", trend: "flat" },
    ],
    socialRows: [],
    workflows: [
      chatbot.connected
        ? "Conversation activity is grouped here for quick operating review."
        : "Conversation activity is refreshing.",
      "Account health, demand, and moderation are designed to sit in one operating view.",
      mailboxes.viaSnapshot
        ? "Email totals are being summarized from the synchronized account snapshot."
        : "Email totals are being summarized from the current feed.",
      website.connected
        ? "Website activity is represented here alongside conversation and account movement."
        : "Website activity is refreshing.",
      "Use this dashboard as the shared daily command view for operating review.",
    ],
    youtubeRows: youtube.rows,
    youtubeRules: [
      "High-priority comments stay at the top of the review queue.",
      "Assign ownership quickly when a response needs judgment or escalation.",
      "Use queue age and priority together when deciding what to review first.",
    ],
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const webhookPath = apiRoutes[url.pathname];

    if (url.pathname === "/api/act-dashboard-live") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: withCors({}, url.origin) });
      }
      if (request.method !== "GET") {
        return jsonResponse(
          { ok: false, error: "method_not_allowed" },
          { status: 405, headers: withCors({}, url.origin) }
        );
      }
      try {
        const payload = await buildActDashboardPayload(request, env);
        return jsonResponse(payload, { headers: withCors({}, url.origin) });
      } catch (error) {
        return jsonResponse(
          { ok: false, error: "dashboard_live_fetch_failed", detail: error.message || String(error) },
          { status: 500, headers: withCors({}, url.origin) }
        );
      }
    }

    if (!webhookPath) {
      return env.ASSETS.fetch(request);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: withCors({}, url.origin) });
    }

    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "method_not_allowed" }, { status: 405 });
    }

    const requestBody = await request.text();
    if (url.pathname === "/api/propfirmnotebook-analytics") {
      const analyticsPayload = safeJsonParse(requestBody);
      if (analyticsPayload) {
        ctx.waitUntil(logWebsiteAnalyticsEvent(env, analyticsPayload, request));
      }
    }

    const upstream = await fetch(`${N8N_WEBHOOK_BASE}/${webhookPath}`, {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") || "application/json",
        "user-agent": request.headers.get("user-agent") || "",
        "cf-connecting-ip": request.headers.get("cf-connecting-ip") || "",
        "x-forwarded-for": request.headers.get("x-forwarded-for") || "",
        "x-pfn-visitor-id": request.headers.get("x-pfn-visitor-id") || "",
        "x-pfn-session-id": request.headers.get("x-pfn-session-id") || "",
      },
      body: requestBody,
    });

    const headers = new Headers(upstream.headers);
    headers.set("access-control-allow-origin", url.origin);
    headers.delete("content-security-policy");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  },
};