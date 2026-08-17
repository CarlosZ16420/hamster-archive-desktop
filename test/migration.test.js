'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { AppStore } = require('../src/core/store');
const { migrate } = require('../scripts/migrate-saves-to-sqlite');

test('standalone migration retains JSON and normalizes archive locations', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-migration-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const saves = path.join(root, 'saves');
  const output = path.join(root, 'nuts');
  await fs.mkdir(path.join(saves, 'pending-manifests'), { recursive: true });
  await fs.mkdir(path.join(output, 'archives', 'old-folder'), { recursive: true });
  const catalog = [{
    id: 'old-record', title: '旧记录', displayName: '旧记录', recordType: 'archive',
    archiveFolder: 'old-folder', archiveFiles: [{ name: 'old.7z', size: 3 }],
    tags: ['旧标签'], manifest: [{ relativePath: 'a.txt', name: 'a.txt', size: 3, md5: 'abc' }]
  }];
  await fs.writeFile(path.join(saves, 'catalog.json'), JSON.stringify(catalog));
  await fs.writeFile(path.join(saves, 'jobs.json'), JSON.stringify([{
    id: 'job', status: 'awaiting_anomaly_confirmation', pendingCatalogRecord: catalog[0]
  }]));
  await fs.writeFile(path.join(saves, 'pending-manifests', 'job.json'), JSON.stringify(catalog[0].manifest));

  const result = await migrate({ saves, archiveOutput: output });
  assert.equal(result.catalogRecords, 1);
  await fs.access(path.join(saves, 'catalog.json'));
  await fs.access(path.join(saves, 'warehouse.sqlite'));
  const store = new AppStore(path.join(root, 'user-data'));
  const [converted] = await store.loadCatalog(saves);
  assert.equal(converted.archiveDirectory, path.join(output, 'archives', 'old-folder'));
  assert.equal('archiveFolder' in converted, false);
  const [convertedJob] = await store.loadJobs(saves);
  assert.equal(convertedJob.pendingCatalogRecord.archiveDirectory, path.join(output, 'archives', 'old-folder'));
  assert.equal('archiveFolder' in convertedJob.pendingCatalogRecord, false);
  assert.deepEqual(await store.loadPendingManifest(saves, 'job'), catalog[0].manifest);
  store.closeAll();
});
