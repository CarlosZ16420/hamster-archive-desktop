'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('archiveApp', {
  getState: () => ipcRenderer.invoke('state:get'),
  chooseDirectory: (initialPath) => ipcRenderer.invoke('dialog:choose-directory', initialPath),
  chooseProgram: (initialPath) => ipcRenderer.invoke('dialog:choose-program', initialPath),
  changeWarehouseLocation: () => ipcRenderer.invoke('warehouse:change-location'),
  openWarehouse: () => ipcRenderer.invoke('warehouse:open'),
  exportWarehouse: () => ipcRenderer.invoke('warehouse:export'),
  importWarehouse: () => ipcRenderer.invoke('warehouse:import'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  openUserData: () => ipcRenderer.invoke('user-data:open'),
  openSimilarityIgnoreTerms: () => ipcRenderer.invoke('similarity:open-ignore-terms'),
  reloadSimilarityIgnoreTerms: () => ipcRenderer.invoke('similarity:reload-ignore-terms'),
  openExternal: (url) => ipcRenderer.invoke('system:open-external', url),
  copyText: (value) => ipcRenderer.invoke('system:copy-text', value),
  chooseSingle: (kind) => ipcRenderer.invoke('dialog:choose-single', kind),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  scanSource: (intakeDirectory) => ipcRenderer.invoke('source:scan', intakeDirectory),
  addSingle: (sourcePath) => ipcRenderer.invoke('task:add-single', sourcePath),
  getDroppedPath: (file) => webUtils.getPathForFile(file),
  confirmTask: (jobId) => ipcRenderer.invoke('task:confirm', jobId),
  confirmAnomaly: (jobId) => ipcRenderer.invoke('task:confirm-anomaly', jobId),
  discardAnomaly: (jobId) => ipcRenderer.invoke('task:discard-anomaly', jobId),
  cancelTask: (jobId) => ipcRenderer.invoke('task:cancel', jobId),
  retryTask: (jobId) => ipcRenderer.invoke('task:retry', jobId),
  startQueue: () => ipcRenderer.invoke('queue:start'),
  pauseQueue: () => ipcRenderer.invoke('queue:pause'),
  resumeQueue: () => ipcRenderer.invoke('queue:resume'),
  removeJobs: (jobIds) => ipcRenderer.invoke('queue:remove-jobs', jobIds),
  clearCompletedJobs: () => ipcRenderer.invoke('queue:clear-completed'),
  clearQueue: () => ipcRenderer.invoke('queue:clear'),
  clearPotentialDuplicates: () => ipcRenderer.invoke('queue:clear-duplicates'),
  confirmAllDuplicates: () => ipcRenderer.invoke('queue:confirm-all-duplicates'),
  finishNextAndPause: () => ipcRenderer.invoke('queue:finish-next'),
  searchCatalog: (query) => ipcRenderer.invoke('catalog:search', query),
  getCatalogSuggestions: (query) => ipcRenderer.invoke('catalog:suggestions', query),
  getWarehouseInsights: () => ipcRenderer.invoke('catalog:insights'),
  getRandomCatalogRecord: (excludeId) => ipcRenderer.invoke('catalog:random', excludeId),
  getCatalogDetails: (recordId) => ipcRenderer.invoke('catalog:details', recordId),
  updateCatalogMetadata: (recordId, metadata) => ipcRenderer.invoke('catalog:update-metadata', recordId, metadata),
  setCatalogCover: (recordId, relativePath) => ipcRenderer.invoke('catalog:set-cover', recordId, relativePath),
  deleteCatalogImage: (recordId, thumbnailRef) => ipcRenderer.invoke('catalog:delete-thumbnail', recordId, thumbnailRef),
  addManualCatalogRecord: (input) => ipcRenderer.invoke('catalog:add-manual', input),
  addCatalogImage: (recordId, input) => ipcRenderer.invoke('catalog:add-image', recordId, input),
  addTagsToCatalogRecords: (recordIds, tags) => ipcRenderer.invoke('catalog:add-tags', recordIds, tags),
  updateBackupLocationForCatalogRecords: (recordIds, location) => ipcRenderer.invoke('catalog:update-backup-location', recordIds, location),
  undoCatalogAction: () => ipcRenderer.invoke('catalog:undo'),
  deleteCatalogRecords: (recordIds) => ipcRenderer.invoke('catalog:delete', recordIds),
  getThumbnail: (recordId, relativePath) => ipcRenderer.invoke('catalog:thumbnail', recordId, relativePath),
  onStateChanged: (callback) => {
    ipcRenderer.on('state:changed', (_event, state) => callback(state));
  },
  onTaskProgress: (callback) => {
    ipcRenderer.on('task:progress', (_event, progress) => callback(progress));
  },
  onCatalogChanged: (callback) => {
    ipcRenderer.on('catalog:changed', (_event, catalog) => callback(catalog));
  },
  onScanProgress: (callback) => {
    ipcRenderer.on('scan:progress', (_event, progress) => callback(progress));
  }
});
