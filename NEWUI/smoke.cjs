/* 无窗口冒烟测试：加载 demo 页面并收集控制台错误 */
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { contextIsolation: true } });
  const errors = [];
  win.webContents.on('console-message', (event, level, message) => {
    if (level >= 2) errors.push(message);
  });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    errors.push(`did-fail-load ${code} ${desc} ${url}`);
  });
  await win.loadURL('file:///' + path.resolve(__dirname, 'demo', 'index.html').replace(/\\/g, '/'));
  win.showInactive();
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const report = await win.webContents.executeJavaScript(`(() => {
    document.querySelector('.tab[data-page="page-library"]').click();
    const grid = document.getElementById('card-grid');
    const cards = grid.querySelectorAll('.card');
    const first = cards[0] ? cards[0].getBoundingClientRect() : null;
    const gridRect = grid.getBoundingClientRect();
    const last = cards[cards.length - 1] ? cards[cards.length - 1].getBoundingClientRect() : null;
    return { cards: cards.length, columns: getComputedStyle(grid).gridTemplateColumns, cardW: first ? first.width : 0, gridW: gridRect.width, rowFill: last ? (last.right - first.left) : 0 };
  })()`);

  // 切到文本列表再切回
  await win.webContents.executeJavaScript(`(() => {
    document.getElementById('view-list').click();
    const rows = document.querySelectorAll('.tl-row').length;
    document.getElementById('view-grid').click();
    return rows;
  })()`).then((rows) => { report.listRows = rows; });

  // 打开抽屉
  await win.webContents.executeJavaScript(`(() => {
    document.querySelector('.card-open').click();
    return document.querySelectorAll('#drawer-body .thumb').length;
  })()`).then((thumbs) => { report.drawerThumbs = thumbs; });

  // 对比：现行 auto-fill 算法的右侧空白
  win.setSize(1380, 900);
  await new Promise((resolve) => setTimeout(resolve, 800));
  await win.webContents.executeJavaScript(`(() => {
    const legacy = document.getElementById('algo-legacy');
    legacy.checked = true;
    legacy.dispatchEvent(new Event('change'));
    const grid = document.getElementById('card-grid');
    const note = document.getElementById('gap-note');
    return { legacyColumns: getComputedStyle(grid).gridTemplateColumns, gapNote: note.hidden ? '' : note.dataset.label };
  })()`).then((legacyReport) => { report.legacy = legacyReport; });

  // 工作台：折叠组 + 摘要行 + 分卷设定
  await win.webContents.executeJavaScript(`(() => {
    document.querySelector('.tab[data-page="page-workbench"]').click();
    const group = document.querySelector('.compression-group');
    const before = document.getElementById('digest-compression').textContent;
    group.querySelector('.group-head').click();
    document.getElementById('archive-format').value = 'zip';
    document.getElementById('archive-format').dispatchEvent(new Event('input'));
    document.getElementById('split-volume').checked = true;
    document.getElementById('split-volume').dispatchEvent(new Event('input'));
    const after = document.getElementById('digest-compression').textContent;
    const hint = document.getElementById('volume-hint').textContent;
    return { collapsed: before, expanded: after, hint, groupOpen: group.dataset.open };
  })()`).then((workbench) => { report.workbench = workbench; });

  report.jsErrors = errors;
  console.log(JSON.stringify(report, null, 2));
  app.exit(errors.length ? 1 : 0);
});
