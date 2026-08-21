'use strict';

// Application translations are deliberately kept outside the renderer logic. User data
// (titles, tags, paths and notes) is never translated; only known interface phrases are.
const exact = {
  '仓鼠症大结局': 'Hamster Archiver',
  'Hamster Archive': 'Hamster Archiver',
  '把混乱的文件，变成可视化仓库和规整压缩包，再交给云盘。': 'Turn messy files into a searchable vault and tidy archives, then hand them to your cloud drive.',
  '完成后保留原文件': 'Keep source files after completion',
  '归档完成后移入回收站': 'Move source to Recycle Bin after archiving',
  '归档后保留原文件': 'Keep original files after archiving',
  '归档后不移动原文件': 'Do not move original files after archiving',
  '归档后移动原文件': 'Move original files after archiving',
  '归档后将原文件移至回收站': 'Move original files to Recycle Bin after archiving',
  '归档后移入回收站': 'Move to Recycle Bin after archiving',
  '归档完成后移到指定位置': 'Move source to the selected location after archiving',
  '主题': 'Theme',
  '语言': 'Language',
  '切换到 English': 'Switch to English',
  '切换到中文': 'Switch to Chinese',
  '简体中文': 'Simplified Chinese',
  '选择界面语言': 'Choose interface language',
  '经典': 'Classic',
  '白昼': 'Daylight',
  '黑夜': 'Night',
  '选择界面主题': 'Choose interface theme',
  '页面导航': 'Page navigation',
  '归档工作台': 'Workbench',
  '仓库': 'Warehouse',
  '01 · 收存位置': '01 · LOCATIONS',
  '这次从哪里收，存到哪里': 'Choose what to collect and where to store it',
  '归档后处理': 'After archiving',
  '高级压缩设置': 'Advanced compression',
  '入库与预览': 'Catalog & previews',
  '更多设置': 'More settings',
  '03 · 运行记录': '03 · ACTIVITY LOG',
  '重复项处理': 'Duplicate handling',
  '清理队列': 'Clean queue',
  '点击任务行的复选框可进行批量操作': 'Select task checkboxes to use batch actions',
  '选中内容后出现批量操作': 'Batch actions appear after selecting items',
  '数据与维护工具': 'Data & maintenance tools',
  '定时运行关闭': 'Scheduled run off',
  '完成后移动原文件': 'Move source after completion',
  '完成后移入回收站': 'Move source to Recycle Bin after completion',
  '保留原文件': 'Keep source files',
  '不记录备份位置': 'Do not record backup location',
  '时间戳命名': 'Timestamp naming',
  '原文件名命名': 'Original-name naming',
  '自定义命名': 'Custom naming',
  '已设置密码': 'Password set',
  '无密码': 'No password',
  '不抽取视频帧': 'Do not extract video frames',
  '不过滤小项目': 'Do not filter small items',
  '名称': 'Name',
  '类型': 'Type',
  '文件': 'Files',
  '大小 / 状态': 'Size / status',
  '入库时间': 'Added',
  '手动': 'Manual',
  '视频': 'Video',
  '文件夹': 'Folder',
  '01 / 归档位置': '01 / LOCATIONS',
  '先确认这次从哪里收、存到哪里': 'Choose what to collect and where to store it',
  '使用说明': 'Instructions',
  '检查更新': 'Check for updates',
  '自动更新未能启动，程序仍停留在当前版本': 'Automatic update could not start. The current version is still running.',
  '保存设置': 'Save settings',
  '需要备份的文件主目录': 'Source directory to back up',
  '最终压缩包存放点': 'Archive output directory',
  '选择': 'Choose',
  '归档完成后，把对应文件夹或视频移入指定位置': 'Move each archived folder or video to the selected location',
  '只在压缩、完整性验证与入库全部成功后移动；目标重名或移动校验失败时会保留源文件': 'Move only after compression, verification and cataloging succeed; collisions or failed checks keep the source.',
  '将已备份文件移动到': 'Move backed-up files to',
  '记录备份位置': 'Record backup location',
  '填写云盘、移动硬盘或其他备份去向': 'Enter a cloud drive, removable disk or other backup destination',
  '备份位置词条': 'Backup location entry',
  '归档完成后，把对应原文件夹或视频移入 Windows 回收站': 'Move each archived source folder or video to the Windows Recycle Bin',
  '仅在压缩、完整性验证、入库记录和缩略图全部完成后执行；可从回收站恢复': 'Only after compression, verification, cataloging and thumbnails finish; recoverable from the Recycle Bin.',
  '仅在压缩、完整性验证、入库记录和缩略图全部完成后执行；可从回收站恢复，异常时会安全停止': 'Only after compression, verification, cataloging and thumbnails finish; recoverable from the Recycle Bin, with a safety stop on anomalies.',
  '分卷压缩': 'Split into volumes',
  '超过单卷上限时自动拆分；默认 10 GiB，与旧版行为一致。': 'Split automatically above the per-volume limit; the 10 GiB default matches previous behavior.',
  '单卷大小': 'Volume size',
  '分卷大小单位': 'Volume size unit',
  '不主动分卷': 'No optional splitting',
  '已关闭主动分卷；超过 10 GiB 时仍执行安全分卷。': 'Optional splitting is off; tasks over 10 GiB still use safety volumes.',
  '安全上限保持为 10 GiB：即使关闭主动分卷，超过 10 GiB 的任务仍须确认并按 10 GiB 分卷。分卷发布、校验、删除与回滚始终按整组处理。': 'The 10 GiB safety limit remains: even with optional splitting off, larger tasks require confirmation and 10 GiB volumes. Publishing, verification, deletion and rollback always handle the complete volume set.',
  '高级设置': 'Advanced settings',
  '用户数据区': 'User data area',
  '打开': 'Open',
  '集中保存设置、仓库数据库、缩略图、暂存文件和当前用户的一份运行日志': 'Stores settings, the warehouse database, thumbnails, staging files and the current user log',
  '集中保存设置、仓库数据库、缩略图、已处理文件和当前用户的一份运行日志；切换时保留旧目录': 'Stores settings, the warehouse database, thumbnails, processed files and the current user log; the old directory is retained when switching',
  '压缩暂存目录': 'Archive staging directory',
  '默认在打包存放点同目录下新建一个 staging 文件夹，目录不存在时自动创建': 'A staging folder is created beside the output directory when needed',
  '默认在打包存放点同目录下新建 staging 文件夹，也可选择其他安全位置': 'Creates a staging folder beside the output directory by default; another safe location can be selected',
  '解压密码': 'Archive password',
  '留空则不设置密码': 'Leave empty for no password',
  '显示': 'Show',
  '隐藏': 'Hide',
  '记录解压密码': 'Record archive password',
  '把任务实际使用的密码作为专属词条写入仓库；不勾选时只记录“已加密”。': 'Store the password used by each task as a private warehouse entry; otherwise only record “encrypted”.',
  '视频帧备份': 'Video frame backup',
  '按总时长平均抽取画面，并在仓库中按视频成组显示': 'Extract evenly spaced frames and group them by video in the warehouse',
  '帧/视频': 'frames/video',
  '小项目过滤': 'Small-item filter',
  '扫描和拖入时跳过低于阈值的视频或文件夹': 'Skip videos and folders below the threshold while scanning or dropping',
  '最小项目大小': 'Minimum item size',
  '相似度排除词表': 'Similarity ignore list',
  '也就是相似判断的“白名单”。每行一个词；不影响仓库搜索、MD5 或文件大小重复检查。': 'A whitelist for similarity checks. One term per line; it does not affect search, MD5 or size checks.',
  '打开词表': 'Open list',
  '重新载入': 'Reload',
  '单个项目缩略图上限': 'Per-project thumbnail limit',
  '包括图片缩略图与视频抽帧，避免超大项目生成过多预览。': 'Includes image thumbnails and video frames to prevent excessive previews.',
  '张': 'images',
  '压缩格式': 'Archive format',
  '7z（默认）': '7z (default)',
  'ZIP': 'ZIP',
  '格式': 'format',
  '压缩率': 'Compression level',
  '0 · 不压缩': '0 · Store only',
  '1 · 快速（默认）': '1 · Fast (default)',
  '3 · 标准': '3 · Standard',
  '5 · 较高': '5 · Higher',
  '7 · 高': '7 · High',
  '9 · 极限': '9 · Maximum',
  '等级': 'level',
  '压缩包命名方式': 'Archive naming',
  '时间戳 + 随机数（默认）': 'Timestamp + random suffix (default)',
  '原文件名 + 8 位随机数（过长时截断）': 'Original name + 8-digit random suffix (truncate if needed)',
  '自定义名 + 8 位随机数': 'Custom name + 8-digit random suffix',
  '填写符合 Windows 文件命名规范的自定义名': 'Enter a Windows-compatible custom name',
  '02 / 扫描与队列': '02 / SCAN & QUEUE',
  '先预览，再开始归档': 'Preview first, then archive',
  '添加单个文件夹': 'Add folder',
  '添加单个视频': 'Add video',
  '扫描主目录': 'Scan source directory',
  '开始压缩入库': 'Start archiving',
  '不压缩直接入库': 'Add without compression',
  '未压缩入库': 'Uncompressed intake',
  '库内项目压缩': 'Compress warehouse item',
  '确认不压缩直接入库': 'Confirm uncompressed intake',
  '本次入库将不会执行压缩，可能导致用户备份时出现遗漏，请确认风险。': 'This intake will not create an archive and may be missed during backup. Please acknowledge the risk.',
  '不再提示': 'Do not show again',
  '确认并直接入库': 'Confirm and add',
  '把未压缩项目送入队列': 'Queue uncompressed items',
  '本功能仅用于给库内“未压缩项目”压缩备份使用。': 'This feature is only for compressing warehouse items marked as uncompressed.',
  '确认并送入队列': 'Confirm and queue',
  '压缩入库': 'Compress and archive',
  '未压缩': 'Uncompressed',
  '压缩包：未生成（未压缩）': 'Archive: not created (uncompressed)',
  '压缩后 未压缩': 'After compression: uncompressed',
  '完成这一项暂停': 'Finish this item, then pause',
  '暂停': 'Pause',
  '暂停当前任务': 'Pause current task',
  '继续当前任务': 'Resume current task',
  '拖拽或粘贴文件夹、视频，快速加入队列': 'Drop or paste a folder or video to add it to the queue',
  '任务': 'Tasks',
  '等待确认': 'Awaiting confirmation',
  '等待压缩': 'Queued',
  '已完成': 'Completed',
  '原始总量': 'Original size',
  '折叠任务列表': 'Collapse task list',
  '展开任务列表': 'Expand task list',
  '未选择任务': 'No tasks selected',
  '移除所选': 'Remove selected',
  '清除可能重复': 'Clear possible duplicates',
  '清除精确重复': 'Clear exact duplicates',
  '选择当前页': 'Select current page',
  '定位相似文件': 'Locate similar files',
  '未加密': 'Not encrypted',
  '同意全部重复': 'Confirm all duplicates',
  '清空已完成队列': 'Clear completed tasks',
  '清空已取消队列': 'Clear cancelled tasks',
  '一键清空队列': 'Clear queue',
  '选择全部任务': 'Select all tasks',
  '还没有任务。选择一个实际主目录后开始扫描。': 'No tasks yet. Choose a real source directory and scan it.',
  '03 / 运行记录': '03 / ACTIVITY LOG',
  '发生了什么': 'What happened',
  '空闲': 'Idle',
  '暂无日志': 'No logs yet',
  '仓库活跃度 / ACTIVITY': 'WAREHOUSE ACTIVITY',
  '仓库概览': 'Warehouse overview',
  '本周入库': 'Added this week',
  '导出仓库': 'Export warehouse',
  '并入外部仓库': 'Import external warehouse',
  '随机漫步 · 换一个': 'Random walk · Another',
  '库存': 'Inventory',
  '标签': 'Tags',
  '最近 16 周': 'Last 16 weeks',
  '按入库日期与容量显示活跃度': 'Activity by inventory date and size',
  '少': 'Less',
  '多': 'More',
  '浏览、分类并整理已入库内容': 'Browse, classify and organize archived content',
  '模糊搜索标题、标签、备份位置、路径…': 'Fuzzy-search titles, tags, backup locations and paths…',
  '按标签筛选': 'Filter by tag',
  '全部标签': 'All tags',
  '按备份位置筛选': 'Filter by backup location',
  '全部备份位置': 'All backup locations',
  '按星级筛选': 'Filter by rating',
  '全部星级': 'All ratings',
  '未评分': 'Unrated',
  '仓库排序': 'Warehouse sort',
  '入库时间：新到旧': 'Inventory date: newest first',
  '入库时间：旧到新': 'Inventory date: oldest first',
  '文件名：正序': 'File name: A–Z',
  '文件名：倒序': 'File name: Z–A',
  '仓库视图': 'Warehouse view',
  '列表': 'List',
  '大缩略图': 'Large thumbnails',
  '刷新仓库': 'Refresh warehouse',
  '设置仓库位置': 'Set warehouse location',
  '在文件浏览器中查看仓库': 'Open warehouse in File Explorer',
  '当前仓库位置': 'Current warehouse location',
  '选择当前结果': 'Select current results',
  '未选择仓库内容': 'No warehouse items selected',
  '批量追加标签': 'Add tags in bulk',
  '批量修改备份位置': 'Change backup location in bulk',
  '撤回': 'Undo',
  '删除所选': 'Delete selected',
  '手动新增库存': 'Add inventory manually',
  '上一页': 'Previous',
  '下一页': 'Next',
  '仓库中暂无归档记录': 'No archive records in the warehouse',
  '选择一条仓库记录': 'Select a warehouse record',
  '这里会显示整理信息、完整目录、文件名、MD5、分卷信息和可用缩略图。': 'Organization details, the full tree, file names, MD5 values, volumes and thumbnails appear here.',
  'GitHub 仓库': 'GitHub repository',
  '欢迎反馈': 'Feedback welcome',
  '本地优先的归档工具': 'A local-first archiving tool',
  '关闭': 'Close',
  '取消': 'Cancel',
  '确认': 'Confirm',
  '修改': 'Edit',
  '复制': 'Copy',
  '删除图片': 'Delete image',
  '设为项目封面': 'Set as project cover',
  '媒体预览': 'Media preview',
  '日期未知': 'Date unknown',
  '整理信息': 'Organization details',
  '标题': 'Title',
  '例如：摄影，旅行，待整理（用逗号分隔）': 'e.g. photography, travel, to review (comma-separated)',
  '例如：百度网盘 / 家庭备份盘 A': 'e.g. Baidu Drive / Home backup disk A',
  '星级': 'Rating',
  '清除': 'Clear',
  '备注': 'Notes',
  '记录来源、内容特点、后续处理计划等，支持直接粘贴图片': 'Record the source, content and next steps; images can be pasted directly',
  '相似项目': 'Similar projects',
  '可能重复': 'Possible duplicate',
  '重新计算': 'Recalculate',
  '管理': 'Manage',
  '安全熔断 / SAFETY HALT': 'SAFETY HALT',
  '队列已立即停止': 'Queue stopped immediately',
  '自动移入回收站已经关闭': 'Automatic Recycle Bin moves are disabled',
  '我已了解，保持队列停止': 'I understand; keep the queue stopped',
  'Hamster Archive · 本地优先的归档工具': 'Hamster Archiver · a local-first archiving tool',
  'Hamster Archiver · 本地优先的归档工具': 'Hamster Archiver · a local-first archiving tool',
  '正在从仓库中挑选一项随机内容…': 'Choosing a random warehouse item…',
  '仓库还是空的，添加库存后这里会自动出现推荐。': 'The warehouse is empty. Add inventory to see recommendations here.',
  '仓库中暂时没有可以推荐的内容。': 'There is no warehouse item to recommend yet.',
  '没有找到符合这次回顾条件的库存。': 'No inventory matched this review.',
  '完成本项后暂停': 'Finish this item, then pause',
  '任务名称已复制': 'Task name copied',
  '已打开任务所在位置': 'Task location opened',
  '已打开用户数据区': 'User data area opened',
  '已打开原文件当前位置': 'Original file location opened',
  '设置已保存': 'Settings saved',
  '当前已是最新版本': 'You are using the latest version',
  '正在检查…': 'Checking…',
  '正在校验更新…': 'Verifying update…',
  '正在下载更新…': 'Downloading update…',
  '正在扫描下一级目录，请稍候…': 'Scanning the next directory level, please wait…',
  '正在读取完整目录和缩略图…': 'Reading the complete directory and thumbnails…',
  '生成清单与 MD5': 'Building manifest and MD5',
  '压缩中': 'Compressing',
  '完整性验证': 'Integrity verification',
  '移入库目录': 'Moving to warehouse',
  '归档完成/源文件处理失败': 'Archived / source handling failed',
  '失败': 'Failed',
  '已取消': 'Cancelled',
  '重复待确认': 'Duplicate awaiting confirmation',
  '大小异常待核验': 'Abnormal size awaiting review',
  '回收站安全警告': 'Recycle Bin safety warning',
  '查看相似项目': 'View similar projects',
  '确认并按 10G 分卷': 'Confirm and split at 10 GiB',
  '确认重复风险': 'Confirm duplicate risk',
  '确认重复并继续': 'Confirm duplicate and continue',
  '核验后确认入库': 'Verify and add to warehouse',
  '删除异常成品': 'Delete abnormal output',
  '确认安全警告': 'Acknowledge safety warning',
  '重试': 'Retry',
  '完整目录结构': 'Complete directory tree',
  '无预览': 'No preview',
  '暂无标签': 'No tags',
  '暂无封面': 'No cover',
  '未命名归档': 'Untitled archive',
  '手动库存记录 · 未关联压缩包或文件清单': 'Manual inventory · no archive or manifest attached',
  '手动库存条目': 'Manual inventory item',
  '这是手动库存记录': 'This is a manual inventory record',
  '手动添加图片': 'Add images manually',
  '添加图片': 'Add images',
  '选择项目图片': 'Choose project images',
  '也可以在这里按 Ctrl+V 粘贴图片': 'You can also press Ctrl+V here to paste images',
  '手动库存 / MANUAL': 'MANUAL INVENTORY',
  '新增一条库存内容': 'Add an inventory item',
  '添加到仓库': 'Add to warehouse',
  '备注（必填）': 'Notes (required)',
  '名称（必填）': 'Name (required)',
  '标签（选填，逗号分隔）': 'Tags (optional, comma-separated)',
  '原始位置（选填，可填写网址）': 'Original location (optional, URL allowed)',
  '备份位置（选填）': 'Backup location (optional)',
  '图片（选填，可多选）': 'Images (optional, multiple allowed)',
  '文件路径或 https://…': 'File path or https://…',
  '留空表示无密码': 'Leave empty for no password',
  '压缩包已加密，但密码未记录': 'Archive is encrypted, but its password was not recorded',
  '解压密码已复制': 'Archive password copied',
  '压缩包名称已复制': 'Archive name copied',
  '图片已删除，可在“撤回”中恢复': 'Image deleted; undo to restore it',
  '项目封面已更新': 'Project cover updated',
  '相似关系已重新计算': 'Similarity recalculated',
  '已双向移除相似关系': 'Similarity removed in both directions',
  '当前没有已关联的相似项目。': 'No linked similar projects.',
  '仓库整理信息已保存': 'Warehouse details saved',
  '仓库已刷新': 'Warehouse refreshed',
  '仓库已复制并切换；原位置仍保留': 'Warehouse copied and switched; the original remains',
  '安全停止：等待确认': 'Safety stop: awaiting confirmation',
  '安全警告已确认；队列保持停止，自动移入回收站已关闭': 'Safety warning acknowledged; queue remains stopped and automatic Recycle Bin moves are disabled',
  '未发现原文件': 'Original file not found',
  '原文件位置：': 'Original location: ',
  '源文件已进入回收站': 'Source file moved to Recycle Bin',
  '原文件已复原，并已打开原位置': 'Original file restored and original location opened',
  '打开原文件当前位置': 'Open original file location',
  '从回收站复原到原位置': 'Restore from Recycle Bin to original location',
  '原文件在 Windows 回收站中。要将文件从回收站移出到原位置吗？': 'The original file is in the Windows Recycle Bin. Move it back to its original location?',
  '没有符合当前条件的仓库内容': 'No warehouse content matches the current filters',
  '当前没有已关联的相似项目。': 'No similar projects are linked.',
  '拖放': 'Drop',
  '粘贴': 'Paste',
  '至': 'to',
  '按备份位置筛选': 'Filter by backup location',
  '按标签筛选': 'Filter by tag',
  '按星级筛选': 'Filter by rating',
  '仓库分页': 'Warehouse pagination',
  '仓库排序': 'Warehouse sort',
  '仓库视图': 'Warehouse view',
  '放大的仓库缩略图': 'Enlarged warehouse thumbnail',
  '选择全部任务': 'Select all tasks',
  '定时开始时间': 'Scheduled start time',
  '定时结束时间': 'Scheduled end time',
  '每个视频保存的帧数': 'Frames saved per video',
  '最近十六周入库活跃度': 'Inventory activity over the last sixteen weeks',
  '批量备份文件时，为主目录下的每一个文件夹或视频，单独压缩进行备份，跳过其他文件': 'When backing up in bulk, each folder or video directly under the source directory is archived separately; other files are skipped',
  '推荐勾选，便于识别哪些文件被备份了': 'Recommended so backed-up sources are easy to identify',
  '已加密': 'Encrypted',
  '仅记录': 'Record only',
  '这个归档中没有文件。': 'This archive contains no files.',
  '没有等待确认的重复任务': 'No duplicate tasks are awaiting confirmation',
  '没有发现可清除的重复任务': 'No duplicate tasks to clear',
  '当前任务已暂停': 'Current task paused',
  '队列运行中': 'Queue running',
  '等待定时时段': 'Waiting for scheduled time',
  '安全停止：等待确认': 'Safety stop: awaiting confirmation',
  '不到 1 分钟': 'Less than 1 minute',
  '缩略图读取失败': 'Could not read thumbnail',
  '源文件已移动': 'Source file moved',
  '无 MD5': 'No MD5',
  '无': 'None',
  '未记录': 'Not recorded',
  '未选择任务（按住 Ctrl 可多选）': 'No tasks selected (hold Ctrl to multi-select)',
  '当前项目封面': 'Current project cover',
  '单个项目最多添加 100 张图片。': 'A project can contain at most 100 images.',
  '手动库存': 'Manual inventory',
  '随机漫步': 'Random walk',
  '完成管理': 'Done managing',
  '保存整理信息': 'Save organization details',
  '高度匹配': 'High match',
  '已执行移入回收站，但回收站中未找到该文件——回收站可能已满，文件或已被永久删除': 'The item was sent to the Recycle Bin, but could not be found there; it may be full and the item may have been permanently deleted',
  '启用后，每个任务只有在验证并入库成功后，才会把对应源文件夹或视频移入 Windows 回收站。是否启用？': 'When enabled, each source folder or video is moved to the Windows Recycle Bin only after verification and cataloging succeed. Enable it?',
  '确定删除这张图片？删除后可以通过仓库顶部的“撤回”恢复。': 'Delete this image? You can restore it with Undo at the top of the warehouse.',
  '删除这次异常任务生成的压缩文件和缩略图？源文件会完整保留在原位置，且不会加入仓库。': 'Delete the archives and thumbnails created by this abnormal task? The source will remain intact and will not be added to the warehouse.',
  '从全部库存中为你随机抽取了一项。': 'A random item was selected from the entire inventory.',
  '该原文件在 Windows 回收站中。要将文件从回收站移出到原位置吗？': 'The original file is in the Windows Recycle Bin. Move it back to its original location?',
  '所选仓库内容已删除。': 'The selected warehouse content was deleted.',
  '所选项目没有可以尝试复原的原文件记录。': 'The selected items have no original locations that can be restored.',
  '它只保存名称、备注及整理信息，不代表程序已经生成或验证过压缩包。': 'It stores only the name, notes and organization details; it does not mean that an archive was generated or verified.',
  '没有符合当前条件的仓库内容': 'No warehouse content matches the current filters',
  '相似关系已重新计算': 'Similarity recalculated',
  '项目封面已更新': 'Project cover updated',
  '图片已删除，可在“撤回”中恢复': 'Image deleted; undo to restore it',
  '已撤回最近一次仓库操作': 'The most recent warehouse action was undone',
  '已打开任务所在位置': 'Task location opened',
  '已打开用户数据区': 'User data area opened',
  '已打开原文件当前位置': 'Original file location opened',
  '仓库已复制并切换；原位置仍保留': 'Warehouse copied and switched; the original remains',
  '仓库已刷新': 'Warehouse refreshed',
  '设置已保存': 'Settings saved',
  '当前已是最新版本': 'You are using the latest version',
  '解压密码已复制': 'Archive password copied',
  '安全警告已确认；队列保持停止，自动移入回收站已关闭': 'Safety warning acknowledged; queue remains stopped and automatic Recycle Bin moves are disabled'
  , '完整性测试已经通过，但压缩前后体积比例超出安全阈值。请先人工核对日志和源项目；确认仍要入库吗？': 'Integrity testing passed, but the archive size ratio is outside the safety threshold. Check the log and source first; add it to the warehouse anyway?'
  , '从任务列表清除所有“名称可能重复”或“内容精确重复”的项目？已入库档案和源文件不会删除。': 'Clear all tasks marked as name- or content-duplicates? Archived files and source files will not be deleted.'
  , '同意任务列表中全部名称重复、标题相似或视频大小相同的风险，并让它们进入等待压缩状态？': 'Accept all name-duplicate, title-similar or same-size video risks and move them to the compression queue?'
  , '选择外部仓库压缩包（.zip）后，会把其中的仓库记录、缩略图和解压密码记录一并并入当前仓库。相同 ID 的记录会跳过；外部压缩包实体不会被移动或删除。是否继续？': 'After choosing an external warehouse ZIP, its records, thumbnails and archive passwords will be merged into this warehouse. Duplicate IDs are skipped; the external archive is not moved or deleted. Continue?'
  , '使用说明 / QUICK START': 'QUICK START'
  , '把资源变成可检索的安全归档': 'Turn resources into safe, searchable archives'
  , '选择资源主目录': 'Choose a source directory'
  , '应用会把其中每个大文件夹与视频分别压缩，生成规整的压缩包，并把内容记录到仓库。': 'Each large folder and video is archived separately and recorded in the warehouse.'
  , '手动云备份压缩包': 'Back up archives to your cloud drive'
  , '本工具只负责本地记录，您可以将压缩包存放点设置为云盘自动同步的目录，或自行上传压缩包。': 'This tool keeps local records. Set the output directory to a cloud-synced folder or upload the archives yourself.'
  , '按需处理单个资源': 'Process one resource when needed'
  , '也可以把单个文件夹或视频直接拖入应用，单独加入任务列表。': 'Drop a single folder or video into the app to add it as an individual task.'
  , '本应用会跳过主目录中的零散图片和其他文件。如需处理，请先把它们收纳到文件夹中。': 'Loose images and other files directly under the source directory are skipped. Put them in a folder if they need processing.'
  , '知道了': 'Got it'
  , '适合记录暂时没有压缩包或文件清单的内容。只有名称和备注必填，也可以直接补充位置、标签与图片。': 'For content without an archive or manifest yet. Only the name and notes are required; locations, tags and images are optional.'
  , '批量整理': 'Bulk organization'
  , '追加标签': 'Add tags'
  , '修改备份位置': 'Change backup location'
  , '用逗号分隔。标签须以文字或数字开头，可使用文字、数字、空格、短横线、下划线和间隔号；单个最多 30 字。': 'Separate tags with commas. Tags must start with a letter or number and may contain letters, numbers, spaces, hyphens, underscores and middle dots; each tag may contain up to 30 characters.'
  , '确认删除所选内容': 'Confirm deletion of selected items'
  , '删除仓库项目': 'Delete warehouse items'
  , '尝试将原文件位置复原': 'Try to restore original locations'
  , '仅处理仍在回收站或归档后移动位置中的原文件；复原失败时会保留对应仓库记录和压缩包。': 'Only sources still in the Recycle Bin or post-archive location are handled; failed restoration keeps the warehouse record and archives.'
  , '安全熔断 / SAFETY HALT': 'SAFETY HALT'
  , '后续任务尚未启动。请先检查 Windows 回收站和原文件位置，再决定是否重新开始队列。': 'Later tasks have not started. Check the Windows Recycle Bin and source location before restarting the queue.'
};

