'use strict';

if (!window.archiveApp) {
  document.querySelector('#desktop-required').hidden = false;
  throw new Error('桌面桥接未加载：请使用 HamsterArchive.exe，不要直接打开网页文件。');
}

const elements = {
  intakeDirectory: document.querySelector('#intake-directory'),
  archiveStagingDirectory: document.querySelector('#archive-staging-directory'),
  archiveOutputDirectory: document.querySelector('#archive-output-directory'),
  moveCompleted: document.querySelector('#move-completed'),
  processedSourceDirectory: document.querySelector('#processed-source-directory'),
  processedSourceDirectoryField: document.querySelector('#processed-source-directory-field'),
  customArchiveName: document.querySelector('#custom-archive-name'),
  archiveFormat: document.querySelector('#archive-format'),
  compressionLevel: document.querySelector('#compression-level'),
  autoTrash: document.querySelector('#auto-trash-completed'),
  recordBackupLocation: document.querySelector('#record-backup-location'),
  backupLocation: document.querySelector('#backup-location'),
  backupLocationField: document.querySelector('#backup-location-field'),
  password: document.querySelector('#archive-password'),
  recordArchivePassword: document.querySelector('#record-archive-password'),
  thumbnailLimit: document.querySelector('#thumbnail-limit'),
  videoFrameBackup: document.querySelector('#video-frame-backup'),
  videoFrameCount: document.querySelector('#video-frame-count'),
  smallItemFilter: document.querySelector('#small-item-filter'),
  minimumTaskMb: document.querySelector('#minimum-task-mb'),
  scheduleEnabled: document.querySelector('#schedule-enabled'),
  scheduleStart: document.querySelector('#schedule-start'),
  scheduleEnd: document.querySelector('#schedule-end'),
  safetyChip: document.querySelector('#source-safety-chip'),
  notice: document.querySelector('#notice'),
  taskList: document.querySelector('#task-list'),
  taskListContainer: document.querySelector('#task-list-container'),
  emptyTasks: document.querySelector('#empty-tasks'),
  selectAllTasks: document.querySelector('#select-all-tasks'),
  selectionCount: document.querySelector('#selection-count'),
  removeSelected: document.querySelector('#remove-selected'),
  looseSummary: document.querySelector('#loose-summary'),
  logList: document.querySelector('#log-list'),
  catalogList: document.querySelector('#catalog-list'),
  catalogDetail: document.querySelector('#catalog-detail'),
  catalogSearch: document.querySelector('#catalog-search'),
  catalogSuggestions: document.querySelector('#catalog-suggestions'),
  catalogTagFilter: document.querySelector('#catalog-tag-filter'),
  catalogBackupFilter: document.querySelector('#catalog-backup-filter'),
  catalogRatingFilter: document.querySelector('#catalog-rating-filter'),
  catalogSort: document.querySelector('#catalog-sort'),
  catalogListView: document.querySelector('#catalog-list-view'),
  catalogGridView: document.querySelector('#catalog-grid-view'),
  libraryLayout: document.querySelector('#library-layout'),
  warehousePath: document.querySelector('#warehouse-path'),
  userDataPath: document.querySelector('#user-data-path'),
  selectAllCatalog: document.querySelector('#select-all-catalog'),
  catalogSelectionCount: document.querySelector('#catalog-selection-count'),
  addTagsSelected: document.querySelector('#add-tags-selected'),
  updateBackupSelected: document.querySelector('#update-backup-selected'),
  undoCatalog: document.querySelector('#undo-catalog'),
  deleteCatalogSelected: document.querySelector('#delete-catalog-selected'),
  manualCatalogDialog: document.querySelector('#manual-catalog-dialog'),
  manualCatalogForm: document.querySelector('#manual-catalog-form'),
  manualCatalogName: document.querySelector('#manual-catalog-name'),
  manualCatalogNotes: document.querySelector('#manual-catalog-notes'),
  manualCatalogTags: document.querySelector('#manual-catalog-tags'),
  manualCatalogSource: document.querySelector('#manual-catalog-source'),
  manualCatalogBackup: document.querySelector('#manual-catalog-backup'),
  manualCatalogImages: document.querySelector('#manual-catalog-images'),
  manualImagePaste: document.querySelector('#manual-image-paste'),
  manualImagePreview: document.querySelector('#manual-image-preview'),
  bulkTagsDialog: document.querySelector('#bulk-tags-dialog'),
  bulkTagsForm: document.querySelector('#bulk-tags-form'),
  bulkTagsInput: document.querySelector('#bulk-tags-input'),
  bulkBackupDialog: document.querySelector('#bulk-backup-dialog'),
  bulkBackupForm: document.querySelector('#bulk-backup-form'),
  bulkBackupInput: document.querySelector('#bulk-backup-input'),
  deleteCatalogDialog: document.querySelector('#delete-catalog-dialog'),
  deleteCatalogForm: document.querySelector('#delete-catalog-form'),
  deleteCatalogSummary: document.querySelector('#delete-catalog-summary'),
  restoreOriginalSources: document.querySelector('#restore-original-sources'),
  restoreOriginalSourcesHelp: document.querySelector('#restore-original-sources-help'),
  catalogPagination: document.querySelector('#catalog-pagination'),
  catalogPageStatus: document.querySelector('#catalog-page-status'),
  catalogPagePrev: document.querySelector('#catalog-page-prev'),
  catalogPageNext: document.querySelector('#catalog-page-next'),
  metricInventory: document.querySelector('#metric-inventory'),
  metricTags: document.querySelector('#metric-tags'),
  metricGb: document.querySelector('#metric-gb'),
  activityGrid: document.querySelector('#activity-grid'),
  activityMonths: document.querySelector('#activity-months'),
  warehouseDiscovery: document.querySelector('#warehouse-discovery'),
  thumbnailLightbox: document.querySelector('#thumbnail-lightbox'),
  lightboxImage: document.querySelector('#lightbox-image'),
  lightboxTitle: document.querySelector('#lightbox-title'),
  lightboxPath: document.querySelector('#lightbox-path'),
  setThumbnailCover: document.querySelector('#set-thumbnail-cover'),
  deleteThumbnail: document.querySelector('#delete-thumbnail'),
  runningIndicator: document.querySelector('#running-indicator'),
  toast: document.querySelector('#toast')
};

const statusLabels = {
  awaiting_confirmation: '等待确认',
  awaiting_duplicate_confirmation: '重复待确认',
  awaiting_anomaly_confirmation: '大小异常待核验',
  queued: '等待压缩',
  inventorying: '生成清单与 MD5',
  compressing: '压缩中',
  verifying: '完整性验证',
  moving: '移入库目录',
  completed: '已完成',
  completed_cleanup_failed: '归档完成/源文件处理失败',
  failed: '失败',
  cancelled: '已取消'
};

let currentState = null;
let activeCatalogId = null;
let currentCatalogResults = [];
let catalogViewMode = localStorage.getItem('hamster-catalog-view-v2') === 'list' ? 'list' : 'grid';
let currentWarehouseInsights = null;
let warehouseInsightsSignature = '';
let discoveryMode = 'loading';
let currentDiscoveryRecordIds = [];
let lightboxContext = null;
let taskListCollapsed = false;
let catalogPage = 1;
const CATALOG_PAGE_SIZE = 24;
let catalogRefreshDirty = false;
let lastCatalogRefreshAt = 0;
let catalogSearchSequence = 0;
let catalogSuggestionSequence = 0;
let catalogStateSignature = '';
let suppressSelectionClickUntil = 0;
let toastTimer;
let pendingManualImages = [];
let similarityManageRecordId = null;
const selectedJobIds = new Set();
const selectedCatalogIds = new Set();

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value >= 100 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function deriveStagingDirectory(archiveOutputDirectory) {
  const raw = String(archiveOutputDirectory || '').trim();
  if (/^[A-Za-z]:[\\/]$/.test(raw) || raw === '/') return `${raw}-staging`;
  const output = raw.replace(/[\\/]+$/, '');
  return output ? `${output}-staging` : '';
}

