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
  high: '2500k',
  standard: '1800k',
  compress: '1200k'
};

const resolutionMap = {
  original: null,
  '1080p': '1920x1080',
  '720p': '1280x720',
  '480p': '854x480'
};

exports.main = async (event) => {
  const {
    fileID,
    fileName = '',
    targetFormat = 'mp4',
    qualityPreset = 'standard',
    resolution = 'original'
  } = event;

  if (!fileID) {
    return {
      success: false,
      error: '缺少文件ID'
    };
  }

  const safeFormat = String(targetFormat).toLowerCase();
  const ext = ['mp4', 'mov', 'avi'].includes(safeFormat) ? safeFormat : 'mp4';
  const inputName = fileName || `input_${Date.now()}.mp4`;
  const outputName = inputName.replace(/\.[a-zA-Z0-9]+$/, '') + `.${ext}`;

  const tempInputPath = path.join('/tmp', `input_${Date.now()}_${Math.random().toString(16).slice(2)}_${path.basename(inputName)}`);
  const tempOutputPath = path.join('/tmp', `output_${Date.now()}_${Math.random().toString(16).slice(2)}_${path.basename(outputName)}`);

  try {
    const downloadRes = await cloud.downloadFile({ fileID });
    const fileContent = downloadRes.fileContent || Buffer.alloc(0);
    fs.writeFileSync(tempInputPath, fileContent);

    await transcodeVideo({
      inputPath: tempInputPath,
      outputPath: tempOutputPath,
      format: ext,
      qualityPreset,
      resolution
    });

    const outputBuffer = fs.readFileSync(tempOutputPath);
    const cloudPath = `video-files/output/${Date.now()}_${path.basename(outputName)}`;

    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: outputBuffer
    });

    return {
      success: true,
      outputFileID: uploadRes.fileID,
      outputFileName: outputName,
      outputSize: outputBuffer.length,
      message: '视频转换成功'
    };
  } catch (error) {
    console.error('视频转换失败:', error);
    return {
      success: false,
      error: error.message || '转换失败'
    };
  } finally {
    safeUnlink(tempInputPath);
    safeUnlink(tempOutputPath);
  }
};

function transcodeVideo({ inputPath, outputPath, format, qualityPreset, resolution }) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .toFormat(format)
      .videoBitrate(qualityBitrateMap[qualityPreset] || qualityBitrateMap.standard)
      .audioBitrate('128k')
      .outputOptions(['-movflags +faststart']);

    if (resolutionMap[resolution]) {
      command.size(resolutionMap[resolution]);
    }

    if (format === 'avi') {
      command.videoCodec('mpeg4').audioCodec('libmp3lame');
    } else {
      command.videoCodec('libx264').audioCodec('aac');
    }

    command
      .on('end', resolve)
      .on('error', (error) => reject(error))
      .save(outputPath);
  });
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
