// Minimal zero-dependency logger with ANSI colors.
// Honors NO_COLOR (https://no-color.org) and non-TTY stderr.

const useColor = process.stderr.isTTY && !process.env.NO_COLOR;

const wrap = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export const c = {
  bold: wrap('1'),
  dim: wrap('2'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  magenta: wrap('35'),
  cyan: wrap('36'),
  gray: wrap('90'),
};

// All status output goes to stderr so that stdout can stay clean for the URL,
// making `demolink 3000 --print-url` pipe-friendly.
const out = (s) => process.stderr.write(s + '\n');

export const log = {
  info: (msg) => out(`${c.blue('›')} ${msg}`),
  step: (msg) => out(`${c.cyan('→')} ${msg}`),
  ok: (msg) => out(`${c.green('✔')} ${msg}`),
  warn: (msg) => out(`${c.yellow('!')} ${msg}`),
  err: (msg) => out(`${c.red('✖')} ${msg}`),
  plain: (msg = '') => out(msg),
  // A boxed, hard-to-miss banner for the final public URL.
  url: (url, label = 'Your site is live at') => {
    const line = `  ${label}:  ${c.bold(c.green(url))}  `;
    const width = stripAnsi(line).length;
    const bar = '─'.repeat(width);
    out('');
    out(c.gray(`┌${bar}┐`));
    out(`${c.gray('│')}${line}${c.gray('│')}`);
    out(c.gray(`└${bar}┘`));
    out('');
  },
};

function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

export class UserError extends Error {}
