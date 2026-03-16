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
 *   - UMAMI_TOKEN: your Umami API token
 * - Add Variables:
 *   - UMAMI_BASE_URL: https://cloud.umami.is
 *   - UMAMI_WEBSITE_ID: your website UUID
 *   - ALLOW_ORIGIN: https://time-machine2025.github.io (optional; default "*")
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
      const base = (env.UMAMI_BASE_URL || "https://cloud.umami.is").replace(/\/+$/, "");
      const websiteId = env.UMAMI_WEBSITE_ID;
      const token = env.UMAMI_TOKEN;

      if (!websiteId || !token) {
        return withCors(
          json({ ok: false, error: "Missing UMAMI_WEBSITE_ID or UMAMI_TOKEN" }, 500),
          env,
          request.headers.get("Origin")
        );
      }

      const now = Date.now();
      const startAt7d = now - 7 * 24 * 60 * 60 * 1000;
      const startAtAll = 0;
      const endAt = now;

      const [pageviewsAll, visitorsAll, pageviews7d, visitors7d, countries7d, referrers7d] =
        await Promise.all([
          umamiMetric(base, token, websiteId, startAtAll, endAt, "pageviews"),
          umamiMetric(base, token, websiteId, startAtAll, endAt, "visitors"),
          umamiMetric(base, token, websiteId, startAt7d, endAt, "pageviews"),
          umamiMetric(base, token, websiteId, startAt7d, endAt, "visitors"),
          umamiByDimension(base, token, websiteId, startAt7d, endAt, "country", 8),
          umamiByDimension(base, token, websiteId, startAt7d, endAt, "referrer", 8),
      ]);

      const payload = {
        totals: {
          pageviews: pageviewsAll?.value ?? 0,
          visitors: visitorsAll?.value ?? 0,
        },
        last7d: {
          pageviews: pageviews7d?.value ?? 0,
          visitors: visitors7d?.value ?? 0,
          topCountries: (countries7d?.data || []).map((x) => ({ name: x.x, value: x.y })),
          topReferrers: (referrers7d?.data || []).map((x) => ({ name: x.x, value: x.y })),
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

async function umamiMetric(base, token, websiteId, startAt, endAt, type) {
  const u = new URL(`${base}/api/websites/${websiteId}/metrics`);
  u.searchParams.set("startAt", String(startAt));
  u.searchParams.set("endAt", String(endAt));
  u.searchParams.set("type", type);

  const res = await fetch(u.toString(), {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(`Umami metrics failed: ${res.status}`);
  return await res.json();
}

async function umamiByDimension(base, token, websiteId, startAt, endAt, type, limit) {
  const u = new URL(`${base}/api/websites/${websiteId}/stats`);
  u.searchParams.set("startAt", String(startAt));
  u.searchParams.set("endAt", String(endAt));
  u.searchParams.set("type", type);
  u.searchParams.set("limit", String(limit));

  const res = await fetch(u.toString(), {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(`Umami stats failed: ${res.status}`);
  return await res.json();
}

