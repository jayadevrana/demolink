// Argument parsing + command dispatch for `demolink`.
import { readFile } from 'node:fs/promises';
import { quickMode } from './quick.js';
import { brandedMode } from './branded.js';
import { setupCommand } from './setup.js';
import { doctorCommand } from './doctor.js';
import { parseTarget } from './util.js';
import { log, c, UserError } from './log.js';

const VALUE_FLAGS = new Set(['host', 'name', 'domain', 'token', 'tld']);

function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (key.startsWith('no-')) {
        flags[key.slice(3)] = false;
      } else if (VALUE_FLAGS.has(key)) {
        flags[key] = argv[++i];
      } else {
        flags[key] = true;
      }
    } else if (a.startsWith('-') && a.length > 1 && !/^-\d/.test(a)) {
      for (const ch of a.slice(1)) {
        if (ch === 'b') flags.branded = true;
        else if (ch === 'h') flags.help = true;
        else if (ch === 'v') flags.version = true;
        else flags[ch] = true;
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

async function version() {
  const url = new URL('../package.json', import.meta.url);
  const pkg = JSON.parse(await readFile(url, 'utf8'));
  return pkg.version;
}

function printHelp() {
  log.plain(`
${c.bold('demolink')} — publish your localhost to a public URL in one command.

${c.bold('USAGE')}
  demolink <port>                 Quick public URL (zero setup)
  demolink publish <port>         Same as above
  demolink <port> --branded       Clean URL on your FreeDomain (needs setup)
  demolink setup                  One-time branded-mode wizard
  demolink doctor                 Check your environment & config

${c.bold('EXAMPLES')}
  demolink 3000                   → https://random-words.trycloudflare.com
  demolink localhost:8080         → tunnel to a non-default host:port
  demolink 3000 -b                → https://bold-otter-3147.yourname.us.kg
  demolink 3000 -b --name shop    → https://shop.yourname.us.kg

${c.bold('OPTIONS')}
  -b, --branded     Use your FreeDomain + Cloudflare instead of trycloudflare.com
      --host <h>    Local host to tunnel to (default: localhost)
      --name <s>    Branded mode: fixed subdomain label instead of a random one
      --keep-dns    Branded mode: don't delete the DNS record on exit
      --no-install  Don't auto-download cloudflared if it's missing
      --print-url   Print only the public URL to stdout (script-friendly)
  -h, --help        Show this help
  -v, --version     Show version

${c.dim('Quick mode uses Cloudflare quick tunnels (temporary). Branded mode uses a free')}
${c.dim('DigitalPlat FreeDomain (dpdns.org, us.kg, …) delegated to a free Cloudflare account.')}
`);
}

async function runTunnel(target, flags) {
  if (target === undefined) {
    throw new UserError('Which port? Try:  demolink 3000');
  }
  const parsed = parseTarget(target, flags.host || 'localhost');
  const host = flags.host || parsed.host;
  const opts = {
    port: parsed.port,
    host,
    install: flags.install !== false,
    printUrl: !!flags['print-url'],
  };
  if (flags.branded) {
    return brandedMode({ ...opts, name: flags.name, keepDns: !!flags['keep-dns'] });
  }
  return quickMode(opts);
}

export async function main(argv) {
  const { positionals, flags } = parseArgs(argv);

  if (flags.help) return printHelp();
  if (flags.version) return void log.plain(await version());

  const [first, second] = positionals;

  switch (first) {
    case undefined:
      return printHelp();
    case 'help':
      return printHelp();
    case 'version':
      return void log.plain(await version());
    case 'setup':
      return setupCommand(flags);
    case 'doctor':
      return doctorCommand();
    case 'publish':
    case 'run':
    case 'share':
      return runTunnel(second, flags);
    default:
      // Treat the first positional as a port/target: `demolink 3000`.
      return runTunnel(first, flags);
  }
}
