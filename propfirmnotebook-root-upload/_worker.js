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
  const raw = (env.SUPABASE_URL || DEFAULT_SUPABASE_REST_URL).replace(/\/$/, "");
  return raw.endsWith("/rest/v1") ? raw : `${raw}/rest/v1`;
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
      issues: ["Missing `TRULYINBOX_API_KEY` in worker environment and no ACT email snapshot asset was found."],
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
    issues: rows.length ? [] : ["No ACT mailbox rows were returned from TrulyInbox."],
  };
}

async function fetchYoutubeReviewData(env) {
  if (!env.SUPABASE_SERVICE_ROLE) {
    return {
      connected: false,
      rows: [],
      stats: null,
      issues: ["Missing `SUPABASE_SERVICE_ROLE` in worker environment."],
    };
  }

  const url = `${getSupabaseRestUrl(env)}/youtube_comment_drafts?select=id,video_title,author,original_comment,priority,assigned_to,review_status,created_at&order=created_at.desc&limit=5`;
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
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
  if (!env.SUPABASE_SERVICE_ROLE) return;
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
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
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
  if (!env.SUPABASE_SERVICE_ROLE) {
    return {
      connected: false,
      stats: null,
      topPages: [],
      issues: ["Missing `SUPABASE_SERVICE_ROLE` in worker environment for website analytics."],
    };
  }

  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
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
    issues: normalized.rows.length ? [] : ["No website analytics events have been logged yet."],
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
  if (!env.SUPABASE_SERVICE_ROLE) {
    return {
      connected: false,
      rows: [],
      stats: null,
      issues: ["Missing `SUPABASE_SERVICE_ROLE` in worker environment for chatbot logs."],
    };
  }

  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
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
      : ["The chatbot interaction log returned no ACT chat rows."],
  };
}