const patterns = [
  [/^等级 (\d+)$/, 'Level $1'],
  [/^分卷 ([\d.]+) (GB|MB)$/, '$1 $2 volumes'],
  [/^确认并按 (.+) 分卷$/, 'Confirm and split at $1'],
  [/^视频抽帧 (\d+) 帧\/视频$/, '$1 video frames/video'],
  [/^缩略图上限 (\d+) 张$/, 'Thumbnail limit $1'],
  [/^过滤 <(\d+) MB$/, 'Filter < $1 MB'],
  [/^自定义「(.+)」$/, 'Custom “$1”'],
  [/^已选择 (\d+) 项（按住 Ctrl 可多选）$/, 'Selected $1 items (hold Ctrl to multi-select)'],
  [/^已选择 (\d+) 项$/, 'Selected $1 items'],
  [/^已选 (\d+) 项$/, 'Selected $1 items'],
  [/^(\d+) 个子目录 · 未压缩$/, '$1 subfolders · uncompressed'],
  [/^(\d+) 个子目录 · (.+)$/, '$1 subfolders · $2'],
  [/^入库 (.+)$/, 'Added $1'],
  [/^第 (\d+) \/ (\d+) 页 · 共 (\d+) 项$/, 'Page $1 / $2 · $3 items total'],
  [/^压缩包：/, 'Archive: '],
  [/^压缩后 /, 'After compression '],
  [/^原始大小 /, 'Original size '],
  [/^已完成 (\d+)\/(\d+) 项 · 预计还需 (\d+) 分钟$/, 'Completed $1/$2 items · estimated time remaining: $3 minutes'],
  [/^已完成 (\d+)\/(\d+) 项 · 预计还需 (\d+) 小时(?: (\d+) 分钟)?$/, 'Completed $1/$2 items · estimated time remaining: $3 hours$4'],
  [/^已完成 (\d+)\/(\d+) 项 · 预计还需 (.+)$/, 'Completed $1/$2 items · estimated time remaining: $3'],
  [/^正在统计 (.+)（(\d+)\/(\d+)）…$/, 'Scanning $1 ($2/$3)…'],
  [/^仓库：/, 'Warehouse: '],
  [/^发现新版本 (.+)$/, 'New version available: $1'],
  [/^第 (\d+) \/ (\d+) 页$/, 'Page $1 / $2'],
  [/^(.+) · 尚未到达$/, '$1 · Not reached yet'],
  [/^(.+) · (\d+) 项库存 · (.+) GB$/, '$1 · $2 inventory items · $3 GB'],
  [/^选择 (.+)$/, 'Select $1'],
  [/^打开任务位置 (.+)$/, 'Open task location: $1'],
  [/^复制任务名 (.+)$/, 'Copy task name: $1'],
  [/^选择项目图片$/, 'Choose project images'],
  [/^原文件名：/, 'Original name: '],
  [/^共 (\d+) 项$/, '$1 items total'],
  [/^已添加 (\d+) 张图片$/, 'Added $1 images'],
  [/^已为 (\d+) 项追加标签$/, 'Added tags to $1 items'],
  [/^已修改 (\d+) 项的备份位置$/, 'Updated backup location for $1 items'],
  [/^已删除 (\d+) 项$/, 'Deleted $1 items'],
  [/^已删除 (\d+) 项；(\d+) 项失败：(.+)$/, 'Deleted $1 items; $2 failed: $3'],
  [/^已清除 (\d+) 个已完成任务$/, 'Cleared $1 completed tasks'],
  [/^已清除 (\d+) 个可能重复的任务$/, 'Cleared $1 possible duplicate tasks'],
  [/^已确认 (\d+) 个重复或相似任务$/, 'Confirmed $1 duplicate or similar tasks'],
  [/^已并入 (\d+) 条记录，跳过 (\d+) 条已存在记录$/, 'Imported $1 records; skipped $2 existing records'],
  [/^没有可并入的新记录，已跳过 (\d+) 条$/, 'No new records to import; skipped $1'],
  [/^已打开相似度排除词表（当前 (\d+) 个词）$/, 'Opened similarity ignore list ($1 terms)'],
  [/^已重新载入 (\d+) 个排除词，并更新相似项目关系$/, 'Reloaded $1 ignore terms and updated similar-project relations'],
  [/^手动库存已添加，并保存 (\d+) 张图片$/, 'Manual inventory added with $1 images'],
  [/^已通过(.+)加入 (\d+) 个任务$/, 'Added $2 tasks via $1'],
  [/^没有可加入的文件夹或视频（(.+)）$/, 'No folders or videos to add ($1)'],
  [/^仓库压缩包已导出：(.+)$/, 'Warehouse archive exported: $1'],
  [/^已切换仓库位置$/, 'Warehouse location switched']
  , [/^(\d+) 个项目入库失败，原文件已移动；(\d+) 个已加入队列$/, '$1 items failed because the source moved; $2 were queued']
  , [/^已将 (\d+) 个库内未压缩项目送入队列$/, 'Queued $1 uncompressed warehouse items']
  , [/^所选内容中没有可加入队列的未压缩项目$/, 'No selected uncompressed items can be queued']
  , [/^从任务列表移除所选 (\d+) 项？已入库档案和源文件不会删除。$/, 'Remove the selected $1 tasks? Archived files and source files will not be deleted.']
  , [/^清空整个任务列表？(.+)$/, 'Clear the entire task list? $1']
];

