'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const test = require('node:test');
const { QueueManager } = require('../src/core/queue-manager');
const { CancelledError } = require('../src/core/archive-engine');
const { AppStore } = require('../src/core/store');

class FakeStore {
  async loadJobs() { return []; }
  async loadCatalog() { return []; }
  async saveJobs(_library, jobs) { this.jobs = structuredClone(jobs); }
  async saveCatalog() {}
  async saveSettings() {}
  async appendLog() {}
  async loadPendingManifest() { return null; }
  async savePendingManifest() {}
  async deletePendingManifest() {}
}

function queuedJob(id) {
  return {
    id,
    sourcePath: `E:\\source\\${id}`,
    sourceType: 'directory',
    displayName: id,
    fileCount: 1,
    totalBytes: 1,
    status: 'queued',
    progress: 0,
    archiveBaseName: `${id}.7z`
  };
}

function blockingRunner(calls, started) {
  return async (job, _config, _hooks, signal) => {
    calls.push(job.id);
    started();
    await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
    throw new CancelledError();
  };
}

test('shutdown cancels current job and does not start the next queued job', async () => {
  let signalStarted;
  const started = new Promise((resolve) => { signalStarted = resolve; });
  const calls = [];
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' }, {
    archiveRunner: blockingRunner(calls, signalStarted)
  });
  manager.jobs = [queuedJob('first'), queuedJob('second')];

  const running = manager.startQueue();
  await started;
  await manager.stopForShutdown();
  await running;

  assert.deepEqual(calls, ['first']);
  assert.equal(manager.jobs[0].status, 'cancelled');
  assert.equal(manager.jobs[1].status, 'queued');
  assert.equal(manager.running, false);
});

test('clear queue stops current work and removes every task', async () => {
  let signalStarted;
  const started = new Promise((resolve) => { signalStarted = resolve; });
  const calls = [];
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' }, {
    archiveRunner: blockingRunner(calls, signalStarted)
  });
  manager.jobs = [queuedJob('first'), queuedJob('second')];

  const running = manager.startQueue();
  await started;
  await manager.clearQueue();
  await running;

  assert.deepEqual(calls, ['first']);
  assert.deepEqual(manager.jobs, []);
  assert.equal(manager.running, false);
});

test('completed tasks can be cleared without touching active or failed tasks', async () => {
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' });
  manager.jobs = [
    { ...queuedJob('done'), status: 'completed' },
    { ...queuedJob('cleanup-warning'), status: 'completed_cleanup_failed' },
    { ...queuedJob('failed'), status: 'failed' }
  ];
  const result = await manager.clearCompletedJobs();
  assert.equal(result.removedCount, 2);
  assert.deepEqual(manager.jobs.map((job) => job.id), ['failed']);
});

test('possible duplicate tasks can be cleared with one action', async () => {
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' });
  manager.jobs = [
    { ...queuedJob('duplicate'), nameDuplicateMatches: [{ archiveId: 'old' }] },
    { ...queuedJob('unique'), nameDuplicateMatches: [] }
  ];
  const result = await manager.removePotentialDuplicateJobs();
  assert.equal(result.removedCount, 1);
  assert.deepEqual(manager.jobs.map((job) => job.id), ['unique']);
});

test('all duplicate and similar confirmations can be accepted in one action', async () => {
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' });
  manager.jobs = [
    { ...queuedJob('similar'), status: 'awaiting_confirmation', confirmationReasons: ['similar_title'] },
    { ...queuedJob('exact'), status: 'awaiting_duplicate_confirmation', confirmationReasons: [] },
    { ...queuedJob('unique'), status: 'queued', confirmationReasons: [] }
  ];
  const result = await manager.confirmAllDuplicateJobs();
  assert.equal(result.confirmedCount, 2);
  assert.ok(manager.jobs[0].duplicateConfirmedAt);
  assert.ok(manager.jobs[1].duplicateConfirmedAt);
  assert.equal(manager.jobs[2].duplicateConfirmedAt, undefined);
});

test('each queued task keeps the password that was active when it was added', async () => {
  const manager = new QueueManager(new FakeStore(), {
    libraryDir: 'E:\\library',
    archivePassword: 'first-password'
  });
  const job = manager.createJob({
    sourcePath: 'E:\\source\\one',
    sourceType: 'directory',
    displayName: 'one',
    fileCount: 1,
    totalBytes: 1
  });
  await manager.updateConfig({ archivePassword: 'second-password' });
  manager.jobs = [job];

  assert.equal(job.archivePassword, 'first-password');
  assert.equal(manager.config.archivePassword, 'second-password');
  assert.equal(Object.hasOwn(manager.getState().jobs[0], 'archivePassword'), false);
  assert.equal(manager.getState().jobs[0].hasPassword, true);
});

test('completed archives remember their task password without exposing it in warehouse summaries', async () => {
  let runnerPassword = null;
  const manager = new QueueManager(new FakeStore(), {
    libraryDir: 'E:\\library',
    archivePassword: 'per-task-secret'
  }, {
    archiveRunner: async (_job, config) => {
      runnerPassword = config.archivePassword;
      return {
        archiveFiles: [{ name: 'one.7z', size: 1 }],
        archiveTotalBytes: 1,
        manifest: [{ relativePath: 'one.bin', name: 'one.bin', size: 1, md5: 'abc' }],
        directories: [],
        passwordScheme: 'configured-v1',
        hasPassword: true,
        verifiedAt: new Date().toISOString()
      };
    }
  });
  manager.jobs = [{ ...queuedJob('password-job'), archivePassword: 'per-task-secret', hasPassword: true }];
  await manager.startQueue();

  assert.equal(runnerPassword, 'per-task-secret');
  assert.equal(manager.getCatalogDetails(manager.catalog[0].id).archivePassword, 'per-task-secret');
  assert.equal(Object.hasOwn(manager.getState().catalog[0], 'archivePassword'), false);
  assert.equal(manager.getState().catalog[0].hasPassword, true);
});

