'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { makeArchiveStagingDirectory, normalizeForComparison } = require('./paths');

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function copyPathIfMissing(sourcePath, targetPath) {
  if (!(await pathExists(sourcePath)) || await pathExists(targetPath)) return false;
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.cp(sourcePath, targetPath, { recursive: true, force: false, errorOnExist: true });
  return true;
}

async function movePathIfMissing(sourcePath, targetPath) {
  if (!(await pathExists(sourcePath)) || await pathExists(targetPath)) return false;
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  try {
    await fs.rename(sourcePath, targetPath);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await fs.cp(sourcePath, targetPath, { recursive: true, force: false, errorOnExist: true });
  }
  return true;
}

async function migrateToUserData(config, workspaceRoot, layout) {
  await Promise.all([
    fs.mkdir(layout.configDirectory, { recursive: true }),
    fs.mkdir(layout.logDirectory, { recursive: true })
  ]);

  let changed = false;
  const oldRepository = String(config.repositoryDirectory || '');
  const legacyDefaultRepository = path.join(workspaceRoot, 'saves');
  const usesLegacyDefaultRepository = oldRepository &&
    normalizeForComparison(oldRepository) === normalizeForComparison(legacyDefaultRepository);

  if (usesLegacyDefaultRepository) {
    const movedRepository = await movePathIfMissing(oldRepository, layout.repositoryDirectory);
    if (!movedRepository) {
      await fs.mkdir(layout.repositoryDirectory, { recursive: true });
      for (const entry of ['warehouse.sqlite', 'warehouse.sqlite-wal', 'warehouse.sqlite-shm', 'thumbnails']) {
        await copyPathIfMissing(path.join(oldRepository, entry), path.join(layout.repositoryDirectory, entry));
      }
    }
    config.repositoryDirectory = layout.repositoryDirectory;
    config.migratedRepositoryFrom = oldRepository;
    changed = true;
  }

  const legacyStagingDirectories = [
    path.join(workspaceRoot, 'archive-staging'),
    path.join(workspaceRoot, '压缩暂存目录'),
    path.join(layout.root, 'staging')
  ];
  const derivedStagingDirectory = makeArchiveStagingDirectory(config.archiveOutputDirectory);
  if (derivedStagingDirectory && (!config.archiveStagingDirectory || legacyStagingDirectories.some((candidate) =>
    normalizeForComparison(config.archiveStagingDirectory) === normalizeForComparison(candidate)))) {
    const currentStaging = config.archiveStagingDirectory || legacyStagingDirectories[0];
    await movePathIfMissing(currentStaging, derivedStagingDirectory);
    config.archiveStagingDirectory = derivedStagingDirectory;
    changed = true;
  }

  const legacyProcessedDirectory = path.join(workspaceRoot, 'processed');
  if (!config.processedSourceDirectory ||
      normalizeForComparison(config.processedSourceDirectory) === normalizeForComparison(legacyProcessedDirectory)) {
    await movePathIfMissing(legacyProcessedDirectory, layout.processedSourceDirectory);
    config.processedSourceDirectory = layout.processedSourceDirectory;
    if (config.moveCompleted === undefined) config.moveCompleted = true;
    changed = true;
  }

  if (normalizeForComparison(config.similarityIgnoreTermsPath || path.join(workspaceRoot, 'config', 'similarity-ignore-terms.txt')) !==
      normalizeForComparison(layout.similarityIgnoreTermsPath)) {
    const configuredTermsPath = config.similarityIgnoreTermsPath || path.join(workspaceRoot, 'config', 'similarity-ignore-terms.txt');
    const localMigrationBackup = path.join(workspaceRoot, 'Developer', 'similarity-ignore-terms.txt');
    const sourceTermsPath = await pathExists(configuredTermsPath) ? configuredTermsPath : localMigrationBackup;
    await copyPathIfMissing(sourceTermsPath, layout.similarityIgnoreTermsPath);
    config.similarityIgnoreTermsPath = layout.similarityIgnoreTermsPath;
    changed = true;
  }

  await Promise.all([
    fs.mkdir(layout.repositoryDirectory, { recursive: true }),
    ...(derivedStagingDirectory ? [fs.mkdir(derivedStagingDirectory, { recursive: true })] : []),
    fs.mkdir(layout.processedSourceDirectory, { recursive: true })
  ]);

  const migrationMarker = path.join(layout.configDirectory, '.portable-v3-migrated');
  if (!(await pathExists(migrationMarker))) {
    const legacyLogCandidates = [
      oldRepository ? path.join(oldRepository, 'logs', 'app.log') : '',
      path.join(layout.repositoryDirectory, 'logs', 'app.log')
    ].filter(Boolean);
    const legacyLogPath = (await Promise.all(legacyLogCandidates.map(async (candidate) =>
      await pathExists(candidate) ? candidate : null))).find(Boolean);
    if (legacyLogPath) {
      if (await pathExists(layout.logPath)) {
        const legacyLog = await fs.readFile(legacyLogPath, 'utf8');
        await fs.appendFile(layout.logPath, `\n${legacyLog}`, 'utf8');
        await fs.rm(legacyLogPath, { force: true });
      } else {
        await fs.rename(legacyLogPath, layout.logPath);
      }
      await fs.rmdir(path.dirname(legacyLogPath)).catch(() => {});
    }
    await fs.writeFile(migrationMarker, `${new Date().toISOString()}\n`, 'utf8');
  }

  if (config.storageSchemaVersion !== 3 || config.userDataDirectory !== layout.root) {
    config.storageSchemaVersion = 3;
    config.userDataDirectory = layout.root;
    changed = true;
  }
  return changed;
}

module.exports = { copyPathIfMissing, migrateToUserData, movePathIfMissing, pathExists };