function formatRemainingTime(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '不到 1 分钟';
  const minutes = Math.max(1, Math.ceil(milliseconds / 60_000));
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} 小时 ${remainder} 分钟` : `${hours} 小时`;
}

function queueEstimateText(activeJob, percentage = activeJob.progress || 0) {
  if (!currentState || activeJob.status !== 'compressing') return '';
  const eligible = currentState.jobs.filter((job) => !['cancelled', 'failed'].includes(job.status));
  const completed = eligible.filter((job) => String(job.status || '').startsWith('completed')).length;
  const samples = (currentState.config?.compressionHistory || [])
    .map((sample) => Number(sample.bytes) / Number(sample.durationMs))
    .filter((rate) => Number.isFinite(rate) && rate > 0)
    .sort((a, b) => a - b);
  const bytesPerMs = samples.length ? samples[Math.floor(samples.length / 2)] : (20 * 1024 ** 2) / 1000;
  const activeRemaining = Number(activeJob.totalBytes || 0) * Math.max(0, 100 - percentage) / 100;
  const queuedRemaining = eligible
    .filter((job) => job.status === 'queued')
    .reduce((sum, job) => sum + Number(job.totalBytes || 0), 0);
  const remainingMs = (activeRemaining + queuedRemaining) / bytesPerMs +
    (eligible.filter((job) => job.status === 'queued').length * 60_000);
  return `已完成 ${completed}/${eligible.length} 项 · 预计还需 ${formatRemainingTime(remainingMs)}`;
}

function taskProgressText(job, percentage = job.progress || 0) {
  const base = job.stageText || `${statusLabels[job.status] || job.status} · ${Math.round(percentage)}%`;
  const estimate = queueEstimateText(job, percentage);
  return estimate ? `${base} · ${estimate}` : base;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function videoInfoText(file) {
  const info = file?.mediaInfo;
  if (!info) return '';
  return [
    info.durationSeconds ? formatDuration(info.durationSeconds) : null,
    info.width && info.height ? `${info.width}×${info.height}` : null,
    info.codec || null,
    info.container ? String(info.container).split(',')[0] : null
  ].filter(Boolean).join(' · ');
}

function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle('error', isError);
  elements.toast.hidden = false;
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 4500);
}

async function safely(action) {
  try {
    return await action();
  } catch (error) {
    showToast(error.message || String(error), true);
    return null;
  }
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function catalogTitle(record) {
  return record.title || record.displayName || '未命名归档';
}

function starText(rating) {
  const value = Number(rating) || 0;
  return value > 0 ? `${'★'.repeat(value)}${'☆'.repeat(5 - value)}` : '未评分';
}

function formatCatalogDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    return `${String(value).replaceAll('-', '/')}（旧记录，仅日期）`;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '日期未知';
  return date.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  });
}

function formatDecimalGb(bytes) {
  const value = (Number(bytes) || 0) / 1_000_000_000;
  if (value === 0) return '0';
  if (value >= 1000) return value.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
  if (value >= 100) return value.toFixed(0);
  return value.toFixed(1).replace(/\.0$/, '');
}

function activityLevel(entry, maxBytes, maxCount) {
  if (entry.future) return -1;
  if (entry.inventoryCount === 0) return 0;
  if (maxBytes > 0 && entry.originalBytes > 0) {
    return Math.max(1, Math.ceil((Math.log1p(entry.originalBytes) / Math.log1p(maxBytes)) * 4));
  }
  return Math.max(1, Math.ceil((entry.inventoryCount / Math.max(1, maxCount)) * 4));
}

function renderWarehouseInsights(insights) {
  currentWarehouseInsights = insights;
  elements.metricInventory.textContent = Number(insights.inventoryCount || 0).toLocaleString('zh-CN');
  elements.metricTags.textContent = Number(insights.uniqueTagCount || 0).toLocaleString('zh-CN');
  elements.metricGb.textContent = formatDecimalGb(insights.totalOriginalBytes);

  const maxBytes = Math.max(0, ...insights.activity.map((entry) => entry.originalBytes || 0));
  const maxCount = Math.max(0, ...insights.activity.map((entry) => entry.inventoryCount || 0));
  elements.activityGrid.replaceChildren();
  for (const entry of insights.activity) {
    const cell = make('span', 'activity-cell');
    const level = activityLevel(entry, maxBytes, maxCount);
    cell.dataset.level = String(level);
    const dateLabel = new Date(`${entry.date}T12:00:00`).toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
    });
    cell.title = entry.future
      ? `${dateLabel} · 尚未到达`
      : `${dateLabel} · ${entry.inventoryCount} 项库存 · ${formatDecimalGb(entry.originalBytes)} GB`;
    elements.activityGrid.append(cell);
  }

  elements.activityMonths.replaceChildren();
  let previousMonth = null;
  for (let week = 0; week < 16; week += 1) {
    const entry = insights.activity[week * 7];
    const date = new Date(`${entry.date}T12:00:00`);
    const month = date.getMonth();
    const label = make('span', '', month !== previousMonth ? `${month + 1}月` : '');
    elements.activityMonths.append(label);
    previousMonth = month;
  }
}

async function refreshWarehouseInsights(force = false) {
  const signature = JSON.stringify((currentState?.catalog || []).map((record) => [
    record.id, record.inventoryDate, record.originalBytes, record.tags
  ]));
  if (!force && signature === warehouseInsightsSignature && currentWarehouseInsights) return currentWarehouseInsights;
  const insights = await safely(() => window.archiveApp.getWarehouseInsights());
  if (insights) {
    warehouseInsightsSignature = signature;
    renderWarehouseInsights(insights);
  }
  return insights;
}

function renderDiscovery(title, description, records) {
  currentDiscoveryRecordIds = records.map((record) => record.id);
  elements.warehouseDiscovery.hidden = false;
  elements.warehouseDiscovery.replaceChildren();
  const heading = make('div', 'discovery-heading');
  heading.append(make('strong', '', title), make('span', '', description));
  elements.warehouseDiscovery.append(heading);
  if (records.length === 0) {
    elements.warehouseDiscovery.append(make(
      'p',
      'muted',
      title === '随机漫步' ? '仓库还是空的，添加库存后这里会自动出现推荐。' : '没有找到符合这次回顾条件的库存。'
    ));
    return;
  }
  const list = make('div', 'discovery-list');
  for (const record of records) {
    const button = make('button', 'discovery-hero');
    button.type = 'button';
    button.dataset.discoveryRecord = record.id;
    if (record.coverThumbnailPath) {
      const backdrop = document.createElement('img');
      backdrop.className = 'discovery-hero-image discovery-hero-backdrop';
      backdrop.alt = '';
      backdrop.setAttribute('aria-hidden', 'true');
      const cover = document.createElement('img');
      cover.className = 'discovery-hero-image discovery-hero-foreground';
      cover.alt = `${catalogTitle(record)} 的封面`;
      button.append(backdrop, cover);
      void loadThumbnail(backdrop, record.id, record.coverThumbnailPath);
      void loadThumbnail(cover, record.id, record.coverThumbnailPath);
    } else {
      button.append(make('span', 'discovery-hero-placeholder', '暂无封面'));
    }
    const info = make('span', 'discovery-hero-info');
    info.append(
      make('strong', '', catalogTitle(record)),
      make('span', '', `${starText(record.rating)} · 入库 ${formatCatalogDate(record.inventoryDate || record.completedAt)}`),
      make('small', '', (record.tags || []).length > 0 ? record.tags.join(' · ') : '暂无标签')
    );
    button.append(info);
    list.append(button);
  }
  elements.warehouseDiscovery.append(list);
}

async function openDiscoveryRecord(recordId) {
  await loadCatalogDetails(recordId);
  elements.catalogDetail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function showRandomWalk(shouldScroll = true) {
  const record = await safely(() => window.archiveApp.getRandomCatalogRecord(activeCatalogId));
  discoveryMode = record ? 'random' : 'empty';
  renderDiscovery(
    '随机漫步',
    record ? '从全部库存中为你随机抽取了一项。' : '仓库中暂时没有可以推荐的内容。',
    record ? [record] : []
  );
  if (shouldScroll) elements.warehouseDiscovery.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  return record;
}

function readConfig() {
  return {
    intakeDirectory: elements.intakeDirectory.value.trim(),
    archiveStagingDirectory: deriveStagingDirectory(elements.archiveOutputDirectory.value),
    archiveOutputDirectory: elements.archiveOutputDirectory.value.trim(),
    moveCompleted: elements.moveCompleted.checked,
    processedSourceDirectory: elements.processedSourceDirectory.value.trim(),
    archiveNamingMode: document.querySelector('input[name="archive-naming-mode"]:checked')?.value || 'timestamp_random',
    customArchiveName: elements.customArchiveName.value.trim(),
    archiveFormat: elements.archiveFormat.value,
    compressionLevel: Number(elements.compressionLevel.value),
    archivePassword: elements.password.value,
    recordArchivePassword: elements.recordArchivePassword.checked,
    videoFrameBackup: elements.videoFrameBackup.checked,
    videoFrameCount: Number(elements.videoFrameCount.value),
    thumbnailLimit: Number(elements.thumbnailLimit.value),
    smallItemFilter: elements.smallItemFilter.checked,
    minimumTaskBytes: Number(elements.minimumTaskMb.value) * (1024 ** 2),
    scheduleEnabled: elements.scheduleEnabled.checked,
    scheduleStart: elements.scheduleStart.value,
    scheduleEnd: elements.scheduleEnd.value,
    autoTrashCompleted: elements.autoTrash.checked,
    recordBackupLocation: elements.recordBackupLocation.checked,
    backupLocation: elements.backupLocation.value.trim()
  };
}

function updateBackupLocationControl() {
  const enabled = elements.recordBackupLocation.checked;
  elements.backupLocation.disabled = !enabled;
  elements.backupLocation.required = enabled;
  elements.backupLocationField.classList.toggle('disabled', !enabled);
}

function updateIntakeOptionControls() {
  elements.videoFrameCount.disabled = !elements.videoFrameBackup.checked;
  elements.minimumTaskMb.disabled = !elements.smallItemFilter.checked;
  elements.scheduleStart.disabled = !elements.scheduleEnabled.checked;
  elements.scheduleEnd.disabled = !elements.scheduleEnabled.checked;
  elements.scheduleStart.required = elements.scheduleEnabled.checked;
  elements.scheduleEnd.required = elements.scheduleEnabled.checked;
}

function updateCompletionControls(changed = '') {
  if (changed === 'move' && elements.moveCompleted.checked) elements.autoTrash.checked = false;
  if (changed === 'trash' && elements.autoTrash.checked) elements.moveCompleted.checked = false;
  elements.processedSourceDirectory.disabled = !elements.moveCompleted.checked;
  elements.processedSourceDirectory.required = elements.moveCompleted.checked;
  elements.processedSourceDirectoryField.classList.toggle('disabled', !elements.moveCompleted.checked);
}

function updateNamingControls() {
  const mode = document.querySelector('input[name="archive-naming-mode"]:checked')?.value;
  elements.customArchiveName.disabled = mode !== 'custom_random';
  elements.customArchiveName.required = mode === 'custom_random';
}

function renderConfig(config) {
  elements.intakeDirectory.value = config.intakeDirectory || '';
  elements.archiveOutputDirectory.value = config.archiveOutputDirectory || '';
  elements.archiveStagingDirectory.value = deriveStagingDirectory(config.archiveOutputDirectory);
  elements.warehousePath.textContent = config.repositoryDirectory ? `仓库：${config.repositoryDirectory}` : '';
  elements.warehousePath.title = config.repositoryDirectory || '当前仓库位置';
  elements.userDataPath.value = config.userDataDirectory || '';
  elements.userDataPath.title = config.userDataDirectory || '';
  elements.moveCompleted.checked = Boolean(config.moveCompleted);
  elements.processedSourceDirectory.value = config.processedSourceDirectory || '';
  const namingRadio = document.querySelector(`input[name="archive-naming-mode"][value="${config.archiveNamingMode || 'timestamp_random'}"]`);
  if (namingRadio) namingRadio.checked = true;
  elements.customArchiveName.value = config.customArchiveName || '';
  elements.archiveFormat.value = config.archiveFormat || '7z';
  elements.compressionLevel.value = String(config.compressionLevel ?? 1);
  elements.password.value = config.archivePassword || '';
  elements.recordArchivePassword.checked = config.recordArchivePassword !== false;
  elements.thumbnailLimit.value = String(config.thumbnailLimit || 30);
  elements.password.type = 'password';
  document.querySelector('#toggle-password').textContent = '显示';
  elements.videoFrameBackup.checked = config.videoFrameBackup !== false;
  elements.videoFrameCount.value = String(config.videoFrameCount || 3);
  elements.smallItemFilter.checked = config.smallItemFilter !== false;
  elements.minimumTaskMb.value = String(Math.round((config.minimumTaskBytes || (100 * 1024 ** 2)) / (1024 ** 2)));
  elements.scheduleEnabled.checked = Boolean(config.scheduleEnabled);
  elements.scheduleStart.value = config.scheduleStart || '';
  elements.scheduleEnd.value = config.scheduleEnd || '';
  elements.autoTrash.checked = Boolean(config.autoTrashCompleted);
  elements.recordBackupLocation.checked = Boolean(config.recordBackupLocation);
  elements.backupLocation.value = config.backupLocation || '';
  updateBackupLocationControl();
  updateIntakeOptionControls();
  updateCompletionControls();
  updateNamingControls();
  renderSafetyChip(Boolean(config.autoTrashCompleted), Boolean(config.moveCompleted));
}

function renderSafetyChip(autoTrash, moveCompleted = false) {
  elements.safetyChip.classList.toggle('trash-enabled', autoTrash);
  elements.safetyChip.lastChild.textContent = autoTrash
    ? '归档完成后移入回收站'
    : moveCompleted ? '归档完成后移到指定位置' : '完成后保留源文件';
}

function actionButton(label, action, jobId, className = '') {
  const button = make('button', className, label);
  button.dataset.action = action;
  button.dataset.jobId = jobId;
  return button;
}

function updateSelectionControls(jobs) {
  const validIds = new Set(jobs.map((job) => job.id));
  for (const id of [...selectedJobIds]) {
    if (!validIds.has(id)) selectedJobIds.delete(id);
  }
  elements.selectionCount.textContent = selectedJobIds.size > 0
    ? `已选择 ${selectedJobIds.size} 项（按住 Ctrl 可多选）`
    : '未选择任务（按住 Ctrl 可多选）';
  elements.removeSelected.disabled = selectedJobIds.size === 0;
  elements.selectAllTasks.checked = jobs.length > 0 && selectedJobIds.size === jobs.length;
  elements.selectAllTasks.indeterminate = selectedJobIds.size > 0 && selectedJobIds.size < jobs.length;
}

function renderJobs(jobs) {
  elements.taskList.replaceChildren();
  elements.emptyTasks.hidden = jobs.length > 0;
  updateSelectionControls(jobs);

  for (const job of jobs) {
    const row = document.createElement('tr');
    row.dataset.jobId = job.id;
    row.classList.toggle('selected', selectedJobIds.has(job.id));

    const selectCell = make('td', 'select-cell');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedJobIds.has(job.id);
    checkbox.dataset.selectJob = job.id;
    checkbox.setAttribute('aria-label', `选择 ${job.displayName}`);
    selectCell.append(checkbox);
    row.append(selectCell);

    const nameCell = make('td', 'task-name');
    const nameLine = make('span', 'task-name-line');
    const copyName = make('button', 'copy-job-name', '复制');
    copyName.type = 'button';
    copyName.dataset.copyJobName = job.displayName;
    copyName.setAttribute('aria-label', `复制任务名 ${job.displayName}`);
    nameLine.append(make('strong', '', job.displayName), copyName);
    nameCell.append(nameLine, make('small', '', job.sourcePath));
    row.append(nameCell);
    row.append(make('td', '', String(job.fileCount)));
    row.append(make('td', '', formatBytes(job.totalBytes)));

    const statusCell = document.createElement('td');
    statusCell.append(make('span', `status ${job.status}`, statusLabels[job.status] || job.status));
    row.append(statusCell);

    const progressCell = document.createElement('td');
    const progress = make('div', 'progress');
    const fill = make('span');
    fill.style.width = `${Math.max(0, Math.min(100, job.progress || 0))}%`;
    progress.append(fill);
    progressCell.append(progress, make('span', 'progress-text', taskProgressText(job)));
    row.append(progressCell);

    const actionCell = make('td', 'row-actions');
    if (job.status === 'awaiting_confirmation') {
      const label = job.confirmationReasons?.includes('large_task') ? '确认并按 10G 分卷' : '确认重复风险';
      actionCell.append(actionButton(label, 'confirm', job.id, 'confirm'));
    }
    if (job.status === 'awaiting_duplicate_confirmation') {
      actionCell.append(actionButton('确认重复并继续', 'confirm', job.id, 'confirm'));
    }
    if (job.status === 'awaiting_anomaly_confirmation') {
      actionCell.append(
        actionButton('核验后确认入库', 'confirm-anomaly', job.id, 'confirm'),
        actionButton('删除异常成品', 'discard-anomaly', job.id, 'danger-link')
      );
    }
    if (['queued', 'awaiting_confirmation', 'awaiting_duplicate_confirmation', 'inventorying', 'compressing', 'verifying', 'failed'].includes(job.status)) {
      actionCell.append(actionButton('取消', 'cancel', job.id));
    }
    if (['failed', 'cancelled'].includes(job.status)) {
      actionCell.append(actionButton('重试', 'retry', job.id));
    }
    row.append(actionCell);
    elements.taskList.append(row);
  }
}

function renderLogs(logs) {
  elements.logList.replaceChildren();
  if (logs.length === 0) {
    elements.logList.append(make('p', 'muted', '暂无日志'));
    return;
  }
  for (const entry of [...logs].reverse()) {
    const row = make('div', `log-entry ${entry.level}`);
    const time = new Date(entry.at);
    row.append(
      make('time', '', time.toLocaleTimeString('zh-CN', { hour12: false })),
      make('span', '', entry.level.toUpperCase()),
      make('p', '', entry.message)
    );
    elements.logList.append(row);
  }
}

function updateCatalogSelectionControls() {
  const validIds = new Set((currentState?.catalog || []).map((record) => record.id));
  for (const id of [...selectedCatalogIds]) {
    if (!validIds.has(id)) selectedCatalogIds.delete(id);
  }
  const resultIds = currentCatalogResults.map((record) => record.id);
  const selectedResultCount = resultIds.filter((id) => selectedCatalogIds.has(id)).length;
  elements.catalogSelectionCount.textContent = selectedCatalogIds.size > 0
    ? `已选择 ${selectedCatalogIds.size} 项`
    : '未选择仓库内容';
  elements.addTagsSelected.disabled = selectedCatalogIds.size === 0;
  elements.updateBackupSelected.disabled = selectedCatalogIds.size === 0;
  elements.deleteCatalogSelected.disabled = selectedCatalogIds.size === 0;
  elements.selectAllCatalog.checked = resultIds.length > 0 && selectedResultCount === resultIds.length;
  elements.selectAllCatalog.indeterminate = selectedResultCount > 0 && selectedResultCount < resultIds.length;
}

function renderCatalog(catalog) {
  currentCatalogResults = catalog;
  elements.catalogList.replaceChildren();
  updateCatalogSelectionControls();
  if (catalog.length === 0) {
    elements.catalogPagination.hidden = true;
    elements.catalogList.append(make('p', 'muted catalog-empty', '没有符合当前条件的仓库内容'));
    return;
  }
  const ordered = [...catalog];
  const pageCount = Math.max(1, Math.ceil(ordered.length / CATALOG_PAGE_SIZE));
  catalogPage = Math.min(Math.max(1, catalogPage), pageCount);
  const visibleRecords = ordered.slice((catalogPage - 1) * CATALOG_PAGE_SIZE, catalogPage * CATALOG_PAGE_SIZE);
  elements.catalogPagination.hidden = pageCount <= 1;
  elements.catalogPageStatus.textContent = `第 ${catalogPage} / ${pageCount} 页 · 共 ${catalog.length} 项`;
  elements.catalogPagePrev.disabled = catalogPage <= 1;
  elements.catalogPageNext.disabled = catalogPage >= pageCount;
  for (const record of visibleRecords) {
    const card = make('article', `catalog-card${activeCatalogId === record.id ? ' active' : ''}${selectedCatalogIds.has(record.id) ? ' selected' : ''}`);
    card.dataset.catalogId = record.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'catalog-select';
    checkbox.checked = selectedCatalogIds.has(record.id);
    checkbox.dataset.selectCatalog = record.id;
    checkbox.setAttribute('aria-label', `选择 ${catalogTitle(record)}`);

    const button = make('button', 'catalog-open');
    button.type = 'button';
    button.dataset.recordId = record.id;
    const cover = make('div', 'catalog-cover');
    if (record.coverThumbnailPath) {
      appendContainedThumbnail(
        cover,
        record.id,
        record.coverThumbnailPath,
        catalogTitle(record),
        'catalog-cover-frame'
      );
    } else {
      cover.append(make('span', 'catalog-cover-placeholder', record.recordType === 'manual' ? '手动库存' : '无预览'));
    }
    cover.append(make('span', 'file-count-badge', record.recordType === 'manual' ? '仅记录' : `${record.manifestCount} 个文件`));

    const info = make('div', 'catalog-card-info');
    info.append(
      make('strong', '', catalogTitle(record)),
      make('span', 'catalog-stars', starText(record.rating)),
      make('small', '', record.recordType === 'manual'
        ? '手动库存条目'
        : `${record.directoryCount || 0} 个子目录 · ${formatBytes(record.archiveTotalBytes)}`),
      make('small', '', `入库 ${formatCatalogDate(record.inventoryDate || record.completedAt)}`)
    );
    if ((record.tags || []).length > 0) {
      const tags = make('div', 'catalog-card-tags');
      for (const tag of record.tags.slice(0, catalogViewMode === 'grid' ? 4 : 2)) {
        tags.append(make('span', '', tag));
      }
      info.append(tags);
    }
    const sourceLocation = sourceLocationPresentation(record);
    info.append(make('small', 'source-location-chip', `原文件位置：${sourceLocation.text}`));
    if (record.backupLocation) {
      info.append(make('span', 'backup-location-chip', `备份 · ${record.backupLocation}`));
    }
    if (record.possibleDuplicate) {
      info.append(make('span', 'duplicate-chip', `可能重复${record.similarCount ? ` · ${record.similarCount} 个相似项` : ''}`));
    }
    button.append(cover, info);
    card.append(checkbox, button);
    elements.catalogList.append(card);
  }
}

function updateTagFilterOptions(catalog) {
  const selected = elements.catalogTagFilter.value;
  const tags = [...new Set(catalog.flatMap((record) => record.tags || []))]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
  elements.catalogTagFilter.replaceChildren(new Option('全部标签', ''));
  for (const tag of tags) elements.catalogTagFilter.append(new Option(tag, tag));
  elements.catalogTagFilter.value = tags.includes(selected) ? selected : '';
}

function updateBackupLocationFilterOptions(catalog) {
  const selected = elements.catalogBackupFilter.value;
  const locations = [...new Set(catalog.map((record) => record.backupLocation).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
  elements.catalogBackupFilter.replaceChildren(new Option('全部备份位置', ''));
  for (const location of locations) elements.catalogBackupFilter.append(new Option(location, location));
  elements.catalogBackupFilter.value = locations.includes(selected) ? selected : '';
}

async function refreshCatalog() {
  const requestSequence = ++catalogSearchSequence;
  const ratingValue = elements.catalogRatingFilter.value;
  const records = await safely(() => window.archiveApp.searchCatalog({
    query: elements.catalogSearch.value,
    tag: elements.catalogTagFilter.value,
    backupLocation: elements.catalogBackupFilter.value,
    rating: ratingValue === '' ? null : Number(ratingValue),
    sort: elements.catalogSort.value
  }));
  if (requestSequence !== catalogSearchSequence) return null;
  if (records) {
    updateTagFilterOptions(currentState?.catalog || []);
    updateBackupLocationFilterOptions(currentState?.catalog || []);
    renderCatalog(records);
    catalogRefreshDirty = false;
    lastCatalogRefreshAt = Date.now();
  }
  return records;
}

async function refreshCatalogSuggestions() {
  const requestSequence = ++catalogSuggestionSequence;
  const query = elements.catalogSearch.value.trim();
  if (query.length < 2) {
    elements.catalogSuggestions.hidden = true;
    elements.catalogSuggestions.replaceChildren();
    return;
  }
  const suggestions = await safely(() => window.archiveApp.getCatalogSuggestions(query));
  if (requestSequence !== catalogSuggestionSequence) return;
  if (!suggestions || suggestions.length === 0 || elements.catalogSearch.value.trim() !== query) {
    elements.catalogSuggestions.hidden = true;
    return;
  }
  elements.catalogSuggestions.replaceChildren();
  for (const suggestion of suggestions) {
    const button = make('button', '', suggestion.title);
    button.type = 'button';
    button.dataset.suggestionTitle = suggestion.title;
    button.append(make('small', '', suggestion.score >= 0.9 ? '高度匹配' : '相似标题'));
    elements.catalogSuggestions.append(button);
  }
  elements.catalogSuggestions.hidden = false;
}

function setCatalogView(mode) {
  catalogViewMode = mode === 'grid' ? 'grid' : 'list';
  localStorage.setItem('hamster-catalog-view-v2', catalogViewMode);
  elements.libraryLayout.classList.toggle('grid-mode', catalogViewMode === 'grid');
  elements.catalogListView.classList.toggle('active', catalogViewMode === 'list');
  elements.catalogGridView.classList.toggle('active', catalogViewMode === 'grid');
  elements.catalogListView.setAttribute('aria-pressed', String(catalogViewMode === 'list'));
  elements.catalogGridView.setAttribute('aria-pressed', String(catalogViewMode === 'grid'));
  catalogPage = 1;
  renderCatalog(currentCatalogResults);
}

function createTree(directories, files) {
  const root = { name: '', path: '', directories: new Map(), files: [] };
  const ensureDirectory = (directoryPath) => {
    let node = root;
    let currentPath = '';
    for (const part of directoryPath.split('/').filter(Boolean)) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!node.directories.has(part)) {
        node.directories.set(part, { name: part, path: currentPath, directories: new Map(), files: [] });
      }
      node = node.directories.get(part);
    }
    return node;
  };

  for (const directoryPath of directories || []) ensureDirectory(directoryPath);
  for (const file of files || []) {
    const parts = file.relativePath.split('/');
    const fileName = parts.pop();
    const directory = ensureDirectory(parts.join('/'));
    directory.files.push({ ...file, name: fileName || file.name });
  }
  return root;
}

async function loadThumbnail(image, recordId, relativePath) {
  const dataUrl = await safely(() => window.archiveApp.getThumbnail(recordId, relativePath));
  if (dataUrl) image.src = dataUrl;
  return dataUrl;
}

function appendContainedThumbnail(container, recordId, relativePath, title, frameClass = '') {
  const frame = make('div', `contained-thumbnail-frame${frameClass ? ` ${frameClass}` : ''}`);
  const backdrop = document.createElement('img');
  backdrop.className = 'contained-thumbnail-image contained-thumbnail-backdrop';
  backdrop.alt = '';
  backdrop.setAttribute('aria-hidden', 'true');

  const image = document.createElement('img');
  image.className = 'contained-thumbnail-image contained-thumbnail-foreground';
  image.loading = 'lazy';
  image.alt = title;
  image.dataset.thumbnailRecord = recordId;
  image.dataset.thumbnailPath = relativePath;
  image.dataset.thumbnailTitle = title;
  frame.append(backdrop, image);
  container.append(frame);

  void loadThumbnail(image, recordId, relativePath).then((dataUrl) => {
    if (dataUrl) backdrop.src = dataUrl;
  });
  return image;
}

function thumbnailsForFile(file) {
  if (file.manualThumbnailRef) {
    return [{ ref: file.manualThumbnailRef, thumbnailPath: file.thumbnailPath, label: file.relativePath }];
  }
  if (Array.isArray(file.thumbnails) && file.thumbnails.length > 0) {
    return file.thumbnails.map((thumbnail, index) => ({
      ...thumbnail,
      ref: `${file.relativePath}::frame:${index}`,
      label: thumbnail.type === 'video-frame'
        ? `第 ${index + 1} 帧 · ${Math.round(thumbnail.timeSeconds || 0)} 秒`
        : file.relativePath
    }));
  }
  return file.thumbnailPath ? [{ ref: file.relativePath, thumbnailPath: file.thumbnailPath, label: file.relativePath }] : [];
}

function imageInputFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(?:png|jpeg|webp|gif)$/i.test(file.type || '')) {
      reject(new Error(`“${file.name}”不是支持的 PNG、JPEG、WebP 或 GIF 图片。`));
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      reject(new Error(`“${file.name}”超过 25 MB。`));
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve({ name: file.name, dataUrl: reader.result }), { once: true });
    reader.addEventListener('error', () => reject(new Error(`无法读取“${file.name}”。`)), { once: true });
    reader.readAsDataURL(file);
  });
}

async function imageInputsFromFiles(files) {
  const inputs = [];
  for (const file of [...files].slice(0, 100)) inputs.push(await imageInputFromFile(file));
  return inputs;
}

async function addImagesToCatalog(recordId, imageInputs) {
  let updated = null;
  for (const input of imageInputs) {
    updated = await window.archiveApp.addCatalogImage(recordId, input);
  }
  return updated;
}

function renderPendingManualImages() {
  elements.manualImagePreview.replaceChildren();
  for (const [index, input] of pendingManualImages.entries()) {
    const item = make('div', 'pending-image-item');
    const image = document.createElement('img');
    image.loading = 'lazy';
    image.src = input.dataUrl;
    image.alt = input.name;
    const remove = make('button', 'dialog-close', '×');
    remove.type = 'button';
    remove.title = '移除这张图片';
    remove.addEventListener('click', () => {
      pendingManualImages.splice(index, 1);
      renderPendingManualImages();
    });
    item.append(image, make('span', '', input.name), remove);
    elements.manualImagePreview.append(item);
  }
}

async function appendPendingManualFiles(files) {
  const remaining = Math.max(0, 100 - pendingManualImages.length);
  if (!remaining) throw new Error('单个项目最多添加 100 张图片。');
  const additions = await imageInputsFromFiles([...files].slice(0, remaining));
  pendingManualImages.push(...additions);
  renderPendingManualImages();
}

async function openThumbnailLightbox(recordId, relativePath, title) {
  const dataUrl = await safely(() => window.archiveApp.getThumbnail(recordId, relativePath));
  if (!dataUrl) {
    showToast('缩略图读取失败', true);
    return;
  }
  lightboxContext = { recordId, relativePath, title };
  elements.lightboxImage.src = dataUrl;
  elements.lightboxTitle.textContent = title || '媒体预览';
  elements.lightboxPath.textContent = relativePath;
  const summary = (currentState?.catalog || []).find((record) => record.id === recordId);
  const isCurrentCover = summary?.coverThumbnailRef === relativePath ||
    (!summary?.coverThumbnailRef && summary?.coverRelativePath === relativePath);
  elements.setThumbnailCover.disabled = isCurrentCover;
  elements.setThumbnailCover.textContent = isCurrentCover ? '当前项目封面' : '设为项目封面';
  elements.thumbnailLightbox.showModal();
}

function closeThumbnailLightbox() {
  elements.thumbnailLightbox.close();
  elements.lightboxImage.removeAttribute('src');
  lightboxContext = null;
}

function flattenDirectoryTree(root) {
  const rows = [];
  const visit = (node, depth) => {
    rows.push({ type: 'directory', depth, name: node.name, count: node.files.length + node.directories.size });
    for (const child of [...node.directories.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))) visit(child, depth + 1);
    for (const file of [...node.files].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))) rows.push({ type: 'file', depth: depth + 1, file });
  };
  for (const directory of [...root.directories.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))) visit(directory, 0);
  for (const file of [...root.files].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))) rows.push({ type: 'file', depth: 0, file });
  return rows;
}

function renderVirtualDirectoryTree(root) {
  const rows = flattenDirectoryTree(root);
  if (rows.length === 0) return make('p', 'muted', '这个归档中没有文件。');
  const viewport = make('div', 'virtual-directory-tree');
  const canvas = make('div', 'virtual-directory-canvas');
  const rowHeight = 48;
  canvas.style.height = `${rows.length * rowHeight}px`;
  viewport.append(canvas);
  const paint = () => {
    const first = Math.max(0, Math.floor(viewport.scrollTop / rowHeight) - 6);
    const count = Math.ceil(viewport.clientHeight / rowHeight) + 12;
    const last = Math.min(rows.length, first + count);
    const fragment = document.createDocumentFragment();
    for (let index = first; index < last; index += 1) {
      const item = rows[index];
      const row = make('div', `virtual-tree-row ${item.type}`);
      row.style.top = `${index * rowHeight}px`;
      row.style.paddingLeft = `${12 + item.depth * 18}px`;
      if (item.type === 'directory') {
        row.append(make('span', 'virtual-tree-icon', '▸'), make('strong', '', item.name), make('small', '', `${item.count} 项`));
      } else {
        row.append(
          make('span', 'virtual-tree-icon file', (item.file.extension || 'FILE').replace('.', '').slice(0, 4).toUpperCase()),
          make('span', 'virtual-tree-name', item.file.name),
          make('small', '', `${formatBytes(item.file.size)} · ${item.file.md5 || '无 MD5'}`)
        );
      }
      fragment.append(row);
    }
    canvas.replaceChildren(fragment);
  };
  viewport.addEventListener('scroll', paint, { passive: true });
  requestAnimationFrame(paint);
  return viewport;
}

function renderCatalogEditor(record) {
  const section = make('section', 'catalog-editor');
  section.append(make('h3', '', '整理信息'));
  const form = make('form', 'catalog-editor-form');

  const titleLabel = make('label', 'editor-field');
  titleLabel.append(make('span', '', '标题'));
  const titleInput = document.createElement('input');
  titleInput.name = 'title';
  titleInput.maxLength = 200;
  titleInput.required = true;
  titleInput.value = catalogTitle(record);
  titleLabel.append(titleInput);

  const tagsLabel = make('label', 'editor-field');
  tagsLabel.append(make('span', '', '标签'));
  const tagsInput = document.createElement('input');
  tagsInput.name = 'tags';
  tagsInput.value = (record.tags || []).join('，');
  tagsInput.placeholder = '例如：摄影，旅行，待整理（用逗号分隔）';
  tagsLabel.append(tagsInput);

  const backupLabel = make('label', 'editor-field');
  backupLabel.append(make('span', '', '备份位置'));
  const backupInput = document.createElement('input');
  backupInput.name = 'backupLocation';
  backupInput.maxLength = 200;
  backupInput.value = record.backupLocation || '';
  backupInput.placeholder = '例如：百度网盘 / 家庭备份盘 A';
  backupLabel.append(backupInput);

  let passwordLabel = null;
  let passwordInput = null;
  let passwordEditing = false;
  if (record.recordType !== 'manual') {
    passwordLabel = make('label', 'editor-field password-editor-field');
    passwordLabel.append(make('span', '', '解压密码'));
    const passwordControl = make('div', 'password-editor-control');
    passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.maxLength = 128;
    passwordInput.autocomplete = 'new-password';
    passwordInput.value = record.archivePassword || '';
    passwordInput.readOnly = true;
    passwordInput.placeholder = record.hasPassword && !record.passwordRecorded ? '压缩包已加密，但密码未记录' : '留空表示无密码';
    const originalPassword = passwordInput.value;
    const showPassword = make('button', 'mini-copy-button', '显示');
    showPassword.type = 'button';
    showPassword.addEventListener('click', () => {
      const showing = passwordInput.type === 'text';
      passwordInput.type = showing ? 'password' : 'text';
      showPassword.textContent = showing ? '显示' : '隐藏';
    });
    const editPassword = make('button', 'mini-copy-button', '修改');
    editPassword.type = 'button';
    editPassword.addEventListener('click', () => {
      if (passwordEditing) {
        passwordInput.value = originalPassword;
        passwordInput.readOnly = true;
        passwordInput.type = 'password';
        showPassword.textContent = '显示';
        editPassword.textContent = '修改';
        passwordEditing = false;
      } else {
        passwordInput.readOnly = false;
        passwordInput.type = 'text';
        showPassword.textContent = '隐藏';
        editPassword.textContent = '取消';
        passwordEditing = true;
        passwordInput.focus();
        passwordInput.select();
      }
    });
    const copyPassword = make('button', 'mini-copy-button', '复制');
    copyPassword.type = 'button';
    copyPassword.disabled = !passwordInput.value;
    copyPassword.addEventListener('click', async () => {
      const copied = await safely(() => window.archiveApp.copyText(passwordInput.value));
      if (copied) showToast('解压密码已复制');
    });
    passwordInput.addEventListener('input', () => { copyPassword.disabled = !passwordInput.value; });
    passwordControl.append(passwordInput, showPassword, editPassword, copyPassword);
    passwordLabel.append(passwordControl);
  }

  const ratingField = make('div', 'editor-field rating-field');
  ratingField.append(make('span', '', '星级'));
  const ratingButtons = make('div', 'rating-buttons');
  let selectedRating = Number(record.rating) || 0;
  const paintRating = () => {
    ratingButtons.querySelectorAll('button').forEach((button) => {
      const value = Number(button.dataset.rating);
      button.classList.toggle('selected', value > 0 && value <= selectedRating);
      button.setAttribute('aria-pressed', String(value === selectedRating));
    });
  };
  const clearRating = make('button', 'clear-rating', '清除');
  clearRating.type = 'button';
  clearRating.dataset.rating = '0';
  ratingButtons.append(clearRating);
  for (let value = 1; value <= 5; value += 1) {
    const button = make('button', 'star-button', '★');
    button.type = 'button';
    button.dataset.rating = String(value);
    button.setAttribute('aria-label', `${value} 星`);
    ratingButtons.append(button);
  }
  ratingButtons.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-rating]');
    if (!button) return;
    selectedRating = Number(button.dataset.rating);
    paintRating();
  });
  paintRating();
  ratingField.append(ratingButtons);

  const notesLabel = make('label', 'editor-field editor-notes');
  notesLabel.append(make('span', '', record.recordType === 'manual' ? '备注（必填）' : '备注'));
  const notesInput = document.createElement('textarea');
  notesInput.name = 'notes';
  notesInput.required = record.recordType === 'manual';
  notesInput.maxLength = 5000;
  notesInput.rows = 4;
  notesInput.placeholder = '记录来源、内容特点、后续处理计划等，支持直接粘贴图片';
  notesInput.value = record.notes || '';
  notesLabel.append(notesInput);

  const imageInput = document.createElement('input');
  imageInput.id = `catalog-image-input-${record.id}`;
  imageInput.className = 'image-file-input';
  imageInput.type = 'file';
  imageInput.accept = 'image/png,image/jpeg,image/webp,image/gif';
  imageInput.multiple = true;

  const uploadFiles = async (files) => {
    if (!files?.length) return;
    const inputs = await safely(() => imageInputsFromFiles(files));
    if (!inputs) return;
    const updated = await safely(() => addImagesToCatalog(record.id, inputs));
    if (!updated) return;
    renderCatalogDetail(updated);
    const state = await safely(() => window.archiveApp.getState());
    if (state) {
      render(state);
      await refreshCatalog();
    }
    showToast(`已添加 ${inputs.length} 张图片`);
  };

  imageInput.addEventListener('change', () => { void uploadFiles(imageInput.files); });
  notesInput.addEventListener('paste', (event) => {
    const files = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith('image/'));
    if (files.length > 0) {
      event.preventDefault();
      void uploadFiles(files);
    }
  });

  const submit = make('button', 'button primary editor-save', '保存整理信息');
  submit.type = 'submit';
  const formActions = make('div', 'catalog-form-actions');
  const imagePickerButton = make('label', 'button ghost', '添加图片');
  imagePickerButton.htmlFor = imageInput.id;
  formActions.append(imageInput, imagePickerButton, submit);
  form.append(titleLabel, tagsLabel, ratingField, backupLabel);
  if (passwordLabel) form.append(passwordLabel);
  form.append(notesLabel, formActions);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    const updated = await safely(() => window.archiveApp.updateCatalogMetadata(record.id, {
      title: titleInput.value,
      tags: tagsInput.value,
      rating: selectedRating,
      notes: notesInput.value,
      backupLocation: backupInput.value,
      ...(passwordInput && passwordEditing ? {
        archivePassword: passwordInput.value,
        passwordRecorded: Boolean(passwordInput.value)
      } : {})
    }));
    submit.disabled = false;
    if (!updated) return;
    renderCatalogDetail(updated);
    const state = await safely(() => window.archiveApp.getState());
    if (state) {
      currentState = state;
      updateTagFilterOptions(state.catalog);
      await refreshCatalog();
    }
    showToast('仓库整理信息已保存');
  });

  section.append(form);
  return section;
}

function isHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(String(value || '')).protocol);
  } catch {
    return false;
  }
}

function sourceLocationPresentation(record) {
  const originalPath = String(record.originalSourcePath || record.sourcePath || '').trim();
  if (record.sourceDisposition === 'missing') {
    return { text: '未发现原文件', value: '', isPath: false };
  }
  if (record.sourceDisposition === 'trashed') {
    return { text: '源文件已进入回收站', value: '', isPath: false };
  }
  if (record.sourceDisposition === 'moved') {
    const movedTo = String(record.movedTo || '').trim();
    return { text: movedTo ? `已移动到：${movedTo}` : '源文件已移动', value: '', isPath: false };
  }
  if (originalPath) return { text: originalPath, value: originalPath, isPath: true };
  return { text: '未记录', value: '', isPath: false };
}

function renderSimilarProjects(record) {
  const warning = make('section', 'similar-projects');
  const head = make('div', 'similar-projects-head');
  head.append(make('h3', '', record.possibleDuplicate ? '可能重复 · 相似项目' : '相似项目'));
  const actions = make('div', 'similar-project-actions');
  const recalculate = make('button', 'button ghost', '重新计算');
  recalculate.type = 'button';
  recalculate.dataset.recalculateSimilar = record.id;
  const manage = make('button', 'button ghost', similarityManageRecordId === record.id ? '完成管理' : '管理');
  manage.type = 'button';
  manage.dataset.manageSimilar = record.id;
  actions.append(recalculate, manage);
  head.append(actions);
  warning.append(head);
  if ((record.similarRecords || []).length === 0) {
    warning.append(make('p', 'muted', '当前没有已关联的相似项目。'));
  } else {
    const links = make('div', 'similar-project-links');
    for (const similar of record.similarRecords) {
      const item = make('span', 'similar-project-item');
      const button = make('button', 'button ghost', `${similar.title} · ${Math.round((similar.score || 0) * 100)}%`);
      button.type = 'button';
      button.dataset.similarRecord = similar.id;
      button.title = (similar.reasons || []).join('；');
      item.append(button);
      if (similarityManageRecordId === record.id) {
        const remove = make('button', 'remove-similar-button', '×');
        remove.type = 'button';
        remove.dataset.removeSimilar = similar.id;
        remove.dataset.recordId = record.id;
        remove.setAttribute('aria-label', `移除与“${similar.title}”的相似关系`);
        item.append(remove);
      }
      links.append(item);
    }
    warning.append(links);
  }
  return warning;
}

function renderCatalogDetail(record) {
  elements.catalogDetail.replaceChildren();
  const heading = make('div', 'archive-heading');
  heading.append(make('h3', '', catalogTitle(record)));
  if (record.title && record.title !== record.displayName) {
    heading.append(make('p', 'original-title', `原始名称：${record.displayName}`));
  }
  heading.append(make('p', 'inventory-date', `入库日期：${formatCatalogDate(record.inventoryDate || record.completedAt)}`));
  if (record.recordType === 'manual') {
    heading.append(make('p', '', '手动库存记录 · 未关联压缩包或文件清单'));
  }
  const sourceLocation = sourceLocationPresentation(record);
  {
    const sourceLine = make('p', 'source-location');
    sourceLine.append(document.createTextNode('原文件位置：'));
    if (sourceLocation.isPath && isHttpUrl(sourceLocation.value)) {
      const sourceLink = make('button', 'inline-link', sourceLocation.text);
      sourceLink.type = 'button';
      sourceLink.dataset.externalUrl = sourceLocation.value;
      sourceLine.append(sourceLink);
    } else {
      sourceLine.append(document.createTextNode(sourceLocation.text));
    }
    heading.append(sourceLine);
  }
  if (record.recordType !== 'manual') {
    const archiveFileNames = (record.archiveFiles || []).map((file) => file.name);
    const archiveNames = archiveFileNames.join('、');
    const archiveLine = make('p', 'archive-name-line');
    archiveLine.append(document.createTextNode(`压缩包：${archiveNames || record.archiveBaseName || '无'}`));
    if (archiveNames || record.archiveBaseName) {
      const copy = make('button', 'mini-copy-button', '复制');
      copy.type = 'button';
      copy.dataset.copyText = archiveFileNames.length > 0 ? archiveFileNames.join('\n') : record.archiveBaseName;
      archiveLine.append(copy);
    }
    heading.append(archiveLine);
  }
  const stats = make('div', 'archive-stats');
  if (record.recordType === 'manual') {
    stats.append(make('span', '', '手动库存'));
  } else {
    stats.append(
      make('span', '', `${record.fileCount || 0} 个文件`),
      make('span', '', `${record.directories?.length || 0} 个子目录`),
      make('span', '', `原始 ${formatBytes(record.originalBytes)}`),
      make('span', '', `压缩后 ${formatBytes(record.archiveTotalBytes)}`)
    );
  }
  if (record.backupLocation) stats.append(make('span', 'backup-stat', `备份位置：${record.backupLocation}`));
  heading.append(stats);
  elements.catalogDetail.append(heading);
  elements.catalogDetail.append(renderCatalogEditor(record));
  elements.catalogDetail.append(renderSimilarProjects(record));

  if (record.recordType === 'manual') {
    const note = make('div', 'manual-record-note');
    note.append(
      make('strong', '', '这是手动库存记录'),
      make('p', '', '它只保存名称、备注及整理信息，不代表程序已经生成或验证过压缩包。')
    );
    elements.catalogDetail.append(note);
  }

  const manualImageFiles = (record.manualImages || []).map((image) => ({
    name: image.name || image.relativePath || '手动添加图片',
    relativePath: image.relativePath || image.name || '手动添加图片',
    thumbnailPath: image.thumbnailPath,
    manualThumbnailRef: image.ref
  }));
  const thumbnailFiles = [...(record.manifest || []), ...manualImageFiles]
    .filter((file) => thumbnailsForFile(file).length > 0);
  const thumbnailCount = thumbnailFiles.reduce((sum, file) => sum + thumbnailsForFile(file).length, 0);
  if (thumbnailCount > 0) {
    const mediaSection = make('details', 'media-preview-section');
    mediaSection.open = true;
    mediaSection.append(make('summary', '', `媒体预览 · ${thumbnailCount} 张`));
    const imageGallery = make('div', 'thumbnail-gallery media-image-gallery');
    for (const file of thumbnailFiles) {
      const thumbnails = thumbnailsForFile(file);
      if (thumbnails.length === 1) {
        const thumbnail = thumbnails[0];
        const card = make('div', 'thumbnail-card');
        appendContainedThumbnail(card, record.id, thumbnail.ref, file.name, 'thumbnail-card-frame');
        card.append(make('span', '', thumbnail.label));
        imageGallery.append(card);
        continue;
      }
      const group = make('section', thumbnails.length > 1 ? 'thumbnail-group video-thumbnail-group' : 'thumbnail-group');
      if (thumbnails.length > 1) {
        const groupHead = make('div', 'thumbnail-group-head');
        const details = videoInfoText(file);
        groupHead.append(
          make('strong', '', file.relativePath),
          make('span', '', `同一视频 · ${thumbnails.length} 帧 · 平均取样${details ? ` · ${details}` : ''}`)
        );
        group.append(groupHead);
      }
      const gallery = make('div', 'thumbnail-gallery');
      for (const thumbnail of thumbnails) {
        const card = make('div', 'thumbnail-card');
        const title = thumbnails.length > 1 ? `${file.name} · ${thumbnail.label}` : file.name;
        appendContainedThumbnail(card, record.id, thumbnail.ref, title, 'thumbnail-card-frame');
        card.append(make('span', '', thumbnail.label));
        gallery.append(card);
      }
      group.append(gallery);
      mediaSection.append(group);
    }
    if (imageGallery.childElementCount > 0) {
      const firstVideoGroup = mediaSection.querySelector('.video-thumbnail-group');
      if (firstVideoGroup) mediaSection.insertBefore(imageGallery, firstVideoGroup);
      else mediaSection.append(imageGallery);
    }
    elements.catalogDetail.append(mediaSection);
  }

  if (record.recordType === 'manual') return;
  elements.catalogDetail.append(make('h3', '', '完整目录结构'));
  const root = createTree(record.directories || [], record.manifest || []);
  elements.catalogDetail.append(renderVirtualDirectoryTree(root));
}

async function loadCatalogDetails(recordId) {
  activeCatalogId = recordId;
  renderCatalog(currentCatalogResults);
  elements.catalogDetail.replaceChildren(make('p', 'muted', '正在读取完整目录和缩略图…'));
  const record = await safely(() => window.archiveApp.getCatalogDetails(recordId));
  if (record) renderCatalogDetail(record);
}

function renderSummary(state) {
  const jobs = state.jobs;
  const currentJob = jobs.find((job) => job.id === state.currentJobId);
  document.querySelector('#summary-total').textContent = String(jobs.length);
  document.querySelector('#summary-confirm').textContent = String(jobs.filter((job) => ['awaiting_confirmation', 'awaiting_duplicate_confirmation', 'awaiting_anomaly_confirmation'].includes(job.status)).length);
  document.querySelector('#summary-queued').textContent = String(jobs.filter((job) => job.status === 'queued').length);
  document.querySelector('#summary-completed').textContent = String(jobs.filter((job) => job.status.startsWith('completed')).length);
  document.querySelector('#summary-bytes').textContent = formatBytes(jobs.reduce((sum, job) => sum + job.totalBytes, 0));
  elements.runningIndicator.textContent = state.paused
    ? '当前任务已暂停'
    : state.pauseAfterCurrent ? '完成本项后暂停'
      : state.scheduleWaiting ? '等待定时时段'
        : state.running ? '队列运行中' : '空闲';
  elements.runningIndicator.classList.toggle('active', state.running);
  document.querySelector('#start-queue').disabled = state.running || !jobs.some((job) => job.status === 'queued');
  document.querySelector('#scan-source').disabled = state.running;
  document.querySelector('#add-folder').disabled = state.running;
  document.querySelector('#add-video').disabled = state.running;
  document.querySelector('#save-settings').disabled = state.running;
  document.querySelector('#clear-completed').disabled = !jobs.some((job) => String(job.status).startsWith('completed'));
  document.querySelector('#clear-queue').disabled = jobs.length === 0;
  document.querySelector('#finish-next').disabled = !jobs.some((job) => job.status === 'queued') && !state.running;
  document.querySelector('#clear-duplicates').disabled = !jobs.some((job) =>
    (job.nameDuplicateMatches || []).length > 0 || (job.similarMatches || []).length > 0 || (job.exactDuplicateMatches || []).length > 0);
  document.querySelector('#confirm-all-duplicates').disabled = !jobs.some((job) =>
    job.status === 'awaiting_duplicate_confirmation' ||
    (job.status === 'awaiting_confirmation' && (job.confirmationReasons || []).some((reason) =>
      ['name_match', 'similar_title', 'same_video_size'].includes(reason))));
  elements.undoCatalog.disabled = !state.undoDepth;
  elements.undoCatalog.textContent = state.undoDepth ? `撤回：${state.undoLabel}` : '撤回';

  const canPause = state.running && !state.paused && ['inventorying', 'compressing', 'verifying'].includes(currentJob?.status);
  document.querySelector('#pause-queue').hidden = !canPause;
  document.querySelector('#resume-queue').hidden = !state.paused;
  renderSafetyChip(Boolean(state.config.autoTrashCompleted), Boolean(state.config.moveCompleted));

  if (state.skippedRootFiles.length > 0) {
    elements.looseSummary.hidden = false;
    elements.looseSummary.textContent = `记录了 ${state.skippedRootFiles.length} 个根级跳过项（非视频、链接或无法读取的内容），当前不会自动移动。`;
  } else {
    elements.looseSummary.hidden = true;
  }
}

function render(state, includeConfig = false) {
  const mergedState = currentState
    ? { ...currentState, ...state, catalog: state.catalog || currentState.catalog }
    : state;
  currentState = mergedState;
  state = mergedState;
  if (includeConfig) renderConfig(state.config);
  renderSummary(state);
  renderJobs(state.jobs);
  renderLogs(state.logs);
  updateCatalogSelectionControls();
  void refreshWarehouseInsights();
  if ((discoveryMode === 'loading' || discoveryMode === 'empty') && state.catalog.length > 0) {
    void showRandomWalk(false);
  } else if (discoveryMode === 'random' && currentDiscoveryRecordIds.some((id) =>
    !state.catalog.some((record) => record.id === id))) {
    void showRandomWalk(false);
  }
  const nextCatalogSignature = JSON.stringify(state.catalog.map((record) => [
    record.id, record.metadataUpdatedAt, record.completedAt, record.coverThumbnailPath,
    record.backupLocation, record.rating, record.tags
  ]));
  if (nextCatalogSignature !== catalogStateSignature) {
    catalogStateSignature = nextCatalogSignature;
    catalogRefreshDirty = true;
    if (currentCatalogResults.length === 0 && state.catalog.length > 0) void refreshCatalog();
  }
}

async function saveConfig() {
  const state = await safely(() => window.archiveApp.saveConfig(readConfig()));
  if (state) {
    render(state, true);
    showToast('设置已保存');
  }
  return state;
}

document.querySelectorAll('.nav-button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.nav-button').forEach((item) => item.classList.toggle('active', item === button));
    document.querySelectorAll('.app-page').forEach((page) => { page.hidden = page.id !== button.dataset.page; });
    if (button.dataset.page === 'library-page' && currentState) {
      if (catalogRefreshDirty || Date.now() - lastCatalogRefreshAt > 10_000) void refreshCatalog();
    }
  });
});

setInterval(() => {
  const libraryVisible = !document.querySelector('#library-page').hidden;
  if (libraryVisible && catalogRefreshDirty && Date.now() - lastCatalogRefreshAt >= 10_000) {
    void refreshCatalog();
  }
}, 2_000);

document.querySelectorAll('[data-pick]').forEach((button) => {
  button.addEventListener('click', async () => {
    const input = document.querySelector(`#${button.dataset.pick}`);
    const selected = await safely(() => window.archiveApp.chooseDirectory(input.value.trim()));
    if (!selected) return;
    input.value = selected;
    if (input === elements.archiveOutputDirectory) {
      elements.archiveStagingDirectory.value = deriveStagingDirectory(selected);
    }
    await saveConfig();
  });
});

