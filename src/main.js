'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, net, shell } = require('electron');
const { AppStore } = require('./core/store');
const { QueueManager } = require('./core/queue-manager');
const {
  makeArchiveStagingDirectory,
  makeDefaultConfig,
  normalizePortableProgramPath,
  PORTABLE_FFMPEG_PATH,
  PORTABLE_SEVEN_ZIP_PATH,
  rebasePortableUserDataPaths,
  resolveApplicationPath
} = require('./core/paths');
const { makeUserDataLayout } = require('./core/storage-paths');
const { IMAGE_EXTENSIONS, isVideoFile } = require('./core/constants');
const { extractVideoFrames } = require('./core/media-service');
const { checkForUpdates } = require('./core/update-checker');

let mainWindow;
let queueManager;
let appStore;
let allowWindowClose = false;
let closePromptOpen = false;
let scheduleTimer = null;
let lastCatalogPushSignature = '';
const isSmokeTest = process.env.HAMSTER_SMOKE_TEST === '1';
const applicationRoot = isSmokeTest && process.env.HAMSTER_SMOKE_USER_DATA_DIR
  ? path.join(path.resolve(process.env.HAMSTER_SMOKE_USER_DATA_DIR), 'portable-root')
  : app.isPackaged ? path.dirname(app.getPath('exe')) : path.resolve(__dirname, '..');
const electronRuntimeDirectory = isSmokeTest && process.env.HAMSTER_SMOKE_USER_DATA_DIR
  ? path.resolve(process.env.HAMSTER_SMOKE_USER_DATA_DIR)
  : path.join(applicationRoot, 'userdata', 'electron');
app.setPath('userData', electronRuntimeDirectory);
if (isSmokeTest) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
}
const hasSingleInstanceLock = isSmokeTest || app.requestSingleInstanceLock();

function catalogPushSignature(catalog) {
  return JSON.stringify((catalog || []).map((record) => [
    record.id, record.metadataUpdatedAt, record.completedAt, record.coverThumbnailPath,
    record.backupLocation, record.rating, record.tags, record.possibleDuplicate
  ]));
}

if (!hasSingleInstanceLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

async function createThumbnails(job, manifest, config, options = {}) {
  const thumbnailDir = path.join(config.repositoryDirectory, 'thumbnails', job.id);
  await fs.mkdir(thumbnailDir, { recursive: true });
  const candidates = manifest.filter((file) => IMAGE_EXTENSIONS.has(file.extension) || isVideoFile(file.name));
  const limit = Math.max(1, Math.min(500, Number(config.thumbnailLimit) || 100));
  let outputIndex = 0;

  for (const file of candidates) {
    if (outputIndex >= limit) break;
    const sourcePath = job.sourceType === 'video'
      ? job.sourcePath
      : path.join(job.sourcePath, ...file.relativePath.split('/'));
    try {
      if (isVideoFile(file.name) && config.videoFrameBackup) {
        const frameCount = Math.min(Number(config.videoFrameCount) || 6, limit - outputIndex);
        let extracted = { frames: [], mediaInfo: null };
        try {
          extracted = await extractVideoFrames(
            sourcePath,
            thumbnailDir,
            outputIndex,
            frameCount,
            config,
            options
          );
        } catch (error) {
          if (options.signal?.aborted) throw error;
          options.onLog?.(`FFmpeg 视频抽帧失败，改用系统缩略图：${path.basename(sourcePath)} · ${error.message}`);
        }
        file.thumbnails = [];
        file.mediaInfo = extracted.mediaInfo;
        for (const frame of extracted.frames) {
          file.thumbnails.push({
            ...frame,
            videoGroup: file.relativePath
          });
          outputIndex += 1;
        }
        if (file.thumbnails.length > 0) {
          file.thumbnailPath = file.thumbnails[0].thumbnailPath;
          continue;
        }
      }
      const thumbnail = await nativeImage.createThumbnailFromPath(sourcePath, { width: 360, height: 240 });
      if (thumbnail.isEmpty()) continue;
      const thumbnailPath = path.join(thumbnailDir, `${String(outputIndex + 1).padStart(3, '0')}.png`);
      await fs.writeFile(thumbnailPath, thumbnail.toPNG());
      file.thumbnailPath = thumbnailPath;
      file.thumbnails = [{ thumbnailPath, type: 'image', frameIndex: null }];
      outputIndex += 1;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      options.onLog?.(`已跳过无法生成预览的媒体：${path.basename(sourcePath)} · ${error.message}`);
    }
  }
  return manifest;
}

async function storeCatalogImage(recordId, input, repositoryDirectory) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(String(recordId || ''))) {
    throw new Error('仓库记录标识无效。');
  }
  const dataUrl = String(input?.dataUrl || '');
  if (!/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(dataUrl)) {
    throw new Error('请选择 PNG、JPEG、WebP 或 GIF 图片。');
  }
  if (dataUrl.length > 36_000_000) throw new Error('单张图片不能超过约 25 MB。');
  let image = nativeImage.createFromDataURL(dataUrl);
  if (image.isEmpty()) throw new Error('图片内容无效或无法读取。');
  const size = image.getSize();
  const longestSide = Math.max(size.width, size.height);
  if (longestSide > 1600) {
    const scale = 1600 / longestSide;
    image = image.resize({
      width: Math.max(1, Math.round(size.width * scale)),
      height: Math.max(1, Math.round(size.height * scale)),
      quality: 'good'
    });
  }
  const imageId = crypto.randomUUID();
  const thumbnailDir = path.join(repositoryDirectory, 'thumbnails', `manual-${recordId}`);
  await fs.mkdir(thumbnailDir, { recursive: true });
  const thumbnailPath = path.join(thumbnailDir, `${imageId}.png`);
  const data = image.toPNG();
  await fs.writeFile(thumbnailPath, data);
  const originalName = String(input?.name || '').trim().slice(0, 200) || '手动添加图片';
  return {
    id: imageId,
    ref: `manual-image:${imageId}`,
    relativePath: originalName,
    name: originalName,
    thumbnailPath,
    size: data.length,
    mimeType: 'image/png',
    addedAt: new Date().toISOString()
  };
}

