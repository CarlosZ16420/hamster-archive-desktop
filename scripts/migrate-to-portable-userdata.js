'use strict';

const path = require('node:path');
const { AppStore } = require('../src/core/store');
const { QueueManager } = require('../src/core/queue-manager');
const { makeDefaultConfig } = require('../src/core/paths');
const { migrateToUserData } = require('../src/core/storage-migration');
const { makeUserDataLayout } = require('../src/core/storage-paths');

async function main() {
  const applicationRoot = path.resolve(__dirname, '..');
  const legacyProfileRoot = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'hamster-archive')
    : null;
  const layout = makeUserDataLayout(applicationRoot, legacyProfileRoot);
  const store = new AppStore(layout);
  try {
    const config = await store.loadSettings(makeDefaultConfig(applicationRoot, layout));
    delete config.ffprobePath;
    await migrateToUserData(config, applicationRoot, layout);
    await store.saveSettings(config);
    const manager = new QueueManager(store, config);
    await manager.initialize();
    console.log(`便携式用户数据迁移完成：${layout.root}`);
    console.log(`仓库：${manager.config.repositoryDirectory}`);
    console.log(`暂存区：${manager.config.archiveStagingDirectory}`);
    console.log(`已备份源文件：${manager.config.processedSourceDirectory}`);
  } finally {
    store.closeAll();
  }
}

main().catch((error) => {
  console.error(`迁移失败：${error.stack || error.message}`);
  process.exitCode = 1;
});