elements.archiveOutputDirectory.addEventListener('input', () => {
  elements.archiveStagingDirectory.value = deriveStagingDirectory(elements.archiveOutputDirectory.value);
});

document.querySelector('#save-settings').addEventListener('click', saveConfig);
document.querySelector('#check-for-updates').addEventListener('click', async () => {
  const button = document.querySelector('#check-for-updates');
  button.disabled = true;
  button.textContent = '正在检查…';
  const result = await safely(() => window.archiveApp.checkForUpdates());
  button.disabled = false;
  button.textContent = '检查更新';
  if (result) showToast(result.updateAvailable ? `发现新版本 ${result.latestVersion}` : '当前已是最新版本');
});
const usageGuideDialog = document.querySelector('#usage-guide-dialog');
document.querySelector('#open-usage-guide').addEventListener('click', () => usageGuideDialog.showModal());
document.querySelector('#close-usage-guide').addEventListener('click', () => usageGuideDialog.close());
document.querySelector('#confirm-usage-guide').addEventListener('click', () => usageGuideDialog.close());
elements.recordBackupLocation.addEventListener('change', () => {
  updateBackupLocationControl();
  if (elements.recordBackupLocation.checked) elements.backupLocation.focus();
});
[...document.querySelectorAll('input[name="archive-naming-mode"]')].forEach((control) => {
  control.addEventListener('change', updateNamingControls);
});
elements.moveCompleted.addEventListener('change', async () => {
  updateCompletionControls('move');
  await saveConfig();
});
[elements.videoFrameBackup, elements.smallItemFilter, elements.scheduleEnabled].forEach((control) => {
  control.addEventListener('change', updateIntakeOptionControls);
});
elements.smallItemFilter.addEventListener('change', () => { void saveConfig(); });
elements.minimumTaskMb.addEventListener('change', () => { void saveConfig(); });
elements.autoTrash.addEventListener('change', async () => {
  if (elements.autoTrash.checked) {
    const accepted = window.confirm('启用后，每个任务只有在验证并入库成功后，才会把对应源文件夹或视频移入 Windows 回收站。是否启用？');
    if (!accepted) {
      elements.autoTrash.checked = false;
      return;
    }
  }
  updateCompletionControls('trash');
  await saveConfig();
});

