// Small shared helpers.
import net from 'node:net';
import { log, c } from './log.js';

/** Resolve true if something is accepting TCP connections on host:port. */
export function probePort(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

/**
 * Keep the process alive until the user hits Ctrl+C (or the tunnel child dies).
 * Runs `onShutdown` once on the way out, then kills the child.
 */
export function holdUntilSignal(child, onShutdown) {
  return new Promise((resolve) => {
    let shuttingDown = false;

    const shutdown = async (reason) => {
      if (shuttingDown) return;
      shuttingDown = true;
      if (reason) log.plain('');
      log.step('Shutting down…');
      try {
        if (onShutdown) await onShutdown();
      } catch (err) {
        log.warn(`Cleanup issue: ${err.message}`);
      }
      if (child && !child.killed) child.kill();
      resolve();
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));

    if (child) {
      child.once('exit', (code) => {
        if (shuttingDown) return;
        log.warn(`Tunnel process exited (code ${code}).`);
        shutdown();
      });
    }
  });
}

/** Parse "[host:]port" / "localhost:3000" / "3000" into { host, port }. */
export function parseTarget(input, fallbackHost = 'localhost') {
  let host = fallbackHost;
  let portStr = String(input).trim();

  // Allow full URLs like http://localhost:3000
  const urlMatch = portStr.match(/^https?:\/\/([^/]+)/i);
  if (urlMatch) portStr = urlMatch[1];

  if (portStr.includes(':')) {
    const idx = portStr.lastIndexOf(':');
    host = portStr.slice(0, idx) || fallbackHost;
    portStr = portStr.slice(idx + 1);
  }

  const port = Number(portStr);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${c.bold(String(input))}. Expected something like 3000 or localhost:3000.`);
  }
  return { host, port };
}