async function pathExists(targetPath) {
  try { await fs.access(targetPath); return true; } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function assertTrustedSender(event) {
  const senderUrl = event.senderFrame?.url || '';
  if (!senderUrl.startsWith('file://')) {
    throw new Error('已拒绝非本地界面的请求。');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    show: process.env.HAMSTER_SMOKE_TEST !== '1',
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: '仓鼠症大结局',
    backgroundColor: '#f3efe7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.removeMenu();
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`PRELOAD_ERROR ${preloadPath}: ${error.stack || error.message}`);
  });
  void mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', async (event) => {
    if (!queueManager?.running || allowWindowClose) return;
    event.preventDefault();
    if (closePromptOpen) return;
    closePromptOpen = true;
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: '归档任务仍在运行',
      message: '现在退出会停止整个归档队列。源文件不会被修改。',
      detail: '当前压缩会安全取消，尚未开始的任务会保留在列表中，下次打开可继续。若正在移动已验证成品，程序会先完成入库记录再退出。',
      buttons: ['继续运行', '停止队列并退出'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    closePromptOpen = false;
    if (result.response === 1) {
      await queueManager.stopForShutdown();
      allowWindowClose = true;
      mainWindow.close();
    }
  });

  if (process.env.HAMSTER_SMOKE_TEST === '1') {
    mainWindow.webContents.once('did-finish-load', async () => {
      const bridgeStatus = await mainWindow.webContents.executeJavaScript(`(() => {
        const required = [
          'getState', 'chooseDirectory', 'chooseProgram', 'changeWarehouseLocation', 'openWarehouse', 'exportWarehouse', 'importWarehouse', 'checkForUpdates', 'openUserData', 'openExternal', 'copyText', 'chooseSingle', 'saveConfig', 'scanSource',
          'addSingle', 'getDroppedPath', 'confirmTask', 'confirmAnomaly', 'cancelTask', 'retryTask', 'startQueue',
          'discardAnomaly', 'pauseQueue', 'resumeQueue', 'removeJobs', 'clearCompletedJobs', 'clearQueue', 'clearPotentialDuplicates', 'confirmAllDuplicates', 'finishNextAndPause', 'searchCatalog',
          'getCatalogSuggestions', 'openSimilarityIgnoreTerms', 'reloadSimilarityIgnoreTerms',
          'getWarehouseInsights', 'getRandomCatalogRecord',
          'getCatalogDetails', 'updateCatalogMetadata', 'addManualCatalogRecord', 'addCatalogImage',
          'setCatalogCover', 'addTagsToCatalogRecords', 'updateBackupLocationForCatalogRecords', 'undoCatalogAction', 'deleteCatalogRecords', 'getThumbnail',
          'onStateChanged', 'onTaskProgress', 'onCatalogChanged', 'onScanProgress'
        ];
        return {
          exists: typeof window.archiveApp === 'object',
          missing: required.filter((name) => typeof window.archiveApp?.[name] !== 'function')
        };
      })()`);
      if (!bridgeStatus.exists || bridgeStatus.missing.length > 0) {
        console.error(`HAMSTER_BRIDGE_TEST_FAILED ${JSON.stringify(bridgeStatus)}`);
        app.exitCode = 1;
        app.quit();
        return;
      }
      const ipcStatus = await mainWindow.webContents.executeJavaScript(`window.archiveApp.getState().then((state) => ({
        hasConfig: Boolean(state?.config),
        hasJobs: Array.isArray(state?.jobs),
        hasCatalog: Array.isArray(state?.catalog)
      }))`);
      if (!ipcStatus.hasConfig || !ipcStatus.hasJobs || !ipcStatus.hasCatalog) {
        console.error(`HAMSTER_IPC_TEST_FAILED ${JSON.stringify(ipcStatus)}`);
        app.exitCode = 1;
        app.quit();
        return;
      }
      if (process.env.HAMSTER_VIDEO_FRAME_TEST_PATH) {
        const videoPath = path.resolve(process.env.HAMSTER_VIDEO_FRAME_TEST_PATH);
        const stats = await fs.stat(videoPath);
        const frameManifest = await createThumbnails({
          id: 'video-frame-smoke',
          sourcePath: videoPath,
          sourceType: 'video'
        }, [{
          relativePath: path.basename(videoPath),
          name: path.basename(videoPath),
          extension: path.extname(videoPath).toLowerCase(),
          size: stats.size
        }], {
          ...queueManager.config,
          archiveOutputDirectory: process.env.HAMSTER_SMOKE_LIBRARY_DIR,
          videoFrameBackup: true,
          videoFrameCount: 6
        });
        const frames = frameManifest[0].thumbnails || [];
        const frameStatus = {
          count: frames.length,
          grouped: frames.every((frame) => frame.videoGroup === path.basename(videoPath)),
          increasing: frames.every((frame, index) => index === 0 || frame.timeSeconds > frames[index - 1].timeSeconds),
          filesExist: (await Promise.all(frames.map(async (frame) => {
            try { await fs.access(frame.thumbnailPath); return true; } catch { return false; }
          }))).every(Boolean)
        };
        console.log(`HAMSTER_VIDEO_FRAME_TEST ${JSON.stringify(frameStatus)}`);
        if (frameStatus.count !== 6 || !frameStatus.grouped || !frameStatus.increasing || !frameStatus.filesExist) {
          console.error('HAMSTER_VIDEO_FRAME_TEST_FAILED');
          app.exitCode = 1;
          app.quit();
          return;
        }
      }
      if (process.env.HAMSTER_SMOKE_PAGE === 'library') {
        await mainWindow.webContents.executeJavaScript(`document.querySelector('[data-page="library-page"]').click()`);
        await new Promise((resolve) => setTimeout(resolve, 500));
        const activityStatus = await mainWindow.webContents.executeJavaScript(`({
          cells: document.querySelectorAll('.activity-cell').length,
          inventory: document.querySelector('#metric-inventory')?.textContent,
          tags: document.querySelector('#metric-tags')?.textContent,
          gb: document.querySelector('#metric-gb')?.textContent
        })`);
        const defaultRandomCount = await mainWindow.webContents.executeJavaScript(`document.querySelectorAll('[data-discovery-record]').length`);
        await mainWindow.webContents.executeJavaScript(`document.querySelector('#random-walk')?.click()`);
        await new Promise((resolve) => setTimeout(resolve, 300));
        const randomWalkCount = await mainWindow.webContents.executeJavaScript(`document.querySelectorAll('[data-discovery-record]').length`);
        const manualDialogStatus = await mainWindow.webContents.executeJavaScript(`(() => {
          document.querySelector('#add-manual-catalog')?.click();
          const dialog = document.querySelector('#manual-catalog-dialog');
          const status = {
            open: Boolean(dialog?.open),
            nameRequired: Boolean(document.querySelector('#manual-catalog-name')?.required),
            notesRequired: Boolean(document.querySelector('#manual-catalog-notes')?.required)
          };
          document.querySelector('#cancel-manual-dialog')?.click();
          return status;
        })()`);
        await mainWindow.webContents.executeJavaScript(`document.querySelector('#catalog-grid-view')?.click()`);
        await new Promise((resolve) => setTimeout(resolve, 1200));
        if (process.env.HAMSTER_SMOKE_OVERVIEW_SCREENSHOT) {
          await mainWindow.webContents.executeJavaScript('window.scrollTo(0, 0)');
          await new Promise((resolve) => setTimeout(resolve, 250));
          const overviewImage = await mainWindow.webContents.capturePage();
          await fs.mkdir(path.dirname(process.env.HAMSTER_SMOKE_OVERVIEW_SCREENSHOT), { recursive: true });
          await fs.writeFile(process.env.HAMSTER_SMOKE_OVERVIEW_SCREENSHOT, overviewImage.toPNG());
        }
        await mainWindow.webContents.executeJavaScript(`document.querySelector('.catalog-cover img')?.click()`);
        await new Promise((resolve) => setTimeout(resolve, 300));
        const cardLightboxStatus = await mainWindow.webContents.executeJavaScript(`({
          open: Boolean(document.querySelector('#thumbnail-lightbox')?.open),
          hasImage: Boolean(document.querySelector('#lightbox-image')?.src),
          hasCoverButton: Boolean(document.querySelector('#set-thumbnail-cover'))
        })`);
        await mainWindow.webContents.executeJavaScript(`document.querySelector('#close-thumbnail-lightbox')?.click()`);
        if (process.env.HAMSTER_SMOKE_GRID_SCREENSHOT) {
          const gridImage = await mainWindow.webContents.capturePage();
          await fs.mkdir(path.dirname(process.env.HAMSTER_SMOKE_GRID_SCREENSHOT), { recursive: true });
          await fs.writeFile(process.env.HAMSTER_SMOKE_GRID_SCREENSHOT, gridImage.toPNG());
        }
        await mainWindow.webContents.executeJavaScript(`document.querySelector('.catalog-open')?.click()`);
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await mainWindow.webContents.executeJavaScript(`document.querySelectorAll('.thumbnail-gallery img')[1]?.click()`);
        await new Promise((resolve) => setTimeout(resolve, 300));
        const detailLightboxOpen = await mainWindow.webContents.executeJavaScript(`Boolean(document.querySelector('#thumbnail-lightbox')?.open)`);
        const selectedCoverPath = await mainWindow.webContents.executeJavaScript(`document.querySelector('#lightbox-path')?.textContent`);
        await mainWindow.webContents.executeJavaScript(`document.querySelector('#set-thumbnail-cover')?.click()`);
        await new Promise((resolve) => setTimeout(resolve, 600));
        const coverState = await mainWindow.webContents.executeJavaScript(`window.archiveApp.getState().then((state) => {
          const record = state.catalog.find((item) => item.id === 'smoke-record');
          return { coverRelativePath: record?.coverRelativePath, coverThumbnailRef: record?.coverThumbnailRef, coverThumbnailPath: record?.coverThumbnailPath };
        })`);
        await mainWindow.webContents.executeJavaScript(`document.querySelector('#close-thumbnail-lightbox')?.click()`);
        const libraryStatus = await mainWindow.webContents.executeJavaScript(`({
          hasHeading: Boolean(document.querySelector('.archive-heading')),
          hasTree: Boolean(document.querySelector('.virtual-directory-tree')),
          hasEditor: Boolean(document.querySelector('.catalog-editor-form')),
          hasGridMode: document.querySelector('#library-layout')?.classList.contains('grid-mode'),
          coverImages: document.querySelectorAll('.catalog-cover img[src]').length,
          hasFileBadge: Boolean(document.querySelector('.file-count-badge')),
          hasCatalogCheckbox: Boolean(document.querySelector('.catalog-select')),
          hasBulkToolbar: Boolean(document.querySelector('.warehouse-bulkbar')),
          hasInventoryDate: document.querySelector('#catalog-detail')?.innerText.includes('入库日期'),
          hasBackupFilter: document.querySelectorAll('#catalog-backup-filter option').length >= 2,
          hasBackupSetting: Boolean(document.querySelector('#record-backup-location') && document.querySelector('#backup-location')),
          hasNewControls: Boolean(document.querySelector('#finish-next') && document.querySelector('#clear-duplicates') &&
            document.querySelector('#clear-completed') && document.querySelector('#open-usage-guide') &&
            document.querySelector('#check-for-updates') && document.querySelector('#export-warehouse') &&
            document.querySelector('#import-warehouse') &&
            document.querySelector('#refresh-catalog') && document.querySelector('#update-backup-selected') &&
            document.querySelector('#undo-catalog') && document.querySelector('#bulk-tags-dialog') &&
            document.querySelector('#set-warehouse-location') && document.querySelector('#open-warehouse')),
          hasNoTreeBulkButtons: !document.querySelector('#expand-library-tree') && !document.querySelector('#collapse-library-tree'),
          hasNoDailyReview: !document.querySelector('#daily-review'),
          stagingIsDerived: Boolean(document.querySelector('#archive-staging-directory[readonly]') &&
            !document.querySelector('[data-pick="archive-staging-directory"]')),
          hasCollapsibleMedia: Boolean(document.querySelector('details.media-preview-section')),
          passwordHidden: document.querySelector('#archive-password')?.type === 'password',
          inlineBulkTagRemoved: !document.querySelector('#bulk-catalog-tags'),
          bulkPasswordRemoved: !document.querySelector('#update-password-selected') && !document.querySelector('#bulk-password-dialog'),
          passwordEditorReadOnly: Boolean(document.querySelector('.password-editor-control input[readonly]')),
          paginationVisible: !document.querySelector('#catalog-pagination')?.hidden,
          paginationText: document.querySelector('#catalog-page-status')?.textContent,
          hasBackupText: document.querySelector('#catalog-detail')?.innerText.includes('百度网盘'),
          dotArtCount: document.querySelectorAll('[data-dot-art], .dot-art').length,
          thumbnailImages: document.querySelectorAll('.thumbnail-card img[src]').length,
          virtualTreeRows: document.querySelectorAll('.virtual-tree-row').length,
          detailText: document.querySelector('#catalog-detail')?.innerText.slice(0, 120)
        })`);
        console.log(`HAMSTER_LIBRARY_TEST ${JSON.stringify({ ...libraryStatus, manualDialogStatus, activityStatus, defaultRandomCount, randomWalkCount, cardLightboxStatus, detailLightboxOpen, selectedCoverPath, coverState })}`);
        if (!libraryStatus.hasHeading || !libraryStatus.hasTree || !libraryStatus.hasEditor ||
            !libraryStatus.hasGridMode || libraryStatus.coverImages < 1 || !libraryStatus.hasFileBadge ||
            !libraryStatus.hasCatalogCheckbox || !libraryStatus.hasBulkToolbar || !libraryStatus.hasInventoryDate ||
            !libraryStatus.hasBackupFilter || !libraryStatus.hasBackupSetting || !libraryStatus.hasBackupText ||
            !libraryStatus.hasNewControls || !libraryStatus.passwordHidden || !libraryStatus.inlineBulkTagRemoved ||
            !libraryStatus.bulkPasswordRemoved || !libraryStatus.passwordEditorReadOnly ||
            !libraryStatus.hasNoTreeBulkButtons || !libraryStatus.hasNoDailyReview ||
            !libraryStatus.stagingIsDerived || !libraryStatus.hasCollapsibleMedia ||
            (Number(process.env.HAMSTER_SMOKE_CATALOG_COUNT || 0) > 24 && !libraryStatus.paginationVisible) ||
            !manualDialogStatus.open || !manualDialogStatus.nameRequired || !manualDialogStatus.notesRequired ||
            activityStatus.cells !== 112 || Number(activityStatus.inventory) < 2 ||
            defaultRandomCount !== 1 || randomWalkCount !== 1 ||
            !cardLightboxStatus.open || !cardLightboxStatus.hasImage || !cardLightboxStatus.hasCoverButton ||
            !detailLightboxOpen || !selectedCoverPath || coverState.coverThumbnailRef !== selectedCoverPath ||
            coverState.coverThumbnailPath !== selectedCoverPath ||
            libraryStatus.dotArtCount !== 0 || libraryStatus.thumbnailImages < 1 || libraryStatus.virtualTreeRows < 1) {
          console.error('HAMSTER_LIBRARY_TEST_FAILED');
          app.exitCode = 1;
          app.quit();
          return;
        }
      }
      if (process.env.HAMSTER_SCREENSHOT_PATH) {
        if (process.env.HAMSTER_SMOKE_ADVANCED === '1') {
          await mainWindow.webContents.executeJavaScript(`
            const advanced = document.querySelector('details.advanced');
            if (advanced) {
              advanced.open = true;
              advanced.scrollIntoView({ block: 'start' });
            }
          `);
        }
        if (process.env.HAMSTER_SCREENSHOT_TOP === '1') {
          await mainWindow.webContents.executeJavaScript(`
            document.querySelectorAll('dialog[open]').forEach((dialogElement) => dialogElement.close());
            window.scrollTo(0, 0);
          `);
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
        const image = await mainWindow.webContents.capturePage();
        await fs.mkdir(path.dirname(process.env.HAMSTER_SCREENSHOT_PATH), { recursive: true });
        await fs.writeFile(process.env.HAMSTER_SCREENSHOT_PATH, image.toPNG());
      }
      console.log(`HAMSTER_SMOKE_TEST_OK ${JSON.stringify({ bridgeStatus, ipcStatus })}`);
      app.quit();
    });
  }
}