test('password recording can be disabled without changing the password used for compression', async () => {
  let runnerPassword = null;
  const manager = new QueueManager(new FakeStore(), {
    libraryDir: 'E:\\library',
    archivePassword: 'compression-only',
    recordArchivePassword: false
  }, {
    archiveRunner: async (_job, config) => {
      runnerPassword = config.archivePassword;
      return {
        archiveFiles: [{ name: 'private.7z', size: 1 }], archiveTotalBytes: 1,
        manifest: [{ relativePath: 'one.bin', name: 'one.bin', size: 1, md5: 'abc' }],
        directories: [], passwordScheme: 'configured-v1', hasPassword: true,
        verifiedAt: new Date().toISOString()
      };
    }
  });
  manager.jobs = [{
    ...queuedJob('unrecorded-password'),
    archivePassword: 'compression-only',
    recordArchivePassword: false
  }];
  await manager.startQueue();
  const record = manager.catalog[0];
  assert.equal(runnerPassword, 'compression-only');
  assert.equal(record.hasPassword, true);
  assert.equal(record.passwordRecorded, false);
  assert.equal(record.archivePassword, '');
});

test('legacy-shaped records are never backfilled from the current global password', async () => {
  const store = new FakeStore();
  store.loadCatalog = async () => [{
    id: 'legacy-record',
    recordType: 'archive',
    title: '旧记录',
    displayName: '旧记录',
    passwordScheme: 'configured-v1',
    tags: [],
    manifest: [],
    directories: []
  }];
  const manager = new QueueManager(store, {
    libraryDir: 'E:\\library',
    archivePassword: 'must-not-be-copied'
  });
  await manager.initialize();
  const record = manager.getCatalogDetails('legacy-record');
  assert.equal(record.archivePassword, '');
  assert.equal(record.passwordRecorded, false);
  assert.equal(record.hasPassword, false);
});

test('thumbnail limit is configurable within a bounded range', async () => {
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' });
  await manager.updateConfig({ thumbnailLimit: 250 });
  assert.equal(manager.config.thumbnailLimit, 250);
  await assert.rejects(manager.updateConfig({ thumbnailLimit: 501 }), /1—500/);
});

test('disabled small-item filtering accepts tiny folders before output setup', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-tiny-queue-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const tinyFolder = path.join(root, 'tiny-folder');
  await fs.mkdir(tinyFolder);
  await fs.writeFile(path.join(tinyFolder, 'tiny.txt'), 'tiny');

  const manager = new QueueManager(new FakeStore(), {
    archiveOutputDirectory: '',
    archiveStagingDirectory: '',
    repositoryDirectory: path.join(root, 'warehouse'),
    moveCompleted: false,
    smallItemFilter: true,
    minimumTaskBytes: 100 * 1024 * 1024
  });
  await manager.updateConfig({ smallItemFilter: false, minimumTaskBytes: 0 });
  await manager.addSingle(tinyFolder);

  assert.equal(manager.config.smallItemFilter, false);
  assert.equal(manager.jobs.length, 1);
  assert.equal(manager.jobs[0].displayName, 'tiny-folder');
  assert.equal(manager.jobs[0].totalBytes, 4);

  const scanRepository = path.join(path.dirname(root), `${path.basename(root)}-warehouse`);
  const scanManager = new QueueManager(new FakeStore(), {
    archiveOutputDirectory: '',
    archiveStagingDirectory: '',
    repositoryDirectory: scanRepository,
    moveCompleted: false,
    smallItemFilter: false,
    minimumTaskBytes: 100 * 1024 * 1024
  });
  await scanManager.scanSource(root);
  assert.deepEqual(scanManager.jobs.map((job) => job.displayName), ['tiny-folder']);
  assert.deepEqual(scanManager.skippedRootFiles, []);
});

test('catalog fuzzy search ranks matches and supports time and filename sorting', () => {
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' });
  manager.catalog = [
    { id: 'older', title: '美女旅行到台湾', displayName: 'B项目', inventoryDate: '2025-01-01T08:30:00.000Z', tags: [], manifest: [], directories: [] },
    { id: 'newer', title: '台湾风景', displayName: 'A项目', inventoryDate: '2026-01-01T08:30:00.000Z', tags: [], manifest: [], directories: [] }
  ];
  assert.equal(manager.searchCatalog({ query: '美女台湾' })[0].id, 'older');
  assert.deepEqual(manager.searchCatalog({ sort: 'inventory_desc' }).map((item) => item.id), ['newer', 'older']);
  assert.deepEqual(manager.searchCatalog({ sort: 'name_asc' }).map((item) => item.id), ['newer', 'older']);
  assert.equal(manager.getCatalogSuggestions('美女台湾')[0].id, 'older');
});

test('catalog search does not create a second in-memory posting index', () => {
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' });
  manager.catalog = Array.from({ length: 5000 }, (_, index) => ({
    id: `bulk-${index}`,
    title: `普通库存编号${index}`,
    displayName: `普通库存编号${index}`,
    tags: [],
    manifest: [],
    directories: []
  }));
  manager.catalog.push({
    id: 'needle', title: '独角兽特别收藏', displayName: '独角兽特别收藏', tags: [], manifest: [], directories: []
  });
  assert.equal(manager.catalogSearchGramIndex, undefined);
  assert.equal(manager.searchCatalog({ query: '独角兽收藏' })[0].id, 'needle');
});

