'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { sourceDispositionPresentation } = require('../src/renderer/ui-state');

test('source disposition chip has exact text and color state for every selection', () => {
  assert.deepEqual(sourceDispositionPresentation(true, false), {
    state: 'trash', label: '归档后移入回收站'
  });
  assert.deepEqual(sourceDispositionPresentation(false, true), {
    state: 'move', label: '归档后移动原文件'
  });
  assert.deepEqual(sourceDispositionPresentation(false, false), {
    state: 'keep', label: '归档后不移动原文件'
  });
  assert.deepEqual(sourceDispositionPresentation(true, true), {
    state: 'trash', label: '归档后移入回收站'
  });
});

test('source disposition chip uses danger colors only for the trash state', () => {
  const styles = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf8');
  assert.match(styles, /\.safety-chip\.trash-enabled\s*\{[^}]*color:\s*var\(--danger-fg\)[^}]*background:\s*var\(--danger-bg\)/s);
  assert.match(styles, /\.safety-chip\s*\{[^}]*color:\s*var\(--ok-fg\)[^}]*background:\s*var\(--ok-bg\)/s);
});

test('queue scan actions stay grouped and right-aligned', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf8');
  const actionGroup = html.match(/<div class="button-row queue-actions">([\s\S]*?)<span class="queue-action-break"/);

  assert.ok(actionGroup, 'queue scan action group should exist');
  assert.match(actionGroup[1], /id="add-folder"[\s\S]*id="add-video"[\s\S]*id="scan-source"/);
  assert.match(styles, /\.queue-title \.queue-actions\s*\{[^}]*justify-content:\s*flex-end;/s);
});

test('maintenance paths are selectable and usage guide is the final footer action', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');

  assert.match(html, /id="select-user-data"[^>]*>选择<\/button>/);
  assert.match(html, /id="archive-staging-directory"[^>]*><button data-pick="archive-staging-directory"/);
  assert.match(html, /欢迎反馈<\/button>[\s\S]*id="open-usage-guide"[^>]*>使用说明<\/button>[\s\S]*<\/footer>/);
});

test('run history keeps log messages in the list instead of duplicating the latest message in the header', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');

  assert.doesNotMatch(html, /id="digest-log"/);
  assert.doesNotMatch(app, /digest\.textContent\s*=\s*`\$\{latestTime\}/);
  assert.match(app, /for \(const entry of \[\.\.\.logs\]\.reverse\(\)\)/);
});
