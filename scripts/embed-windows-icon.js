'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const ResEdit = require('resedit');

async function embedWindowsIcon(executablePath, iconPath) {
  const executableData = await fs.readFile(executablePath);
  const iconData = await fs.readFile(iconPath);
  const executable = ResEdit.NtExecutable.from(executableData, { ignoreCert: true });
  const resources = ResEdit.NtExecutableResource.from(executable);
  const existingGroups = ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries);
  const iconFile = ResEdit.Data.IconFile.from(iconData);
  const targetGroups = existingGroups.length > 0
    ? existingGroups.map((group) => ({ id: group.id, lang: group.lang }))
    : [{ id: 1, lang: 1033 }];

  for (const group of targetGroups) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      resources.entries,
      group.id,
      group.lang,
      iconFile.icons.map((item) => item.data)
    );
  }
  resources.outputResource(executable);
  const temporaryPath = `${executablePath}.icon-update`;
  const backupPath = `${executablePath}.icon-backup`;
  await fs.writeFile(temporaryPath, Buffer.from(executable.generate()));
  await fs.rename(executablePath, backupPath);
  try {
    await fs.rename(temporaryPath, executablePath);
    await fs.rm(backupPath, { force: true });
  } catch (error) {
    await fs.rm(executablePath, { force: true }).catch(() => {});
    await fs.rename(backupPath, executablePath).catch(() => {});
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

if (require.main === module) {
  const executablePath = path.resolve(process.argv[2] || '');
  const iconPath = path.resolve(process.argv[3] || '');
  embedWindowsIcon(executablePath, iconPath).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { embedWindowsIcon };
