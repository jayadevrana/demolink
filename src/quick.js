// `demolink <port>` — zero-config public URL via a Cloudflare quick tunnel.
import { ensureCloudflared, startQuickTunnel } from './cloudflared.js';
import { log, c } from './log.js';
import { probePort, holdUntilSignal } from './util.js';

export async function quickMode({ port, host, install, printUrl }) {
  const listening = await probePort(host, port);
  if (!listening) {
    log.warn(`Nothing is listening on ${c.bold(`${host}:${port}`)} yet — start your dev server, or it may 502 until you do.`);
  }

  const bin = await ensureCloudflared({ autoInstall: install });
  log.step(`Opening a tunnel to ${c.bold(`http://${host}:${port}`)} …`);

  const { url, child } = await startQuickTunnel({ bin, port, host });

  if (printUrl) process.stdout.write(url + '\n');
  log.url(url);
  log.info(`This is a temporary URL — it changes every run. ${c.dim('Press Ctrl+C to stop.')}`);

  await holdUntilSignal(child);
}