test('similar project links are stored symmetrically', () => {
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' });
  manager.catalog = [
    { id: 'a', title: '王佳乐在北京上学', displayName: '项目A', tags: [], manifest: [], directories: [] },
    { id: 'b', title: '北京王佳乐的学习生活', displayName: '项目B', tags: [], manifest: [], directories: [] }
  ];
  manager.rebuildAllSimilarityRelations();
  assert.equal(manager.catalog[0].similarRecords[0].id, 'b');
  assert.equal(manager.catalog[1].similarRecords[0].id, 'a');
  assert.equal(manager.catalog[0].possibleDuplicate, true);
});

test('similar project links can be recalculated and dismissed symmetrically', async () => {
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' });
  manager.catalog = [
    { id: 'a', title: '王佳乐在北京上学', displayName: '项目A', tags: [], manifest: [], directories: [], dismissedSimilarRecordIds: [] },
    { id: 'b', title: '北京王佳乐的学习生活', displayName: '项目B', tags: [], manifest: [], directories: [], dismissedSimilarRecordIds: [] }
  ];
  manager.rebuildAllSimilarityRelations();
  await manager.recalculateCatalogSimilarity('a');
  assert.equal(manager.catalog[1].similarRecords.some((item) => item.id === 'a'), true);

  await manager.removeCatalogSimilarity('a', 'b');
  assert.deepEqual(manager.catalog[0].similarRecords, []);
  assert.deepEqual(manager.catalog[1].similarRecords, []);
  assert.deepEqual(manager.catalog[0].dismissedSimilarRecordIds, ['b']);
  assert.deepEqual(manager.catalog[1].dismissedSimilarRecordIds, ['a']);

  manager.rebuildAllSimilarityRelations();
  assert.deepEqual(manager.catalog[0].similarRecords, []);
  assert.deepEqual(manager.catalog[1].similarRecords, []);
});

test('similarity version upgrade removes stale domain-only FC2 relations', async () => {
  class SimilarityUpgradeStore extends FakeStore {
    async loadCatalog() {
      return [
        {
          id: 'fc2-a', title: 'FC2-PPV-4768873', displayName: 'FC2-PPV-4768873',
          similarityVersion: 2, possibleDuplicate: true,
          similarRecords: [{ id: 'fc2-b', title: 'FC2-PPV-4723700', score: 0.827, reasons: ['包含标题相似的视频'] }],
          manifest: [{ name: 'hhd800.com@FC2-PPV-4768873.mp4', extension: '.mp4', size: 1001 }],
          directories: [], tags: []
        },
        {
          id: 'fc2-b', title: 'FC2-PPV-4723700', displayName: 'FC2-PPV-4723700',
          similarityVersion: 2, possibleDuplicate: true,
          similarRecords: [{ id: 'fc2-a', title: 'FC2-PPV-4768873', score: 0.827, reasons: ['包含标题相似的视频'] }],
          manifest: [{ name: 'hhd800.com@FC2-PPV-4723700.mp4', extension: '.mp4', size: 1002 }],
          directories: [], tags: []
        }
      ];
    }
    async saveCatalog(_directory, records) { this.catalog = structuredClone(records); }
  }
  const store = new SimilarityUpgradeStore();
  const manager = new QueueManager(store, { repositoryDirectory: 'E:\\library' });
  await manager.initialize();
  assert.deepEqual(manager.catalog.map((record) => record.similarRecords), [[], []]);
  assert.deepEqual(manager.catalog.map((record) => record.similarityVersion), [3, 3]);
  assert.deepEqual(manager.catalog.map((record) => record.possibleDuplicate), [false, false]);
  assert.deepEqual(store.catalog.map((record) => record.similarRecords), [[], []]);
});

test('legacy catalog records receive an empty hidden original source location', async () => {
  class LegacyStore extends FakeStore {
    async loadCatalog() {
      return [{ id: 'legacy', title: '旧记录', displayName: '旧记录', sourcePath: 'E:\\old\\item', tags: [], manifest: [], directories: [] }];
    }
    async saveCatalog(_directory, records) { this.catalog = structuredClone(records); }
  }
  const store = new LegacyStore();
  const manager = new QueueManager(store, { libraryDir: 'E:\\library' });
  await manager.initialize();
  assert.equal(Object.hasOwn(manager.catalog[0], 'originalSourcePath'), true);
  assert.equal(manager.catalog[0].originalSourcePath, '');
  assert.equal(store.catalog[0].originalSourcePath, '');
});

test('lightweight source audit marks missing moved and recycled originals once', async () => {
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' }, {
    pathExists: async () => false,
    isTrashItemPresent: async () => false
  });
  manager.catalog = [
    { id: 'moved', title: '已移动', sourceDisposition: 'moved', movedTo: 'E:\\done\\moved', originalSourcePath: 'E:\\source\\moved' },
    { id: 'trash', title: '回收站', sourceDisposition: 'trashed', originalSourcePath: 'E:\\source\\trash' },
    { id: 'missing', title: '已消失', sourceDisposition: 'missing', originalSourcePath: '' }
  ];
  const result = await manager.auditTrackedSourceLocations({ limit: 10 });
  assert.deepEqual(result, { checked: 2, missing: 2 });
  assert.equal(manager.catalog[0].sourceDisposition, 'missing');
  assert.equal(manager.catalog[1].sourceDisposition, 'missing');
  assert.equal(manager.catalog[0].originalSourcePath, '');
  assert.equal(manager.catalog[1].originalSourcePath, '');
  const second = await manager.auditTrackedSourceLocations({ limit: 10 });
  assert.deepEqual(second, { checked: 0, missing: 0 });
});

