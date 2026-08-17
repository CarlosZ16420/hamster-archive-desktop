'use strict';

const crypto = require('node:crypto');
const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { CancelledError } = require('./archive-engine-errors');
const { isImageFile, isVideoFile } = require('./constants');

async function hashFileMd5(filePath, signal, pauseController) {
  const hash = crypto.createHash('md5');
  const stream = fsSync.createReadStream(filePath, { highWaterMark: 4 * 1024 * 1024 });
  try {
    for await (const chunk of stream) {
      await pauseController?.waitIfPaused(signal);
      if (signal?.aborted) {
        stream.destroy();
        throw new CancelledError();
      }
      hash.update(chunk);
    }
    return hash.digest('hex');
  } catch (error) {
    stream.destroy();
    throw error;
  }
}

function portableRelativePath(value) {
  return value.split(path.sep).join('/');
}

async function collectFiles(sourcePath, sourceType, options = {}) {
  const { signal, pauseController, onSkippedFile = () => {} } = options;
  if (sourceType === 'video') {
    const stats = await fs.stat(sourcePath);
    return [{
      absolutePath: sourcePath,
      relativePath: path.basename(sourcePath),
      name: path.basename(sourcePath),
      extension: path.extname(sourcePath).toLowerCase(),
      size: stats.size,
      modifiedAtMs: stats.mtimeMs,
      modifiedAt: stats.mtime.toISOString(),
      mediaType: 'video'
    }];
  }

  const files = [];
  const pending = [sourcePath];
  while (pending.length > 0) {
    await pauseController?.waitIfPaused(signal);
    if (signal?.aborted) throw new CancelledError();
    const current = pending.pop();
    let directory;
    try {
      directory = await fs.opendir(current);
    } catch (error) {
      onSkippedFile({ path: portableRelativePath(path.relative(sourcePath, current)) || '.', reason: error.message, code: error.code || 'READ_FAILED', type: 'directory' });
      continue;
    }
    for await (const entry of directory) {
      if (entry.isSymbolicLink()) continue;
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.isFile()) {
        let stats;
        try {
          stats = await fs.stat(entryPath);
        } catch (error) {
          onSkippedFile({ path: portableRelativePath(path.relative(sourcePath, entryPath)), reason: error.message, code: error.code || 'STAT_FAILED', type: 'file' });
          continue;
        }
        files.push({
          absolutePath: entryPath,
          relativePath: portableRelativePath(path.relative(sourcePath, entryPath)),
          name: entry.name,
          extension: path.extname(entry.name).toLowerCase(),
          size: stats.size,
          modifiedAtMs: stats.mtimeMs,
          modifiedAt: stats.mtime.toISOString(),
          mediaType: isVideoFile(entry.name) ? 'video' : isImageFile(entry.name) ? 'image' : 'file'
        });
      }
    }
  }
  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'zh-CN'));
  return files;
}

async function buildManifest(sourcePath, sourceType, options = {}) {
  const { signal, pauseController, onProgress = () => {}, onSkippedFile = () => {} } = options;
  const skippedFiles = [];
  const recordSkipped = (item) => {
    skippedFiles.push(item);
    onSkippedFile(item);
  };
  const files = await collectFiles(sourcePath, sourceType, { signal, pauseController, onSkippedFile: recordSkipped });
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  let processedBytes = 0;
  const manifest = [];

  for (let index = 0; index < files.length; index += 1) {
    if (signal?.aborted) throw new CancelledError();
    const file = files[index];
    let md5;
    let afterStats;
    try {
      md5 = await hashFileMd5(file.absolutePath, signal, pauseController);
      afterStats = await fs.stat(file.absolutePath);
    } catch (error) {
      if (error instanceof CancelledError || error.code === 'TASK_CANCELLED' || error.code === 'SOURCE_CHANGED') throw error;
      recordSkipped({ path: file.relativePath, reason: error.message, code: error.code || 'READ_FAILED', type: 'file', size: file.size });
      processedBytes += file.size;
      continue;
    }
    if (afterStats.size !== file.size || afterStats.mtimeMs !== file.modifiedAtMs) {
      const error = new Error(`散列期间源文件发生变化：${file.relativePath}`);
      error.code = 'SOURCE_CHANGED';
      throw error;
    }
    processedBytes += file.size;
    manifest.push({
      relativePath: file.relativePath,
      name: file.name,
      extension: file.extension,
      size: file.size,
      modifiedAt: file.modifiedAt,
      modifiedAtMs: file.modifiedAtMs,
      mediaType: file.mediaType,
      md5
    });
    onProgress({
      currentFile: file.relativePath,
      processedFiles: index + 1,
      totalFiles: files.length,
      processedBytes,
      totalBytes,
      percent: totalBytes === 0 ? 100 : Math.floor((processedBytes / totalBytes) * 100)
    });
  }

  if (files.length === 0) {
    onProgress({ processedFiles: 0, totalFiles: 0, processedBytes: 0, totalBytes: 0, percent: 100 });
  }
  Object.defineProperty(manifest, 'skippedFiles', { value: skippedFiles, enumerable: false });
  return manifest;
}

async function validateManifestUnchanged(sourcePath, sourceType, manifest, signal, pauseController) {
  for (const file of manifest) {
    await pauseController?.waitIfPaused(signal);
    if (signal?.aborted) throw new CancelledError();
    const absolutePath = sourceType === 'video'
      ? sourcePath
      : path.join(sourcePath, ...file.relativePath.split('/'));
    let stats;
    try {
      stats = await fs.stat(absolutePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        const changed = new Error(`压缩期间源文件消失：${file.relativePath}`);
        changed.code = 'SOURCE_CHANGED';
        throw changed;
      }
      throw error;
    }
    if (stats.size !== file.size || stats.mtimeMs !== file.modifiedAtMs) {
      const changed = new Error(`压缩期间源文件发生变化：${file.relativePath}`);
      changed.code = 'SOURCE_CHANGED';
      throw changed;
    }
  }
}

async function collectDirectories(sourcePath, sourceType, options = {}) {
  if (sourceType === 'video') return [];
  const { signal, pauseController } = options;
  const directories = [];
  const pending = [sourcePath];
  while (pending.length > 0) {
    await pauseController?.waitIfPaused(signal);
    if (signal?.aborted) throw new CancelledError();
    const current = pending.pop();
    let directory;
    try {
      directory = await fs.opendir(current);
    } catch (error) {
      options.onSkippedFile?.({ path: portableRelativePath(path.relative(sourcePath, current)) || '.', reason: error.message, code: error.code || 'READ_FAILED', type: 'directory' });
      continue;
    }
    for await (const entry of directory) {
      if (entry.isSymbolicLink() || !entry.isDirectory()) continue;
      const entryPath = path.join(current, entry.name);
      directories.push(portableRelativePath(path.relative(sourcePath, entryPath)));
      pending.push(entryPath);
    }
  }
  return directories.sort((left, right) => left.localeCompare(right, 'zh-CN'));
}

module.exports = {
  buildManifest,
  collectDirectories,
  collectFiles,
  hashFileMd5,
  validateManifestUnchanged
};
