const cloud = require('wx-server-sdk');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const fs = require('fs');
const path = require('path');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const qualityBitrateMap = {
  high: '256k',
  standard: '192k',
  compress: '128k'
};

exports.main = async (event) => {
  const {
    fileID,
    fileName = '',
    quality = 0.8,
    bitrate = '',
    format = 'auto'
  } = event;

  if (!fileID) {
    return {
      success: false,
      error: '缺少文件ID'
    };
  }

  const inputName = fileName || `input_${Date.now()}.mp3`;
  const inputExt = getExtension(inputName) || 'mp3';
  const targetFormat = format === 'auto' ? inputExt : String(format).toLowerCase();
  const safeFormat = ['mp3', 'aac', 'wav'].includes(targetFormat) ? targetFormat : 'mp3';

  const qualityPreset = getQualityPreset(quality);
  const outputBitrate = bitrate || qualityBitrateMap[qualityPreset] || '192k';

  const tempInputPath = path.join('/tmp', `input_${Date.now()}_${Math.random().toString(16).slice(2)}_${path.basename(inputName)}`);
  const outputName = inputName.replace(/\.[a-zA-Z0-9]+$/, '') + `.${safeFormat}`;
  const tempOutputPath = path.join('/tmp', `output_${Date.now()}_${Math.random().toString(16).slice(2)}_${path.basename(outputName)}`);

  try {
    const downloadRes = await cloud.downloadFile({ fileID });
    fs.writeFileSync(tempInputPath, downloadRes.fileContent || Buffer.alloc(0));

    await transcodeAudio({
      inputPath: tempInputPath,
      outputPath: tempOutputPath,
      format: safeFormat,
      bitrate: outputBitrate
    });

    const outputBuffer = fs.readFileSync(tempOutputPath);
    const cloudPath = `audio-files/output/${Date.now()}_${path.basename(outputName)}`;

    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: outputBuffer
    });

    return {
      success: true,
      outputFileID: uploadRes.fileID,
      outputFileName: outputName,
      outputSize: outputBuffer.length,
      bitrate: outputBitrate,
      message: '音频压缩成功'
    };
  } catch (error) {
    console.error('音频压缩失败:', error);
    return {
      success: false,
      error: error.message || '压缩失败'
    };
  } finally {
    safeUnlink(tempInputPath);
    safeUnlink(tempOutputPath);
  }
};

function transcodeAudio({ inputPath, outputPath, format, bitrate }) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .toFormat(format)
      .audioBitrate(bitrate)
      .outputOptions(['-map_metadata -1']);

    if (format === 'mp3') {
      command.audioCodec('libmp3lame');
    } else if (format === 'aac') {
      command.audioCodec('aac');
    } else if (format === 'wav') {
      command.audioCodec('pcm_s16le');
    }

    command
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });
}

function getQualityPreset(quality) {
  if (quality >= 0.9) return 'high';
  if (quality >= 0.65) return 'standard';
  return 'compress';
}

function getExtension(fileName = '') {
  const matched = fileName.match(/\.([a-zA-Z0-9]+)$/);
  return matched ? matched[1].toLowerCase() : '';
}

function safeUnlink(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn('清理临时文件失败:', filePath, error.message);
  }
}