test('completed source movement refuses collisions and preserves the source', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-source-move-'));
  try {
    const source = path.join(root, 'source', 'item');
    const destination = path.join(root, 'done');
    await fs.mkdir(source, { recursive: true });
    await fs.writeFile(path.join(source, 'one.bin'), 'abc');
    await fs.mkdir(path.join(destination, 'item'), { recursive: true });
    const manager = new QueueManager(new FakeStore(), { libraryDir: path.join(root, 'library') });
    await assert.rejects(manager.moveCompletedItem({
      id: 'move', sourcePath: source, sourceType: 'directory', fileCount: 1, totalBytes: 3
    }, destination), /同名项目/);
    assert.equal((await fs.stat(source)).isDirectory(), true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('finish next and pause runs one queued task only', async () => {
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' }, {
    archiveRunner: async (job) => ({
      archiveFolder: null,
      archiveFiles: [{ name: `${job.id}.7z`, size: 1 }],
      archiveTotalBytes: 1,
      manifest: [{ relativePath: 'file.bin', name: 'file.bin', size: 1, md5: 'abc' }],
      directories: [],
      passwordScheme: 'fixed-v1',
      verifiedAt: new Date().toISOString()
    })
  });
  manager.jobs = [queuedJob('first'), queuedJob('second')];
  const idle = new Promise((resolve) => manager.once('idle', resolve));
  await manager.finishNextAndPause();
  await idle;
  assert.equal(manager.jobs[0].status, 'completed');
  assert.equal(manager.jobs[1].status, 'queued');
});

test('schedule refuses a task whose estimate exceeds the remaining window', () => {
  const manager = new QueueManager(new FakeStore(), {
    libraryDir: 'E:\\library', scheduleEnabled: true, scheduleStart: '10:00', scheduleEnd: '10:10'
  });
  const decision = manager.canStartScheduledJob({ totalBytes: 20 * 1024 ** 3 }, new Date(2026, 7, 15, 10, 5));
  assert.equal(decision.allowed, false);
  assert.ok(decision.estimatedMs > decision.remainingMs);
});

test('compression estimates use persisted recent speed samples', async () => {
  const store = new FakeStore();
  const manager = new QueueManager(store, { libraryDir: 'E:\\library' });
  await manager.rememberCompressionSample(600 * 1024 ** 2, 30_000);
  const estimatedMs = manager.estimateJobDurationMs({ totalBytes: 1_200 * 1024 ** 2 });
  assert.equal(manager.config.compressionHistory.length, 1);
  assert.equal(estimatedMs, 120_000);
});

test('abnormal compression ratio waits for explicit inventory confirmation', async () => {
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' }, {
    archiveRunner: async () => ({
      archiveFolder: null,
      archiveFiles: [{ name: 'odd.7z', size: 200 }],
      archiveTotalBytes: 200,
      manifest: [{ relativePath: 'file.bin', name: 'file.bin', size: 100, md5: 'abc' }],
      directories: [],
      passwordScheme: 'fixed-v1',
      verifiedAt: new Date().toISOString()
    })
  });
  manager.jobs = [{ ...queuedJob('odd'), totalBytes: 100 }];
  await manager.startQueue();
  assert.equal(manager.jobs[0].status, 'awaiting_anomaly_confirmation');
  assert.equal(manager.catalog.length, 0);
  await manager.confirmAnomaly('odd');
  assert.equal(manager.jobs[0].status, 'completed');
  assert.equal(manager.catalog.length, 1);
});

test('BUG1 regression: a 0.789 percent archive ratio is held for review and discard preserves source', async (t) => {
  const originalBytes = 16_575_432_670;
  const archiveBytes = 130_838_769;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-bug1-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const sourcePath = path.join(root, 'BUG1-source');
  const libraryDir = path.join(root, 'output');
  await fs.mkdir(sourcePath, { recursive: true });
  await fs.writeFile(path.join(sourcePath, 'source-kept.txt'), 'source must remain');
  const trashed = [];
  const manager = new QueueManager(new FakeStore(), {
    libraryDir,
    warehouseDir: path.join(root, 'saves'),
    stagingDir: path.join(root, 'staging')
  }, {
    archiveRunner: async () => {
      await fs.mkdir(libraryDir, { recursive: true });
      await fs.writeFile(path.join(libraryDir, 'bug1.7z.001'), 'fake archive');
      return {
      archiveFolder: null,
      archiveFiles: [{ name: 'bug1.7z.001', size: archiveBytes }],
      archiveTotalBytes: archiveBytes,
      manifest: [{ relativePath: 'large.xltd', name: 'large.xltd', size: originalBytes, md5: 'bug1' }],
      directories: [],
      passwordScheme: 'fixed-v1',
      verifiedAt: new Date().toISOString()
      };
    },
    trashItem: async (targetPath) => {
      trashed.push(targetPath);
      await fs.rm(targetPath, { recursive: true, force: true });
    }
  });
  manager.jobs = [{ ...queuedJob('bug1'), sourcePath, totalBytes: originalBytes }];
  await manager.startQueue();
  assert.equal(manager.jobs[0].status, 'awaiting_anomaly_confirmation');
  assert.equal(manager.jobs[0].errorCode, 'ARCHIVE_SIZE_ANOMALY');
  assert.match(manager.jobs[0].stageText, /不足原始内容的 1%/);
  assert.ok(manager.logs.some((entry) => entry.level === 'error' && entry.message.includes('压缩体积异常')));
  assert.equal(manager.catalog.length, 0);
  await manager.discardAnomalousArchive('bug1');
  assert.equal(manager.jobs[0].status, 'cancelled');
  assert.equal(trashed.length, 1);
  await fs.access(path.join(sourcePath, 'source-kept.txt'));
  await assert.rejects(fs.access(path.join(libraryDir, 'bug1.7z.001')), /ENOENT/);
});

