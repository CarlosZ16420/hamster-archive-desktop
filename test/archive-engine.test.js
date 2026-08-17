'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { LARGE_TASK_BYTES } = require('../src/core/constants');
const { buildCompressArgs, buildVerifyArgs } = require('../src/core/archive-engine');

function makeJob(totalBytes) {
  return {
    sourcePath: 'E:\\input\\示例目录',
    totalBytes
  };
}

test('small task has no password by default and is not split', () => {
  const args = buildCompressArgs(makeJob(LARGE_TASK_BYTES), 'E:\\stage\\test.7z');
  assert.equal(args.includes('-mhe=on'), false);
  assert.equal(args.some((arg) => arg.startsWith('-p')), false);
  assert.equal(args.includes('-v10g'), false);
  assert.equal(args.at(-1), '示例目录');
});

test('task larger than 10 GiB uses 10 GiB volumes', () => {
  const args = buildCompressArgs(makeJob(LARGE_TASK_BYTES + 1), 'E:\\stage\\test.7z');
  assert.ok(args.includes('-v10g'));
});

test('verification has no password argument by default', () => {
  const archivePath = path.join('E:\\stage', 'arc_20260814T151230Z_a1b2c3d4.7z.001');
  const args = buildVerifyArgs(archivePath);
  assert.equal(args[0], 't');
  assert.equal(args[1], archivePath);
  assert.equal(args.some((arg) => arg.startsWith('-p')), false);
});

test('custom password is used for compression and verification', () => {
  const job = { totalBytes: 1, sourcePath: 'E:\\source\\folder' };
  const compressArgs = buildCompressArgs(job, 'E:\\stage\\archive.7z', '新密码');
  assert.ok(compressArgs.includes('-mhe=on'));
  assert.ok(compressArgs.includes('-p新密码'));
  assert.ok(buildVerifyArgs('E:\\stage\\archive.7z', '新密码').includes('-p新密码'));
});

test('zip format uses selected compression level without 7z header encryption', () => {
  const args = buildCompressArgs({
    totalBytes: 1,
    sourcePath: 'E:\\source\\folder',
    archiveFormat: 'zip',
    compressionLevel: 7
  }, 'E:\\stage\\archive.zip', 'zip-pass');
  assert.ok(args.includes('-tzip'));
  assert.ok(args.includes('-mx=7'));
  assert.ok(args.includes('-pzip-pass'));
  assert.equal(args.includes('-mhe=on'), false);
});