// Queue stages often contain counts or a current filename, so they cannot all
// be represented as exact dictionary keys. Translate only fixed UI wording and
// leave paths, names and counters untouched.
const stageFragments = [
  ['程序上次运行时被中断，可重新扫描或重试。', 'The previous run was interrupted. Scan again or retry.'],
  ['正在生成逐文件清单与 MD5', 'Generating file manifest and MD5'],
  ['正在生成未压缩入库清单与 MD5', 'Generating uncompressed inventory manifest and MD5'],
  ['正在生成 MD5：', 'Generating MD5: '],
  ['正在加密压缩', 'Encrypting and compressing'],
  ['正在压缩', 'Compressing'],
  ['并生成 ', ' and creating '],
  [' 分卷', ' volumes'],
  ['正在复核源文件未发生变化', 'Checking that source files are unchanged'],
  ['正在执行 7-Zip 完整性测试', 'Running the 7-Zip integrity test'],
  ['正在把已验证成品移入归档库', 'Moving verified archives into the library'],
  ['超过 10 GiB', 'Over 10 GiB'],
  ['名称可能重复', 'Name may be duplicated'],
  ['等待手动确认', 'Awaiting manual confirmation'],
  ['等待压缩', 'Queued for compression'],
  ['等待未压缩直接入库', 'Queued for uncompressed intake'],
  ['未压缩直接入库', 'Uncompressed intake'],
  ['库内项目压缩', 'Warehouse item compression'],
  ['已生成完整清单并直接入库（未压缩）', 'Manifest completed and added without compression'],
  ['已确认，等待压缩', 'Confirmed, queued for compression'],
  ['已批量确认重复风险，等待压缩', 'Duplicate risk confirmed in bulk, queued for compression'],
  ['异常成品已移入回收站，源项目保持原位', 'Abnormal archive moved to the Recycle Bin; source kept in place'],
  ['等待核验', 'awaiting review'],
  ['安全停止：原文件未进入回收站，仍在原位置', 'Safety stop: source did not enter the Recycle Bin and remains in place'],
  ['安全停止：回收站未保留原文件，请立即检查', 'Safety stop: the Recycle Bin did not retain the source; check immediately'],
  ['已验证入库；因回收站安全熔断，源项目保留在原位置', 'Verified and cataloged; source kept in place because of the Recycle Bin safety halt'],
  ['已验证入库；因队列正在停止，源项目已保留', 'Verified and cataloged; source kept because the queue is stopping'],
  ['已取消，源文件未修改', 'Cancelled; source was not changed'],
  ['处理失败，可重试', 'Processing failed; retry is available'],
  ['正在安全取消', 'Cancelling safely']
];

