// `demolink doctor` — environment + config diagnostics.
import { findCloudflared } from './cloudflared.js';
import { loadConfig, CONFIG_PATH } from './config.js';
import { verifyToken, getZone } from './cloudflare.js';
import { log, c } from './log.js';

export async function doctorCommand() {
  log.plain(c.bold('demolink doctor\n'));

  // Node
  log.ok(`Node ${process.version}`);

  // cloudflared
  const bin = await findCloudflared();
  if (bin) log.ok(`cloudflared found → ${c.dim(bin)}`);
  else log.warn('cloudflared not found (demolink will offer to download it on first run, or pass --install)');

  // Branded config
  const config = await loadConfig();
  if (!config.cfToken || !config.domain) {
    log.warn(`Branded mode not configured. Run ${c.bold('demolink setup')} to enable custom FreeDomain URLs.`);
    log.plain('');
    log.info('Quick mode (trycloudflare.com URLs) needs no setup — just run: demolink 3000');
    return;
  }

  log.info(`Config: ${c.dim(CONFIG_PATH)}`);
  log.info(`Domain: ${c.bold(config.domain)}`);
  try {
    await verifyToken(config.cfToken);
    log.ok('Cloudflare token is active.');
    const zone = await getZone(config.cfToken, config.domain);
    log.ok(`Zone ${c.bold(zone.name)} reachable (account ${zone.accountId.slice(0, 8)}…).`);
    log.plain('');
    log.ok('Branded mode is ready:  demolink 3000 --branded');
  } catch (err) {
    log.err(err.message);
  }
}
