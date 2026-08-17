'use strict';

const path = require('node:path');

function makeUserDataLayout(applicationRoot, legacyElectronUserDataRoot = null) {
  if (!applicationRoot) throw new Error('软件主目录不能为空。');
  const root = path.join(path.resolve(applicationRoot), 'userdata');
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

module.exports = { makeUserDataLayout };
