const N8N_WEBHOOK_BASE = "https://propfirmnotebook-chat.agenticaistaffing.com/webhook";

const apiRoutes = {
  "/api/propfirmnotebook-chat": "propfirmnotebook-chat",
  "/api/propfirmnotebook-analytics": "propfirmnotebook-analytics",
};

function jsonResponse(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const webhookPath = apiRoutes[url.pathname];

    if (!webhookPath) {
      return env.ASSETS.fetch(request);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": url.origin,
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type, x-pfn-visitor-id, x-pfn-session-id",
          "access-control-max-age": "300",
        },
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "method_not_allowed" }, { status: 405 });
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
      body: await request.text(),
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
