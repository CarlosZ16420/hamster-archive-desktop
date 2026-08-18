'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const APPLY_UPDATE_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$appRoot = [IO.Path]::GetFullPath([string]$env:HAMSTER_UPDATE_APP_ROOT)
$stageRoot = [IO.Path]::GetFullPath([string]$env:HAMSTER_UPDATE_STAGE_ROOT)
$runRoot = [IO.Path]::GetFullPath([string]$env:HAMSTER_UPDATE_RUN_ROOT)
$validationFile = [IO.Path]::GetFullPath([string]$env:HAMSTER_UPDATE_VALIDATION_FILE)
$targetPid = [int]$env:HAMSTER_UPDATE_TARGET_PID
$version = [string]$env:HAMSTER_UPDATE_VERSION
$logFile = Join-Path $runRoot 'update.log'

function Write-UpdateLog([string]$Message) {
  $stamp = (Get-Date).ToString('s')
  Add-Content -LiteralPath $logFile -Value "$stamp $Message" -Encoding UTF8
}

try {
  Write-UpdateLog "等待主程序退出：PID $targetPid"
  $deadline = (Get-Date).AddSeconds(90)
  while ($null -ne (Get-Process -Id $targetPid -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 250
  }
  if ($null -ne (Get-Process -Id $targetPid -ErrorAction SilentlyContinue)) { throw '主程序在 90 秒内没有退出。' }

  $backupRoot = Join-Path $runRoot 'rollback'
  New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
  $stageItems = @(Get-ChildItem -LiteralPath $stageRoot -Force | Where-Object { $_.Name -ne 'userdata' })
  foreach ($item in $stageItems) {
    $existing = Join-Path $appRoot $item.Name
    if (Test-Path -LiteralPath $existing) {
      Copy-Item -LiteralPath $existing -Destination (Join-Path $backupRoot $item.Name) -Recurse -Force
    }
  }
  Write-UpdateLog "已创建程序文件回滚副本。"

  foreach ($item in $stageItems) {
    Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $appRoot $item.Name) -Recurse -Force
  }
  Write-UpdateLog "已写入版本 $version 的程序文件，启动验证进程。"

  $newExe = Join-Path $appRoot 'HamsterArchive.exe'
  if (-not (Test-Path -LiteralPath $newExe)) { throw '更新包中缺少 HamsterArchive.exe。' }
  $child = Start-Process -FilePath $newExe -WorkingDirectory $appRoot -PassThru
  $validationDeadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $validationDeadline) {
    if (Test-Path -LiteralPath $validationFile) { break }
    if ($child.HasExited) { break }
    Start-Sleep -Milliseconds 250
  }
  if (-not (Test-Path -LiteralPath $validationFile)) {
    if (-not $child.HasExited) { Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue }
    throw '新版本未在 45 秒内完成启动验证。'
  }

  Set-Content -LiteralPath (Join-Path $runRoot 'completed.json') -Value (@{ version = $version; completedAt = (Get-Date).ToString('o') } | ConvertTo-Json) -Encoding UTF8
  Write-UpdateLog '更新验证成功。'
  $cleanup = "Start-Sleep -Seconds 3; Remove-Item -LiteralPath '$($runRoot.Replace("'", "''"))' -Recurse -Force -ErrorAction SilentlyContinue"
  Start-Process powershell.exe -ArgumentList '-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',$cleanup -WindowStyle Hidden
}
catch {
  Write-UpdateLog "更新失败：$($_.Exception.Message)"
  $backupRoot = Join-Path $runRoot 'rollback'
  if (Test-Path -LiteralPath $backupRoot) {
    $stageItems = @(Get-ChildItem -LiteralPath $stageRoot -Force | Where-Object { $_.Name -ne 'userdata' })
    foreach ($item in $stageItems) {
      Remove-Item -LiteralPath (Join-Path $appRoot $item.Name) -Recurse -Force -ErrorAction SilentlyContinue
    }
    foreach ($item in Get-ChildItem -LiteralPath $backupRoot -Force) {
      Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $appRoot $item.Name) -Recurse -Force
    }
    Write-UpdateLog '已恢复旧版本程序文件。'
    $oldExe = Join-Path $appRoot 'HamsterArchive.exe'
    if (Test-Path -LiteralPath $oldExe) { Start-Process -FilePath $oldExe -WorkingDirectory $appRoot }
  }
  Set-Content -LiteralPath (Join-Path $runRoot 'failed.json') -Value (@{ version = $version; error = $_.Exception.Message; failedAt = (Get-Date).ToString('o') } | ConvertTo-Json) -Encoding UTF8
}
`;

function normalizeDigest(value) {
  const match = String(value || '').trim().match(/^(?:sha256:)?([a-f0-9]{64})$/i);
  return match ? match[1].toLowerCase() : '';
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function downloadFile(url, targetPath, fetchImpl, onProgress = () => {}) {
  const parsed = new URL(String(url || ''));
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') {
    throw new Error('更新包地址不是受信任的 GitHub HTTPS 地址。');
  }
  const response = await fetchImpl(parsed.href, {
    headers: { Accept: 'application/octet-stream', 'User-Agent': 'hamster-archive-update-manager' }
  });
  if (!response.ok) throw new Error(`更新包下载失败（HTTP ${response.status}）。`);
  const totalBytes = Number(response.headers.get('content-length')) || 0;
  if (!response.body?.getReader) throw new Error('当前运行环境不支持流式下载更新包。');
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  const handle = await fsp.open(targetPath, 'w');
  let downloadedBytes = 0;
  try {
    const reader = response.body.getReader();
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      await handle.write(result.value);
      downloadedBytes += result.value.byteLength;
      onProgress({ stage: 'downloading', downloadedBytes, totalBytes, percentage: totalBytes
        ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0 });
    }
  } finally {
    await handle.close();
  }
}

async function extractArchive(sevenZipPath, archivePath, destination) {
  await fsp.mkdir(destination, { recursive: true });
  await execFileAsync(sevenZipPath, ['x', archivePath, `-o${destination}`, '-y'], {
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024
  });
}

async function locatePackageRoot(extractRoot) {
  const candidates = [extractRoot];
  for (const entry of await fsp.readdir(extractRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) candidates.push(path.join(extractRoot, entry.name));
  }
  for (const candidate of candidates) {
    if (await exists(path.join(candidate, 'HamsterArchive.exe')) &&
        await exists(path.join(candidate, 'release-manifest.json'))) return candidate;
  }
  throw new Error('更新包目录结构无效，找不到程序文件。');
}

async function exists(targetPath) {
  try { await fsp.access(targetPath); return true; } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function prepareUpdate({ applicationRoot, userDataDirectory, sevenZipPath, currentVersion, release, fetchImpl, onProgress = () => {} }) {
  if (process.platform !== 'win32') throw new Error('自动更新目前仅支持 Windows 便携版。');
  if (!release?.asset?.downloadUrl) throw new Error('这个 Release 没有可用的 Windows 更新包。');
  const expectedDigest = normalizeDigest(release.asset.digest);
  if (!expectedDigest) throw new Error('Release 缺少 SHA256 摘要，已停止更新。');
  const version = String(release.latestVersion || '').replace(/[^0-9A-Za-z.-]/g, '_');
  const runRoot = path.join(path.resolve(userDataDirectory), 'updates', `${version}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`);
  const archivePath = path.join(runRoot, 'package.zip');
  const extractRoot = path.join(runRoot, 'extracted');
  try {
    await fsp.mkdir(runRoot, { recursive: true });
    await downloadFile(release.asset.downloadUrl, archivePath, fetchImpl, onProgress);
    onProgress({ stage: 'verifying', downloadedBytes: release.asset.size || 0, totalBytes: release.asset.size || 0, percentage: 100 });
    const actualDigest = await hashFile(archivePath);
    if (actualDigest !== expectedDigest) throw new Error('更新包 SHA256 校验失败，文件可能已损坏。');
    await extractArchive(sevenZipPath, archivePath, extractRoot);
    const packageRoot = await locatePackageRoot(extractRoot);
    const manifest = JSON.parse(await fsp.readFile(path.join(packageRoot, 'release-manifest.json'), 'utf8'));
    if (String(manifest.version) !== String(release.latestVersion)) throw new Error('更新包版本与 Release 标签不一致。');
    onProgress({ stage: 'prepared', downloadedBytes: release.asset.size || 0, totalBytes: release.asset.size || 0, percentage: 100 });
    return { runRoot, packageRoot, archivePath, version: release.latestVersion, currentVersion, applicationRoot: path.resolve(applicationRoot) };
  } catch (error) {
    await fsp.rm(runRoot, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function launchUpdate({ prepared, targetPid }) {
  const validationFile = path.join(prepared.runRoot, 'validation.json');
  const scriptPath = path.join(prepared.runRoot, 'apply-update.ps1');
  await fsp.writeFile(scriptPath, APPLY_UPDATE_SCRIPT, 'utf8');
  const child = spawn('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath
  ], {
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      HAMSTER_UPDATE_APP_ROOT: prepared.applicationRoot,
      HAMSTER_UPDATE_STAGE_ROOT: prepared.packageRoot,
      HAMSTER_UPDATE_RUN_ROOT: prepared.runRoot,
      HAMSTER_UPDATE_VALIDATION_FILE: validationFile,
      HAMSTER_UPDATE_TARGET_PID: String(targetPid),
      HAMSTER_UPDATE_VERSION: String(prepared.version)
    }
  });
  child.unref();
  return { validationFile, runRoot: prepared.runRoot };
}

async function cleanupSuccessfulUpdateRuns(userDataDirectory) {
  const updatesRoot = path.join(path.resolve(userDataDirectory), 'updates');
  let entries;
  try { entries = await fsp.readdir(updatesRoot, { withFileTypes: true }); } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const runRoot = path.join(updatesRoot, entry.name);
    if (await exists(path.join(runRoot, 'completed.json'))) {
      await fsp.rm(runRoot, { recursive: true, force: true });
    }
  }
}

module.exports = {
  normalizeDigest,
  hashFile,
  prepareUpdate,
  launchUpdate,
  cleanupSuccessfulUpdateRuns
};
