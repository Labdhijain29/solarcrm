const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');

const IMAGE_MAX_WIDTH = 1920;
const IMAGE_MAX_HEIGHT = 1920;
const JPEG_QUALITY = 78;
const WEBP_QUALITY = 78;
const PNG_QUALITY = 82;
const VIDEO_CRF = 28;
const VIDEO_PRESET = 'veryfast';
const VIDEO_MAX_WIDTH = 1280;

const isImage = (file) => String(file?.mimetype || '').startsWith('image/');
const isVideo = (file) => String(file?.mimetype || '').startsWith('video/');

const replaceExtension = (fileName, extension) => {
  const parsed = path.parse(fileName || `upload${extension}`);
  return `${parsed.name || 'upload'}${extension}`;
};

const buildOptimizedFile = (file, buffer, patch = {}) => ({
  ...file,
  ...patch,
  buffer,
  size: buffer.length,
});

const keepSmaller = (file, optimizedFile) => {
  if (!optimizedFile?.buffer?.length) return file;
  if (!file?.buffer?.length) return optimizedFile;
  return optimizedFile.buffer.length < file.buffer.length ? optimizedFile : file;
};

const optimizeImage = async (file) => {
  const mimeType = String(file.mimetype || '').toLowerCase();
  const pipeline = sharp(file.buffer)
    .rotate()
    .resize({
      width: IMAGE_MAX_WIDTH,
      height: IMAGE_MAX_HEIGHT,
      fit: 'inside',
      withoutEnlargement: true,
    });

  let buffer;
  let patch = {};

  if (mimeType === 'image/png') {
    buffer = await pipeline.png({ compressionLevel: 9, quality: PNG_QUALITY, effort: 8 }).toBuffer();
  } else if (mimeType === 'image/webp') {
    buffer = await pipeline.webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer();
  } else {
    buffer = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
    patch = {
      mimetype: 'image/jpeg',
      originalname: replaceExtension(file.originalname, '.jpg'),
    };
  }

  return keepSmaller(file, buildOptimizedFile(file, buffer, patch));
};

const runFfmpeg = (args) => new Promise((resolve, reject) => {
  const child = spawn(ffmpegPath, args, { windowsHide: true });
  let stderr = '';

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) {
      resolve();
      return;
    }

    reject(new Error(stderr || `ffmpeg exited with code ${code}`));
  });
});

const optimizeVideo = async (file) => {
  if (!ffmpegPath) return file;

  const tempId = crypto.randomUUID();
  const inputPath = path.join(os.tmpdir(), `${tempId}-input${path.extname(file.originalname || '') || '.video'}`);
  const outputPath = path.join(os.tmpdir(), `${tempId}-output.mp4`);

  try {
    await fs.writeFile(inputPath, file.buffer);
    await runFfmpeg([
      '-y',
      '-i', inputPath,
      '-vf', `scale='min(${VIDEO_MAX_WIDTH},iw)':-2`,
      '-c:v', 'libx264',
      '-preset', VIDEO_PRESET,
      '-crf', String(VIDEO_CRF),
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ]);

    const buffer = await fs.readFile(outputPath);
    return keepSmaller(file, buildOptimizedFile(file, buffer, {
      mimetype: 'video/mp4',
      originalname: replaceExtension(file.originalname, '.mp4'),
    }));
  } finally {
    await Promise.allSettled([
      fs.unlink(inputPath),
      fs.unlink(outputPath),
    ]);
  }
};

const optimizeUploadFile = async (file, options = {}) => {
  if (!file?.buffer || options.enabled === false) return file;

  try {
    if (isImage(file)) return await optimizeImage(file);
    if (isVideo(file)) return await optimizeVideo(file);
  } catch (error) {
    if (options.throwOnFailure) throw error;
  }

  return file;
};

module.exports = {
  optimizeUploadFile,
};