test('automatic trash runs only after archive metadata and thumbnails are saved', async () => {
  const events = [];
  const store = new FakeStore();
  store.saveCatalog = async () => { events.push('catalog'); };
  const manager = new QueueManager(store, {
    libraryDir: 'E:\\library',
    autoTrashCompleted: true,
    recordBackupLocation: true,
    backupLocation: '百度网盘'
  }, {
    archiveRunner: async () => {
      events.push('archive');
      return {
        archiveFolder: 'archive',
        archiveFiles: [{ name: 'archive.7z', size: 1 }],
        archiveTotalBytes: 1,
        manifest: [{ relativePath: 'image.jpg', name: 'image.jpg', size: 1, md5: 'abc' }],
        directories: [],
        passwordScheme: 'fixed-v1',
        verifiedAt: new Date().toISOString()
      };
    },
    createThumbnails: async (_job, manifest) => {
      events.push('thumbnails');
      return manifest;
    },
    validateSourceBeforeDisposition: async () => { events.push('source-check'); },
    trashItem: async () => { events.push('trash'); }
  });
  manager.jobs = [queuedJob('one')];

  await manager.startQueue();

  assert.equal(manager.jobs[0].status, 'completed');
  assert.equal(manager.catalog[0].sourceDisposition, 'trashed');
  assert.equal(manager.catalog[0].backupLocation, '百度网盘');
  assert.ok(events.indexOf('archive') < events.indexOf('thumbnails'));
  assert.ok(events.indexOf('thumbnails') < events.indexOf('catalog'));
  assert.ok(events.indexOf('catalog') < events.indexOf('trash'));
});

test('catalog metadata supports defaults, editing, cover thumbnails and filters', async () => {
  const store = new FakeStore();
  const legacyRecord = {
    id: 'record-one',
    displayName: '原始项目名',
    sourcePath: 'E:\\source\\原始项目名',
    archiveBaseName: 'archive.7z',
    archiveDirectory: 'E:\\library',
    fileCount: 2,
    manifest: [
      { relativePath: 'cover.jpg', thumbnailPath: 'E:\\repository\\thumbnails\\job-one\\cover.png', md5: 'aaa' },
      { relativePath: 'notes.txt', md5: 'bbb' }
    ],
    directories: []
  };
  store.loadCatalog = async () => [legacyRecord];
  store.saveCatalog = async (_library, records) => { store.catalog = structuredClone(records); };
  const manager = new QueueManager(store, {
    archiveOutputDirectory: 'E:\\library', repositoryDirectory: 'E:\\repository'
  });

  await manager.initialize();
  assert.equal(manager.catalog[0].title, '原始项目名');
  assert.deepEqual(manager.catalog[0].tags, []);
  assert.equal(store.catalog[0].rating, 0);
  assert.ok(manager.catalog[0].inventoryDate);

  await manager.updateCatalogMetadata('record-one', {
    title: '北海道旅行',
    tags: ['摄影', '旅行', '摄影'],
    rating: 5,
    notes: '冬季照片，之后制作相册。',
    backupLocation: '家庭备份盘 A'
  });

  await manager.setCatalogCover('record-one', 'cover.jpg');
  const summary = manager.searchCatalog({
    query: '相册', tag: '旅行', backupLocation: '家庭备份盘 A', rating: 5
  });
  assert.equal(summary.length, 1);
  assert.equal(summary[0].title, '北海道旅行');
  assert.deepEqual(summary[0].tags, ['摄影', '旅行']);
  assert.equal(summary[0].coverThumbnailPath, 'cover.jpg');
  assert.equal(summary[0].coverRelativePath, 'cover.jpg');
  assert.equal(summary[0].backupLocation, '家庭备份盘 A');
  assert.equal(manager.searchCatalog({ tag: '不存在' }).length, 0);
  assert.equal(manager.searchCatalog({ backupLocation: '不存在' }).length, 0);
  await assert.rejects(manager.setCatalogCover('record-one', 'notes.txt'), /不能设为封面/);
  await assert.rejects(
    manager.updateCatalogMetadata('record-one', { title: '', rating: 5 }),
    /标题不能为空/
  );
});

test('backup location setting requires a text value when enabled', async () => {
  const manager = new QueueManager(new FakeStore(), {
    libraryDir: 'E:\\library',
    recordBackupLocation: false,
    backupLocation: ''
  });

  await assert.rejects(
    manager.updateConfig({ recordBackupLocation: true, backupLocation: '   ' }),
    /请填写备份位置/
  );
  const state = await manager.updateConfig({ recordBackupLocation: true, backupLocation: ' 移动硬盘 B ' });
  assert.equal(state.config.recordBackupLocation, true);
  assert.equal(state.config.backupLocation, '移动硬盘 B');
});

