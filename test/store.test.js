'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { AppStore, readJson, writeJsonAtomic } = require('../src/core/store');
const { makeUserDataLayout } = require('../src/core/storage-paths');

test('JSON state can be atomically created and replaced', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-store-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const filePath = path.join(root, 'nested', 'state.json');

  await writeJsonAtomic(filePath, { value: 1 });
  assert.deepEqual(await readJson(filePath, null), { value: 1 });
  await writeJsonAtomic(filePath, { value: 2 });
  assert.deepEqual(await readJson(filePath, null), { value: 2 });
});

test('SQLite repository persists catalog, jobs and pending manifests incrementally', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-sqlite-store-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const repositoryDirectory = path.join(root, 'saves');
  const store = new AppStore(path.join(root, 'user-data'));
  const record = {
    id: 'record-one', title: '测试库存', displayName: '测试库存', rating: 4,
    tags: ['视频', '旅行'], inventoryDate: '2026-08-15T10:30:00.000Z',
    manifest: [{ relativePath: 'movie.mp4', name: 'movie.mp4', size: 123, md5: 'abc', mediaType: 'video' }]
  };
  const job = { id: 'job-one', displayName: '测试任务', sourcePath: 'E:\\input', status: 'queued' };

  await store.saveCatalog(repositoryDirectory, [record]);
  await store.saveJobs(repositoryDirectory, [job]);
  await store.savePendingManifest(repositoryDirectory, job.id, record.manifest);
  assert.deepEqual(await store.loadCatalog(repositoryDirectory), [record]);
  assert.deepEqual(await store.loadJobs(repositoryDirectory), [job]);
  assert.deepEqual(await store.loadPendingManifest(repositoryDirectory, job.id), record.manifest);
  assert.equal(await store.verifyRepository(repositoryDirectory), true);
  assert.deepEqual(store.findCatalogIdsBySearchTerms(repositoryDirectory, ['char:测']), ['record-one']);
  assert.deepEqual(store.findCatalogIdsByExactName(repositoryDirectory, '测试库存'), ['record-one']);
  assert.equal(store.findExactFileMatches(repositoryDirectory, record.manifest)[0].previous[0].archiveId, 'record-one');

  await store.saveCatalog(repositoryDirectory, [{ ...record, notes: '只更新这一条' }]);
  assert.equal((await store.loadCatalog(repositoryDirectory))[0].notes, '只更新这一条');
  const second = { ...record, id: 'record-two', title: '第二条', displayName: '第二条', manifest: [] };
  await store.saveCatalog(repositoryDirectory, [{ ...record, notes: '保留' }, second]);
  await store.saveCatalogRecords(repositoryDirectory, [{ ...second, backupLocation: '移动硬盘 B' }], [{ ...record, notes: '保留' }, second]);
  const afterSubsetUpdate = await store.loadCatalog(repositoryDirectory);
  assert.equal(afterSubsetUpdate.length, 2);
  assert.equal(afterSubsetUpdate.find((item) => item.id === 'record-one').notes, '保留');
  assert.equal(afterSubsetUpdate.find((item) => item.id === 'record-two').backupLocation, '移动硬盘 B');
  await store.deletePendingManifest(repositoryDirectory, job.id);
  assert.equal(await store.loadPendingManifest(repositoryDirectory, job.id), null);
  store.closeAll();
});

test('user data layout keeps settings, warehouse and one log under one root', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-user-data-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const layout = makeUserDataLayout(root);
  assert.equal(layout.root, path.join(root, 'userdata'));
  assert.equal(layout.processedSourceDirectory, path.join(root, 'userdata', 'processed'));
  const store = new AppStore(layout);
  await store.saveSettings({ archivePassword: '' });
  await store.appendLog(path.join(root, 'first-warehouse'), { message: 'first' });
  await store.appendLog(path.join(root, 'second-warehouse'), { message: 'second' });

  assert.equal(layout.settingsPath.startsWith(layout.root), true);
  assert.equal(layout.repositoryDirectory.startsWith(layout.root), true);
  assert.deepEqual(await readJson(layout.settingsPath, null), { archivePassword: '' });
  const lines = (await fs.readFile(layout.logPath, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 2);
  assert.equal((await fs.readdir(path.join(root, 'first-warehouse')).catch(() => [])).length, 0);
});