document.querySelector('#toggle-password').addEventListener('click', () => {
  const showing = elements.password.type === 'text';
  elements.password.type = showing ? 'password' : 'text';
  document.querySelector('#toggle-password').textContent = showing ? '显示' : '隐藏';
});
elements.password.addEventListener('change', () => { void saveConfig(); });
elements.recordArchivePassword.addEventListener('change', () => { void saveConfig(); });
elements.thumbnailLimit.addEventListener('change', () => { void saveConfig(); });
elements.archiveFormat.addEventListener('change', () => { void saveConfig(); });
elements.compressionLevel.addEventListener('change', () => { void saveConfig(); });
document.querySelector('#open-user-data').addEventListener('click', async () => {
  const opened = await safely(() => window.archiveApp.openUserData());
  if (opened) showToast('已打开用户数据区');
});

document.querySelector('#scan-source').addEventListener('click', async () => {
  const saved = await saveConfig();
  if (!saved) return;
  elements.notice.textContent = '正在扫描下一级目录，请稍候…';
  elements.notice.hidden = false;
  const state = await safely(() => window.archiveApp.scanSource(elements.intakeDirectory.value.trim()));
  elements.notice.hidden = true;
  if (state) render(state);
});

async function addSingle(kind) {
  const saved = await saveConfig();
  if (!saved) return;
  const selected = await safely(() => window.archiveApp.chooseSingle(kind));
  if (!selected) return;
  const state = await safely(() => window.archiveApp.addSingle(selected));
  if (state) render(state);
}

