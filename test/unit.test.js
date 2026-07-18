import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTarget } from '../src/util.js';
import { randomLabel, isValidLabel, isValidDomain, FREEDOMAIN_TLDS } from '../src/names.js';

test('parseTarget accepts a bare port', () => {
  assert.deepEqual(parseTarget('3000'), { host: 'localhost', port: 3000 });
});

test('parseTarget accepts host:port', () => {
  assert.deepEqual(parseTarget('127.0.0.1:8080'), { host: '127.0.0.1', port: 8080 });
});

test('parseTarget accepts a full URL', () => {
  assert.deepEqual(parseTarget('http://localhost:5173'), { host: 'localhost', port: 5173 });
});

test('parseTarget honors a fallback host', () => {
  assert.deepEqual(parseTarget('4000', '0.0.0.0'), { host: '0.0.0.0', port: 4000 });
});

test('parseTarget rejects bad ports', () => {
  assert.throws(() => parseTarget('not-a-port'));
  assert.throws(() => parseTarget('70000'));
  assert.throws(() => parseTarget('0'));
});

test('isValidLabel', () => {
  assert.ok(isValidLabel('shop'));
  assert.ok(isValidLabel('bold-otter-3147'));
  assert.ok(!isValidLabel('-bad'));
  assert.ok(!isValidLabel('bad-'));
  assert.ok(!isValidLabel('UPPER'));
  assert.ok(!isValidLabel('has space'));
});

test('isValidDomain', () => {
  assert.ok(isValidDomain('yourname.us.kg'));
  assert.ok(isValidDomain('demo.dpdns.org'));
  assert.ok(!isValidDomain('nodot'));
  assert.ok(!isValidDomain('bad_underscore.us.kg'));
});

test('randomLabel is a valid, well-formed label', () => {
  for (let i = 0; i < 200; i++) {
    const label = randomLabel();
    assert.ok(isValidLabel(label), `"${label}" should be a valid label`);
    assert.match(label, /^[a-z]+-[a-z]+-\d{4}$/);
  }
});

test('FreeDomain TLD list is present', () => {
  assert.ok(FREEDOMAIN_TLDS.includes('us.kg'));
  assert.ok(FREEDOMAIN_TLDS.includes('dpdns.org'));
});
