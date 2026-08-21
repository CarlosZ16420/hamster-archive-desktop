'use strict';

const path = require('node:path');

function normalizeName(value) {
  const parsed = path.parse(value.normalize('NFKC').toLowerCase()).name;
  return parsed.replace(/[\s_.\-()[\]{}【】（）]+/g, '');
}

function findTaskNameMatches(task, catalog) {
  const target = normalizeName(task.displayName);
  if (!target || !isMeaningfulTitle(target)) return [];
  const matches = [];
  for (const record of catalog) {
    if ([record.displayName, record.title].filter(Boolean).some((name) => normalizeName(name) === target)) {
      matches.push({
        archiveId: record.id,
        displayName: record.displayName,
        archiveBaseName: record.archiveBaseName
      });
    }
  }
  return matches.slice(0, 20);
}

function findExactFileMatches(manifest, catalog) {
  const index = new Map();
  for (const record of catalog) {
    for (const file of record.manifest || []) {
      if (!file.md5) continue;
      const key = `${file.size}:${file.md5}`;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push({
        archiveId: record.id,
        archiveName: record.archiveBaseName,
        archivedTask: record.displayName,
        relativePath: file.relativePath
      });
    }
  }

  const matches = [];
  for (const file of manifest) {
    const previous = index.get(`${file.size}:${file.md5}`);
    if (!previous) continue;
    matches.push({
      sourceRelativePath: file.relativePath,
      md5: file.md5,
      size: file.size,
      previous: previous.slice(0, 5)
    });
    if (matches.length >= 100) break;
  }
  return matches;
}

const GENERIC_TITLES = new Set([
  '新建文件夹', '未命名文件夹', '视频', '照片', '图片', '相册', 'video', 'videos', 'image', 'images', 'photo', 'photos', 'img'
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mts', '.m2ts', '.ts'
]);

const DEFAULT_SIMILARITY_IGNORE_TERMS = [
  'FC2', 'PPV', 'S1', 'SOD', 'SOD CREATE', 'MOODYZ', 'PRESTIGE', 'IDEA POCKET',
  'IDEAPOCKET', 'MADONNA', 'ATTACKERS', 'FALENO', 'FALENO STAR', 'KAWAII',
  'E-BODY', 'WANZ', 'WANZ FACTORY', 'DAS', 'MIDE', 'MGS', 'CARIBBEANCOM',
  '1PONDO', 'HEYZO', 'PACOPACOMAMA', 'TOKYO HOT', 'HONNAKA', 'HMP', 'KMP',
  'MAX-A', 'ALICE JAPAN', 'CRYSTAL-EIZOU', 'GLORY QUEST', 'PREMIUM', 'OPPAI',
  'TAMEIKE GORO', 'KIRA KIRA', 'NANPA JAPAN', 'GIGA', 'ROCKET', 'NATURAL HIGH'
];

