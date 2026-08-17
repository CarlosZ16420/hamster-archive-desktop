# Hamster Archive / 仓鼠归档

一个小而专注的 Windows 本地归档工具：把主目录下的一级文件夹或视频分别压缩、校验并登记到可搜索的仓库中。

## 功能

- 使用随软件附带的便携版 7-Zip 压缩和校验，支持密码与 10 GiB 自动分卷。
- 大任务、疑似重复和体积异常均需人工确认，异常删除不会移动源文件。
- 支持暂停、完成当前项后暂停、定时运行、拖放导入和安全的源文件后处理。
- 使用 SQLite 保存仓库记录，支持模糊搜索、标签、星级、相似项目和批量整理。
- 搜索、精确重复和相似候选索引持久化在 SQLite 中；仓库列表分页，超长目录按可视区域渲染。
- 使用 FFmpeg 获取视频信息并均匀截帧；竖屏画面完整保留，不做裁切。
- 无法读取的文件会被跳过并写入日志；发生跳过时自动保留源项目，避免遗漏数据。
- 多卷压缩包删除先整体进入暂存隔离区，失败时回滚，防止只删掉一部分分卷。
- 全部索引和相似度判断在本机完成，不依赖云服务或大模型。

## 便携数据布局

正式发布包采用真正的便携式布局。`HamsterArchive.exe` 与 `userdata` 位于同一个软件目录；程序不会把当前用户数据写入 Windows 的 AppData。

```text
hamster-archive/
├─ HamsterArchive.exe
├─ tools/
├─ resources/
└─ userdata/
   ├─ config/       # 设置与相似度白名单
   ├─ warehouse/    # SQLite 仓库、目录记录和缩略图
   ├─ logs/         # 单一运行日志
   ├─ processed/    # 未另行设置时，已备份原文件的默认去向
   └─ electron/     # 界面运行缓存
```

待备份主目录和压缩成品存放点由用户选择，不是项目自带目录。备份或迁移软件时，请在程序完全退出后复制整个软件文件夹，至少完整保留 `userdata`。

压缩暂存区会自动放在“打包后文件存放点”旁边，例如成品目录为 `C:\ABC`，暂存目录就是 `C:\ABC-staging`。这样可避免压缩完成后发生不必要的跨盘复制。

> 仓库可以记录归档密码。`userdata` 属于敏感资料，不应提交到 Git、网盘公开目录或发送给他人。

## 使用发布包

从 GitHub Releases 下载 Windows x64 压缩包，完整解压后运行 `HamsterArchive.exe`。不要只复制 EXE；运行库、工具和 `userdata` 目录都需要保持相对位置。

首次运行会在软件目录内补齐所需的 `userdata` 子目录，不需要用户手动创建。

## 从源码运行

需要 Windows、Node.js 22 或更高版本和 npm。

```powershell
npm install
npm run check
npm test
npm start
```

源代码仓库不包含体积较大的 FFmpeg 二进制。构建正式发布包前，请将 `ffmpeg.exe` 放入 `tools/ffmpeg/`；视频信息读取与截帧共用这一个程序，不再分发 FFprobe。便携版 7-Zip 位于 `tools/7zip/`。

```powershell
npm run publish:check
npm run build:release
```

## 数据迁移

从旧版根目录结构升级时，可在软件完全退出后运行：

```powershell
npm run migrate:portable
```

脚本把旧的 `saves`、默认 `processed` 和旧设置迁入本目录的 `userdata`，把旧暂存区迁到成品目录旁，并更新数据库中的内部路径。用户自行选择的待备份目录与成品目录不会被移动。

## 参与开发

提交前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，并运行 `npm run publish:check`。漏洞请按 [SECURITY.md](SECURITY.md) 中的方式报告。

## 许可证

项目源码使用 [MIT License](LICENSE)。发布包附带的 7-Zip 与 FFmpeg 是独立的第三方程序，分别遵循其随附许可；相关文本位于 `tools/7zip/` 和 `tools/ffmpeg/`。
