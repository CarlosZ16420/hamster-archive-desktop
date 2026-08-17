'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { checkForUpdates, compareVersions } = require('../src/core/update-checker');

test('semantic versions are compared numerically', () => {
  assert.equal(compareVersions('2.0.0', '1.11.9'), 1);
  assert.equal(compareVersions('v2.0.0', '2.0.0'), 0);
  assert.equal(compareVersions('1.9.9', '2.0.0'), -1);
});

test('manual update check reports a newer GitHub release', async () => {
  const result = await checkForUpdates({
    currentVersion: '1.1.7',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ tag_name: 'v2.0.0', html_url: 'https://example.test/release' })
    })
  });
  assert.equal(result.updateAvailable, true);
  assert.equal(result.latestVersion, '2.0.0');
});
