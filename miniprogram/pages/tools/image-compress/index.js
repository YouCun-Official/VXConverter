// pages/tools/image-compress/index.js

const compressor = require('../../../utils/imageCompressor.js');
const CONFIG = require('./config.js');

Page({
  data: {
    // 图片列表
    images: [],  // { path, originalSize, compressedPath, compressedSize, ratio }

    // 压缩配置
    quality: CONFIG.defaults.quality,
    resizeIndex: 0, // 选中的尺寸选项索引
    formatIndex: 0, // 选中的格式选项索引

    // 配置选项
    qualityPresets: CONFIG.qualityPresets,
    resizeOptions: CONFIG.resizeOptions,
    formatOptions: CONFIG.formatOptions,

    // 状态
    isCompressing: false,
    compressProgress: 0,

    // 统计
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    overallRatio: 0
  },

  /**
   * 页面加载
   */
  onLoad() {
    // 初始化
  },

  /**
   * 选择图片
   */
  chooseImages() {
    wx.chooseImage({
      count: 9,
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePaths = res.tempFilePaths;

        wx.showLoading({
          title: '加载中...',
          mask: true
        });

        try {
          // 获取图片信息
          const images = await Promise.all(
            tempFilePaths.map(async (path) => {
              try {
                const info = await this.getImageInfo(path);
                const stats = await this.getFileStats(path);

                return {
                  path: path,
                  width: info.width,
                  height: info.height,
                  originalSize: stats.size,
                  compressedPath: null,
                  compressedSize: null,
                  ratio: null
                };
              } catch (error) {
                console.error('获取图片信息失败:', error);
                return null;
              }
            })
          );

          // 过滤掉失败的图片
          const validImages = images.filter(img => img !== null);

          this.setData({
            images: this.data.images.concat(validImages)
          });

          this.calculateTotalSize();

          wx.hideLoading();
          wx.showToast({
            title: `已添加 ${validImages.length} 张图片`,
            icon: 'success'
          });
        } catch (error) {
          wx.hideLoading();
          wx.showToast({
            title: '加载图片失败',
            icon: 'none'
          });
        }
      },
      fail: (error) => {
        console.error('选择图片失败:', error);
      }
    });
  },

  /**
   * 删除图片
   */
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张图片吗？',
      success: (res) => {
        if (res.confirm) {
          const images = this.data.images;
          images.splice(index, 1);

          this.setData({ images });
          this.calculateTotalSize();

          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 调整压缩质量
   */
  onQualityChange(e) {
    this.setData({
      quality: parseFloat(e.detail.value)
    });
  },

  /**
   * 选择质量预设
   */
  selectQualityPreset(e) {
    const quality = parseFloat(e.currentTarget.dataset.quality);
    this.setData({ quality });
  },

  /**
   * 调整尺寸选项
   */
  onResizeChange(e) {
    this.setData({
      resizeIndex: parseInt(e.detail.value)
    });
  },

  /**
   * 调整格式选项
   */
  onFormatChange(e) {
    this.setData({
      formatIndex: parseInt(e.detail.value)
    });
  },

  /**
   * 开始压缩
   */
  async startCompress() {
    if (this.data.images.length === 0) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none'
      });
      return;
    }

    this.setData({ isCompressing: true, compressProgress: 0 });

    try {
      // 获取压缩选项
      const resizeOption = this.data.resizeOptions[this.data.resizeIndex];
      const formatOption = this.data.formatOptions[this.data.formatIndex];

      const options = {
        quality: this.data.quality,
        resize: resizeOption.value,
        format: formatOption.value,
        maxWidth: resizeOption.maxWidth,
        maxHeight: resizeOption.maxHeight
      };

      console.log('压缩选项:', options);

      // 批量压缩
      const imagePaths = this.data.images.map(img => img.path);
      const results = await compressor.batchCompressImages(
        imagePaths,
        options,
        (progress) => {
          this.setData({
            compressProgress: progress.percent
          });
        }
      );

      console.log('压缩结果:', results);

      // 更新图片数据
      const updatedImages = this.data.images.map((img, index) => {
        const result = results[index];
        if (result.success) {
          return {
            ...img,
            compressedPath: result.compressedPath,
            compressedSize: result.compressedSize,
            ratio: result.compressionRatio
          };
        }
        return img;
      });

      this.setData({
        images: updatedImages,
        isCompressing: false
      });

      this.calculateTotalSize();

      wx.showToast({
        title: '压缩完成',
        icon: 'success'
      });

    } catch (error) {
      console.error('压缩失败:', error);
      this.setData({ isCompressing: false });

      wx.showModal({
        title: '压缩失败',
        content: error.message || '请重试',
        showCancel: false
      });
    }
  },

  /**
   * 保存单张图片
   */
  async saveSingleImage(e) {
    const index = e.currentTarget.dataset.index;
    const image = this.data.images[index];

    if (!image.compressedPath) {
      wx.showToast({
        title: '请先压缩图片',
        icon: 'none'
      });
      return;
    }

    // 检查权限
    const hasAuth = await this.checkPhotoAuth();
    if (!hasAuth) return;

    wx.showLoading({ title: '保存中...' });

    try {
      await this.saveImageToPhotos(image.compressedPath);
      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  /**
   * 保存全部到相册
   */
  async saveAllToAlbum() {
    const compressedImages = this.data.images.filter(img => img.compressedPath);

    if (compressedImages.length === 0) {
      wx.showToast({
        title: '请先压缩图片',
        icon: 'none'
      });
      return;
    }

    // 检查权限
    const hasAuth = await this.checkPhotoAuth();
    if (!hasAuth) return;

    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    try {
      let successCount = 0;
      for (let img of compressedImages) {
        try {
          await this.saveImageToPhotos(img.compressedPath);
          successCount++;
        } catch (error) {
          console.error('保存图片失败:', error);
        }
      }

      wx.hideLoading();
      wx.showToast({
        title: `已保存 ${successCount} 张图片`,
        icon: 'success'
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  /**
   * 检查相册权限
   */
  checkPhotoAuth() {
    return new Promise((resolve) => {
      wx.getSetting({
        success: (res) => {
          if (res.authSetting['scope.writePhotosAlbum']) {
            resolve(true);
          } else if (res.authSetting['scope.writePhotosAlbum'] === false) {
            wx.showModal({
              title: '需要授权',
              content: '需要您授权保存图片到相册',
              confirmText: '去设置',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.openSetting({
                    success: (settingRes) => {
                      if (settingRes.authSetting['scope.writePhotosAlbum']) {
                        resolve(true);
                      } else {
                        resolve(false);
                      }
                    },
                    fail: () => {
                      resolve(false);
                    }
                  });
                } else {
                  resolve(false);
                }
              }
            });
          } else {
            wx.authorize({
              scope: 'scope.writePhotosAlbum',
              success: () => resolve(true),
              fail: () => {
                wx.showModal({
                  title: '需要授权',
                  content: '需要您授权保存图片到相册',
                  showCancel: false
                });
                resolve(false);
              }
            });
          }
        },
        fail: () => resolve(false)
      });
    });
  },

  /**
   * 保存图片到相册
   */
  saveImageToPhotos(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath: filePath,
        success: resolve,
        fail: reject
      });
    });
  },

  /**
   * 计算总体大小
   */
  calculateTotalSize() {
    const totalOriginal = this.data.images.reduce(
      (sum, img) => sum + (img.originalSize || 0), 0
    );
    const totalCompressed = this.data.images.reduce(
      (sum, img) => sum + (img.compressedSize || 0), 0
    );

    const ratio = totalOriginal > 0
      ? ((1 - totalCompressed / totalOriginal) * 100).toFixed(1)
      : 0;

    this.setData({
      totalOriginalSize: totalOriginal,
      totalCompressedSize: totalCompressed,
      overallRatio: ratio
    });
  },

  /**
   * 获取图片信息
   */
  getImageInfo(path) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: path,
        success: resolve,
        fail: reject
      });
    });
  },

  /**
   * 获取文件状态
   */
  getFileStats(filePath) {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      try {
        const stats = fs.statSync(filePath);
        resolve(stats);
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * 格式化文件大小（用于显示）
   */
  formatSize(bytes) {
    return compressor.formatFileSize(bytes);
  }
});
