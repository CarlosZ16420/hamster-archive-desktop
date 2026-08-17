#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const {
  integrityCheck,
  loadCatalog,
  loadJobs,
  openRepository,
  saveCatalog,
  saveJobs,
  stableJson
} = require('../src/core/sqlite-repository');

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument === '--saves') options.saves = argv[++index];
    else if (argument === '--archive-output') options.archiveOutput = argv[++index];
    else throw new Error(`未知参数：${argument}`);
  }
  return options;
}

function usage() {
  return [
    '仓鼠归档 saves → SQLite 转换工具',
    '',
    '用法：',
    '  node scripts\\migrate-saves-to-sqlite.js --saves "E:\\路径\\saves" --archive-output "E:\\路径\\nuts"',
    '',
    '说明：',
    '  --saves           旧存档目录；默认是项目目录下的 saves',
    '  --archive-output  压缩包所在目录；默认是 saves 同级的 nuts',
    '  转换不会删除或改写 catalog.json、jobs.json 和 pending-manifests。'
  ].join('\n');
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`无法读取 ${filePath}：${error.message}`);
  }
}

function normalizeArchiveStorage(record, archiveOutputDirectory) {
  const normalized = structuredClone(record);
  if (normalized.recordType !== 'manual') {
    if (normalized.archiveFolder) {
      normalized.archiveDirectory = path.join(archiveOutputDirectory, 'archives', String(normalized.archiveFolder));
    } else if (!normalized.archiveDirectory) {
      const archiveNames = (normalized.archiveFiles || []).map((item) => item?.name).filter(Boolean);
      const isFlatCurrentArchive = archiveNames.some((name) => fsSync.existsSync(path.join(archiveOutputDirectory, name)));
      normalized.archiveDirectory = isFlatCurrentArchive
        ? archiveOutputDirectory
        : path.join(archiveOutputDirectory, 'archives');
    }
  }
  delete normalized.archiveFolder;
  delete normalized.archiveStorageVersion;
  return normalized;
}

async function loadPendingManifests(savesDirectory) {
  const directory = path.join(savesDirectory, 'pending-manifests');
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return new Map();
    throw error;
  }
  const manifests = new Map();
  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.json') continue;
    const jobId = path.basename(entry.name, '.json');
    manifests.set(jobId, await readJson(path.join(directory, entry.name), null));
  }
  return manifests;
}

function totalManifestFiles(catalog) {
  return catalog.reduce((sum, record) => sum + (Array.isArray(record.manifest) ? record.manifest.length : 0), 0);
}

async function migrate(options) {
  const projectRoot = path.resolve(__dirname, '..');
  const savesDirectory = path.resolve(options.saves || path.join(projectRoot, 'saves'));
  const archiveOutputDirectory = path.resolve(options.archiveOutput || path.join(path.dirname(savesDirectory), 'nuts'));
  const targetPath = path.join(savesDirectory, 'warehouse.sqlite');
  const incomingPath = path.join(savesDirectory, `warehouse.sqlite.incoming-${Date.now()}`);

  if (fsSync.existsSync(targetPath)) {
    throw new Error(`目标数据库已经存在：${targetPath}\n为保护现有仓库，本工具不会覆盖它。`);
  }
  const catalogPath = path.join(savesDirectory, 'catalog.json');
  if (!fsSync.existsSync(catalogPath)) throw new Error(`没有找到旧存档：${catalogPath}`);

  const sourceCatalog = await readJson(catalogPath, []);
  const sourceJobs = await readJson(path.join(savesDirectory, 'jobs.json'), []);
  const sourcePending = await loadPendingManifests(savesDirectory);
  if (!Array.isArray(sourceCatalog) || !Array.isArray(sourceJobs)) {
    throw new Error('旧 catalog.json 或 jobs.json 的顶层结构不是数组，已停止转换。');
  }
  const catalog = sourceCatalog.map((record) => normalizeArchiveStorage(record, archiveOutputDirectory));
  const jobs = sourceJobs.map((job) => job?.pendingCatalogRecord
    ? { ...job, pendingCatalogRecord: normalizeArchiveStorage(job.pendingCatalogRecord, archiveOutputDirectory) }
    : job);

  let repository;
  try {
    repository = openRepository(savesDirectory, { databasePath: incomingPath });
    const { database } = repository;
    saveCatalog(database, catalog);
    saveJobs(database, jobs);
    const savePending = database.prepare(`
      INSERT INTO pending_manifests(job_id, manifest_json) VALUES (?, ?)
      ON CONFLICT(job_id) DO UPDATE SET manifest_json = excluded.manifest_json
    `);
    database.exec('BEGIN IMMEDIATE');
    try {
      for (const [jobId, manifest] of sourcePending) savePending.run(jobId, JSON.stringify(manifest));
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }

    const convertedCatalog = loadCatalog(database);
    const convertedJobs = loadJobs(database);
    const convertedPending = new Map(database.prepare('SELECT job_id, manifest_json FROM pending_manifests').all()
      .map((row) => [row.job_id, JSON.parse(row.manifest_json)]));
    if (!integrityCheck(database)) throw new Error('SQLite integrity_check 未通过。');
    if (stableJson(convertedCatalog) !== stableJson(catalog)) throw new Error('仓库记录回读结果与旧存档不一致。');
    if (stableJson(convertedJobs) !== stableJson(jobs)) throw new Error('任务队列回读结果与转换结果不一致。');
    if (stableJson([...convertedPending]) !== stableJson([...sourcePending])) throw new Error('待确认清单回读结果与旧存档不一致。');
    if (totalManifestFiles(convertedCatalog) !== totalManifestFiles(catalog)) throw new Error('逐文件清单数量校验失败。');

    database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    database.close();
    repository = null;
    await fs.rename(incomingPath, targetPath);
    return {
      targetPath,
      catalogRecords: catalog.length,
      manifestFiles: totalManifestFiles(catalog),
      jobs: sourceJobs.length,
      pendingManifests: sourcePending.size
    };
  } catch (error) {
    try { repository?.database.close(); } catch {}
    throw new Error(`${error.message}\n未完成的临时数据库保留在：${incomingPath}`);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const result = await migrate(options);
  console.log([
    '转换成功。',
    `SQLite：${result.targetPath}`,
    `库存记录：${result.catalogRecords}`,
    `逐文件记录：${result.manifestFiles}`,
    `队列任务：${result.jobs}`,
    `待确认清单：${result.pendingManifests}`,
    '旧 JSON 文件均已保留，可作为回退备份。'
  ].join('\n'));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`转换失败：${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { migrate, normalizeArchiveStorage, parseArguments };
