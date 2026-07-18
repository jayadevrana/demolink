// Persistent config for branded mode, stored at ~/.demolink/config.json.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';

export const CONFIG_DIR = join(homedir(), '.demolink');
export const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
export const BIN_DIR = join(CONFIG_DIR, 'bin');

export async function loadConfig() {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

export async function saveConfig(config) {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
  // The file holds a Cloudflare API token — keep it owner-only.
  try {
    await chmod(CONFIG_PATH, 0o600);
  } catch {
    // chmod is best-effort (e.g. Windows); ignore failures.
  }
}

export async function updateConfig(patch) {
  const current = await loadConfig();
  const next = { ...current, ...patch };
  await saveConfig(next);
  return next;
}
