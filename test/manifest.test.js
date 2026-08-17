'use strict';

const assert = require('node:assert/strict');
const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildManifest } = require('../src/core/manifest');

test('manifest generation skips and records a file that becomes unreadable', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-manifest-skip-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const firstPath = path.join(root, 'a-readable.bin');
  const removedPath = path.join(root, 'z-removed.bin');
  await fs.writeFile(firstPath, Buffer.alloc(1024));
  await fs.writeFile(removedPath, Buffer.alloc(1024));
  let removed = false;
  const skipped = [];
  const manifest = await buildManifest(root, 'directory', {
    onProgress: async () => {},
    onSkippedFile: (item) => skipped.push(item)
  });

  // The deterministic hook above verifies the normal path; explicitly confirm missing files are recorded
  // by deleting between collection and hashing in a second pass.
  await fs.writeFile(removedPath, Buffer.alloc(1024));
  const secondManifest = await buildManifest(root, 'directory', {
    onProgress: () => {
      if (!removed) {
        removed = true;
        fsSync.rmSync(removedPath, { force: true });
      }
    },
    onSkippedFile: (item) => skipped.push(item)
  });
  assert.equal(manifest.length, 2);
  assert.ok(secondManifest.length >= 1);
  assert.ok(skipped.some((item) => item.path === 'z-removed.bin'));
});
