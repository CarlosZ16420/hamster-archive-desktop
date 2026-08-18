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

test('update metadata exposes a matching Windows asset for installation', async () => {
  const result = await checkForUpdates({
    currentVersion: '4.0.0',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: 'v4.0.1',
        html_url: 'https://example.test/release',
        assets: [{
          name: 'HamsterArchive-v4.0.1-win-x64.zip',
          browser_download_url: 'https://github.com/CarlosZ16420/hamster-archiver/releases/download/v4.0.1/HamsterArchive-v4.0.1-win-x64.zip',
          size: 123,
          digest: 'sha256:' + 'a'.repeat(64)
        }]
      })
    })
  });
  assert.equal(result.installable, true);
  assert.equal(result.asset.name, 'HamsterArchive-v4.0.1-win-x64.zip');
  assert.equal(result.asset.size, 123);
});