let locale = 'zh-CN';
let translating = false;
let domObserver = null;
const originalText = new WeakMap();
const originalAttributes = new WeakMap();

function translate(value) {
  if (typeof value !== 'string' || locale !== 'en-US') return value;
  if (Object.hasOwn(exact, value)) return exact[value];
  for (const [pattern, replacement] of patterns) {
    if (pattern.test(value)) return value.replace(pattern, replacement);
  }
  return value;
}

function translateStage(value) {
  if (typeof value !== 'string' || locale !== 'en-US') return value;
  let result = translate(value);
  for (const [source, target] of stageFragments) result = result.split(source).join(target);
  return result;
}

function translateDom(root = document) {
  if (translating || !root) return;
  translating = true;
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let current;
    while ((current = walker.nextNode())) nodes.push(current);
    for (const node of nodes) {
      const value = originalText.has(node) ? originalText.get(node) : node.nodeValue;
      originalText.set(node, value);
      const trimmed = value.trim();
      const translated = locale === 'en-US' ? translate(trimmed) : trimmed;
      if (trimmed) node.nodeValue = value.replace(trimmed, translated);
    }
    for (const element of root.querySelectorAll?.('[placeholder],[title],[aria-label]') || []) {
      for (const attribute of ['placeholder', 'title', 'aria-label']) {
        if (!element.hasAttribute(attribute)) continue;
        let values = originalAttributes.get(element);
        if (!values) {
          values = {};
          originalAttributes.set(element, values);
        }
        if (values[attribute] === undefined) values[attribute] = element.getAttribute(attribute);
         element.setAttribute(attribute, locale === 'en-US' ? translate(values[attribute]) : values[attribute]);
      }
    }
  } finally {
    translating = false;
  }
}

function setLocale(nextLocale) {
  locale = nextLocale === 'en-US' ? 'en-US' : 'zh-CN';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
    translateDom(document.body);
    ensureDynamicTranslationObserver();
  }
  return locale;
}

function ensureDynamicTranslationObserver() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined' || !document.body || domObserver) return;
  domObserver = new MutationObserver((records) => {
    if (translating) return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) translateDom(node);
      }
    }
  });
  domObserver.observe(document.body, { childList: true, subtree: true });
}

if (typeof window !== 'undefined') {
  ensureDynamicTranslationObserver();
  window.hamsterI18n = { exact, patterns, translate, translateStage, translateDom, setLocale, getLocale: () => locale };
}

if (typeof module !== 'undefined') {
  module.exports = { exact, patterns, translate, translateStage, translateDom, setLocale, getLocale: () => locale };
}
