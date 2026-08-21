'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const i18n = require('../src/renderer/i18n');

test('interface translations switch without translating user content', () => {
  i18n.setLocale('en-US');
  assert.equal(i18n.translate('开始压缩入库'), 'Start archiving');
  assert.equal(i18n.translate('切换到 English'), 'Switch to English');
  assert.equal(i18n.translate('已完成'), 'Completed');
  assert.equal(i18n.translate('设置已保存'), 'Settings saved');
  assert.equal(i18n.translate('不压缩直接入库'), 'Add without compression');
  assert.equal(i18n.translate('压缩包：未生成（未压缩）'), 'Archive: not created (uncompressed)');
  assert.equal(i18n.translate('3 个项目入库失败，原文件已移动；2 个已加入队列'), '3 items failed because the source moved; 2 were queued');
  assert.equal(i18n.translate('已删除 3 项'), 'Deleted 3 items');
  assert.equal(i18n.translateStage('正在加密压缩并生成 10 GiB 分卷'), 'Encrypting and compressing and creating 10 GiB volumes');
  assert.equal(i18n.translateStage('发现 2 个相似项目 · 等待手动确认'), '发现 2 个相似项目 · Awaiting manual confirmation');
  assert.equal(i18n.translateStage('库内项目压缩 · 等待压缩'), 'Warehouse item compression · Queued for compression');
  assert.equal(i18n.translate('已完成 3/8 项 · 预计还需 45 分钟'), 'Completed 3/8 items · estimated time remaining: 45 minutes');
  assert.equal(i18n.translate('用户自己的项目标题'), '用户自己的项目标题');

  i18n.setLocale('zh-CN');
  assert.equal(i18n.translate('开始压缩入库'), '开始压缩入库');
  assert.equal(i18n.translate('设置已保存'), '设置已保存');
});