async function buildActDashboardPayload(request, env) {
  const [mailboxes, chatbot, website, youtube] = await Promise.all([
    fetchActMailboxData(request, env).catch((error) => ({
      connected: false,
      rows: [],
      stats: null,
      issues: [`TrulyInbox fetch failed: ${error.message}`],
    })),
    fetchActChatbotData(env).catch((error) => ({
      connected: false,
      rows: [],
      stats: null,
      issues: [`Chatbot log fetch failed: ${error.message}`],
    })),
    fetchWebsiteAnalyticsData(env).catch((error) => ({
      connected: false,
      stats: null,
      topPages: [],
      issues: [`Website analytics fetch failed: ${error.message}`],
    })),
    fetchYoutubeReviewData(env).catch((error) => ({
      connected: false,
      rows: [],
      stats: null,
      issues: [`YouTube review fetch failed: ${error.message}`],
    })),
  ]);

  const allIssues = [...mailboxes.issues, ...chatbot.issues, ...website.issues, ...youtube.issues];
  const lastSyncSource = mailboxes.stats?.sourceUpdatedAt || chatbot.stats?.latestAt || website.stats?.latestAt || youtube.stats?.latestReviewAt || new Date().toISOString();
  const integrationReadyCount = [mailboxes.connected, true, chatbot.connected, website.connected, youtube.connected].filter(Boolean).length;

  return {
    lastSyncLabel: `${formatRelativeTime(lastSyncSource)} from live sources`,
    integrationCount: `${integrationReadyCount}/6 live or route-ready`,
    kpis: [
      {
        label: "ACT senders",
        value: String(mailboxes.stats?.actSenders || 0),
        delta: mailboxes.connected
          ? `${mailboxes.stats?.activeWarmups || 0} currently warming in TrulyInbox`
          : "Waiting for TrulyInbox worker key",
        trend: mailboxes.connected ? "up" : "flat",
      },
      {
        label: "Avg warmup score",
        value: mailboxes.stats?.avgScore == null ? "Pending" : String(mailboxes.stats.avgScore),
        delta: mailboxes.connected
          ? "Live TrulyInbox account data"
          : "Score feed not configured yet",
        trend: mailboxes.stats?.avgScore != null ? "up" : "flat",
      },
      {
        label: "Latest warmup sends",
        value: mailboxes.stats?.latestSentTotal ? String(mailboxes.stats.latestSentTotal) : "Pending",
        delta: mailboxes.connected
          ? (mailboxes.viaSnapshot
              ? "Latest synced ACT snapshot counts"
              : "Latest visible send counts across ACT mailboxes")
          : "Waiting for live mailbox stats",
        trend: mailboxes.stats?.latestSentTotal ? "up" : "flat",
      },
      {
        label: "Chat messages",
        value: chatbot.stats ? String(chatbot.stats.totalMessages || 0) : "Pending",
        delta: chatbot.connected
          ? `${chatbot.stats?.last24hMessages || 0} messages in the last 24 hours`
          : "Waiting for Supabase chatbot log feed",
        trend: chatbot.connected ? "up" : "flat",
      },
    ],
    integrations: [
      {
        name: "TrulyInbox",
        status: mailboxes.connected ? "Live" : "Needs env key",
        detail: mailboxes.connected
          ? (mailboxes.viaSnapshot
              ? "ACT sender health is being served from the synced snapshot asset."
              : "ACT sender health is now fetched server-side from TrulyInbox.")
          : "Add `TRULYINBOX_API_KEY` to the site worker environment.",
        cadence: "On page load",
        owner: "Cloudflare worker",
      },
      {
        name: "n8n workflows",
        status: "Route exists",
        detail: "ACT chat and review workflows are active in n8n; summary API can be added next.",
        cadence: "Real time",
        owner: "n8n",
      },
      {
        name: "ACT chatbot feed",
        status: chatbot.connected ? "Live log" : "Write path live",
        detail: chatbot.connected
          ? "ACT chatbot activity is now being read server-side from the live interactions and contact tables."
          : "The site already posts ACT chatbot events into the `tradersempire-chat` workflow.",
        cadence: "Real time",
        owner: chatbot.connected ? "Supabase + n8n" : "Cloudflare worker + n8n",
      },
      {
        name: "Website analytics",
        status: website.connected ? "Live" : "Needs env key",
        detail: website.connected
          ? "Page views, guide opens, and ACT signup clicks are now being read from the website analytics event log."
          : "Add `SUPABASE_SERVICE_ROLE` to log and read website analytics events.",
        cadence: "Real time",
        owner: website.connected ? "Cloudflare worker + Supabase" : "Analytics stack",
      },
      {
        name: "Social activity",
        status: "Workflow mapping needed",
        detail: "ACT has social workflows in n8n, but this dashboard still needs a channel summary endpoint.",
        cadence: "TBD",
        owner: "n8n + channel APIs",
      },
      {
        name: "YouTube review DB",
        status: youtube.connected ? "Live" : "Needs env key",
        detail: youtube.connected
          ? "Review queue rows are now pulled server-side from the existing comment draft table."
          : "Add `SUPABASE_SERVICE_ROLE` to the site worker environment.",
        cadence: "On page load",
        owner: "Supabase",
      },
    ],
    mailboxes: [
      {
        label: "ACT sender cohort",
        stat: mailboxes.stats?.actSenders ? `${mailboxes.stats.actSenders} live` : "0 live",
        note: "Filtered to the ACT-related sender addresses only",
      },
      {
        label: "Warmups active",
        stat: String(mailboxes.stats?.activeWarmups || 0),
        note: mailboxes.connected
          ? (mailboxes.viaSnapshot ? "Synced snapshot count from TrulyInbox" : "Live count from TrulyInbox")
          : "Needs TrulyInbox worker key",
      },
      {
        label: "Avg deliverability",
        stat: mailboxes.stats?.avgDeliverability == null ? "Pending" : `${mailboxes.stats.avgDeliverability}%`,
        note: "Only visible when TrulyInbox returns deliverability values",
      },
      {
        label: "Latest warmup sends",
        stat: mailboxes.stats?.latestSentTotal ? String(mailboxes.stats.latestSentTotal) : "Pending",
        note: "Summed from the latest available ACT mailbox rows",
      },
    ],
    actMailboxes: mailboxes.rows,
    risks: allIssues.length
      ? allIssues
      : [
          "Website analytics is live, but totals only reflect events captured after this logging pass was wired.",
          "Chat messages are live, but session/thread grouping is only partial until `session_id` is consistently populated.",
          "Social channel metrics should stay separated by platform when we wire them next.",
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
        note: website.connected ? "Unique visitor/session IDs from logged site events" : "Website analytics logging not configured yet",
      },
      {
        label: "ACT CTA clicks",
        value: website.stats ? String(website.stats.actSignupClicks || 0) : "Pending",
        note: website.connected ? "Tracked from guide signup CTA clicks" : "Needs website analytics logging",
      },
      {
        label: "Guide starts",
        value: website.stats ? String(website.stats.guideStarts || 0) : "Pending",
        note: website.connected ? "Tracked from chat panel open events" : "Needs website analytics logging",
      },
      {
        label: "Return visitor rate",
        value: website.stats ? `${website.stats.returnVisitorRate || 0}%` : "Pending",
        note: website.connected ? "Based on repeat session or visitor IDs in the event log" : "Needs website analytics logging",
      },
    ],
    topPages: website.connected && website.topPages.length
      ? website.topPages
      : [
          "Website analytics will start populating top pages as soon as new site events are logged.",
        ],
    socialKpis: [
      { label: "Posts published", value: "Pending", delta: "Live social summary not wired yet", trend: "flat" },
      { label: "Replies pending", value: "Pending", delta: "Need per-channel workflow rollups", trend: "flat" },
      { label: "Approval queue", value: "Pending", delta: "Waiting for moderation endpoint", trend: "flat" },
      { label: "Escalations", value: "Pending", delta: "Waiting for social review summary", trend: "flat" },
    ],
    socialRows: [],
    workflows: [
      chatbot.connected
        ? "ACT chatbot messages are now being read from the live `interactions` and `contacts` tables."
        : "ACT chatbot webhook is active and already receives site traffic.",
      "ACT YouTube review workflows are active in n8n.",
      mailboxes.viaSnapshot
        ? "The dashboard is currently serving ACT email data from the synced snapshot file."
        : "The dashboard now has a secure worker route for live reads.",
      website.connected
        ? "Website event analytics are now logged and read back through the worker."
        : "Website event analytics still need the worker database key.",
      "Social summary reads are the next connector step.",
    ],
    youtubeRows: youtube.rows,
    youtubeRules: [
      "High-priority comments stay at the top of the review queue.",
      "Every live review row shown here comes from the existing YouTube comment draft table.",
      "Posting and approval actions should keep using the current ACT n8n workflows.",
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