function parseSimilarityIgnoreTerms(value) {
  const lines = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
  return [...new Set(lines
    .map((line) => String(line).replace(/\s+#.*$/, '').trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.normalize('NFKC').toLowerCase()))]
    .sort((left, right) => right.length - left.length);
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripSimilarityIgnoreTerms(value, ignoreTerms = []) {
  let result = String(value || '');
  for (const term of parseSimilarityIgnoreTerms(ignoreTerms)) {
    const chunks = term.match(/[\p{Script=Han}a-z0-9]+/gu) || [];
    if (chunks.length === 0) continue;
    const body = chunks.map(escapeRegularExpression).join('[^\\p{Script=Han}a-z0-9]*');
    const leftBoundary = /^[a-z0-9]/i.test(chunks[0]) ? '(?<![a-z0-9])' : '';
    const rightBoundary = /[a-z0-9]$/i.test(chunks.at(-1)) ? '(?![a-z0-9])' : '';
    result = result.replace(new RegExp(`${leftBoundary}${body}${rightBoundary}`, 'giu'), ' ');
  }
  return result;
}

function stripDomainNoise(value) {
  return String(value || '').replace(
    /(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,62})\.)+[a-z]{2,24}(?=$|[^a-z0-9])/giu,
    ' '
  );
}

function similarityParts(value, ignoreTerms = []) {
  const rawBase = path.parse(String(value || '').normalize('NFKC').toLowerCase()).name;
  const base = stripSimilarityIgnoreTerms(stripDomainNoise(rawBase), ignoreTerms);
  const compact = base.replace(/[^\p{Script=Han}a-z0-9]+/gu, '');
  const han = [...compact].filter((character) => /\p{Script=Han}/u.test(character));
  const latinWords = base.match(/[a-z]{3,}/g) || [];
  return { base, compact, han, latinWords };
}

function isMeaningfulTitle(value, ignoreTerms = []) {
  const parts = similarityParts(value, ignoreTerms);
  if (!parts.compact || GENERIC_TITLES.has(parts.compact)) return false;
  const hanCount = parts.han.length;
  const latinCount = parts.latinWords.join('').length;
  // 纯数字编号、分隔符和被排除的厂牌词没有语义，不能仅凭数字片段重合判相似。
  // 完全相同的名称仍由精确名称检查处理，大小和 MD5 检查也不受影响。
  return hanCount >= 2 || latinCount >= 6;
}

function videoEntries(subject) {
  if (subject.sourceType === 'video' && !(subject.manifest || []).length) {
    return [{ name: subject.displayName || subject.title || '', size: Number(subject.totalBytes || subject.originalBytes) || 0 }];
  }
  return (subject.manifest || [])
    .filter((file) => VIDEO_EXTENSIONS.has(String(file.extension || path.extname(file.name || file.relativePath || '')).toLowerCase()))
    .map((file) => ({ name: file.name || path.basename(file.relativePath || ''), size: Number(file.size) || 0 }));
}

function addTextCandidateKeys(keys, value, ignoreTerms = []) {
  const parts = similarityParts(value, ignoreTerms);
  if (!isMeaningfulTitle(value, ignoreTerms)) return;
  const compactCharacters = [...parts.compact];
  for (const pair of bigrams(compactCharacters)) keys.add(`text:${pair}`);
  for (const word of parts.latinWords) keys.add(`word:${word}`);
  if (compactCharacters.length === 2) keys.add(`text:${parts.compact}`);
}

function similarityCandidateKeys(subject, ignoreTerms = []) {
  const keys = new Set();
  addTextCandidateKeys(keys, subject.title || subject.displayName || '', ignoreTerms);
  for (const video of videoEntries(subject)) {
    addTextCandidateKeys(keys, video.name, ignoreTerms);
    if (video.size > 0) keys.add(`video-size:${video.size}`);
  }
  return [...keys];
}

function bigrams(characters) {
  const result = new Set();
  for (let index = 0; index < characters.length - 1; index += 1) {
    result.add(`${characters[index]}${characters[index + 1]}`);
  }
  return result;
}

function titleSimilarity(left, right, ignoreTerms = []) {
  const a = similarityParts(left, ignoreTerms);
  const b = similarityParts(right, ignoreTerms);
  if (!isMeaningfulTitle(left, ignoreTerms) || !isMeaningfulTitle(right, ignoreTerms)) return 0;
  if (a.compact === b.compact) return 1;
  if (a.compact.length >= 4 && b.compact.length >= 4 &&
      (a.compact.includes(b.compact) || b.compact.includes(a.compact))) return 0.9;

  if (a.han.length >= 4 && b.han.length >= 4) {
    const aSet = new Set(a.han);
    const bSet = new Set(b.han);
    const commonCharacters = [...aSet].filter((character) => bSet.has(character)).length;
    const aBigrams = bigrams(a.han);
    const bBigrams = bigrams(b.han);
    const commonBigrams = [...aBigrams].filter((item) => bBigrams.has(item)).length;
    if (commonCharacters < 3 || commonBigrams < 2) return 0;
    const characterCoverage = commonCharacters / Math.min(aSet.size, bSet.size);
    const dice = (2 * commonBigrams) / Math.max(1, aBigrams.size + bBigrams.size);
    return Math.min(0.89, Math.max(dice, characterCoverage * 0.75));
  }

  const aLetters = a.latinWords.join('').length;
  const bLetters = b.latinWords.join('').length;
  if (aLetters < 6 || bLetters < 6) return 0;
  const sharedWords = a.latinWords.filter((word) => b.latinWords.some((candidate) =>
    candidate === word || (word.length >= 5 && (candidate.includes(word) || word.includes(candidate)))
  ));
  const sharedLetters = sharedWords.reduce((sum, word) => sum + word.length, 0);
  if (sharedLetters < 6) return 0;
  return Math.min(0.88, sharedLetters / Math.max(aLetters, bLetters) + 0.35);
}

function findSimilarProjects(subject, candidates, ignoreTerms = []) {
  const subjectTitle = subject.title || subject.displayName || '';
  const subjectVideos = videoEntries(subject);
  const matches = [];
  for (const candidate of candidates || []) {
    const candidateId = candidate.id || candidate.jobId;
    if (!candidateId || candidateId === subject.id || candidateId === subject.jobId) continue;
    const candidateTitle = candidate.title || candidate.displayName || '';
    let score = titleSimilarity(subjectTitle, candidateTitle, ignoreTerms);
    const reasons = [];
    if (score > 0) reasons.push(score === 1 ? '标题一致' : '标题相似');
    const candidateVideos = videoEntries(candidate);
    for (const subjectVideo of subjectVideos) {
      for (const candidateVideo of candidateVideos) {
        const videoTitleScore = titleSimilarity(subjectVideo.name, candidateVideo.name, ignoreTerms);
        if (videoTitleScore >= 0.45) {
          score = Math.max(score, videoTitleScore * 0.94);
          reasons.push('包含标题相似的视频');
        }
        if (subjectVideo.size > 0 && subjectVideo.size === candidateVideo.size) {
          score = Math.max(score, 0.96);
          reasons.push('视频大小完全一致');
        }
      }
    }
    if (score < 0.45 || reasons.length === 0) continue;
    matches.push({
      id: candidateId,
      title: candidateTitle,
      score: Number(score.toFixed(3)),
      reasons: [...new Set(reasons)]
    });
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, 20);
}

function textMatchRanges(value, candidateValue, ignoreTerms = []) {
  const source = String(value || '');
  const candidate = String(candidateValue || '');
  if (titleSimilarity(source, candidate, ignoreTerms) < 0.45) return [];

  const ignored = parseSimilarityIgnoreTerms(ignoreTerms);
  const isIgnored = (token) => ignored.some((term) => {
    const compactTerm = term.replace(/[^\p{Script=Han}a-z0-9]+/gu, '');
    const compactToken = token.toLocaleLowerCase().replace(/[^\p{Script=Han}a-z0-9]+/gu, '');
    return compactTerm && (compactToken === compactTerm || compactToken.includes(compactTerm));
  });
  const candidateParts = similarityParts(candidate, ignoreTerms);
  const candidateHan = new Set(candidateParts.han);
  const candidateWords = candidateParts.latinWords;
  const ranges = [];

  for (const match of source.matchAll(/[\p{Script=Han}]+|[a-z]{3,}/giu)) {
    const token = match[0];
    if (isIgnored(token)) continue;
    if (/^\p{Script=Han}+$/u.test(token)) {
      for (let offset = 0; offset < token.length; offset += 1) {
        if (candidateHan.has(token[offset].normalize('NFKC').toLocaleLowerCase())) {
          ranges.push([match.index + offset, match.index + offset + 1]);
        }
      }
    } else {
      const lower = token.normalize('NFKC').toLocaleLowerCase();
      if (candidateWords.some((word) => word === lower ||
          (word.length >= 5 && (word.includes(lower) || lower.includes(word))))) {
        ranges.push([match.index, match.index + token.length]);
      }
    }
  }

  if (ranges.length === 0) return [[0, source.length]];
  const merged = [];
  for (const range of ranges.sort((left, right) => left[0] - right[0])) {
    const previous = merged.at(-1);
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

function entryName(relativePath) {
  const parts = String(relativePath || '').split(/[\\/]/).filter(Boolean);
  return parts.at(-1) || '';
}

function findSimilarEntryMatches(subject, candidates, ignoreTerms = []) {
  const matches = new Map();
  const subjectDirectories = (subject.directories || []).map((relativePath) => ({
    kind: 'directory', relativePath: String(relativePath || ''), name: entryName(relativePath)
  }));
  const subjectFiles = (subject.manifest || []).map((file) => ({
    kind: 'file', relativePath: String(file.relativePath || ''), name: file.name || entryName(file.relativePath), file
  }));

  const textIndex = new Map();
  const exactFileIndex = new Map();
  const videoSizeIndex = new Map();
  const addIndex = (index, key, entry) => {
    if (!key) return;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(entry);
  };
  for (const candidate of candidates || []) {
    const common = { recordId: candidate.id, title: candidate.title || candidate.displayName || '' };
    for (const relativePath of candidate.directories || []) {
      const entry = { ...common, kind: 'directory', relativePath: String(relativePath || ''), name: entryName(relativePath) };
      for (const key of similarityCandidateKeys({ title: entry.name }, ignoreTerms)) addIndex(textIndex, `directory:${key}`, entry);
    }
    for (const file of candidate.manifest || []) {
      const entry = { ...common, kind: 'file', relativePath: String(file.relativePath || ''), name: file.name || entryName(file.relativePath), file };
      for (const key of similarityCandidateKeys({ title: entry.name }, ignoreTerms)) addIndex(textIndex, `file:${key}`, entry);
      if (file.md5 && Number(file.size) >= 0) addIndex(exactFileIndex, `${Number(file.size)}:${String(file.md5).toLocaleLowerCase()}`, entry);
      if (VIDEO_EXTENSIONS.has(String(file.extension || path.extname(entry.name)).toLocaleLowerCase()) && Number(file.size) > 0) {
        addIndex(videoSizeIndex, String(Number(file.size)), entry);
      }
    }
  }

  for (const sourceDirectory of subjectDirectories) {
    const targets = new Set(similarityCandidateKeys({ title: sourceDirectory.name }, ignoreTerms)
      .flatMap((key) => textIndex.get(`directory:${key}`) || []));
    for (const targetDirectory of targets) {
      const ranges = textMatchRanges(sourceDirectory.name, targetDirectory.name, ignoreTerms);
      if (ranges.length === 0) continue;
      const key = `directory:${sourceDirectory.relativePath}`;
      const current = matches.get(key) || { kind: 'directory', relativePath: sourceDirectory.relativePath, ranges: [], matches: [] };
      current.ranges.push(...ranges);
      current.matches.push({ recordId: targetDirectory.recordId, title: targetDirectory.title, relativePath: targetDirectory.relativePath, reason: '目录名相似' });
      matches.set(key, current);
    }
  }

  for (const sourceFile of subjectFiles) {
    const targets = new Set(similarityCandidateKeys({ title: sourceFile.name }, ignoreTerms)
      .flatMap((key) => textIndex.get(`file:${key}`) || []));
    if (sourceFile.file.md5) {
      for (const target of exactFileIndex.get(`${Number(sourceFile.file.size)}:${String(sourceFile.file.md5).toLocaleLowerCase()}`) || []) targets.add(target);
    }
    if (VIDEO_EXTENSIONS.has(String(sourceFile.file.extension || path.extname(sourceFile.name)).toLocaleLowerCase()) && Number(sourceFile.file.size) > 0) {
      for (const target of videoSizeIndex.get(String(Number(sourceFile.file.size))) || []) targets.add(target);
    }
    for (const targetFile of targets) {
        const exactContent = sourceFile.file.md5 && targetFile.file.md5 &&
          String(sourceFile.file.md5).toLocaleLowerCase() === String(targetFile.file.md5).toLocaleLowerCase() &&
          Number(sourceFile.file.size) === Number(targetFile.file.size);
        const sameVideoSize = VIDEO_EXTENSIONS.has(String(sourceFile.file.extension || path.extname(sourceFile.name)).toLocaleLowerCase()) &&
          VIDEO_EXTENSIONS.has(String(targetFile.file.extension || path.extname(targetFile.name)).toLocaleLowerCase()) &&
          Number(sourceFile.file.size) > 0 && Number(sourceFile.file.size) === Number(targetFile.file.size);
        const ranges = exactContent || sameVideoSize
          ? [[0, sourceFile.name.length]]
          : textMatchRanges(sourceFile.name, targetFile.name, ignoreTerms);
        if (ranges.length === 0) continue;
        const key = `file:${sourceFile.relativePath}`;
        const current = matches.get(key) || { kind: 'file', relativePath: sourceFile.relativePath, ranges: [], matches: [] };
        current.ranges.push(...ranges);
        current.matches.push({
          recordId: targetFile.recordId,
          title: targetFile.title,
          relativePath: targetFile.relativePath,
          reason: exactContent ? '文件内容完全一致' : sameVideoSize ? '视频大小完全一致' : '文件名相似'
        });
        matches.set(key, current);
    }
  }

  return [...matches.values()].map((entry) => {
    const merged = [];
    for (const range of entry.ranges.sort((left, right) => left[0] - right[0])) {
      const previous = merged.at(-1);
      if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
      else merged.push([...range]);
    }
    return {
      ...entry,
      ranges: merged,
      matches: entry.matches.filter((match, index, items) => items.findIndex((candidate) =>
        candidate.recordId === match.recordId && candidate.relativePath === match.relativePath && candidate.reason === match.reason
      ) === index).slice(0, 20)
    };
  });
}

function fuzzyTextScore(query, text) {
  const needle = similarityParts(query).compact;
  const haystack = similarityParts(text).compact;
  if (!needle) return 1;
  if (!haystack) return 0;
  if (haystack === needle) return 1;
  if (haystack.startsWith(needle)) return 0.95;
  if (haystack.includes(needle)) return 0.9;
  let cursor = 0;
  for (const character of haystack) {
    if (character === needle[cursor]) cursor += 1;
    if (cursor === needle.length) return Math.max(0.55, 0.82 - ((haystack.length - needle.length) / Math.max(20, haystack.length)));
  }
  const needleBigrams = bigrams([...needle]);
  const haystackBigrams = bigrams([...haystack]);
  const common = [...needleBigrams].filter((item) => haystackBigrams.has(item)).length;
  const dice = (2 * common) / Math.max(1, needleBigrams.size + haystackBigrams.size);
  return dice >= 0.35 ? dice * 0.8 : 0;
}

module.exports = {
  DEFAULT_SIMILARITY_IGNORE_TERMS,
  findExactFileMatches,
  findSimilarEntryMatches,
  findSimilarProjects,
  findTaskNameMatches,
  fuzzyTextScore,
  isMeaningfulTitle,
  normalizeName,
  parseSimilarityIgnoreTerms,
  similarityCandidateKeys,
  titleSimilarity
};