test('manual inventory requires only name and notes and records inventory date', async () => {
  const store = new FakeStore();
  store.saveCatalog = async (_library, records) => { store.catalog = structuredClone(records); };
  const manager = new QueueManager(store, { libraryDir: 'E:\\library' });

  const record = await manager.addManualCatalogRecord({ name: '纸质相册', notes: '存放在书柜第二层。' });

  assert.equal(record.recordType, 'manual');
  assert.equal(record.title, '纸质相册');
  assert.equal(record.notes, '存放在书柜第二层。');
  assert.ok(Number.isFinite(Date.parse(record.inventoryDate)));
  assert.deepEqual(record.archiveFiles, []);
  await assert.rejects(manager.addManualCatalogRecord({ name: '缺少备注' }), /备注不能为空/);
});

test('manual inventory accepts optional locations and can receive stored images', async () => {
  const warehouseDir = 'E:\\warehouse';
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library', warehouseDir }, {
    storeCatalogImage: async (recordId, input) => ({
      id: 'image-one',
      ref: 'manual-image:image-one',
      relativePath: input.name,
      name: input.name,
      thumbnailPath: path.join(warehouseDir, 'thumbnails', `manual-${recordId}`, 'image-one.png')
    })
  });
  const record = await manager.addManualCatalogRecord({
    name: '网络收藏',
    notes: '以后整理',
    tags: '网页, 待整理',
    sourcePath: 'https://example.com/item',
    backupLocation: '移动硬盘 A'
  });
  const updated = await manager.addCatalogImage(record.id, { name: '封面.png', dataUrl: 'data:image/png;base64,AA==' });
  assert.deepEqual(updated.tags, ['网页', '待整理']);
  assert.equal(updated.sourcePath, 'https://example.com/item');
  assert.equal(updated.backupLocation, '移动硬盘 A');
  assert.equal(updated.manualImages.length, 1);
  assert.equal(updated.coverThumbnailRef, 'manual-image:image-one');
  assert.equal(manager.summarizeCatalogRecord(updated).thumbnailCount, 1);
});

test('bulk tags append without replacing existing tags', async () => {
  const store = new FakeStore();
  store.saveCatalog = async (_library, records) => { store.catalog = structuredClone(records); };
  const manager = new QueueManager(store, { libraryDir: 'E:\\library' });
  manager.catalog = [
    { id: 'one', title: '一', tags: ['原标签'] },
    { id: 'two', title: '二', tags: [] }
  ];

  await manager.addTagsToCatalogRecords(['one', 'two'], '旅行，摄影');

  assert.deepEqual(manager.catalog[0].tags, ['原标签', '旅行', '摄影']);
  assert.deepEqual(manager.catalog[1].tags, ['旅行', '摄影']);
});

test('bulk backup location and metadata changes can be undone up to the previous snapshot', async () => {
  const store = new FakeStore();
  const manager = new QueueManager(store, { libraryDir: 'E:\\library' });
  manager.catalog = [{
    id: 'one', recordType: 'manual', displayName: '一', title: '一', notes: '备注', tags: [], rating: 0,
    backupLocation: '', manifest: [], directories: []
  }];
  await manager.updateBackupLocationForCatalogRecords(['one'], '移动硬盘 A');
  assert.equal(manager.catalog[0].backupLocation, '移动硬盘 A');
  assert.equal(manager.getState().undoDepth, 1);
  await manager.undoCatalogAction();
  assert.equal(manager.catalog[0].backupLocation, '');
});

test('single archive password changes only through explicit metadata editing', async () => {
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' });
  manager.catalog = [
    { id: 'archive-a', recordType: 'archive', title: 'A', displayName: 'A', tags: [], manifest: [], directories: [], archivePassword: '', hasPassword: false },
    { id: 'manual-b', recordType: 'manual', title: 'B', displayName: 'B', tags: [], manifest: [], directories: [] }
  ];
  await manager.updateCatalogMetadata('archive-a', { archivePassword: 'shared-secret', passwordRecorded: true });
  assert.equal(manager.catalog[0].archivePassword, 'shared-secret');
  assert.equal(manager.catalog[0].passwordRecorded, true);
  assert.equal(manager.catalog[1].archivePassword, undefined);
  await manager.undoCatalogAction();
  assert.equal(manager.catalog[0].archivePassword, '');
  assert.equal(manager.catalog[0].hasPassword, false);
});

test('warehouse undo history is capped at ten actions', async () => {
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' });
  manager.catalog = [{
    id: 'one', recordType: 'manual', displayName: '一', title: '一', notes: '备注', tags: [], rating: 0,
    backupLocation: '', manifest: [], directories: []
  }];
  for (let index = 0; index < 12; index += 1) {
    await manager.updateBackupLocationForCatalogRecords(['one'], `位置 ${index}`);
  }
  assert.equal(manager.getState().undoDepth, 10);
});

test('bulk tag input rejects punctuation outside the tag rules', async () => {
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' });
  manager.catalog = [{
    id: 'one', recordType: 'manual', displayName: '一', title: '一', notes: '备注', tags: [], rating: 0,
    backupLocation: '', manifest: [], directories: []
  }];
  await assert.rejects(manager.addTagsToCatalogRecords(['one'], '合法标签, 不合格!'), /标签只能使用/);
});

