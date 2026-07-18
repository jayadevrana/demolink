// Thin Cloudflare API v4 client — only the endpoints branded mode needs.
import { UserError } from './log.js';

const BASE = 'https://api.cloudflare.com/client/v4';

async function cf(token, path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new UserError(`Network error talking to Cloudflare: ${err.message}`);
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new UserError(`Cloudflare returned a non-JSON response (HTTP ${res.status}).`);
  }

  if (!json.success) {
    const detail = (json.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`;
    throw new UserError(`Cloudflare API error — ${detail}`);
  }
  return json.result;
}

/** Confirm the API token is valid and active. */
export async function verifyToken(token) {
  const result = await cf(token, '/user/tokens/verify');
  if (result.status !== 'active') {
    throw new UserError(`Cloudflare token is not active (status: ${result.status}).`);
  }
  return true;
}

/** Look up the zone (the domain you added to Cloudflare, e.g. "myname.us.kg"). */
export async function getZone(token, domain) {
  const result = await cf(token, `/zones?name=${encodeURIComponent(domain)}`);
  if (!result.length) {
    throw new UserError(
      `Zone "${domain}" not found in this Cloudflare account.\n` +
        `  Add it at https://dash.cloudflare.com (Add a site → Free plan), then point\n` +
        `  your FreeDomain nameservers at the two NS Cloudflare gives you.`,
    );
  }
  return { id: result[0].id, accountId: result[0].account.id, name: result[0].name };
}

/** Find an existing named tunnel by name, or create one. Returns its id. */
export async function ensureTunnel(token, accountId, name) {
  const existing = await cf(
    token,
    `/accounts/${accountId}/cfd_tunnel?name=${encodeURIComponent(name)}&is_deleted=false`,
  );
  if (existing.length) return existing[0].id;

  const created = await cf(token, `/accounts/${accountId}/cfd_tunnel`, {
    method: 'POST',
    body: { name, config_src: 'cloudflare' },
  });
  return created.id;
}

/** Fetch the connector token used by `cloudflared tunnel run --token`. */
export async function getTunnelToken(token, accountId, tunnelId) {
  // This endpoint returns the token string directly as `result`.
  return cf(token, `/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`);
}

/** Replace the tunnel's ingress rules so `hostname` → local service. */
export async function setTunnelIngress(token, accountId, tunnelId, hostname, service) {
  return cf(token, `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, {
    method: 'PUT',
    body: {
      config: {
        ingress: [
          { hostname, service },
          { service: 'http_status:404' },
        ],
      },
    },
  });
}

/** Create (or update) a proxied CNAME record pointing the hostname at the tunnel. */
export async function upsertTunnelCname(token, zoneId, hostname, tunnelId) {
  const content = `${tunnelId}.cfargotunnel.com`;
  const existing = await cf(
    token,
    `/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(hostname)}`,
  );
  const record = { type: 'CNAME', name: hostname, content, proxied: true, ttl: 1 };
  if (existing.length) {
    return cf(token, `/zones/${zoneId}/dns_records/${existing[0].id}`, { method: 'PUT', body: record });
  }
  return cf(token, `/zones/${zoneId}/dns_records`, { method: 'POST', body: record });
}

/** Remove the DNS record for a hostname (used on cleanup). */
export async function deleteDnsRecord(token, zoneId, hostname) {
  const existing = await cf(
    token,
    `/zones/${zoneId}/dns_records?name=${encodeURIComponent(hostname)}`,
  );
  for (const rec of existing) {
    await cf(token, `/zones/${zoneId}/dns_records/${rec.id}`, { method: 'DELETE' });
  }
  return existing.length;
}
