# 私有开发仓库与公开发行仓库维护规则

本项目采用“一个私有主仓库 + 一个公开快照仓库”，不维护两套源码。

## 仓库职责

- 私有仓库 `hamster-archive` 是唯一开发源，保留完整开发历史、内部文档和本机辅助脚本。
- 公开仓库 `hamster-archive-desktop` 只接收经过检查的源码快照、公开版更新日志和 Release。
- 不在公开仓库直接开发，也不把公开仓库的提交合并回私有仓库。
- 用户运行数据、密码、日志、仓库数据库、缩略图、压缩包和私人媒体永远不进入任一源码提交。

## 公开内容边界

公开快照由私有仓库已提交的 `HEAD` 通过 `git archive` 生成，并遵守 `.gitattributes` 的 `export-ignore`。同步脚本还会在临时导出目录执行第二次黑名单检查。

以下内容不得进入公开仓库：

- `Developer/`、`dev-notes/`、`test-data/`、`AGENTS.md`；
- `scripts/sync-public-snapshot.js`（仅用于维护者的私有发布流程）；
- `ReadmeGlmversion.md`；
- `userdata/`、日志、SQLite 数据库、压缩包、密码和本机绝对路径；
- 内部完整版 `CHANGELOG.md`。公开仓库会使用 `CHANGELOG.public.md` 生成简洁的 `CHANGELOG.md`。

## 每次发布的固定流程

1. 只在私有仓库修改代码，更新 `package.json` 与 `CHANGELOG.public.md`。
2. 运行 `npm run check`、`npm test`、`npm run publish:check`，并手动检查待提交文件。
3. 提交并推送私有仓库。
4. 确认公开快照仓库工作区干净，然后运行 `npm run snapshot:public -- --push`。
5. 在公开仓库检查快照、创建与版本一致的 `vX.Y.Z` 标签和 GitHub Release，并上传正式构建包。

脚本默认使用 `Developer/hamster-archive-public-release` 作为独立公开仓库。若公开仓库放在其他位置，可通过 `PUBLIC_SNAPSHOT_DIR` 指定。脚本拒绝覆盖存在未提交修改的公开仓库，也拒绝把磁盘根目录或私有仓库作为目标。

## 版本与紧急修复

- 正常功能按语义化版本管理：不兼容改动升主版本，新增兼容功能升次版本，修复升补丁版本。
- 公开 Release 的标签、`package.json` 版本、发布包文件名必须一致。
- 紧急修复仍先进入私有仓库，再生成新的公开快照；不要在公开仓库手改后“补回”私有仓库。

## 发布前人工核对

- `git status` 中没有用户数据或来源不明的大文件。
- 公开快照中没有内部开发日志、个人说明、密码和绝对路径。
- 新安装可以自行创建 `userdata`；压缩暂存区位于成品目录旁。
- 便携版整体移动后，7-Zip、FFmpeg 与 `userdata` 内部路径仍能解析。
- GitHub Release 下载包能够在一台没有开发环境的 Windows 电脑上启动。
