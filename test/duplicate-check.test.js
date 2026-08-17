'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { findExactFileMatches, findSimilarProjects, findTaskNameMatches, fuzzyTextScore, normalizeName, titleSimilarity } = require('../src/core/duplicate-check');

test('name normalization supports simple suspected duplicate checks', () => {
  assert.equal(normalizeName('示例 目录_01.mp4'), normalizeName('示例-目录 01.MP4'));
  const matches = findTaskNameMatches({ displayName: '示例 目录_01.mp4' }, [{
    id: 'archive-1',
    displayName: '示例-目录 01.MP4',
    archiveBaseName: 'archive.7z'
  }]);
  assert.equal(matches.length, 1);
});

test('exact duplicate check uses file size and MD5 together', () => {
  const matches = findExactFileMatches([{
    relativePath: 'new/video.mp4', size: 99, md5: 'abc'
  }], [{
    id: 'archive-1',
    displayName: 'old',
    archiveBaseName: 'old.7z',
    manifest: [
      { relativePath: 'old/video.mp4', size: 99, md5: 'abc' },
      { relativePath: 'other.mp4', size: 100, md5: 'abc' }
    ]
  }]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].previous[0].relativePath, 'old/video.mp4');
});

test('local title similarity detects reordered Chinese meaning but ignores generic titles', () => {
  assert.ok(titleSimilarity('王佳乐在北京上学', '北京王佳乐的学习生活') >= 0.45);
  assert.equal(titleSimilarity('新建文件夹', '新建文件夹'), 0);
  assert.equal(titleSimilarity('a.mp4', 'a.mp4'), 0);
  assert.equal(findTaskNameMatches({ displayName: '视频' }, [{ id: 'old', displayName: '视频' }]).length, 0);
});

test('fuzzy title matching supports separated terms and exact video-size evidence', () => {
  assert.ok(fuzzyTextScore('美女台湾', '美女旅行到台湾') >= 0.45);
  const matches = findSimilarProjects({
    id: 'new', title: '新项目', sourceType: 'directory',
    manifest: [{ name: '片段A.mp4', extension: '.mp4', size: 1234 }]
  }, [{
    id: 'old', title: '旧项目', sourceType: 'directory',
    manifest: [{ name: '完全不同.mp4', extension: '.mp4', size: 1234 }]
  }]);
  assert.equal(matches.length, 1);
  assert.ok(matches[0].reasons.includes('视频大小完全一致'));
});

test('similarity ignore terms remove common maker-name noise without changing exact evidence', () => {
  assert.ok(titleSimilarity('PRESTIGE 东京', 'PRESTIGE 大阪') >= 0.45);
  assert.equal(titleSimilarity('PRESTIGE 东京', 'PRESTIGE 大阪', ['PRESTIGE']), 0);
  const matches = findSimilarProjects({
    id: 'new', title: 'FC2 PPV 东京', sourceType: 'video', totalBytes: 456
  }, [{
    id: 'old', title: 'FC2 PPV 大阪', sourceType: 'video', totalBytes: 456
  }], ['FC2', 'PPV']);
  assert.equal(matches.length, 1);
  assert.ok(matches[0].reasons.includes('视频大小完全一致'));
});
