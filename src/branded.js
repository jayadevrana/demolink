// `demolink <port> --branded` — clean URL on your FreeDomain via a Cloudflare
// named tunnel. Requires a one-time `demolink setup`.
import { loadConfig } from './config.js';
import {
  verifyToken,
  getZone,
  ensureTunnel,
  getTunnelToken,
  setTunnelIngress,
  upsertTunnelCname,
  deleteDnsRecord,
} from './cloudflare.js';
import { ensureCloudflared, runNamedTunnel } from './cloudflared.js';
import { randomLabel, isValidLabel, isValidDomain } from './names.js';
import { log, c, UserError } from './log.js';
import { probePort, holdUntilSignal } from './util.js';

export async function brandedMode({ port, host, install, printUrl, name, keepDns }) {
  const config = await loadConfig();
  if (!config.cfToken || !config.domain) {
    throw new UserError('Branded mode is not set up yet. Run:  demolink setup');
  }
  if (!isValidDomain(config.domain)) {
    throw new UserError(`Configured domain "${config.domain}" looks invalid. Re-run: demolink setup`);
  }

  const label = name ?? randomLabel();
  if (!isValidLabel(label)) {
    throw new UserError(`Invalid subdomain "${label}". Use letters, digits and hyphens only.`);
  }
  const hostname = `${label}.${config.domain}`;
  const tunnelName = config.tunnelName || 'demolink';

  const listening = await probePort(host, port);
  if (!listening) {
    log.warn(`Nothing is listening on ${c.bold(`${host}:${port}`)} yet — start your dev server, or it may 502 until you do.`);
  }

  log.step('Verifying Cloudflare credentials…');
  await verifyToken(config.cfToken);
  const zone = await getZone(config.cfToken, config.domain);

  log.step(`Preparing tunnel ${c.bold(tunnelName)} …`);
  const tunnelId = await ensureTunnel(config.cfToken, zone.accountId, tunnelName);
  const connectorToken = await getTunnelToken(config.cfToken, zone.accountId, tunnelId);

  log.step(`Routing ${c.bold(hostname)} → ${c.bold(`http://${host}:${port}`)} …`);
  await setTunnelIngress(config.cfToken, zone.accountId, tunnelId, hostname, `http://${host}:${port}`);
  await upsertTunnelCname(config.cfToken, zone.id, hostname, tunnelId);

  const bin = await ensureCloudflared({ autoInstall: install });
  log.step('Starting tunnel connector…');
  const child = runNamedTunnel({ bin, token: connectorToken });

  const url = `https://${hostname}`;
  if (printUrl) process.stdout.write(url + '\n');
  log.url(url);
  log.info(`Branded demo on your FreeDomain. ${c.dim('Press Ctrl+C to stop.')}`);
  if (!keepDns) log.info(c.dim('The DNS record is removed on exit (pass --keep-dns to keep it).'));

  await holdUntilSignal(child, async () => {
    if (keepDns) return;
    try {
      await deleteDnsRecord(config.cfToken, zone.id, hostname);
      log.ok(`Removed DNS record for ${hostname}`);
    } catch (err) {
      log.warn(`Could not remove DNS record (${err.message}). Delete it from the Cloudflare dashboard if needed.`);
    }
  });
}
