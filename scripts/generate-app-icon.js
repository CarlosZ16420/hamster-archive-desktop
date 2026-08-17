'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { app, nativeImage } = require('electron');

const projectRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(projectRoot, 'assets', 'app-icon.png');
const outputPath = path.join(projectRoot, 'assets', 'app-icon.ico');
const iconSizes = [16, 24, 32, 48, 64, 128, 256];

function buildIco(pngImages) {
  const headerSize = 6;
  const entrySize = 16;
  const directory = Buffer.alloc(headerSize + (pngImages.length * entrySize));
  directory.writeUInt16LE(0, 0);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(pngImages.length, 4);
  let offset = directory.length;
  for (let index = 0; index < pngImages.length; index += 1) {
    const { size, data } = pngImages[index];
    const entryOffset = headerSize + (index * entrySize);
    directory.writeUInt8(size === 256 ? 0 : size, entryOffset);
    directory.writeUInt8(size === 256 ? 0 : size, entryOffset + 1);
    directory.writeUInt8(0, entryOffset + 2);
    directory.writeUInt8(0, entryOffset + 3);
    directory.writeUInt16LE(1, entryOffset + 4);
    directory.writeUInt16LE(32, entryOffset + 6);
    directory.writeUInt32LE(data.length, entryOffset + 8);
    directory.writeUInt32LE(offset, entryOffset + 12);
    offset += data.length;
  }
  return Buffer.concat([directory, ...pngImages.map((image) => image.data)]);
}

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const source = nativeImage.createFromPath(sourcePath);
  if (source.isEmpty()) throw new Error(`无法读取应用图标：${sourcePath}`);
  const pngImages = iconSizes.map((size) => ({
    size,
    data: source.resize({ width: size, height: size, quality: 'best' }).toPNG()
  }));
  await fs.writeFile(outputPath, buildIco(pngImages));
  console.log(outputPath);
  app.quit();
}).catch((error) => {
  console.error(error.stack || error.message);
  app.exit(1);
});
