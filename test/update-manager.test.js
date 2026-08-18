'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { hashFile, normalizeDigest } = require('../src/core/update-manager');

test('update digest accepts GitHub SHA256 format and rejects malformed values', () => {
  const digest = 'a'.repeat(64);
  assert.equal(normalizeDigest(`sha256:${digest.toUpperCase()}`), digest);
  assert.equal(normalizeDigest(digest), digest);
  assert.equal(normalizeDigest('sha256:not-a-digest'), '');
});

test('update package hashing produces a stable SHA256 value', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-update-hash-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const filePath = path.join(root, 'package.zip');
  await fs.writeFile(filePath, 'hamster archive update');
  assert.equal(await hashFile(filePath), '4422e5fb2510e3d5c57321f0db705bc9dde2ecb2d1daff34162668109612ed1a');
});