document.querySelector('#add-folder').addEventListener('click', () => addSingle('directory'));
document.querySelector('#add-video').addEventListener('click', () => addSingle('video'));

const dropZone = document.querySelector('#drop-zone');
document.addEventListener('dragover', (event) => {
  if (!event.dataTransfer?.types?.includes('Files')) return;
  event.preventDefault();
  dropZone.classList.add('drag-active');
  event.dataTransfer.dropEffect = 'copy';
});
document.addEventListener('dragleave', (event) => {
  if (!event.relatedTarget) dropZone.classList.remove('drag-active');
});
async function addPathsToQueue(paths, sourceLabel) {
  const uniquePaths = [...new Set((paths || []).map((value) => String(value).trim()).filter(Boolean))];
  if (uniquePaths.length === 0) return;
  const saved = await saveConfig();
  if (!saved) return;
  let added = 0;
  for (const sourcePath of uniquePaths) {
    const state = await safely(() => window.archiveApp.addSingle(sourcePath));
    if (state) {
      added += 1;
      render(state);
    }
  }
  showToast(
    added > 0
      ? `已通过${sourceLabel}加入 ${added} 个任务`
      : `没有可加入的文件夹或视频（${sourceLabel}）`,
    added === 0
  );
}

document.addEventListener('drop', async (event) => {
  if (!event.dataTransfer?.files?.length) return;
  event.preventDefault();
  dropZone.classList.remove('drag-active');
  const paths = [...new Set([...event.dataTransfer.files]
    .map((file) => window.archiveApp.getDroppedPath(file))
    .filter(Boolean))];
  await addPathsToQueue(paths, '拖放');
});

