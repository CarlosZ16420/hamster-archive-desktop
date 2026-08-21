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