function registerIpc() {
  ipcMain.handle('state:get', (event) => {
    assertTrustedSender(event);
    return queueManager.getState();
  });

  ipcMain.handle('dialog:choose-directory', async (event, initialPath) => {
    assertTrustedSender(event);
    const configuredPath = String(initialPath || '').trim();
    const result = await dialog.showOpenDialog(mainWindow, {
      ...(configuredPath ? { defaultPath: path.resolve(configuredPath) } : {}),
      properties: ['openDirectory', 'createDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:choose-program', async (event, initialPath) => {
    assertTrustedSender(event);
    const configuredPath = String(initialPath || '').trim();
    const resolvedPath = configuredPath ? resolveApplicationPath(applicationRoot, configuredPath) : '';
    const defaultPath = resolvedPath && path.extname(resolvedPath)
      ? resolvedPath
      : (resolvedPath || undefined);
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 7-Zip 程序',
      ...(defaultPath ? { defaultPath: path.resolve(defaultPath) } : {}),
      properties: ['openFile'],
      filters: [{ name: '7-Zip 程序', extensions: ['exe'] }]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('warehouse:change-location', async (event) => {
    assertTrustedSender(event);
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择仓库位置（saves）',
      defaultPath: queueManager.config.repositoryDirectory,
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled) return null;
    return queueManager.changeWarehouseDirectory(result.filePaths[0]);
  });

  ipcMain.handle('warehouse:open', async (event) => {
    assertTrustedSender(event);
    await fs.mkdir(queueManager.config.repositoryDirectory, { recursive: true });
    const message = await shell.openPath(queueManager.config.repositoryDirectory);
    if (message) throw new Error(`无法打开仓库：${message}`);
    return true;
  });

  ipcMain.handle('warehouse:export', async (event) => {
    assertTrustedSender(event);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = path.join(
      queueManager.config.repositoryDirectory,
      `hamster-warehouse-export-${stamp}.zip`
    );
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出仓库为压缩包',
      defaultPath,
      filters: [{ name: '仓库压缩包', extensions: ['zip'] }]
    });
    if (result.canceled || !result.filePath) return null;
    return queueManager.exportWarehouseToFile(result.filePath);
  });

  ipcMain.handle('warehouse:import', async (event) => {
    assertTrustedSender(event);
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择外来仓库压缩包或目录',
      defaultPath: queueManager.config.repositoryDirectory,
      properties: ['openFile', 'openDirectory'],
      filters: [{ name: '仓库压缩包', extensions: ['zip'] }]
    });
    if (result.canceled) return null;
    return queueManager.importWarehouseFromArchiveOrDirectory(result.filePaths[0]);
  });

  ipcMain.handle('app:check-for-updates', async (event) => {
    assertTrustedSender(event);
    const result = await checkForUpdates({ currentVersion: app.getVersion(), fetchImpl: net.fetch });
    if (!result.updateAvailable) {
      await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '检查更新',
        message: `当前已是最新版本（${result.currentVersion}）`,
        detail: result.latestVersion ? `GitHub 最新版本：${result.latestVersion}` : 'GitHub 暂无正式发行版。',
        buttons: ['知道了']
      });
      return result;
    }
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '发现新版本',
      message: `可以更新到 ${result.latestVersion}`,
      detail: `当前版本：${result.currentVersion}\n建议前往 GitHub 查看发行说明并下载。`,
      buttons: ['前往 GitHub', '稍后'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    if (response.response === 0) await shell.openExternal(result.releaseUrl);
    return result;
  });

  ipcMain.handle('user-data:open', async (event) => {
    assertTrustedSender(event);
    const userDataDirectory = path.resolve(queueManager.config.userDataDirectory);
    await fs.mkdir(userDataDirectory, { recursive: true });
    const message = await shell.openPath(userDataDirectory);
    if (message) throw new Error(`无法打开用户数据区：${message}`);
    return true;
  });

  ipcMain.handle('similarity:open-ignore-terms', async (event) => {
    assertTrustedSender(event);
    const filePath = await queueManager.ensureSimilarityIgnoreTermsFile();
    const message = await shell.openPath(filePath);
    if (message) throw new Error(`无法打开相似度排除词表：${message}`);
    return { path: filePath, count: queueManager.similarityIgnoreTerms.length };
  });

  ipcMain.handle('similarity:reload-ignore-terms', async (event) => {
    assertTrustedSender(event);
    return queueManager.reloadSimilarityIgnoreTerms();
  });

  ipcMain.handle('system:open-external', async (event, value) => {
    assertTrustedSender(event);
    const url = new URL(String(value || ''));
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('只允许打开 HTTP 或 HTTPS 链接。');
    await shell.openExternal(url.href);
    return true;
  });

  ipcMain.handle('system:copy-text', (event, value) => {
    assertTrustedSender(event);
    const content = String(value || '');
    if (content.length > 10_000) throw new Error('复制内容过长。');
    clipboard.writeText(content);
    return true;
  });

  ipcMain.handle('dialog:choose-single', async (event, kind) => {
    assertTrustedSender(event);
    const options = kind === 'video'
      ? {
          properties: ['openFile'],
          filters: [{
            name: '视频文件',
            extensions: ['3gp', 'avi', 'flv', 'm2ts', 'm4v', 'mkv', 'mov', 'mp4', 'mpeg', 'mpg', 'mts', 'rm', 'rmvb', 'ts', 'vob', 'webm', 'wmv']
          }]
        }
      : { properties: ['openDirectory'] };
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('config:save', async (event, config) => {
    assertTrustedSender(event);
    return queueManager.updateConfig(config);
  });

  ipcMain.handle('source:scan', async (event, intakeDirectory) => {
    assertTrustedSender(event);
    return queueManager.scanSource(intakeDirectory);
  });

  ipcMain.handle('task:add-single', async (event, sourcePath) => {
    assertTrustedSender(event);
    return queueManager.addSingle(sourcePath);
  });

  ipcMain.handle('task:confirm', async (event, jobId) => {
    assertTrustedSender(event);
    return queueManager.confirmJob(jobId);
  });

  ipcMain.handle('task:confirm-anomaly', async (event, jobId) => {
    assertTrustedSender(event);
    return queueManager.confirmAnomaly(jobId);
  });
  ipcMain.handle('task:discard-anomaly', async (event, jobId) => {
    assertTrustedSender(event);
    return queueManager.discardAnomalousArchive(jobId);
  });

  ipcMain.handle('task:cancel', async (event, jobId) => {
    assertTrustedSender(event);
    return queueManager.cancelJob(jobId);
  });

  ipcMain.handle('task:retry', async (event, jobId) => {
    assertTrustedSender(event);
    return queueManager.retryJob(jobId);
  });

  ipcMain.handle('queue:start', (event) => {
    assertTrustedSender(event);
    void queueManager.startQueue();
    return queueManager.getState();
  });

  ipcMain.handle('queue:pause', async (event) => {
    assertTrustedSender(event);
    return queueManager.pauseCurrent();
  });

  ipcMain.handle('queue:resume', async (event) => {
    assertTrustedSender(event);
    return queueManager.resumeCurrent();
  });

  ipcMain.handle('queue:remove-jobs', async (event, jobIds) => {
    assertTrustedSender(event);
    return queueManager.removeJobs(jobIds);
  });

  ipcMain.handle('queue:clear', async (event) => {
    assertTrustedSender(event);
    return queueManager.clearQueue();
  });

  ipcMain.handle('queue:clear-completed', async (event) => {
    assertTrustedSender(event);
    return queueManager.clearCompletedJobs();
  });

  ipcMain.handle('queue:clear-duplicates', async (event) => {
    assertTrustedSender(event);
    return queueManager.removePotentialDuplicateJobs();
  });
  ipcMain.handle('queue:confirm-all-duplicates', async (event) => {
    assertTrustedSender(event);
    return queueManager.confirmAllDuplicateJobs();
  });

  ipcMain.handle('queue:finish-next', (event) => {
    assertTrustedSender(event);
    void queueManager.finishNextAndPause();
    return queueManager.getState();
  });

  ipcMain.handle('catalog:search', (event, query) => {
    assertTrustedSender(event);
    return queueManager.searchCatalog(query);
  });
  ipcMain.handle('catalog:suggestions', (event, query) => {
    assertTrustedSender(event);
    return queueManager.getCatalogSuggestions(query);
  });

  ipcMain.handle('catalog:insights', (event) => {
    assertTrustedSender(event);
    return queueManager.getWarehouseInsights();
  });

  ipcMain.handle('catalog:random', (event, excludeId) => {
    assertTrustedSender(event);
    return queueManager.getRandomCatalogRecord(excludeId);
  });

  ipcMain.handle('catalog:details', (event, recordId) => {
    assertTrustedSender(event);
    return queueManager.getCatalogDetails(recordId);
  });

  ipcMain.handle('catalog:update-metadata', async (event, recordId, metadata) => {
    assertTrustedSender(event);
    return queueManager.updateCatalogMetadata(recordId, metadata);
  });

  ipcMain.handle('catalog:set-cover', async (event, recordId, relativePath) => {
    assertTrustedSender(event);
    return queueManager.setCatalogCover(recordId, relativePath);
  });

  ipcMain.handle('catalog:delete-thumbnail', async (event, recordId, thumbnailRef) => {
    assertTrustedSender(event);
    return queueManager.deleteCatalogThumbnail(recordId, thumbnailRef);
  });

  ipcMain.handle('catalog:add-manual', async (event, input) => {
    assertTrustedSender(event);
    return queueManager.addManualCatalogRecord(input);
  });

  ipcMain.handle('catalog:add-image', async (event, recordId, input) => {
    assertTrustedSender(event);
    return queueManager.addCatalogImage(recordId, input);
  });

  ipcMain.handle('catalog:add-tags', async (event, recordIds, tags) => {
    assertTrustedSender(event);
    return queueManager.addTagsToCatalogRecords(recordIds, tags);
  });

  ipcMain.handle('catalog:update-backup-location', async (event, recordIds, location) => {
    assertTrustedSender(event);
    return queueManager.updateBackupLocationForCatalogRecords(recordIds, location);
  });


  ipcMain.handle('catalog:undo', async (event) => {
    assertTrustedSender(event);
    return queueManager.undoCatalogAction();
  });

  ipcMain.handle('catalog:delete', async (event, recordIds) => {
    assertTrustedSender(event);
    return queueManager.deleteCatalogRecords(recordIds);
  });

  ipcMain.handle('catalog:thumbnail', async (event, recordId, relativePath) => {
    assertTrustedSender(event);
    const thumbnailPath = queueManager.getThumbnailPath(recordId, relativePath);
    if (!thumbnailPath) return null;
    const data = await fs.readFile(thumbnailPath);
    const mimeType = /\.jpe?g$/i.test(thumbnailPath) ? 'image/jpeg'
      : /\.webp$/i.test(thumbnailPath) ? 'image/webp'
        : 'image/png';
    return `data:${mimeType};base64,${data.toString('base64')}`;
  });
}

if (hasSingleInstanceLock) app.whenReady().then(async () => {
  const workspaceRoot = applicationRoot;
  const userDataLayout = makeUserDataLayout(workspaceRoot);
  const store = new AppStore(userDataLayout);
  appStore = store;
  const config = rebasePortableUserDataPaths(
    await store.loadSettings(makeDefaultConfig(workspaceRoot, userDataLayout)),
    userDataLayout
  );
  delete config.ffprobePath;
  config.sevenZipPath = normalizePortableProgramPath(config.sevenZipPath, workspaceRoot, PORTABLE_SEVEN_ZIP_PATH);
  config.ffmpegPath = normalizePortableProgramPath(config.ffmpegPath, workspaceRoot, PORTABLE_FFMPEG_PATH);
  if (!(await pathExists(resolveApplicationPath(workspaceRoot, config.sevenZipPath)))) {
    config.sevenZipPath = PORTABLE_SEVEN_ZIP_PATH;
  }
  if (!(await pathExists(resolveApplicationPath(workspaceRoot, config.ffmpegPath)))) {
    config.ffmpegPath = PORTABLE_FFMPEG_PATH;
  }
  if (process.env.HAMSTER_SMOKE_LIBRARY_DIR) {
    config.archiveOutputDirectory = process.env.HAMSTER_SMOKE_LIBRARY_DIR;
    config.repositoryDirectory = process.env.HAMSTER_SMOKE_WAREHOUSE_DIR || path.join(process.env.HAMSTER_SMOKE_LIBRARY_DIR, 'saves');
  }
  config.archiveStagingDirectory = makeArchiveStagingDirectory(config.archiveOutputDirectory);
  for (const directory of [config.repositoryDirectory].filter(Boolean)) {
    await fs.mkdir(directory, { recursive: true });
  }
  await store.saveSettings(config);
  queueManager = new QueueManager(store, config, {
    createThumbnails,
    storeCatalogImage,
    trashItem: (targetPath) => shell.trashItem(targetPath),
    resolveProgramPath: (configuredPath) => resolveApplicationPath(workspaceRoot, configuredPath)
  });
  await queueManager.initialize();
  scheduleTimer = setInterval(() => {
    void queueManager.handleScheduleTick().catch((error) => console.error('SCHEDULE_ERROR', error));
  }, 15_000);
  scheduleTimer.unref?.();
  if (process.env.HAMSTER_TRASH_TEST_DIR) {
    const trashTestDir = path.resolve(process.env.HAMSTER_TRASH_TEST_DIR);
    if (!path.basename(trashTestDir).startsWith('hamster-trash-smoke-')) {
      throw new Error('回收站测试目录名称不符合安全规则。');
    }
    await fs.mkdir(trashTestDir, { recursive: false });
    await fs.writeFile(path.join(trashTestDir, 'temporary-test-file.txt'), 'temporary recycle bin test', 'utf8');
    await shell.trashItem(trashTestDir);
    try {
      await fs.access(trashTestDir);
      throw new Error('回收站测试失败：临时目录仍然存在。');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    console.log('HAMSTER_TRASH_TEST_OK');
  }
  if (process.env.HAMSTER_SMOKE_FIXTURE_IMAGE) {
    const fixtureImage = process.env.HAMSTER_SMOKE_FIXTURE_IMAGE;
    const imageStats = await fs.stat(fixtureImage);
    const fixtureJob = {
      id: 'smoke-fixture',
      sourcePath: path.dirname(fixtureImage),
      sourceType: 'directory'
    };
    const fixtureManifest = await createThumbnails(fixtureJob, [{
      relativePath: path.basename(fixtureImage),
      name: path.basename(fixtureImage),
      extension: path.extname(fixtureImage).toLowerCase(),
      size: imageStats.size,
      md5: 'fixture-image-md5'
    }], config);
    fixtureManifest.push({
      ...fixtureManifest[0],
      relativePath: '相册/第二张候选封面.png',
      name: '第二张候选封面.png',
      md5: 'fixture-second-cover-md5'
    });
    fixtureManifest.push({
      relativePath: '相册/子目录/示例视频.mp4',
      name: '示例视频.mp4',
      extension: '.mp4',
      size: 734003200,
      md5: 'fixture-video-md5',
      mediaType: 'video'
    });
    queueManager.catalog = [{
      id: 'smoke-record',
      jobId: 'smoke-job',
      sourcePath: 'E:\\示例来源\\旅行相册',
      displayName: '旅行相册（界面测试）',
      title: '北海道冬季旅行',
      tags: ['摄影', '旅行'],
      rating: 5,
      notes: '用于验证仓库整理信息、标签和星级显示。',
      backupLocation: '百度网盘',
      coverRelativePath: null,
      sourceType: 'directory',
      recordType: 'archive',
      fileCount: fixtureManifest.length,
      originalBytes: fixtureManifest.reduce((sum, file) => sum + file.size, 0),
      archiveBaseName: 'arc_20260815T010000Z_smoketest.7z',
      archiveDirectory: config.archiveOutputDirectory,
      archiveFiles: [{ name: 'arc_20260815T010000Z_smoketest.7z', size: 700000000 }],
      archiveTotalBytes: 700000000,
      manifest: fixtureManifest,
      directories: ['相册', '相册/子目录', '空目录'],
      passwordScheme: 'fixed-v1',
      sourceDisposition: 'kept',
      verifiedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      inventoryDate: new Date().toISOString()
    }];
    const reviewInventoryDate = new Date();
    reviewInventoryDate.setFullYear(reviewInventoryDate.getFullYear() - 1);
    queueManager.catalog.push({
      ...queueManager.catalog[0],
      id: 'smoke-review-record',
      jobId: 'smoke-review-job',
      title: '去年今日的旅行记忆',
      displayName: '去年今日的旅行记忆',
      archiveDirectory: config.archiveOutputDirectory,
      archiveBaseName: 'arc_smoke_review.7z',
      archiveFiles: [{ name: 'arc_smoke_review.7z', size: 700000000 }],
      manifest: fixtureManifest.map((file) => ({ ...file })),
      completedAt: reviewInventoryDate.toISOString(),
      inventoryDate: reviewInventoryDate.toISOString()
    });
    const requestedCatalogCount = Math.max(2, Number(process.env.HAMSTER_SMOKE_CATALOG_COUNT) || 2);
    for (let index = 2; index < requestedCatalogCount; index += 1) {
      queueManager.catalog.unshift({
        ...queueManager.catalog[0],
        id: `smoke-extra-record-${index}`,
        jobId: `smoke-extra-job-${index}`,
        title: `分页测试库存 ${String(index + 1).padStart(2, '0')}`,
        displayName: `分页测试库存 ${String(index + 1).padStart(2, '0')}`,
        archiveDirectory: config.archiveOutputDirectory,
        archiveBaseName: `arc_smoke_extra_${index}.7z`,
        archiveFiles: [{ name: `arc_smoke_extra_${index}.7z`, size: 1_000_000 }],
        manifest: [],
        completedAt: new Date(Date.now() - (index * 86_400_000)).toISOString(),
        inventoryDate: new Date(Date.now() - (index * 86_400_000)).toISOString()
      });
    }
  }
  registerIpc();
  createWindow();

  lastCatalogPushSignature = catalogPushSignature(queueManager.getState().catalog);
  queueManager.on('state', (state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const { catalog, ...queueState } = state;
      mainWindow.webContents.send('state:changed', queueState);
      const catalogSignature = catalogPushSignature(catalog);
      if (catalogSignature !== lastCatalogPushSignature) {
        lastCatalogPushSignature = catalogSignature;
        mainWindow.webContents.send('catalog:changed', catalog);
      }
    }
  });
  queueManager.on('progress', (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('task:progress', progress);
  });
  queueManager.on('scan-progress', (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan:progress', progress);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error) => {
  if (process.env.HAMSTER_SMOKE_TEST === '1') console.error(`HAMSTER_STARTUP_FAILED ${error.stack || error.message}`);
  else dialog.showErrorBox('程序启动失败', error.message);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  appStore?.closeAll();
});
