// Locate, optionally auto-install, and run the `cloudflared` binary.
import { spawn, execFile } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { access, mkdir, chmod, readdir } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, platform, arch } from 'node:os';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { BIN_DIR } from './config.js';
import { log, c, UserError } from './log.js';

const execFileAsync = promisify(execFile);

const TRYCLOUDFLARE_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
const EXE = platform() === 'win32' ? '.exe' : '';

/** Return an absolute path to a working cloudflared, or null if none found. */
export async function findCloudflared() {
  // 1) Our own cached copy.
  const cached = join(BIN_DIR, `cloudflared${EXE}`);
  if (await isExecutable(cached)) return cached;

  // 2) Anything on PATH.
  const dirs = (process.env.PATH || '').split(platform() === 'win32' ? ';' : ':');
  for (const dir of dirs) {
    if (!dir) continue;
    const candidate = join(dir, `cloudflared${EXE}`);
    if (await isExecutable(candidate)) return candidate;
  }
  return null;
}

async function isExecutable(p) {
  try {
    await access(p, FS.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure cloudflared is available. If missing and `autoInstall` is true,
 * download the right release binary into ~/.demolink/bin. Otherwise throw
 * a UserError with per-OS install hints.
 */
export async function ensureCloudflared({ autoInstall = true } = {}) {
  const found = await findCloudflared();
  if (found) return found;

  if (!autoInstall) throw notInstalledError();

  log.step('cloudflared not found — downloading it (one time)…');
  const bin = await downloadCloudflared();
  log.ok(`Installed cloudflared → ${c.dim(bin)}`);
  return bin;
}

function notInstalledError() {
  const hints = {
    darwin: 'brew install cloudflared',
    linux: 'See https://pkg.cloudflare.com/ (apt/yum) or run `demolink doctor`',
    win32: 'winget install --id Cloudflare.cloudflared',
  };
  const hint = hints[platform()] || 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/';
  return new UserError(
    `cloudflared is required but was not found.\n  Install it with:  ${hint}\n  Or re-run with --install to let demolink download it.`,
  );
}

function assetName() {
  const a = arch(); // 'x64' | 'arm64' | ...
  const goArch = a === 'x64' ? 'amd64' : a === 'arm64' ? 'arm64' : a === 'arm' ? 'arm' : null;
  if (!goArch) throw new UserError(`Unsupported CPU architecture for auto-install: ${a}`);
  switch (platform()) {
    case 'darwin':
      return { file: `cloudflared-darwin-${goArch}.tgz`, archive: 'tgz' };
    case 'linux':
      return { file: `cloudflared-linux-${goArch}`, archive: 'raw' };
    case 'win32':
      return { file: `cloudflared-windows-${goArch}.exe`, archive: 'raw' };
    default:
      throw new UserError(`Unsupported platform for auto-install: ${platform()}`);
  }
}

async function downloadCloudflared() {
  const { file, archive } = assetName();
  const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/${file}`;
  await mkdir(BIN_DIR, { recursive: true });
  const dest = join(BIN_DIR, `cloudflared${EXE}`);

  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new UserError(`Failed to download cloudflared (${res.status}). Install it manually instead.`);
  }

  if (archive === 'tgz') {
    // macOS ships a .tgz containing the `cloudflared` binary; extract via tar.
    const tmp = join(tmpdir(), file);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
    await execFileAsync('tar', ['-xzf', tmp, '-C', BIN_DIR]);
    // The archive may extract as `cloudflared`; make sure it is where we expect.
    const entries = await readdir(BIN_DIR);
    if (!entries.includes('cloudflared')) {
      throw new UserError('cloudflared archive did not contain the expected binary.');
    }
  } else {
    await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  }

  await chmod(dest, 0o755).catch(() => {});
  return dest;
}

/**
 * Start a Cloudflare *quick tunnel* (no account needed) and resolve with the
 * public https://*.trycloudflare.com URL once cloudflared prints it.
 *
 * Returns { url, child } so the caller can keep the process alive and kill it.
 */
export function startQuickTunnel({ bin, port, host = 'localhost', timeoutMs = 30000 }) {
  const target = `http://${host}:${port}`;
  const child = spawn(
    bin,
    ['tunnel', '--no-autoupdate', '--url', target],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new UserError('Timed out waiting for cloudflared to assign a URL.'));
    }, timeoutMs);

    const scan = (buf) => {
      const text = buf.toString();
      if (process.env.DEMOLINK_DEBUG) process.stderr.write(c.dim(text));
      const m = text.match(TRYCLOUDFLARE_RE);
      if (m && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ url: m[0], child });
      }
    };

    child.stdout.on('data', scan);
    child.stderr.on('data', scan);

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new UserError(`Could not start cloudflared: ${err.message}`));
    });
    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new UserError(`cloudflared exited early (code ${code}). Run with DEMOLINK_DEBUG=1 for details.`));
    });
  });
}

/**
 * Run a pre-created *named* tunnel using its connector token. Used by branded
 * mode after the DNS route has been configured via the Cloudflare API.
 */
export function runNamedTunnel({ bin, token }) {
  const child = spawn(
    bin,
    ['tunnel', '--no-autoupdate', 'run', '--token', token],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  if (process.env.DEMOLINK_DEBUG) {
    child.stdout.on('data', (b) => process.stderr.write(c.dim(b.toString())));
    child.stderr.on('data', (b) => process.stderr.write(c.dim(b.toString())));
  }
  return child;
}
