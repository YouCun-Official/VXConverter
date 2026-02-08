/**
 * 图片格式转换工具类
 */
const FormatUtils = require('./formatUtils.js');

class ImageFormatConverter {
  /**
   * 图片格式转换
   * @param {String} imagePath - 源图片路径
   * @param {String} targetFormat - 目标格式 (jpg/png/webp)
   * @param {Object} options - 配置选项
   */
  static async convertFormat(imagePath, targetFormat, options = {}) {
    const {
      quality = 0.92,
      maxWidth = null,
      maxHeight = null
    } = options;

    try {
      // 1. 获取图片信息
      const imageInfo = await this.getImageInfo(imagePath);

      // 2. 计算目标尺寸
      const targetSize = this.calculateTargetSize(
        imageInfo.width,
        imageInfo.height,
        maxWidth,
        maxHeight
      );

      // 3. 创建Canvas并绘制
      const canvas = wx.createOffscreenCanvas({
        type: '2d',
        width: targetSize.width,
        height: targetSize.height
      });

      const ctx = canvas.getContext('2d');
      const img = canvas.createImage();

      return new Promise((resolve, reject) => {
        img.onload = () => {
          // 清空画布
          ctx.clearRect(0, 0, targetSize.width, targetSize.height);

          // 绘制图片
          ctx.drawImage(img, 0, 0, targetSize.width, targetSize.height);

          // 4. 导出为目标格式
          wx.canvasToTempFilePath({
            canvas: canvas,
            fileType: this.normalizeFormat(targetFormat),
            quality: quality,
            success: (res) => {
              // 5. 获取转换后的文件信息
              this.getFileStats(res.tempFilePath)
                .then(stats => {
                  resolve({
                    success: true,
                    filePath: res.tempFilePath,
                    originalSize: imageInfo.originalSize || 0,
                    convertedSize: stats.size,
                    width: targetSize.width,
                    height: targetSize.height,
                    format: targetFormat
                  });
                })
                .catch(error => {
                  // 即使获取文件信息失败，也返回成功结果
                  resolve({
                    success: true,
                    filePath: res.tempFilePath,
                    originalSize: imageInfo.originalSize || 0,
                    convertedSize: 0,
                    width: targetSize.width,
                    height: targetSize.height,
                    format: targetFormat
                  });
                });
            },
            fail: (error) => {
              console.error('Canvas导出失败:', error);
              reject(new Error('图片转换失败'));
            }
          });
        };

        img.onerror = (error) => {
          console.error('图片加载失败:', error);
          reject(new Error('图片加载失败'));
        };

        img.src = imagePath;
      });
    } catch (error) {
      console.error('图片格式转换失败:', error);
      throw error;
    }
  }

  /**
   * 格式标准化
   */
  static normalizeFormat(format) {
    const formatMap = {
      'jpg': 'jpg',
      'jpeg': 'jpg',
      'png': 'png',
      'webp': 'webp'
    };
    return formatMap[format.toLowerCase()] || 'jpg';
  }

  /**
   * 计算目标尺寸（保持宽高比）
   */
  static calculateTargetSize(width, height, maxWidth, maxHeight) {
    if (!maxWidth && !maxHeight) {
      return { width, height };
    }

    let targetWidth = width;
    let targetHeight = height;

    if (maxWidth && width > maxWidth) {
      targetWidth = maxWidth;
      targetHeight = (height * maxWidth) / width;
    }

    if (maxHeight && targetHeight > maxHeight) {
      targetHeight = maxHeight;
      targetWidth = (targetWidth * maxHeight) / targetHeight;
    }

    return {
      width: Math.round(targetWidth),
      height: Math.round(targetHeight)
    };
  }

  /**
   * 获取图片信息
   */
  static getImageInfo(path) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: path,
        success: (res) => {
          // 尝试获取文件大小
          this.getFileStats(path)
            .then(stats => {
              resolve({
                ...res,
                originalSize: stats.size
              });
            })
            .catch(() => {
              // 如果获取文件大小失败，仍然返回图片信息
              resolve(res);
            });
        },
        fail: reject
      });
    });
  }

  /**
   * 获取文件状态
   */
  static getFileStats(filePath) {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      fs.stat({
        path: filePath,
        success: (res) => resolve(res),
        fail: (error) => reject(error)
      });
    });
  }

  /**
   * 批量转换图片
   */
  static async batchConvert(imagePaths, targetFormat, options = {}, progressCallback = null) {
    const results = [];
    const total = imagePaths.length;

    for (let i = 0; i < imagePaths.length; i++) {
      try {
        const result = await this.convertFormat(imagePaths[i], targetFormat, options);
        results.push(result);

        // 进度回调
        if (progressCallback) {
          progressCallback({
            current: i + 1,
            total: total,
            percent: Math.round(((i + 1) / total) * 100)
          });
        }
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          originalPath: imagePaths[i]
        });
      }
    }

    return results;
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes) {
    return FormatUtils.formatFileSize(bytes);
  }
}

module.exports = ImageFormatConverter;
