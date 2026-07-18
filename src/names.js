// Random, human-friendly subdomain label generator + FreeDomain TLD metadata.
import { randomInt } from 'node:crypto';

// The free TLDs offered by DigitalPlat FreeDomain.
// https://github.com/DigitalPlatDev/FreeDomain
export const FREEDOMAIN_TLDS = ['dpdns.org', 'us.kg', 'qzz.io', 'xx.kg', 'qd.je'];

export const FREEDOMAIN_DASHBOARD = 'https://dash.domain.digitalplat.org/';

const ADJECTIVES = [
  'amber', 'azure', 'bold', 'brave', 'brisk', 'calm', 'clever', 'cosmic',
  'crimson', 'dapper', 'eager', 'fancy', 'feisty', 'gentle', 'golden', 'happy',
  'jolly', 'keen', 'lively', 'lucky', 'mellow', 'merry', 'mighty', 'nimble',
  'noble', 'plucky', 'proud', 'quiet', 'rapid', 'royal', 'shiny', 'silent',
  'snappy', 'spry', 'stellar', 'sunny', 'swift', 'tidy', 'vivid', 'witty',
];

const NOUNS = [
  'otter', 'falcon', 'maple', 'comet', 'lynx', 'heron', 'pixel', 'quartz',
  'willow', 'cedar', 'panda', 'koala', 'raven', 'finch', 'bison', 'gecko',
  'walrus', 'badger', 'marmot', 'puffin', 'turtle', 'sparrow', 'beacon', 'harbor',
  'meadow', 'canyon', 'summit', 'ember', 'pebble', 'cobble', 'nimbus', 'mango',
  'cocoa', 'ginger', 'pepper', 'biscuit', 'noodle', 'waffle', 'pretzel', 'donut',
];

const pick = (arr) => arr[randomInt(arr.length)];

/**
 * Generate a random label like "bold-otter-3147".
 * Collision odds are tiny (40*40*9000 ≈ 14.4M combos); branded mode also
 * re-rolls on the rare DNS conflict.
 */
export function randomLabel() {
  const n = String(randomInt(1000, 10000));
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${n}`;
}

const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** Validate a single DNS label (the leftmost part of a hostname). */
export function isValidLabel(label) {
  return typeof label === 'string' && LABEL_RE.test(label);
}

/** Validate an apex domain like "myname.us.kg". */
export function isValidDomain(domain) {
  if (typeof domain !== 'string' || domain.length > 253) return false;
  const parts = domain.split('.');
  if (parts.length < 2) return false;
  return parts.every((p) => isValidLabel(p));
}