document.addEventListener('paste', async (event) => {
  const target = event.target;
  if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  const filePaths = [...(event.clipboardData?.files || [])]
    .map((file) => window.archiveApp.getDroppedPath(file))
    .filter(Boolean);
  let textPaths = [];
  if (filePaths.length === 0) {
    const text = event.clipboardData?.getData('text') || '';
    textPaths = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }
  const paths = [...new Set([...filePaths, ...textPaths])];
  if (paths.length === 0) return;
  event.preventDefault();
  dropZone.classList.remove('drag-active');
  await addPathsToQueue(paths, '粘贴');
});

document.querySelector('#start-queue').addEventListener('click', async () => {
  const state = await safely(() => window.archiveApp.startQueue());
  if (state) render(state);
});
document.querySelector('#finish-next').addEventListener('click', async () => {
  const state = await safely(() => window.archiveApp.finishNextAndPause());
  if (state) render(state);
});
document.querySelector('#pause-queue').addEventListener('click', async () => {
  const state = await safely(() => window.archiveApp.pauseQueue());
  if (state) render(state);
});
document.querySelector('#resume-queue').addEventListener('click', async () => {
  const state = await safely(() => window.archiveApp.resumeQueue());
  if (state) render(state);
});

document.querySelector('#toggle-task-list').addEventListener('click', (event) => {
  taskListCollapsed = !taskListCollapsed;
  elements.taskListContainer.hidden = taskListCollapsed;
  event.currentTarget.textContent = taskListCollapsed ? '展开任务列表' : '折叠任务列表';
});

elements.selectAllTasks.addEventListener('change', () => {
  selectedJobIds.clear();
  if (elements.selectAllTasks.checked) {
    for (const job of currentState?.jobs || []) selectedJobIds.add(job.id);
  }
  renderJobs(currentState?.jobs || []);
});

elements.taskList.addEventListener('change', (event) => {
  const checkbox = event.target.closest('input[data-select-job]');
  if (!checkbox) return;
  if (checkbox.checked) selectedJobIds.add(checkbox.dataset.selectJob);
  else selectedJobIds.delete(checkbox.dataset.selectJob);
  renderJobs(currentState?.jobs || []);
});

