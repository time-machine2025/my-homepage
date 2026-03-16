/**
 * Cloudflare Worker: Umami API proxy
 *
 * Purpose:
 * - Keep your Umami API token secret (not exposed to the browser)
 * - Provide a tiny public API your GitHub Pages can call
 *
 * Setup (high level):
 * - Create a Worker
 * - Add Secrets:
 *   - UMAMI_API_KEY: your Umami Cloud API key (recommended for cloud.umami.is)
 *   - UMAMI_TOKEN: (optional) bearer token for self-hosted Umami
 * - Add Variables:
 *   - UMAMI_BASE_URL: https://cloud.umami.is
 *   - UMAMI_WEBSITE_ID: your website UUID
 *   - ALLOW_ORIGIN: https://time-machine2025.github.io (optional; default "*")
 *   - CACHE_TTL_SECONDS: 300 (optional)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const cacheKey = new Request(url.toString(), request);

    if (request.method === "OPTIONS") {
      return withCors(
        new Response(null, { status: 204 }),
        env,
        request.headers.get("Origin")
      );
    }

    if (path === "" || path === "/") {
      return withCors(
        json({ ok: true, name: "umami-proxy" }),
        env,
        request.headers.get("Origin")
      );
    }

    if (path !== "/summary") {
      return withCors(
        json({ ok: false, error: "Not found" }, 404),
        env,
        request.headers.get("Origin")
      );
    }

    const cacheTtlSeconds = Number(env.CACHE_TTL_SECONDS || 300);
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) {
      return withCors(cached, env, request.headers.get("Origin"));
    }

    try {
      // Umami Cloud API base is https://api.umami.is/v1 (docs).
      // Self-hosted base is typically https://your-umami-domain (and endpoints under /api).
      const rawBase = (env.UMAMI_BASE_URL || "https://cloud.umami.is").replace(/\/+$/, "");
      const websiteId = env.UMAMI_WEBSITE_ID;
      const apiKey = env.UMAMI_API_KEY;
      const token = env.UMAMI_TOKEN;

      if (!websiteId || (!apiKey && !token)) {
        return withCors(
          json(
            {
              ok: false,
              error: "Missing UMAMI_WEBSITE_ID and (UMAMI_API_KEY or UMAMI_TOKEN)",
            },
            500
          ),
          env,
          request.headers.get("Origin")
        );
      }

      const base = apiKey ? "https://api.umami.is/v1" : rawBase;
      const apiPrefix = apiKey ? "" : "/api";

      const now = Date.now();
      const startAt7d = now - 7 * 24 * 60 * 60 * 1000;
      const startAtAll = 0;
      const endAt = now;

      const [statsAll, stats7d, countries7d, referrers7d] = await Promise.all([
        umamiStats(base, apiPrefix, { apiKey, token }, websiteId, startAtAll, endAt),
        umamiStats(base, apiPrefix, { apiKey, token }, websiteId, startAt7d, endAt),
        umamiMetrics(base, apiPrefix, { apiKey, token }, websiteId, startAt7d, endAt, "country", 8),
        umamiMetrics(base, apiPrefix, { apiKey, token }, websiteId, startAt7d, endAt, "referrer", 8),
      ]);

      const payload = {
        totals: {
          pageviews: statsAll?.pageviews ?? 0,
          visitors: statsAll?.visitors ?? 0,
        },
        last7d: {
          pageviews: stats7d?.pageviews ?? 0,
          visitors: stats7d?.visitors ?? 0,
          topCountries: (countries7d || []).map((x) => ({ name: x.x, value: x.y })),
          topReferrers: (referrers7d || []).map((x) => ({ name: x.x, value: x.y })),
        },
      };

      const response = json(payload);
      response.headers.set("cache-control", `public, max-age=${cacheTtlSeconds}`);
      await cache.put(cacheKey, response.clone());
      return withCors(response, env, request.headers.get("Origin"));
    } catch (err) {
      return withCors(
        json(
          {
            ok: false,
            error: err && err.message ? err.message : String(err),
          },
          500
        ),
        env,
        request.headers.get("Origin")
      );
    }
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function withCors(response, env, origin) {
  const allowOrigin = env.ALLOW_ORIGIN || "*";
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", allowOrigin === "*" ? "*" : allowOrigin);
  headers.set("access-control-allow-methods", "GET,OPTIONS");
  headers.set("access-control-allow-headers", "content-type,accept");
  headers.set("vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}

async function umamiStats(base, apiPrefix, auth, websiteId, startAt, endAt) {
  const u = new URL(`${base}${apiPrefix}/websites/${websiteId}/stats`);
  u.searchParams.set("startAt", String(startAt));
  u.searchParams.set("endAt", String(endAt));

  const res = await fetch(u.toString(), {
    headers: {
      accept: "application/json",
      ...umamiAuthHeaders(auth),
    },
  });
  if (!res.ok) throw new Error(`Umami stats failed: ${res.status}`);
  return await res.json();
}

async function umamiMetrics(base, apiPrefix, auth, websiteId, startAt, endAt, type, limit) {
  const u = new URL(`${base}${apiPrefix}/websites/${websiteId}/metrics`);
  u.searchParams.set("startAt", String(startAt));
  u.searchParams.set("endAt", String(endAt));
  u.searchParams.set("type", type);
  u.searchParams.set("limit", String(limit));

  const res = await fetch(u.toString(), {
    headers: {
      accept: "application/json",
      ...umamiAuthHeaders(auth),
    },
  });
  if (!res.ok) throw new Error(`Umami metrics failed: ${res.status}`);
  return await res.json();
}

function umamiAuthHeaders(auth) {
  // Umami Cloud uses API keys, not bearer tokens.
  // Self-hosted Umami commonly uses Authorization: Bearer <token>.
  if (auth && typeof auth === "object" && auth.apiKey) {
    return { "x-umami-api-key": auth.apiKey };
  }
  if (auth && typeof auth === "object" && auth.token) {
    return { authorization: `Bearer ${auth.token}` };
  }
  if (typeof auth === "string" && auth.trim()) {
    return { authorization: `Bearer ${auth}` };
  }
  return {};
}