test('catalog deletion quarantines archive volumes atomically and rejects paths outside the warehouse', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-atomic-delete-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const archiveDirectory = path.join(root, 'library');
  const repositoryDirectory = path.join(root, 'repository');
  const stagingDirectory = path.join(root, 'staging');
  await fs.mkdir(path.join(repositoryDirectory, 'thumbnails', 'job-safe'), { recursive: true });
  await fs.mkdir(archiveDirectory, { recursive: true });
  await fs.writeFile(path.join(archiveDirectory, 'arc_safe.7z'), 'archive');
  const trashed = [];
  const store = new FakeStore();
  store.saveCatalog = async (_library, records) => { store.catalog = structuredClone(records); };
  const manager = new QueueManager(store, {
    archiveOutputDirectory: archiveDirectory, repositoryDirectory, archiveStagingDirectory: stagingDirectory
  }, {
    trashItem: async (targetPath) => { trashed.push(targetPath); }
  });
  manager.catalog = [
    {
      id: 'archive', title: '归档项目', recordType: 'archive',
      archiveDirectory, archiveFiles: [{ name: 'arc_safe.7z' }], jobId: 'job-safe'
    },
    {
      id: 'manual', title: '手动项目', recordType: 'manual',
      jobId: null
    },
    {
      id: 'unsafe', title: '越界项目', recordType: 'archive',
      archiveDirectory, archiveFiles: [{ name: '..\\outside' }], jobId: null
    }
  ];

  const result = await manager.deleteCatalogRecords(['archive', 'manual', 'unsafe']);

  assert.deepEqual(result.deletedIds.sort(), ['archive', 'manual']);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0].message, /无效路径|不在允许的仓库子目录/);
  assert.equal(manager.catalog.length, 1);
  assert.equal(trashed.length, 2);
  assert.ok(trashed.some((targetPath) => targetPath.includes('delete-quarantine')));
  assert.ok(trashed.some((targetPath) => targetPath.endsWith('thumbnails\\job-safe')));
});

test('catalog deletion can restore a moved original before removing the archive record', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-restore-source-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const originalPath = path.join(root, 'source', 'item');
  const movedPath = path.join(root, 'processed', 'item');
  const archiveDirectory = path.join(root, 'archives');
  const repositoryDirectory = path.join(root, 'repository');
  const stagingDirectory = path.join(root, 'staging');
  await fs.mkdir(movedPath, { recursive: true });
  await fs.mkdir(archiveDirectory, { recursive: true });
  await fs.writeFile(path.join(movedPath, 'one.bin'), 'abc');
  await fs.writeFile(path.join(archiveDirectory, 'item.7z'), 'archive');
  const manager = new QueueManager(new FakeStore(), {
    archiveOutputDirectory: archiveDirectory, repositoryDirectory, archiveStagingDirectory: stagingDirectory
  }, { trashItem: async () => {} });
  manager.catalog = [{
    id: 'restore', jobId: null, title: '复原项目', recordType: 'archive', sourceType: 'directory',
    originalSourcePath: originalPath, sourceDisposition: 'moved', movedTo: movedPath,
    fileCount: 1, originalBytes: 3, archiveDirectory, archiveFiles: [{ name: 'item.7z' }]
  }];

  const result = await manager.deleteCatalogRecords(['restore'], { restoreOriginalSources: true });
  assert.deepEqual(result.deletedIds, ['restore']);
  assert.equal((await fs.stat(originalPath)).isDirectory(), true);
  await assert.rejects(fs.access(movedPath), /ENOENT/);
});

test('failed original restoration keeps both archive and warehouse record', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-restore-failure-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const archiveDirectory = path.join(root, 'archives');
  await fs.mkdir(archiveDirectory, { recursive: true });
  await fs.writeFile(path.join(archiveDirectory, 'item.7z'), 'archive');
  const manager = new QueueManager(new FakeStore(), {
    archiveOutputDirectory: archiveDirectory,
    repositoryDirectory: path.join(root, 'repository'),
    archiveStagingDirectory: path.join(root, 'staging')
  }, { trashItem: async () => {} });
  manager.catalog = [{
    id: 'restore-failure', jobId: null, title: '复原失败', recordType: 'archive', sourceType: 'directory',
    originalSourcePath: path.join(root, 'source', 'item'), sourceDisposition: 'moved', movedTo: path.join(root, 'missing', 'item'),
    fileCount: 1, originalBytes: 3, archiveDirectory, archiveFiles: [{ name: 'item.7z' }]
  }];

  const result = await manager.deleteCatalogRecords(['restore-failure'], { restoreOriginalSources: true });
  assert.equal(result.deletedIds.length, 0);
  assert.match(result.failures[0].message, /已找不到原文件/);
  await fs.access(path.join(archiveDirectory, 'item.7z'));
  assert.equal(manager.catalog.length, 1);
});

test('new flat multi-volume records are moved to one quarantine before deletion', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-flat-delete-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const archiveDirectory = path.join(root, 'library');
  const stagingDirectory = path.join(root, 'staging');
  await fs.mkdir(archiveDirectory, { recursive: true });
  await fs.writeFile(path.join(archiveDirectory, 'arc_flat.7z.001'), 'one');
  await fs.writeFile(path.join(archiveDirectory, 'arc_flat.7z.002'), 'two');
  const trashed = [];
  const manager = new QueueManager(new FakeStore(), {
    archiveOutputDirectory: archiveDirectory, repositoryDirectory: path.join(root, 'repository'), archiveStagingDirectory: stagingDirectory
  }, {
    trashItem: async (targetPath) => { trashed.push(targetPath); }
  });
  manager.catalog = [{
    id: 'flat', title: '平铺分卷', recordType: 'archive', archiveDirectory, jobId: null,
    archiveFiles: [{ name: 'arc_flat.7z.001' }, { name: 'arc_flat.7z.002' }]
  }];
  const result = await manager.deleteCatalogRecords(['flat']);
  assert.deepEqual(result.deletedIds, ['flat']);
  assert.equal(trashed.length, 1);
  assert.ok(trashed[0].includes('delete-quarantine'));
});

