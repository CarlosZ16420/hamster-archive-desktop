<div align="center">

<img src="README.assets/iconC_cropped_1022x1022.png" alt="Hamster Archiver pixel hamster icon" width="112">

# Hamster Archiver

### Turn scattered large files into verified archives and a searchable local warehouse

Local-first batch archiver and searchable media vault for Windows.

Local-first · Batch archiving · Media previews · Portable user data

![Version](https://img.shields.io/badge/version-4.4.9-d45f3c?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-23211d?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-2f7558?style=flat-square)
![Electron](https://img.shields.io/badge/Electron-43-456f83?style=flat-square)
![SQLite](https://img.shields.io/badge/SQLite-WAL-b17422?style=flat-square)
[![CI](https://github.com/CarlosZ16420/hamster-archiver/actions/workflows/ci.yml/badge.svg)](https://github.com/CarlosZ16420/hamster-archiver/actions/workflows/ci.yml)

[中文 README](README.md) · [Download releases](../../releases) · [Report an issue](../../issues) · [Contributing](CONTRIBUTING.md)

</div>

---

## What is it?

Hamster Archiver is for people who have large piles of local media and need a reliable, searchable backup record:

- folders full of videos and images that are difficult to browse;
- resources downloaded more than once without realizing it;
- cloud-drive backups that become impossible to search later;
- private media that should remain on local storage instead of being scanned by a photo service.

The application scans one source directory, creates one task for every direct child folder or video, produces a manifest and media previews, compresses each task, verifies the result, and records everything in a local SQLite warehouse.

```text
Scan → manifest and duplicate checks → 7-Zip compression → integrity verification → warehouse record → optional source handling
```

Volume size is configurable from 64 MiB to 10 GiB, with the existing 10 GiB behavior as the default. Turning optional splitting off cannot bypass confirmation and safety volumes for tasks over 10 GiB. Passwords, backup destinations, tags, ratings and notes can be stored per project. Possible duplicates, large tasks and abnormal archive sizes wait for explicit confirmation.

## Warehouse

The warehouse is more than a list of archives. It provides cover browsing, activity statistics, random discovery, fuzzy search, filtering, pagination and a virtualized directory tree.

It stores complete directory information, image thumbnails and evenly spaced video frames. Frames from the same video remain grouped together. Thumbnails can be enlarged, selected as a project cover, deleted or supplemented with manually chosen and pasted images.

The application includes Daylight and Night themes plus a “⇄ EN / ⇄ 中文” language toggle. The language preference is stored in the portable `userdata` directory.

## Safety and archiving

- Portable 7-Zip is bundled and supports 7z/ZIP, compression levels 0–9 and integrity testing.
- Unreadable or locked files are skipped and recorded instead of aborting the whole scan.
- Abnormal archive sizes are held for review; the source remains protected if an abnormal product is discarded.
- Multi-volume products use an isolated, atomic deletion workflow.
- Disk space is checked before compression; cross-disk moves copy, verify and then remove the source.
- The queue supports pause, finish-current-item-and-pause, scheduled operation and history-based time estimates.
- When moving a source to the Windows Recycle Bin, the current task is checked immediately. Only an unverified result from the current task can halt the queue; historical projects are not periodically sampled.

## Media and search

- One portable FFmpeg binary probes videos and extracts evenly spaced frames; FFprobe is not required.
- SQLite WAL and FTS5 provide persistent search indexes.
- Exact fingerprints, titles and video sizes participate in duplicate checks.
- Similarity calculations are local and use a maintainable ignore-term whitelist.
- Similar links can be recalculated or dismissed symmetrically for a project pair.

## Quick start

### Use a release build

1. Download the Windows x64 ZIP from [Releases](../../releases).
2. Extract the complete directory and run `HamsterArchiver.exe`.
3. Choose the source directory and archive output directory, scan and confirm the queue, then start archiving.

Keep the release directory structure intact. Electron, 7-Zip, FFmpeg and `userdata` use relative paths. Moving the complete application directory to another drive keeps the portable tool paths valid.

### Manual update when automatic update fails

If the application reports that automatic update did not finish, the old version remains intact and usable. Copying the portable data directory preserves more information than re-importing the warehouse:

Update checks use the public release channel, while source code and development commits are kept in a private repository. Version 4.2.0 can discover and verify a newer Release, but its built-in updater copies the new `resources` directory into a nested path. Startup validation therefore still reads version 4.2.0 and rolls back. Upgrading from 4.2.0 requires the manual steps below. After that one manual upgrade, the fixed updater replaces backed-up program directories before startup validation and always excludes the existing `userdata` directory.

1. Export the warehouse once from the old version as a safety copy, then exit the application completely.
2. Download the latest Windows x64 ZIP from [Releases](../../releases) and extract it into a **new directory**. Do not replace only the EXE or overwrite a directory that is still running.
3. With both versions closed, copy the complete `userdata` directory from the old version into the new version, replacing the new empty `userdata`.
4. Run `HamsterArchiver.exe` from the new directory. Verify the version, warehouse records and thumbnails before deleting the old directory.
5. If the copied `userdata` cannot be read, keep the old directory and use Import external warehouse in the new version with the archive exported in step 1.

The main application now exits only after the independent updater confirms that it has started. A launch failure keeps the current version open and displays these manual steps. A replacement or startup-validation failure rolls the program files back and reports the reason and diagnostics directory when the old version reopens.

### Run from source

Requirements: Windows, Node.js 22+ and npm.

```powershell
git clone https://github.com/CarlosZ16420/hamster-archiver.git
cd hamster-archiver
npm install
npm run check
npm test
npm start
```

The source repository does not contain the large `ffmpeg.exe` binary. Put FFmpeg in `tools/ffmpeg/` before building a release; portable 7-Zip is included with the source.

## Portable data layout

```text
HamsterArchiver-v4.4.9-win-x64/
├─ HamsterArchiver.exe
├─ tools/
│  ├─ 7zip/
│  └─ ffmpeg/
├─ resources/
└─ userdata/
   ├─ config/       # settings and the similarity ignore list
   ├─ warehouse/    # SQLite warehouse and thumbnails
   ├─ logs/         # one user log
   ├─ processed/    # default destination for processed sources
   └─ electron/     # local UI cache
```

The staging directory is created beside the selected output directory, for example `D:\packed-staging`, to reduce cross-disk transfers. Source and output directories are user choices and are not part of the source repository.

`userdata` may contain passwords, file paths, thumbnails and warehouse indexes. It is ignored by Git and never included in a public snapshot. Exit the application before copying the complete directory to another device.

## Technology and boundaries

| Area | Implementation |
|---|---|
| Desktop | Electron 43, context isolation, sandbox and strict CSP |
| Data | Node built-in SQLite, WAL, transactions and FTS5 |
| Compression | Portable 7-Zip, 7z/ZIP, configurable 64 MiB–10 GiB volumes, optional passwords and integrity tests |
| Media | One portable FFmpeg binary for probing and frame extraction |
| Performance | Warehouse pagination, virtualized directories and persistent search/similarity candidates |
| Privacy | User data stays local; media, warehouse data and passwords are not uploaded |

The application only contacts GitHub when you click Check for updates or open a GitHub link. Update packages are downloaded to a temporary userdata directory, verified, and applied by a separate updater. Archive uploads remain under your cloud-drive client or manual control.

## Development

Before submitting changes, run:

```powershell
npm run check
npm test
npm run publish:check
```

Do not commit `userdata/`, databases, logs, archives, passwords, real media or personal absolute paths. See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

This project is released under the [MIT License](LICENSE). 7-Zip and FFmpeg remain under their bundled licenses.

<div align="center">

Feedback and pull requests are welcome.

[GitHub repository](https://github.com/CarlosZ16420/hamster-archiver) · [Report a problem](https://github.com/CarlosZ16420/hamster-archiver/issues)

</div>
