// utils/imageCompressor.js
// 图片压缩工具

/**
 * 图片压缩核心函数
 * @param {String} imagePath - 原始图片路径
 * @param {Object} options - 压缩选项
 * @returns {Promise<Object>} 压缩结果
 */
async function compressImage(imagePath, options = {}) {
  const {
    quality = 0.8,
    resize = 'original',
    format = 'auto',
    maxWidth = null,
    maxHeight = null
  } = options;

  try {
    // 1. 获取原始图片信息
    const imageInfo = await getImageInfo(imagePath);
    console.log('原始图片信息:', imageInfo);

    // 2. 计算目标尺寸
    let targetWidth = imageInfo.width;
    let targetHeight = imageInfo.height;

    if (resize !== 'original' && maxWidth && maxHeight) {
      const scale = Math.min(
        maxWidth / imageInfo.width,
        maxHeight / imageInfo.height,
        1.0 // 不放大
      );
      targetWidth = Math.floor(imageInfo.width * scale);
      targetHeight = Math.floor(imageInfo.height * scale);
    }

    // 3. 确定输出格式
    let outputFormat = format;
    if (format === 'auto') {
      // 智能选择：PNG转JPG以减小体积，其他保持原格式
      const path = imagePath.toLowerCase();
      if (path.endsWith('.png')) {
        outputFormat = 'jpg';
      } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
        outputFormat = 'jpg';
      } else {
        outputFormat = 'jpg'; // 默认使用jpg
      }
    }

    // 4. 创建Canvas
    const canvas = wx.createOffscreenCanvas({
      type: '2d',
      width: targetWidth,
      height: targetHeight
    });
    const ctx = canvas.getContext('2d');

    // 5. 加载图片
    const img = canvas.createImage();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imagePath;
    });

    // 6. 绘制到Canvas（白色背景，避免JPG透明问题）
    if (outputFormat === 'jpg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // 7. 导出压缩图片
    const tempFilePath = await canvasToTempFile(canvas, quality, outputFormat);

    // 8. 获取压缩后文件大小
    const fs = wx.getFileSystemManager();
    const originalStats = await getFileStats(imagePath);
    const compressedStats = await getFileStats(tempFilePath);

    const originalSize = originalStats.size;
    const compressedSize = compressedStats.size;
    const compressionRatio = originalSize > 0
      ? ((1 - compressedSize / originalSize) * 100).toFixed(1)
      : '0.0';

    return {
      success: true,
      originalPath: imagePath,
      compressedPath: tempFilePath,
      originalSize: originalSize,
      compressedSize: compressedSize,
      compressionRatio: compressionRatio,
      dimensions: {
        original: { width: imageInfo.width, height: imageInfo.height },
        compressed: { width: targetWidth, height: targetHeight }
      }
    };

  } catch (error) {
    console.error('压缩失败:', error);
    return {
      success: false,
      originalPath: imagePath,
      error: error.message || '压缩失败'
    };
  }
}

/**
 * 批量压缩图片
 * @param {Array} imagePaths - 图片路径数组
 * @param {Object} options - 压缩选项
 * @param {Function} onProgress - 进度回调
 */
async function batchCompressImages(imagePaths, options, onProgress) {
  const results = [];
  const total = imagePaths.length;

  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];

    // 更新进度
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: total,
        percent: Math.floor(((i + 1) / total) * 100)
      });
    }

    // 压缩单张图片
    const result = await compressImage(imagePath, options);
    results.push(result);

    // 短暂延时，避免阻塞UI
    await sleep(50);
  }

  return results;
}

/**
 * 获取图片信息
 */
function getImageInfo(imagePath) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: imagePath,
      success: resolve,
      fail: reject
    });
  });
}

/**
 * 将canvas转换为临时文件
 */
function canvasToTempFile(canvas, quality, fileType) {
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas: canvas,
      quality: quality,
      fileType: fileType,
      success: (res) => resolve(res.tempFilePath),
      fail: reject
    });
  });
}

/**
 * 获取文件状态信息
 */
function getFileStats(filePath) {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager();
    try {
      const stats = fs.statSync(filePath);
      resolve(stats);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 延时函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  if (!bytes) return '--';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

module.exports = {
  compressImage,
  batchCompressImages,
  formatFileSize
};