test('multi-volume deletion rolls every part back when recycle-bin removal fails', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-delete-rollback-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const archiveDirectory = path.join(root, 'library');
  await fs.mkdir(archiveDirectory, { recursive: true });
  for (const name of ['rollback.7z.001', 'rollback.7z.002']) await fs.writeFile(path.join(archiveDirectory, name), name);
  const manager = new QueueManager(new FakeStore(), {
    archiveOutputDirectory: archiveDirectory,
    repositoryDirectory: path.join(root, 'repository'),
    archiveStagingDirectory: path.join(root, 'staging')
  }, {
    trashItem: async () => { throw new Error('模拟回收站失败'); }
  });
  manager.catalog = [{
    id: 'rollback', title: '回滚测试', recordType: 'archive', archiveDirectory, jobId: null,
    archiveFiles: [{ name: 'rollback.7z.001' }, { name: 'rollback.7z.002' }]
  }];
  const result = await manager.deleteCatalogRecords(['rollback']);
  assert.equal(result.deletedIds.length, 0);
  assert.match(result.failures[0].message, /已回滚/);
  await fs.access(path.join(archiveDirectory, 'rollback.7z.001'));
  await fs.access(path.join(archiveDirectory, 'rollback.7z.002'));
  assert.equal(manager.catalog.length, 1);
});

test('warehouse insights calculate inventory, unique tags and GB activity', () => {
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' });
  manager.catalog = [
    {
      id: 'today', title: '今天入库', tags: ['旅行', '摄影'], originalBytes: 2_000_000_000,
      inventoryDate: new Date(2026, 7, 15, 10).toISOString(), manifest: [], directories: []
    },
    {
      id: 'last-year', title: '去年今日', tags: ['旅行'], originalBytes: 1_000_000_000,
      inventoryDate: new Date(2025, 7, 15, 10).toISOString(), manifest: [], directories: []
    },
    {
      id: 'manual', title: '手动库存', tags: ['纸质'], originalBytes: 0,
      inventoryDate: new Date(2026, 7, 14, 10).toISOString(), manifest: [], directories: []
    }
  ];

  const insights = manager.getWarehouseInsights(new Date(2026, 7, 15, 12));

  assert.equal(insights.inventoryCount, 3);
  assert.equal(insights.uniqueTagCount, 3);
  assert.equal(insights.totalOriginalBytes, 3_000_000_000);
  assert.equal(insights.activity.length, 112);
  assert.equal(insights.activity.find((entry) => entry.date === '2026-08-15').inventoryCount, 1);
  assert.equal(insights.activity.find((entry) => entry.date === '2026-08-15').originalBytes, 2_000_000_000);
});

test('warehouse location change copies metadata and rewrites owned thumbnail paths without deleting the old warehouse', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-warehouse-move-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const oldWarehouse = path.join(root, 'warehouse-old');
  const newWarehouse = path.join(root, 'warehouse-new');
  const thumbnailPath = path.join(oldWarehouse, 'thumbnails', 'manual-record', 'image.png');
  await fs.mkdir(path.dirname(thumbnailPath), { recursive: true });
  await fs.writeFile(thumbnailPath, 'image');
  const store = new AppStore(path.join(root, 'user-data'));
  await store.saveCatalog(oldWarehouse, [{
    id: 'record', title: '迁移库存', displayName: '迁移库存', recordType: 'manual', notes: '备注',
    tags: [], manifest: [], directories: [], manualImages: [{
      id: 'image', ref: 'manual-image:image', relativePath: 'image.png', thumbnailPath
    }]
  }]);
  await store.saveJobs(oldWarehouse, []);
  const manager = new QueueManager(store, {
    sourceDir: path.join(root, 'source'),
    stagingDir: path.join(root, 'staging'),
    libraryDir: path.join(root, 'output'),
    warehouseDir: oldWarehouse,
    moveCompleted: false
  });
  await manager.initialize();
  const result = await manager.changeWarehouseDirectory(newWarehouse);
  assert.equal(result.copied, true);
  assert.equal(manager.config.repositoryDirectory, newWarehouse);
  assert.equal(manager.catalog[0].manualImages[0].thumbnailPath, path.join(newWarehouse, 'thumbnails', 'manual-record', 'image.png'));
  await fs.access(path.join(newWarehouse, 'thumbnails', 'manual-record', 'image.png'));
  await fs.access(thumbnailPath);
  store.closeAll();
});

test('random warehouse recommendation avoids the active item when alternatives exist', () => {
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' });
  manager.catalog = [
    { id: 'active', title: '当前', manifest: [], directories: [] },
    { id: 'other', title: '其他', manifest: [], directories: [] }
  ];

  assert.equal(manager.getRandomCatalogRecord('active').id, 'other');
  assert.equal(manager.getRandomCatalogRecord('other').id, 'active');
});

test('random warehouse recommendation visits every item before reshuffling', () => {
  const manager = new QueueManager(new FakeStore(), { libraryDir: 'E:\\library' });
  manager.catalog = Array.from({ length: 8 }, (_, index) => ({
    id: `record-${index}`, title: `库存 ${index}`, manifest: [], directories: []
  }));
  const firstCycle = Array.from({ length: 8 }, () => manager.getRandomCatalogRecord().id);
  assert.equal(new Set(firstCycle).size, 8);
});