elements.taskList.addEventListener('click', async (event) => {
  if (Date.now() < suppressSelectionClickUntil) return;
  const copyName = event.target.closest('button[data-copy-job-name]');
  if (copyName) {
    const copied = await safely(() => window.archiveApp.copyText(copyName.dataset.copyJobName));
    if (copied) showToast('任务名称已复制');
    return;
  }
  const button = event.target.closest('button[data-action]');
  if (button) {
    const { action, jobId } = button.dataset;
    let state;
    if (action === 'confirm') state = await safely(() => window.archiveApp.confirmTask(jobId));
    if (action === 'confirm-anomaly') {
      if (!window.confirm('完整性测试已经通过，但压缩前后体积比例超出安全阈值。请先人工核对日志和源项目；确认仍要入库吗？')) return;
      state = await safely(() => window.archiveApp.confirmAnomaly(jobId));
    }
    if (action === 'discard-anomaly') {
      if (!window.confirm('删除这次异常任务生成的压缩文件和缩略图？源文件会完整保留在原位置，且不会加入仓库。')) return;
      state = await safely(() => window.archiveApp.discardAnomaly(jobId));
    }
    if (action === 'cancel') state = await safely(() => window.archiveApp.cancelTask(jobId));
    if (action === 'retry') state = await safely(() => window.archiveApp.retryTask(jobId));
    if (state) render(state);
    return;
  }
  if (event.target.closest('input')) return;
  const row = event.target.closest('tr[data-job-id]');
  if (!row) return;
  if (!event.ctrlKey && !event.metaKey) selectedJobIds.clear();
  if (selectedJobIds.has(row.dataset.jobId)) selectedJobIds.delete(row.dataset.jobId);
  else selectedJobIds.add(row.dataset.jobId);
  renderJobs(currentState?.jobs || []);
});

elements.removeSelected.addEventListener('click', async () => {
  if (selectedJobIds.size === 0) return;
  if (!window.confirm(`从任务列表移除所选 ${selectedJobIds.size} 项？已入库档案和源文件不会删除。`)) return;
  const state = await safely(() => window.archiveApp.removeJobs([...selectedJobIds]));
  if (state) {
    selectedJobIds.clear();
    render(state);
  }
});

document.querySelector('#clear-queue').addEventListener('click', async () => {
  if (!window.confirm('清空整个任务列表？如果当前正在运行，会停止当前任务并阻止后续任务启动。已入库档案和源文件不会删除。')) return;
  const state = await safely(() => window.archiveApp.clearQueue());
  if (state) {
    selectedJobIds.clear();
    render(state);
  }
});

document.querySelector('#clear-completed').addEventListener('click', async () => {
  const completedCount = (currentState?.jobs || []).filter((job) => String(job.status).startsWith('completed')).length;
  if (completedCount === 0) return;
  const result = await safely(() => window.archiveApp.clearCompletedJobs());
  if (!result) return;
  selectedJobIds.clear();
  render(result.state);
  showToast(`已清除 ${result.removedCount} 个已完成任务`);
});

document.querySelector('#clear-duplicates').addEventListener('click', async () => {
  if (!window.confirm('从任务列表清除所有“名称可能重复”或“内容精确重复”的项目？已入库档案和源文件不会删除。')) return;
  const result = await safely(() => window.archiveApp.clearPotentialDuplicates());
  if (!result) return;
  selectedJobIds.clear();
  render(result.state);
  showToast(result.removedCount > 0 ? `已清除 ${result.removedCount} 个可能重复的任务` : '没有发现可清除的重复任务');
});

document.querySelector('#confirm-all-duplicates').addEventListener('click', async () => {
  if (!window.confirm('同意任务列表中全部名称重复、标题相似或视频大小相同的风险，并让它们进入等待压缩状态？')) return;
  const result = await safely(() => window.archiveApp.confirmAllDuplicates());
  if (!result) return;
  render(result.state);
  showToast(result.confirmedCount > 0 ? `已确认 ${result.confirmedCount} 个重复或相似任务` : '没有等待确认的重复任务');
});

elements.catalogList.addEventListener('change', (event) => {
  const checkbox = event.target.closest('input[data-select-catalog]');
  if (!checkbox) return;
  if (checkbox.checked) selectedCatalogIds.add(checkbox.dataset.selectCatalog);
  else selectedCatalogIds.delete(checkbox.dataset.selectCatalog);
  renderCatalog(currentCatalogResults);
});

