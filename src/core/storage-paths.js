'use strict';

const fs = require('node:fs');
const path = require('node:path');

const USER_DATA_LOCATION_FILENAME = 'user-data-location.json';

function userDataLocationPath(applicationRoot) {
  if (!applicationRoot) throw new Error('软件主目录不能为空。');
  return path.join(path.resolve(applicationRoot), USER_DATA_LOCATION_FILENAME);
}

function resolveUserDataRoot(applicationRoot, readFileSync = fs.readFileSync) {
  const resolvedApplicationRoot = path.resolve(applicationRoot);
  const defaultRoot = path.join(resolvedApplicationRoot, 'userdata');
  try {
    const saved = JSON.parse(readFileSync(userDataLocationPath(resolvedApplicationRoot), 'utf8'));
    const configured = String(saved?.userDataDirectory || '').trim();
    if (!configured) return defaultRoot;
    const resolved = path.isAbsolute(configured)
      ? path.resolve(configured)
      : path.resolve(resolvedApplicationRoot, configured);
    return path.parse(resolved).root === resolved ? defaultRoot : resolved;
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return defaultRoot;
    throw error;
  }
}

function makeUserDataLayout(applicationRoot, legacyElectronUserDataRoot = null, userDataRoot = null) {
  if (!applicationRoot) throw new Error('软件主目录不能为空。');
  const root = path.resolve(userDataRoot || path.join(path.resolve(applicationRoot), 'userdata'));
  const configDirectory = path.join(root, 'config');
  const logDirectory = path.join(root, 'logs');
  return {
    root,
    electronRuntimeDirectory: path.join(root, 'electron'),
    configDirectory,
    settingsPath: path.join(configDirectory, 'settings.json'),
    legacySettingsPath: legacyElectronUserDataRoot
      ? path.join(path.resolve(legacyElectronUserDataRoot), 'settings.json')
      : null,
    similarityIgnoreTermsPath: path.join(configDirectory, 'similarity-ignore-terms.txt'),
    repositoryDirectory: path.join(root, 'warehouse'),
    processedSourceDirectory: path.join(root, 'processed'),
    logDirectory,
    logPath: path.join(logDirectory, 'app.log')
  };
}

module.exports = {
  USER_DATA_LOCATION_FILENAME,
  makeUserDataLayout,
  resolveUserDataRoot,
  userDataLocationPath
};
