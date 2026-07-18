// `demolink setup` — one-time wizard for branded mode.
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { saveConfig, loadConfig, CONFIG_PATH } from './config.js';
import { verifyToken, getZone } from './cloudflare.js';
import { FREEDOMAIN_TLDS, FREEDOMAIN_DASHBOARD, isValidDomain } from './names.js';
import { log, c, UserError } from './log.js';

const STEPS = `
${c.bold('Branded mode — one-time setup')}

To serve a clean URL like ${c.green('bold-otter-3147.yourname.us.kg')} you need a free
domain delegated to a free Cloudflare account. Three one-time steps:

  ${c.cyan('1.')} Register a free domain at ${c.bold(FREEDOMAIN_DASHBOARD)}
       (TLDs: ${FREEDOMAIN_TLDS.join(', ')}). Sign in with GitHub, pick e.g. ${c.green('yourname.us.kg')}.

  ${c.cyan('2.')} Add that exact domain to Cloudflare (https://dash.cloudflare.com → "Add a
       domain" → Free plan). Cloudflare shows you two nameservers — copy them into
       the FreeDomain dashboard's ${c.bold('Nameserver')} fields and save. Wait until
       Cloudflare reports the domain ${c.bold('Active')} (usually minutes).

  ${c.cyan('3.')} Create a Cloudflare API token at
       ${c.bold('https://dash.cloudflare.com/profile/api-tokens')} → "Create Custom Token" with:
         • ${c.bold('Account')} → Cloudflare Tunnel → ${c.bold('Edit')}
         • ${c.bold('Zone')}    → DNS            → ${c.bold('Edit')}
         • ${c.bold('Zone')}    → Zone           → ${c.bold('Read')}
       Zone Resources: include the domain you added. Copy the token (shown once).
`;

export async function setupCommand(flags) {
  const existing = await loadConfig();

  // Non-interactive path: demolink setup --domain x --token y
  let domain = flags.domain;
  let token = flags.token || process.env.CLOUDFLARE_API_TOKEN;

  const interactive = stdin.isTTY && (!domain || !token);
  let rl;
  if (interactive) {
    log.plain(STEPS);
    rl = createInterface({ input: stdin, output: stdout });
  }

  try {
    if (!domain) {
      if (!rl) throw new UserError('Missing --domain. Example: demolink setup --domain yourname.us.kg --token <TOKEN>');
      domain = (await rl.question(`${c.cyan('?')} Your FreeDomain domain (e.g. yourname.us.kg): `)).trim();
    }
    if (!isValidDomain(domain)) {
      throw new UserError(`"${domain}" doesn't look like a valid domain.`);
    }

    if (!token) {
      if (!rl) throw new UserError('Missing --token (or set CLOUDFLARE_API_TOKEN).');
      token = (await rl.question(`${c.cyan('?')} Cloudflare API token: `)).trim();
    }
    if (!token) throw new UserError('No token provided.');

    log.step('Verifying token and locating the zone…');
    await verifyToken(token);
    const zone = await getZone(token, domain);
    log.ok(`Token works and zone ${c.bold(zone.name)} is reachable.`);

    await saveConfig({
      ...existing,
      domain,
      cfToken: token,
      tunnelName: existing.tunnelName || 'demolink',
    });

    log.ok(`Saved config → ${c.dim(CONFIG_PATH)} (chmod 600)`);
    log.plain('');
    log.info(`You're ready. Try:  ${c.bold('demolink 3000 --branded')}`);
  } finally {
    if (rl) rl.close();
  }
}