elements.catalogList.addEventListener('click', async (event) => {
  if (Date.now() < suppressSelectionClickUntil) return;
  const button = event.target.closest('button[data-record-id]');
  if (!button) return;
  if (event.ctrlKey || event.metaKey) {
    if (selectedCatalogIds.has(button.dataset.recordId)) selectedCatalogIds.delete(button.dataset.recordId);
    else selectedCatalogIds.add(button.dataset.recordId);
    renderCatalog(currentCatalogResults);
    return;
  }
  await loadCatalogDetails(button.dataset.recordId);
  if (catalogViewMode === 'grid') {
    elements.catalogDetail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

let searchTimer;
elements.catalogSearch.addEventListener('input', () => {
  clearTimeout(searchTimer);
  catalogPage = 1;
  searchTimer = setTimeout(() => {
    void refreshCatalog();
    void refreshCatalogSuggestions();
  }, 280);
});

elements.catalogSuggestions.addEventListener('mousedown', (event) => {
  const button = event.target.closest('button[data-suggestion-title]');
  if (!button) return;
  event.preventDefault();
  elements.catalogSearch.value = button.dataset.suggestionTitle;
  elements.catalogSuggestions.hidden = true;
  catalogPage = 1;
  void refreshCatalog();
});
elements.catalogSearch.addEventListener('blur', () => {
  setTimeout(() => { elements.catalogSuggestions.hidden = true; }, 150);
});

for (const filter of [elements.catalogTagFilter, elements.catalogBackupFilter, elements.catalogRatingFilter, elements.catalogSort]) {
  filter.addEventListener('change', () => { catalogPage = 1; void refreshCatalog(); });
}
elements.catalogListView.addEventListener('click', () => setCatalogView('list'));
elements.catalogGridView.addEventListener('click', () => setCatalogView('grid'));
document.querySelector('#refresh-catalog').addEventListener('click', async () => {
  await refreshCatalog();
  await refreshWarehouseInsights(true);
  showToast('仓库已刷新');
});
document.querySelector('#set-warehouse-location').addEventListener('click', async () => {
  const result = await safely(() => window.archiveApp.changeWarehouseLocation());
  if (!result) return;
  selectedCatalogIds.clear();
  activeCatalogId = null;
  catalogStateSignature = '';
  render(result.state, true);
  await refreshCatalog();
  await refreshWarehouseInsights(true);
  showToast(result.copied ? '仓库已复制并切换；原位置仍保留' : '已切换仓库位置');
});
document.querySelector('#open-warehouse').addEventListener('click', () => {
  void safely(() => window.archiveApp.openWarehouse());
});
document.querySelector('#export-warehouse').addEventListener('click', async () => {
  const result = await safely(() => window.archiveApp.exportWarehouse());
  if (result) showToast(`仓库压缩包已导出：${result.path}`);
});
document.querySelector('#import-warehouse').addEventListener('click', async () => {
  if (!window.confirm('选择外部仓库压缩包（.zip）后，会把其中的仓库记录、缩略图和解压密码记录一并并入当前仓库。相同 ID 的记录会跳过；外部压缩包实体不会被移动或删除。是否继续？')) return;
  const result = await safely(() => window.archiveApp.importWarehouse());
  if (!result) return;
  render(result.state);
  await refreshCatalog();
  await refreshWarehouseInsights(true);
  showToast(result.importedCount > 0
    ? `已并入 ${result.importedCount} 条记录，跳过 ${result.skippedCount} 条已存在记录`
    : `没有可并入的新记录，已跳过 ${result.skippedCount} 条`);
});
document.querySelector('#open-similarity-ignore-terms').addEventListener('click', async () => {
  const result = await safely(() => window.archiveApp.openSimilarityIgnoreTerms());
  if (result) showToast(`已打开相似度排除词表（当前 ${result.count} 个词）`);
});
document.querySelector('#reload-similarity-ignore-terms').addEventListener('click', async () => {
  const result = await safely(() => window.archiveApp.reloadSimilarityIgnoreTerms());
  if (!result) return;
  if (result.state) render(result.state, true);
  await refreshCatalog();
  showToast(`已重新载入 ${result.count} 个排除词，并更新相似项目关系`);
});
elements.catalogPagePrev.addEventListener('click', () => {
  if (catalogPage <= 1) return;
  catalogPage -= 1;
  renderCatalog(currentCatalogResults);
  elements.catalogList.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
elements.catalogPageNext.addEventListener('click', () => {
  catalogPage += 1;
  renderCatalog(currentCatalogResults);
  elements.catalogList.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.addEventListener('click', (event) => {
  const image = event.target.closest('img[data-thumbnail-record][data-thumbnail-path]');
  if (!image) return;
  event.preventDefault();
  event.stopPropagation();
  void openThumbnailLightbox(
    image.dataset.thumbnailRecord,
    image.dataset.thumbnailPath,
    image.dataset.thumbnailTitle || image.alt
  );
}, true);

document.querySelector('#close-thumbnail-lightbox').addEventListener('click', closeThumbnailLightbox);
elements.thumbnailLightbox.addEventListener('click', (event) => {
  if (event.target === elements.thumbnailLightbox) closeThumbnailLightbox();
});
elements.thumbnailLightbox.addEventListener('close', () => {
  elements.lightboxImage.removeAttribute('src');
  lightboxContext = null;
});
elements.setThumbnailCover.addEventListener('click', async () => {
  if (!lightboxContext) return;
  const context = { ...lightboxContext };
  const updated = await safely(() => window.archiveApp.setCatalogCover(context.recordId, context.relativePath));
  if (!updated) return;
  const state = await safely(() => window.archiveApp.getState());
  if (state) {
    render(state);
    await refreshCatalog();
  }
  if (activeCatalogId === updated.id) renderCatalogDetail(updated);
  elements.setThumbnailCover.disabled = true;
  elements.setThumbnailCover.textContent = '当前项目封面';
  showToast('项目封面已更新');
});

elements.deleteThumbnail.addEventListener('click', async () => {
  if (!lightboxContext) return;
  const context = { ...lightboxContext };
  if (!window.confirm('确定删除这张图片？删除后可以通过仓库顶部的“撤回”恢复。')) return;
  const updated = await safely(() => window.archiveApp.deleteCatalogImage(context.recordId, context.relativePath));
  if (!updated) return;
  closeThumbnailLightbox();
  const state = await safely(() => window.archiveApp.getState());
  if (state) {
    render(state);
    await refreshCatalog();
  }
  if (activeCatalogId === updated.id) renderCatalogDetail(updated);
  showToast('图片已删除，可在“撤回”中恢复');
});

document.querySelector('#random-walk').addEventListener('click', async () => {
  await showRandomWalk(true);
});

elements.warehouseDiscovery.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-discovery-record]');
  if (button) void openDiscoveryRecord(button.dataset.discoveryRecord);
});

elements.catalogDetail.addEventListener('click', (event) => {
  const external = event.target.closest('button[data-external-url]');
  if (external) {
    void safely(() => window.archiveApp.openExternal(external.dataset.externalUrl));
    return;
  }
  const passwordToggle = event.target.closest('button[data-password-toggle]');
  if (passwordToggle) {
    const value = passwordToggle.parentElement.querySelector('.archive-password-value');
    const showing = passwordToggle.textContent === '隐藏';
    value.textContent = showing ? '****' : passwordToggle.dataset.passwordToggle;
    passwordToggle.textContent = showing ? '显示' : '隐藏';
    return;
  }
  const copy = event.target.closest('button[data-copy-text]');
  if (copy) {
    void safely(() => window.archiveApp.copyText(copy.dataset.copyText)).then((copied) => {
      if (copied) showToast(copy.dataset.copyKind === 'password' ? '解压密码已复制' : '压缩包名称已复制');
    });
    return;
  }
  const removeSimilar = event.target.closest('button[data-remove-similar]');
  if (removeSimilar) {
    const recordId = removeSimilar.dataset.recordId;
    const similarId = removeSimilar.dataset.removeSimilar;
    void safely(() => window.archiveApp.removeCatalogSimilarity(recordId, similarId)).then(async (updated) => {
      if (!updated) return;
      renderCatalogDetail(updated);
      const state = await safely(() => window.archiveApp.getState());
      if (state) render(state);
      await refreshCatalog();
      showToast('已双向移除相似关系');
    });
    return;
  }
  const recalculateSimilar = event.target.closest('button[data-recalculate-similar]');
  if (recalculateSimilar) {
    recalculateSimilar.disabled = true;
    void safely(() => window.archiveApp.recalculateCatalogSimilarity(recalculateSimilar.dataset.recalculateSimilar)).then(async (updated) => {
      if (!updated) return;
      renderCatalogDetail(updated);
      const state = await safely(() => window.archiveApp.getState());
      if (state) render(state);
      await refreshCatalog();
      showToast('相似关系已重新计算');
    });
    return;
  }
  const manageSimilar = event.target.closest('button[data-manage-similar]');
  if (manageSimilar) {
    similarityManageRecordId = similarityManageRecordId === manageSimilar.dataset.manageSimilar
      ? null
      : manageSimilar.dataset.manageSimilar;
    void loadCatalogDetails(manageSimilar.dataset.manageSimilar);
    return;
  }
  const button = event.target.closest('button[data-similar-record]');
  if (!button) return;
  void loadCatalogDetails(button.dataset.similarRecord).then(() => {
    elements.catalogDetail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

document.addEventListener('click', (event) => {
  const external = event.target.closest('button[data-external-url]');
  if (!external || elements.catalogDetail.contains(external)) return;
  void safely(() => window.archiveApp.openExternal(external.dataset.externalUrl));
});

elements.selectAllCatalog.addEventListener('change', () => {
  for (const record of currentCatalogResults) {
    if (elements.selectAllCatalog.checked) selectedCatalogIds.add(record.id);
    else selectedCatalogIds.delete(record.id);
  }
  renderCatalog(currentCatalogResults);
});

function closeBulkTagsDialog() {
  elements.bulkTagsDialog.close();
  elements.bulkTagsForm.reset();
}

function closeBulkBackupDialog() {
  elements.bulkBackupDialog.close();
  elements.bulkBackupForm.reset();
}

elements.addTagsSelected.addEventListener('click', () => {
  if (selectedCatalogIds.size === 0) return;
  elements.bulkTagsDialog.showModal();
  elements.bulkTagsInput.focus();
});
document.querySelector('#close-bulk-tags').addEventListener('click', closeBulkTagsDialog);
document.querySelector('#cancel-bulk-tags').addEventListener('click', closeBulkTagsDialog);
elements.bulkTagsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const selectedCount = selectedCatalogIds.size;
  const state = await safely(() => window.archiveApp.addTagsToCatalogRecords([...selectedCatalogIds], elements.bulkTagsInput.value));
  if (!state) return;
  closeBulkTagsDialog();
  render(state);
  await refreshCatalog();
  showToast(`已为 ${selectedCount} 项追加标签`);
});

elements.updateBackupSelected.addEventListener('click', () => {
  if (selectedCatalogIds.size === 0) return;
  elements.bulkBackupDialog.showModal();
  elements.bulkBackupInput.focus();
});
document.querySelector('#close-bulk-backup').addEventListener('click', closeBulkBackupDialog);
document.querySelector('#cancel-bulk-backup').addEventListener('click', closeBulkBackupDialog);
elements.bulkBackupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const selectedCount = selectedCatalogIds.size;
  const state = await safely(() => window.archiveApp.updateBackupLocationForCatalogRecords(
    [...selectedCatalogIds], elements.bulkBackupInput.value
  ));
  if (!state) return;
  closeBulkBackupDialog();
  render(state);
  await refreshCatalog();
  showToast(`已修改 ${selectedCount} 项的备份位置`);
});

elements.undoCatalog.addEventListener('click', async () => {
  const state = await safely(() => window.archiveApp.undoCatalogAction());
  if (!state) return;
  render(state);
  await refreshCatalog();
  if (activeCatalogId && state.catalog.some((record) => record.id === activeCatalogId)) {
    await loadCatalogDetails(activeCatalogId);
  }
  showToast('已撤回最近一次仓库操作');
});

function closeDeleteCatalogDialog() {
  elements.deleteCatalogDialog.close();
  elements.deleteCatalogForm.reset();
}

elements.deleteCatalogSelected.addEventListener('click', () => {
  const selectedRecords = (currentState?.catalog || []).filter((record) => selectedCatalogIds.has(record.id));
  if (selectedRecords.length === 0) return;
  const archiveCount = selectedRecords.filter((record) => record.recordType !== 'manual').length;
  const manualCount = selectedRecords.length - archiveCount;
  const parts = [];
  if (archiveCount > 0) parts.push(`${archiveCount} 个普通归档的压缩包将移入 Windows 回收站`);
  if (manualCount > 0) parts.push(`${manualCount} 条手动库存记录将被移除`);
  elements.deleteCatalogSummary.textContent = `所选 ${selectedRecords.length} 项：${parts.join('；')}。只有必要操作全部成功后，对应仓库记录才会删除。`;
  const restorableCount = selectedRecords.filter((record) => ['moved', 'trashed'].includes(record.sourceDisposition)).length;
  elements.restoreOriginalSources.disabled = restorableCount === 0;
  elements.restoreOriginalSources.closest('.restore-source-option').classList.toggle('disabled', restorableCount === 0);
  elements.restoreOriginalSourcesHelp.textContent = restorableCount > 0
    ? `其中 ${restorableCount} 项记录为已移动或已进入回收站；复原失败时会保留对应仓库记录和压缩包。`
    : '所选项目没有可以尝试复原的原文件记录。';
  elements.deleteCatalogDialog.showModal();
});

document.querySelector('#close-delete-catalog').addEventListener('click', closeDeleteCatalogDialog);
document.querySelector('#cancel-delete-catalog').addEventListener('click', closeDeleteCatalogDialog);
elements.deleteCatalogDialog.addEventListener('click', (event) => {
  if (event.target === elements.deleteCatalogDialog) closeDeleteCatalogDialog();
});
elements.deleteCatalogForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const result = await safely(() => window.archiveApp.deleteCatalogRecords([...selectedCatalogIds], {
    restoreOriginalSources: elements.restoreOriginalSources.checked
  }));
  if (!result) return;
  closeDeleteCatalogDialog();
  for (const id of result.deletedIds) selectedCatalogIds.delete(id);
  if (activeCatalogId && result.deletedIds.includes(activeCatalogId)) {
    activeCatalogId = null;
    elements.catalogDetail.replaceChildren(make('div', 'empty-library', '所选仓库内容已删除。'));
  }
  render(result.state);
  await refreshCatalog();
  if (result.failures.length > 0) {
    showToast(`已删除 ${result.deletedIds.length} 项；${result.failures.length} 项失败：${result.failures[0].message}`, true);
  } else {
    showToast(`已删除 ${result.deletedIds.length} 项`);
  }
});

function closeManualCatalogDialog() {
  elements.manualCatalogDialog.close();
  elements.manualCatalogForm.reset();
  pendingManualImages = [];
  renderPendingManualImages();
}

document.querySelector('#add-manual-catalog').addEventListener('click', () => {
  elements.manualCatalogDialog.showModal();
  elements.manualCatalogName.focus();
});
document.querySelector('#close-manual-dialog').addEventListener('click', closeManualCatalogDialog);
document.querySelector('#cancel-manual-dialog').addEventListener('click', closeManualCatalogDialog);
elements.manualCatalogDialog.addEventListener('click', (event) => {
  if (event.target === elements.manualCatalogDialog) closeManualCatalogDialog();
});
elements.manualCatalogImages.addEventListener('change', () => {
  void safely(() => appendPendingManualFiles(elements.manualCatalogImages.files));
});
elements.manualImagePaste.addEventListener('paste', (event) => {
  const files = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith('image/'));
  if (files.length === 0) return;
  event.preventDefault();
  void safely(() => appendPendingManualFiles(files));
});
elements.manualCatalogForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const images = [...pendingManualImages];
  const record = await safely(() => window.archiveApp.addManualCatalogRecord({
    name: elements.manualCatalogName.value,
    notes: elements.manualCatalogNotes.value,
    tags: elements.manualCatalogTags.value,
    sourcePath: elements.manualCatalogSource.value,
    backupLocation: elements.manualCatalogBackup.value
  }));
  if (!record) return;
  let updatedRecord = record;
  if (images.length > 0) {
    updatedRecord = await safely(() => addImagesToCatalog(record.id, images)) || record;
  }
  closeManualCatalogDialog();
  const state = await safely(() => window.archiveApp.getState());
  if (state) {
    render(state);
    await refreshCatalog();
    await loadCatalogDetails(updatedRecord.id);
  }
  showToast(images.length > 0 ? `手动库存已添加，并保存 ${images.length} 张图片` : '手动库存已添加');
});

function enableMarqueeSelection(container, itemSelector, idFromItem, selection, finishRender) {
  container.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('input, button, img, a')) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const initialSelection = new Set((event.ctrlKey || event.metaKey) ? selection : []);
    let active = false;
    let marquee = null;

    const move = (moveEvent) => {
      if (!active && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 6) return;
      if (!active) {
        active = true;
        marquee = make('div', 'selection-marquee');
        document.body.append(marquee);
        document.body.classList.add('marquee-selecting');
      }
      const left = Math.min(startX, moveEvent.clientX);
      const top = Math.min(startY, moveEvent.clientY);
      const right = Math.max(startX, moveEvent.clientX);
      const bottom = Math.max(startY, moveEvent.clientY);
      Object.assign(marquee.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
      selection.clear();
      for (const id of initialSelection) selection.add(id);
      for (const item of container.querySelectorAll(itemSelector)) {
        const rect = item.getBoundingClientRect();
        const hit = rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top;
        const id = idFromItem(item);
        if (hit) selection.add(id);
        item.classList.toggle('selected', selection.has(id));
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = selection.has(id);
      }
      if (container === elements.taskListContainer) updateSelectionControls(currentState?.jobs || []);
      else updateCatalogSelectionControls();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      marquee?.remove();
      document.body.classList.remove('marquee-selecting');
      if (active) {
        suppressSelectionClickUntil = Date.now() + 250;
        finishRender();
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  });
}

enableMarqueeSelection(
  elements.taskListContainer,
  'tr[data-job-id]',
  (item) => item.dataset.jobId,
  selectedJobIds,
  () => renderJobs(currentState?.jobs || [])
);
enableMarqueeSelection(
  elements.catalogList,
  '.catalog-card[data-catalog-id]',
  (item) => item.dataset.catalogId,
  selectedCatalogIds,
  () => renderCatalog(currentCatalogResults)
);

window.archiveApp.onStateChanged((state) => render(state));
window.archiveApp.onTaskProgress((progress) => {
  if (!currentState) return;
  const job = currentState.jobs.find((candidate) => candidate.id === progress.jobId);
  if (!job) return;
  job.status = progress.stage;
  job.stageText = progress.stageText || job.stageText;
  job.progress = progress.percentage;
  const row = elements.taskList.querySelector(`tr[data-job-id="${CSS.escape(progress.jobId)}"]`);
  if (row) {
    const status = row.querySelector('.status');
    const fill = row.querySelector('.progress span');
    const progressText = row.querySelector('.progress-text');
    if (status) {
      status.className = `status-pill ${progress.stage}`;
      status.textContent = statusLabels[progress.stage] || progress.stage;
    }
    if (fill) fill.style.width = `${Math.max(0, Math.min(100, progress.percentage))}%`;
    if (progressText) progressText.textContent = taskProgressText(job, progress.percentage);
  }
});
window.archiveApp.onCatalogChanged((catalog) => {
  if (!currentState) return;
  currentState.catalog = catalog;
  catalogRefreshDirty = true;
  updateCatalogSelectionControls();
  void refreshWarehouseInsights();
  const libraryVisible = !document.querySelector('#library-page').hidden;
  if (libraryVisible) void refreshCatalog();
});
window.archiveApp.onScanProgress((progress) => {
  elements.notice.hidden = false;
  elements.notice.textContent = `正在统计 ${progress.displayName}（${progress.index + 1}/${progress.total}）…`;
});

setCatalogView(catalogViewMode);
safely(async () => {
  const state = await window.archiveApp.getState();
  render(state, true);
});
