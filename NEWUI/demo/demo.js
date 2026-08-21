/* ===========================================================================
   Hamster Archiver · NEWUI 演示脚本
   全部为前端演示逻辑与假数据，不依赖 Electron。
   ========================================================================= */
'use strict';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

let toastTimer = null;
function toast(message) {
  const node = $('toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 2600);
}

/* --------------------------------------------------------------------------
   演示数据：仓库记录
--------------------------------------------------------------------------- */
const CATALOG = [
  { id: 1,  title: '人物写真题材 · 一',   type: 'folder', cover: 'assets/person-1.jpg', files: 128, dirs: 6,  size: 4.2,  date: '2026-08-19', rating: 5, tags: ['摄影', '人像'], backup: '百度网盘', state: 'compressed', volumes: 1 },
  { id: 2,  title: '人像精选 2023',        type: 'folder', cover: 'assets/person-2.jpg', files: 86,  dirs: 3,  size: 3.1,  date: '2026-08-15', rating: 4, tags: ['人像'], backup: '百度网盘', state: 'compressed', volumes: 1 },
  { id: 3,  title: '棚拍样片合集',         type: 'folder', cover: 'assets/person-3.jpg', files: 214, dirs: 12, size: 7.8,  date: '2026-08-12', rating: 3, tags: ['摄影', '棚拍'], backup: '移动硬盘 A', state: 'compressed', volumes: 1 },
  { id: 4,  title: '街拍视频 13735968',    type: 'video',  cover: 'assets/video-person-1.jpg', files: 1, dirs: 0, size: 2.1, date: '2026-08-08', rating: 4, tags: ['视频', '街拍'], backup: '', state: 'compressed', volumes: 1 },
  { id: 5,  title: '4K 舞蹈视频 4912877',  type: 'video',  cover: 'assets/video-person-2.jpg', files: 1, dirs: 0, size: 1.4, date: '2026-08-05', rating: 0, tags: ['视频'], backup: '', state: 'uncompressed', volumes: 0 },
  { id: 6,  title: '动物图鉴',             type: 'folder', cover: 'assets/animal-1.jpg', files: 342, dirs: 18, size: 5.6,  date: '2026-07-28', rating: 5, tags: ['动物', '摄影'], backup: '', state: 'compressed', volumes: 1 },
  { id: 7,  title: '峡谷航拍全集',         type: 'folder', cover: 'assets/canyon-1.jpg', files: 96,  dirs: 4,  size: 8.9,  date: '2026-07-21', rating: 5, tags: ['风景', '航拍'], backup: '百度网盘', state: 'compressed', volumes: 1 },
  { id: 8,  title: '峡谷岩壁特写',         type: 'folder', cover: 'assets/canyon-2.jpg', files: 64,  dirs: 2,  size: 2.2,  date: '2026-07-18', rating: 4, tags: ['风景'], backup: '', state: 'compressed', volumes: 1, duplicate: true, similar: 1 },
  { id: 9,  title: '沙漠风光',             type: 'folder', cover: 'assets/desert-1.jpg', files: 58,  dirs: 1,  size: 1.9,  date: '2026-07-11', rating: 3, tags: ['风景', '沙漠'], backup: '', state: 'compressed', volumes: 1 },
  { id: 10, title: '沙漠纹理素材',         type: 'folder', cover: 'assets/desert-2.jpg', files: 41,  dirs: 1,  size: 1.2,  date: '2026-07-06', rating: 0, tags: ['素材'], backup: '', state: 'compressed', volumes: 1 },
  { id: 11, title: '热气球节 2025',        type: 'folder', cover: 'assets/balloon-1.jpg', files: 77,  dirs: 3,  size: 3.4,  date: '2026-06-30', rating: 4, tags: ['旅行'], backup: '移动硬盘 A', state: 'compressed', volumes: 1 },
  { id: 12, title: '热气球特写（副本）',   type: 'folder', cover: 'assets/balloon-2.jpg', files: 33,  dirs: 1,  size: 0.9,  date: '2026-06-27', rating: 0, tags: ['旅行'], backup: '', state: 'compressed', volumes: 1, duplicate: true, similar: 1 },
  { id: 13, title: '绿色植物图鉴',         type: 'folder', cover: 'assets/green-1.jpg', files: 205, dirs: 9,  size: 4.1,  date: '2026-06-20', rating: 3, tags: ['植物'], backup: '', state: 'compressed', volumes: 1 },
  { id: 14, title: '苔藓微距合集',         type: 'folder', cover: 'assets/green-2.jpg', files: 118, dirs: 5,  size: 2.7,  date: '2026-06-14', rating: 5, tags: ['植物', '微距'], backup: '', state: 'compressed', volumes: 1 },
  { id: 15, title: '风蚀地貌研究',         type: 'folder', cover: 'assets/wind-1.jpg', files: 89,  dirs: 4,  size: 3.3,  date: '2026-06-05', rating: 4, tags: ['地质', '风景'], backup: '', state: 'compressed', volumes: 1 },
  { id: 16, title: '风景人物视频 12476106', type: 'video', cover: 'assets/video-scene-1.jpg', files: 1, dirs: 0, size: 1.8, date: '2026-05-28', rating: 4, tags: ['视频', '风景'], backup: '', state: 'compressed', volumes: 1 },
  { id: 17, title: '杂项收集（未整理）',   type: 'folder', cover: 'assets/misc-1.jpg', files: 503, dirs: 27, size: 12.6, date: '2026-05-19', rating: 2, tags: ['待整理'], backup: '', state: 'compressed', volumes: 2 },
  { id: 18, title: '云盘残留备份（待核对）', type: 'folder', cover: null, files: 0, dirs: 0, size: 0, date: '2026-05-10', rating: 3, tags: ['手动', '待核对'], backup: '阿里云盘', state: 'uncompressed', volumes: 0, manual: true },
];

const TYPE_LABEL = { folder: '文件夹', video: '视频', manual: '手动' };
function stars(rating, cls) {
  const wrap = el('span', cls || 'stars');
  for (let i = 1; i <= 5; i++) wrap.append(el('span', i <= rating ? '' : 'off', '★'));
  return wrap;
}
function fmtSize(gb) {
  if (!gb) return '—';
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(gb * 1024)} MB`;
}
function fmtDate(iso) { return iso.slice(5).replace('-', '/'); }

/* --------------------------------------------------------------------------
   顶栏：页面切换 / 主题
--------------------------------------------------------------------------- */
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.page').forEach((p) => { p.hidden = p.id !== tab.dataset.page; });
    if (tab.dataset.page === 'page-library') layoutGrid();
  });
});

$('theme-toggle').addEventListener('click', () => {
  const body = document.body;
  body.dataset.theme = body.dataset.theme === 'day' ? 'night' : 'day';
});
document.querySelector('.lang-btn').addEventListener('click', () => toast('演示：语言切换保持原有 ⇄ EN 行为'));
document.querySelector('.safety-chip').addEventListener('click', () => toast('演示：安全提示，勾选「移入回收站」后此徽章会变红'));

/* --------------------------------------------------------------------------
   折叠设置组 + 摘要行（digest）
--------------------------------------------------------------------------- */
document.querySelectorAll('.settings-group .group-head').forEach((head) => {
  head.addEventListener('click', () => {
    const group = head.closest('.settings-group');
    group.dataset.open = group.dataset.open === 'true' ? 'false' : 'true';
  });
});

function updateCompressionDigest() {
  const format = $('archive-format').value === '7z' ? '7z' : 'ZIP';
  const level = $('compression-level').value;
  const naming = document.querySelector('input[name="naming"]:checked').value;
  const namingLabel = naming === 'timestamp' ? '时间戳命名'
    : naming === 'original' ? '原名命名'
    : `自定义「${$('custom-name').value || '未填写'}」`;
  const volumeLabel = $('split-volume').checked
    ? `分卷 ${$('volume-size').value}${$('volume-unit').value === 'gb' ? ' GB' : ' MB'}`
    : '不分卷';
  const password = $('archive-password').value ? '已设密码' : '无密码';
  $('digest-compression').textContent = `${format} · 等级 ${level} · ${namingLabel} · ${volumeLabel} · ${password}`;
}

function updateVolumeHint() {
  const enabled = $('split-volume').checked;
  $('volume-setting').classList.toggle('enabled', enabled);
  $('volume-size').disabled = !enabled;
  $('volume-unit').disabled = !enabled;
  const size = Number($('volume-size').value) || 0;
  const gb = $('volume-unit').value === 'gb' ? size : size / 1024;
  const taskGb = 9.8;
  const count = gb > 0 ? Math.ceil(taskGb / gb) : 0;
  const last = count > 0 ? (taskGb - (count - 1) * gb) : 0;
  $('volume-hint').textContent = enabled && count > 0
    ? `示例：一个 ${taskGb} GB 的任务将拆为 ${count} 卷（` +
      Array.from({ length: count }, (_, i) => (i === count - 1 ? last.toFixed(1) : gb.toFixed(1)) + ' GB').join(' + ') + '）'
    : '示例：一个 9.8 GB 的任务将拆为 3 卷（4 + 4 + 1.8 GB）';
}

function updatePostDigest() {
  const move = $('opt-move').checked ? '移动到「已备份」' : '保留原位';
  const backup = $('opt-backup-loc').checked ? '记录备份位置' : '不记录备份位置';
  const trash = $('opt-trash').checked ? '回收站' : '不用回收站';
  $('digest-post').textContent = `${move} · ${backup} · ${trash}`;
  $('safety-chip').classList.toggle('trash', $('opt-trash').checked);
  $('safety-chip').innerHTML = `<span class="dot"></span>${$('opt-trash').checked ? '归档后移入回收站' : '归档后保留原文件'}`;
}

['archive-format', 'compression-level', 'archive-password', 'split-volume', 'volume-size', 'volume-unit'].forEach((id) => {
  $(id).addEventListener('input', () => { updateCompressionDigest(); updateVolumeHint(); });
});
document.querySelectorAll('input[name="naming"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    $('custom-name').disabled = radio.value !== 'custom' || !radio.checked;
    updateCompressionDigest();
  });
});
$('custom-name').addEventListener('input', updateCompressionDigest);
$('toggle-password').addEventListener('click', () => {
  const input = $('archive-password');
  input.type = input.type === 'password' ? 'text' : 'password';
  $('toggle-password').textContent = input.type === 'password' ? '显示' : '隐藏';
});
['opt-move', 'opt-backup-loc', 'opt-trash'].forEach((id) => $(id).addEventListener('change', updatePostDigest));

updateCompressionDigest();
updateVolumeHint();
updatePostDigest();

/* --------------------------------------------------------------------------
   队列：任务表 + 情境化工具栏 + 进度动画
--------------------------------------------------------------------------- */
const TASKS = [
  { id: 't1', name: '人物写真题材 · 一', detail: '128 个文件 · 6 个子目录', size: '4.2 GB', status: 'compressing', progress: 34 },
  { id: 't2', name: '人像精选 2023', detail: '86 个文件 · 3 个子目录', size: '3.1 GB', status: 'queued' },
  { id: 't3', name: '棚拍样片合集', detail: '214 个文件 · 12 个子目录 · 与「人物写真题材 · 一」相似', size: '7.8 GB', status: 'confirm-dup' },
  { id: 't4', name: '街拍视频 13735968', detail: '视频 · 3840×2160 · 30fps', size: '2.1 GB', status: 'queued' },
  { id: 't5', name: '4K 舞蹈视频 4912877', detail: '视频 · 压缩后体积异常，等待确认', size: '1.4 GB', status: 'confirm-anomaly' },
  { id: 't6', name: '动物图鉴', detail: '342 个文件 · 18 个子目录 · 压缩比 62%', size: '5.6 GB', status: 'done', progress: 100 },
  { id: 't7', name: '杂项收集（未整理）', detail: '503 个文件 · 27 个子目录 · 已拆分 2 卷', size: '12.6 GB', status: 'done', progress: 100 },
];

const STATUS_META = {
  'compressing':    { label: '压缩中', cls: 'active' },
  'queued':         { label: '等待压缩', cls: '' },
  'confirm-dup':    { label: '待确认重复', cls: 'confirm' },
  'confirm-anomaly':{ label: '待确认异常', cls: 'confirm' },
  'done':           { label: '已完成', cls: 'done' },
};

const taskSelection = new Set();

function renderTasks() {
  const tbody = $('task-list');
  tbody.replaceChildren();
  for (const task of TASKS) {
    const tr = el('tr', taskSelection.has(task.id) ? 'selected' : '');
    const sel = el('td', 'sel');
    const check = el('input');
    check.type = 'checkbox';
    check.dataset.task = task.id;
    check.checked = taskSelection.has(task.id);
    check.addEventListener('change', () => {
      if (check.checked) taskSelection.add(task.id); else taskSelection.delete(task.id);
      renderTasks();
    });
    sel.append(check);

    const name = el('td', 'task-name');
    name.append(el('strong', '', task.name), el('small', '', task.detail));

    const size = el('td', '', task.size);

    const meta = STATUS_META[task.status];
    const status = el('td', '', '');
    status.append(el('span', `status ${meta.cls}`, meta.label));

    const progress = el('td');
    if (task.status === 'compressing') {
      const bar = el('div', 'progress');
      const fill = el('span');
      fill.style.width = `${task.progress}%`;
      bar.append(fill);
      const text = el('span', 'progress-text', `${task.progress}% · 18.4 MB/s · 预计剩余 3 分钟`);
      progress.append(bar, text);
    } else if (task.status === 'done') {
      progress.append(el('span', 'progress-text', '已完成 · 校验通过'));
    } else {
      progress.append(el('span', 'progress-text', '—'));
    }

    const actions = el('td', 'row-actions');
    if (task.status === 'confirm-dup' || task.status === 'confirm-anomaly') {
      const ok = el('button', 'confirm', '确认');
      ok.addEventListener('click', () => {
        task.status = 'queued';
        toast(`已确认「${task.name}」，任务进入等待压缩`);
        renderTasks();
      });
      const remove = el('button', '', '移除');
      remove.addEventListener('click', () => {
        const index = TASKS.indexOf(task);
        TASKS.splice(index, 1);
        toast(`已移除「${task.name}」`);
        renderTasks();
      });
      actions.append(ok, remove);
    } else if (task.status === 'queued') {
      const remove = el('button', '', '移除');
      remove.addEventListener('click', () => {
        TASKS.splice(TASKS.indexOf(task), 1);
        toast(`已移除「${task.name}」`);
        renderTasks();
      });
      actions.append(remove);
    } else if (task.status === 'done') {
      actions.append(el('button', '', '查看'));
    }

    tr.append(sel, name, size, status, progress, actions);
    tbody.append(tr);
  }
  $('queue-selected-count').textContent = String(taskSelection.size);
  $('queue-batch').hidden = taskSelection.size === 0;
  $('queue-hint').hidden = taskSelection.size > 0;
}

$('select-all-tasks').addEventListener('change', (event) => {
  if (event.target.checked) TASKS.forEach((t) => taskSelection.add(t.id));
  else taskSelection.clear();
  renderTasks();
});
$('toggle-queue').addEventListener('click', () => {
  const table = $('task-table');
  table.hidden = !table.hidden;
  $('toggle-queue').textContent = table.hidden ? '展开任务列表' : '折叠任务列表';
});
$('btn-start').addEventListener('click', () => toast('演示：开始压缩入库（进度条会自动演示推进）'));

/* 进度动画 */
setInterval(() => {
  const task = TASKS.find((t) => t.status === 'compressing');
  if (!task) return;
  task.progress = Math.min(100, task.progress + Math.round(1 + Math.random() * 3));
  if (task.progress >= 100) {
    task.status = 'done';
    const next = TASKS.find((t) => t.status === 'queued');
    if (next) { next.status = 'compressing'; next.progress = 0; }
    pushLog('success', `${task.name} · 压缩完成，完整性验证通过`);
  }
  renderTasks();
}, 900);

/* 下拉菜单 */
document.querySelectorAll('[data-menu]').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const menu = $(button.dataset.menu);
    document.querySelectorAll('.menu').forEach((m) => { if (m !== menu) m.hidden = true; });
    menu.hidden = !menu.hidden;
  });
});
document.addEventListener('click', () => document.querySelectorAll('.menu').forEach((m) => { m.hidden = true; }));
document.querySelectorAll('.menu button').forEach((button) => {
  button.addEventListener('click', () => toast(`演示：${button.textContent.trim()}`));
});
document.querySelectorAll('[data-toast]').forEach((button) => {
  button.addEventListener('click', () => toast(button.dataset.toast));
});

/* --------------------------------------------------------------------------
   日志
--------------------------------------------------------------------------- */
const LOGS = [
  { time: '14:02:11', type: 'success', text: '人物写真题材 · 一 · 压缩完成，验证通过（4.2 GB → 1.6 GB）' },
  { time: '13:58:40', type: 'info', text: '开始压缩：人物写真题材 · 一 · 7z 等级 1 · 分卷 4096 MB' },
  { time: '13:58:02', type: 'warn', text: '「4K 舞蹈视频 4912877」压缩后体积异常（0.3 GB / 原始 1.4 GB），等待人工确认' },
  { time: '13:55:21', type: 'info', text: '「杂项收集（未整理）」已拆分为 2 卷，正在移动到存放点' },
  { time: '13:51:07', type: 'success', text: '动物图鉴 · 压缩完成，验证通过，已入库' },
];

function pushLog(type, text) {
  LOGS.unshift({ time: new Date().toTimeString().slice(0, 8), type, text });
  if (LOGS.length > 30) LOGS.pop();
  renderLogs();
}
function renderLogs() {
  const list = $('log-list');
  list.replaceChildren();
  for (const entry of LOGS) {
    const row = el('div', `log-entry ${entry.type}`);
    row.append(el('time', '', entry.time), el('span', '', { success: '成功', info: '信息', warn: '注意', error: '错误' }[entry.type] || '信息'), el('p', '', entry.text));
    list.append(row);
  }
  $('digest-log').textContent = `${LOGS[0].time} · ${LOGS[0].text}`;
}
renderLogs();
renderTasks();

/* --------------------------------------------------------------------------
   仓库：活跃度热力图 + 随机漫步
--------------------------------------------------------------------------- */
function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}
function renderActivity() {
  const rand = seededRandom(20260821);
  const grid = $('activity-grid');
  grid.replaceChildren();
  const recordDates = new Set(CATALOG.map((r) => r.date));
  const today = new Date('2026-08-21');
  for (let week = 15; week >= 0; week--) {
    for (let day = 0; day < 7; day++) {
      const date = new Date(today);
      date.setDate(today.getDate() - (week * 7 + day));
      const iso = date.toISOString().slice(0, 10);
      let level = Math.floor(rand() * 3);
      if (recordDates.has(iso)) level = 3 + (rand() > .5 ? 1 : 0);
      if (date > today) level = -1;
      const cell = el('i', 'activity-cell');
      if (level >= 0) cell.dataset.level = String(Math.min(4, level));
      grid.append(cell);
    }
  }
  const months = $('activity-months');
  months.replaceChildren();
  const names = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  let lastMonth = -1;
  for (let week = 15; week >= 0; week--) {
    const date = new Date(today);
    date.setDate(today.getDate() - week * 7);
    if (date.getMonth() !== lastMonth) {
      lastMonth = date.getMonth();
      months.append(el('span', '', names[lastMonth]));
    } else {
      months.append(el('span'));
    }
  }
}
renderActivity();

function renderDiscovery(record) {
  const box = $('discovery');
  box.replaceChildren();
  const card = el('button', 'discovery-card');
  card.type = 'button';
  const label = el('span', 'discovery-label', '随机漫步 · 随机一项库存');
  if (record.cover) {
    const backdrop = el('img', 'discovery-backdrop');
    backdrop.src = record.cover; backdrop.alt = '';
    const foreground = el('img', 'discovery-foreground');
    foreground.src = record.cover; foreground.alt = '';
    card.append(backdrop, foreground);
  }
  const info = el('div', 'discovery-info');
  info.append(el('strong', '', record.title));
  info.append(el('span', '', `${TYPE_LABEL[record.type]} · ${record.files} 个文件 · ${fmtSize(record.size)}`));
  info.append(el('small', '', `入库 ${record.date} · ${record.tags.join(' / ') || '无标签'}`));
  card.append(label, info);
  card.addEventListener('click', () => openDrawer(record));
  box.append(card);
}
function randomDiscovery() {
  renderDiscovery(CATALOG[Math.floor(Math.random() * CATALOG.length)]);
}
$('btn-random').addEventListener('click', randomDiscovery);
randomDiscovery();

/* --------------------------------------------------------------------------
   仓库：筛选 / 排序 / 分页 / 视图
--------------------------------------------------------------------------- */
let viewMode = 'grid';
let page = 1;
const PAGE_SIZE = 12;
const catalogSelection = new Set();
let activeRecordId = null;
let filtered = [...CATALOG];

function populateFilters() {
  const tags = [...new Set(CATALOG.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const tagSelect = $('filter-tag');
  tags.forEach((tag) => tagSelect.append(new Option(tag, tag)));
  const backups = [...new Set(CATALOG.map((r) => r.backup).filter(Boolean))];
  const backupSelect = $('filter-backup');
  backups.forEach((b) => backupSelect.append(new Option(b, b)));
}
populateFilters();

function applyFilters() {
  const query = $('catalog-search').value.trim().toLowerCase();
  const tag = $('filter-tag').value;
  const backup = $('filter-backup').value;
  const rating = $('filter-rating').value;
  filtered = CATALOG.filter((record) => {
    if (query && !`${record.title} ${record.tags.join(' ')} ${record.backup}`.toLowerCase().includes(query)) return false;
    if (tag && !record.tags.includes(tag)) return false;
    if (backup && record.backup !== backup) return false;
    if (rating !== '' && record.rating !== Number(rating)) return false;
    return true;
  });
  const sort = $('catalog-sort').value;
  if (sort === 'inventory_desc') filtered.sort((a, b) => b.date.localeCompare(a.date));
  if (sort === 'inventory_asc') filtered.sort((a, b) => a.date.localeCompare(b.date));
  if (sort === 'name_asc') filtered.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
  if (sort === 'name_desc') filtered.sort((a, b) => b.title.localeCompare(a.title, 'zh-CN'));
  page = 1;
  renderLibrary();
}

['catalog-search', 'filter-tag', 'filter-backup', 'filter-rating', 'catalog-sort'].forEach((id) => {
  $(id).addEventListener('input', applyFilters);
  $(id).addEventListener('change', applyFilters);
});

function visibleRecords() {
  return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

function updatePagination() {
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  $('pagination').hidden = pageCount <= 1;
  $('page-status').textContent = `第 ${page} / ${pageCount} 页 · 共 ${filtered.length} 项`;
  $('page-prev').disabled = page <= 1;
  $('page-next').disabled = page >= pageCount;
}
$('page-prev').addEventListener('click', () => { page--; renderLibrary(); });
$('page-next').addEventListener('click', () => { page++; renderLibrary(); });

function setView(mode) {
  viewMode = mode;
  $('view-grid').classList.toggle('active', mode === 'grid');
  $('view-list').classList.toggle('active', mode === 'list');
  $('algo-compare').style.display = mode === 'grid' ? '' : 'none';
  page = 1;
  renderLibrary();
}
$('view-grid').addEventListener('click', () => setView('grid'));
$('view-list').addEventListener('click', () => setView('list'));

/* --------------------------------------------------------------------------
   网格布局：新版「按容器测量」算法 vs 现行 auto-fill
--------------------------------------------------------------------------- */
const GRID_GAP = 16;
const CARD_MIN = 236;
const CARD_MAX = 312;
const CARD_IDEAL = 272;

function layoutGrid() {
  const grid = $('card-grid');
  if (!grid || viewMode !== 'grid') return;
  const legacy = $('algo-legacy').checked;
  const note = $('gap-note');
  if (legacy) {
    grid.classList.add('legacy');
    grid.style.gridTemplateColumns = '';
    grid.style.justifyContent = '';
    /* 模拟现行算法的实际排布，测量右侧空白 */
    const width = grid.clientWidth;
    if (width > 0) {
      const columns = Math.floor((width + GRID_GAP) / (280 + GRID_GAP));
      const used = columns * 280 + (columns - 1) * GRID_GAP;
      const leftover = Math.max(0, Math.round(width - used));
      if (leftover > 6) {
        note.hidden = false;
        note.style.left = `${used}px`;
        note.dataset.label = `右侧空白 ≈ ${leftover}px`;
      } else {
        note.hidden = true;
      }
    }
    return;
  }
  note.hidden = true;
  grid.classList.remove('legacy');
  const width = grid.clientWidth;
  if (width <= 0) return;
  const nMin = Math.max(1, Math.ceil((width + GRID_GAP) / (CARD_MAX + GRID_GAP)));
  const nMax = Math.max(1, Math.floor((width + GRID_GAP) / (CARD_MIN + GRID_GAP)));
  const idealCols = Math.round((width + GRID_GAP) / (CARD_IDEAL + GRID_GAP));
  const columns = Math.min(Math.max(idealCols, nMin), nMax);
  let cardWidth = (width - (columns - 1) * GRID_GAP) / columns;
  let justify = 'start';
  if (cardWidth > CARD_MAX) { cardWidth = CARD_MAX; justify = 'center'; }
  grid.style.gridTemplateColumns = `repeat(${columns}, ${cardWidth.toFixed(2)}px)`;
  grid.style.justifyContent = justify;
}

$('algo-legacy').addEventListener('change', layoutGrid);
if (window.ResizeObserver) {
  new ResizeObserver(() => layoutGrid()).observe(document.getElementById('grid-wrap'));
}
window.addEventListener('resize', layoutGrid);

/* --------------------------------------------------------------------------
   仓库：卡片 / 文本列表渲染
--------------------------------------------------------------------------- */
function typeIcon(type) {
  if (type === 'video') {
    return '<svg class="ic" viewBox="0 0 16 16"><rect x="1.8" y="3.2" width="9.4" height="9.6" rx="1.6"/><path d="M11.2 6.4 14.4 4.6v6.8l-3.2-1.8z"/></svg>';
  }
  return '<svg class="ic" viewBox="0 0 16 16"><path d="M1.8 4.2c0-.7.6-1.3 1.3-1.3h3l1.4 1.6h5.4c.7 0 1.3.6 1.3 1.3v6.4c0 .7-.6 1.3-1.3 1.3H3.1c-.7 0-1.3-.6-1.3-1.3z"/></svg>';
}

function renderGrid() {
  const grid = $('card-grid');
  grid.replaceChildren();
  for (const record of visibleRecords()) {
    const card = el('article', `card${activeRecordId === record.id ? ' active' : ''}${catalogSelection.has(record.id) ? ' selected' : ''}`);

    const check = el('input', 'card-check');
    check.type = 'checkbox';
    check.checked = catalogSelection.has(record.id);
    check.setAttribute('aria-label', `选择 ${record.title}`);
    check.addEventListener('click', (event) => event.stopPropagation());
    check.addEventListener('change', () => {
      if (check.checked) catalogSelection.add(record.id); else catalogSelection.delete(record.id);
      renderLibrary();
    });

    const open = el('button', 'card-open');
    open.type = 'button';
    const cover = el('div', 'card-cover');
    if (record.cover) {
      const img = el('img');
      img.src = record.cover;
      img.alt = record.title;
      img.loading = 'lazy';
      img.draggable = false;
      cover.append(img);
    } else {
      cover.append(el('span', 'placeholder', record.manual ? '手动库存' : '无预览'));
    }
    const type = el('span', 'type-badge');
    type.innerHTML = typeIcon(record.type);
    type.append(document.createTextNode(TYPE_LABEL[record.type]));
    cover.append(type);
    if (!record.manual) cover.append(el('span', 'file-badge', `${record.files} 个文件`));

    const info = el('div', 'card-info');
    info.append(el('strong', '', record.title));
    const meta = el('div', 'card-meta');
    meta.append(el('span', 'size', record.state === 'uncompressed' ? '未压缩' : fmtSize(record.size)));
    meta.append(el('span', 'date', fmtDate(record.date)));
    info.append(meta, stars(record.rating));
    if (record.tags.length) {
      const tags = el('div', 'card-tags');
      for (const tag of record.tags.slice(0, 3)) {
        tags.append(el('span', record.state === 'uncompressed' && tag === record.tags[0] ? 'warn-tag' : '', tag));
      }
      info.append(tags);
    }
    const chips = el('div', 'card-chips');
    if (record.backup) chips.append(el('span', 'chip-backup', `备份 · ${record.backup}`));
    if (record.duplicate) chips.append(el('span', 'chip-dup', '可能重复'));
    if (record.volumes > 1) chips.append(el('span', 'chip-volume', `${record.volumes} 卷`));
    if (chips.childNodes.length) info.append(chips);

    open.append(cover, info);
    open.addEventListener('click', () => openDrawer(record));
    card.append(check, open);
    grid.append(card);
  }
  requestAnimationFrame(layoutGrid);
}

function renderTextList() {
  const list = $('text-list');
  list.replaceChildren();
  const head = el('div', 'tl-head');
  head.append(
    el('span', '', ''),
    el('span', '', '名称'),
    el('span', 'tl-type', '类型'),
    el('span', 'tl-files num', '文件'),
    el('span', '', '大小 / 状态'),
    el('span', '', '入库时间'),
    el('span', 'tl-rating', '星级'),
  );
  const headCheck = el('input', 'tl-check');
  headCheck.type = 'checkbox';
  headCheck.addEventListener('change', () => {
    if (headCheck.checked) visibleRecords().forEach((r) => catalogSelection.add(r.id));
    else visibleRecords().forEach((r) => catalogSelection.delete(r.id));
    renderLibrary();
  });
  head.firstChild.replaceWith(headCheck);
  list.append(head);

  for (const record of visibleRecords()) {
    const row = el('div', `tl-row${activeRecordId === record.id ? ' active' : ''}${catalogSelection.has(record.id) ? ' selected' : ''}`);
    const check = el('input', 'tl-check');
    check.type = 'checkbox';
    check.checked = catalogSelection.has(record.id);
    check.addEventListener('click', (event) => event.stopPropagation());
    check.addEventListener('change', () => {
      if (check.checked) catalogSelection.add(record.id); else catalogSelection.delete(record.id);
      renderLibrary();
    });

    const title = el('div', 'tl-title');
    title.append(el('strong', '', record.title));
    if (record.tags.length) {
      const tags = el('div', 'tags');
      for (const tag of record.tags.slice(0, 4)) tags.append(el('span', '', tag));
      title.append(tags);
    }

    const state = el('span', `tl-state${record.state === 'uncompressed' ? ' uncompressed' : ''}`,
      record.state === 'uncompressed' ? '未压缩' : `${fmtSize(record.size)}${record.volumes > 1 ? ` · ${record.volumes}卷` : ''}`);

    row.append(
      check,
      title,
      el('span', 'tl-type', TYPE_LABEL[record.type]),
      el('span', 'tl-files tl-cell num muted', record.manual ? '—' : String(record.files)),
      state,
      el('span', 'tl-cell muted', record.date),
      stars(record.rating, 'tl-rating stars'),
    );
    row.addEventListener('click', () => openDrawer(record));
    list.append(row);
  }
}

function renderLibrary() {
  const hasResults = filtered.length > 0;
  $('empty-state').hidden = hasResults;
  $('grid-wrap').hidden = !(hasResults && viewMode === 'grid');
  $('text-list').hidden = !(hasResults && viewMode === 'list');
  if (viewMode === 'grid') renderGrid(); else renderTextList();
  updatePagination();

  $('catalog-selected-count').textContent = String(catalogSelection.size);
  $('bulkbar-batch').hidden = catalogSelection.size === 0;
  $('bulkbar-hint').hidden = catalogSelection.size > 0;
  $('select-all-catalog').checked = hasResults && visibleRecords().every((r) => catalogSelection.has(r.id));
}
$('select-all-catalog').addEventListener('change', (event) => {
  if (event.target.checked) visibleRecords().forEach((r) => catalogSelection.add(r.id));
  else visibleRecords().forEach((r) => catalogSelection.delete(r.id));
  renderLibrary();
});

applyFilters();

/* --------------------------------------------------------------------------
   详情抽屉
--------------------------------------------------------------------------- */
function drawerThumbs(record) {
  const pool = CATALOG.filter((r) => r.cover).map((r) => r.cover);
  const base = record.cover ? [record.cover, ...pool.filter((p) => p !== record.cover)] : pool;
  return base.slice(0, 5);
}

function openDrawer(record) {
  activeRecordId = record.id;
  const body = $('drawer-body');
  body.replaceChildren();

  const cover = el('div', 'drawer-cover');
  if (record.type === 'video') {
    const video = el('video');
    video.src = 'assets/preview.mp4';
    video.controls = true;
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    cover.append(video, el('span', 'video-flag', '视频 · 内嵌预览（演示片段）'));
  } else if (record.cover) {
    const img = el('img');
    img.src = record.cover;
    img.alt = record.title;
    cover.append(img);
  } else {
    cover.append(el('span', 'placeholder', '无预览'));
  }

  const inner = el('div', 'drawer-body-inner');
  inner.append(el('h3', '', record.title));
  inner.append(el('p', 'drawer-sub',
    record.manual ? '手动库存条目 · 暂无压缩包与文件清单' : `${TYPE_LABEL[record.type]} · 来自 E:\\媒体库\\待归档\\${record.title}`));

  const ratingRow = el('div', 'drawer-rating');
  ratingRow.append(stars(record.rating));
  const editRating = el('button', '', '评分');
  editRating.addEventListener('click', () => toast('演示：评分与标签编辑保持原有交互'));
  ratingRow.append(editRating);
  inner.append(ratingRow);

  const stats = el('div', 'stat-grid');
  const entries = [
    ['文件数', record.manual ? '—' : `${record.files} 个${record.dirs ? ` · ${record.dirs} 目录` : ''}`],
    ['原始大小', record.manual ? '—' : fmtSize(record.size)],
    ['压缩状态', record.state === 'uncompressed' ? '未压缩' : `已压缩 · 7z 等级 1`],
    ['分卷', record.volumes > 1 ? `${record.volumes} 卷 · 每卷 4 GB` : record.state === 'uncompressed' ? '—' : '单卷'],
    ['入库时间', record.date],
    ['压缩包命名', '20260814-8f3k2m.7z'],
  ];
  for (const [label, value] of entries) {
    const cell = el('div');
    cell.append(el('span', '', label), el('strong', '', value));
    stats.append(cell);
  }
  inner.append(stats);

  const tagSection = el('div', 'drawer-section');
  tagSection.append(el('h4', '', '标签与标记'));
  const chips = el('div', 'drawer-chips');
  for (const tag of record.tags) chips.append(el('span', '', tag));
  if (record.backup) chips.append(el('span', 'backup', `备份 · ${record.backup}`));
  if (record.duplicate) chips.append(el('span', 'dup', '可能重复 · 1 个相似项'));
  if (chips.childNodes.length) tagSection.append(chips);
  else tagSection.append(el('p', 'drawer-sub', '暂无标签'));
  inner.append(tagSection);

  if (!record.manual && record.type !== 'video') {
    const thumbSection = el('div', 'drawer-section');
    thumbSection.append(el('h4', '', `缩略图（${drawerThumbs(record).length} / 上限 30）`));
    const strip = el('div', 'thumb-strip');
    drawerThumbs(record).forEach((src, index) => {
      const thumb = el('div', 'thumb');
      const img = el('img');
      img.src = src;
      img.alt = '';
      img.loading = 'lazy';
      thumb.append(img);
      if (index === 0 && record.cover) thumb.append(el('span', 'cover-flag', '封面'));
      thumb.addEventListener('click', () => toast('演示：点击缩略图放大预览（灯箱）'));
      strip.append(thumb);
    });
    thumbSection.append(strip);
    inner.append(thumbSection);
  }

  const actions = el('div', 'drawer-actions');
  const primary = el('button', 'btn primary', '校验完整性');
  primary.addEventListener('click', () => toast(`演示：正在校验「${record.title}」的压缩包完整性…`));
  const openFolder = el('button', 'btn ghost', '打开压缩包位置');
  openFolder.addEventListener('click', () => toast('演示：在文件资源管理器中显示'));
  const edit = el('button', 'btn ghost', '编辑信息');
  edit.addEventListener('click', () => toast('演示：编辑标签 / 评分 / 备注 / 密码词条'));
  actions.append(primary, openFolder, edit);
  inner.append(actions);

  body.append(cover, inner);

  $('drawer').hidden = false;
  $('drawer-backdrop').hidden = false;
  if (viewMode === 'grid') renderGrid(); else renderTextList();
}

function closeDrawer() {
  $('drawer').hidden = true;
  $('drawer-backdrop').hidden = true;
  activeRecordId = null;
  if (viewMode === 'grid') renderGrid(); else renderTextList();
}
$('drawer-close').addEventListener('click', closeDrawer);
$('drawer-backdrop').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDrawer();
});
