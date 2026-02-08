// pages/tools/image-format/index.js

const converter = require('../../../utils/imageFormatConverter.js');
const { imageFormats, qualityPresets, resizeOptions } = require('../../../config/mediaFormats.js');

Page({
  data: {
    // 图片列表
    images: [],  // { path, originalSize, convertedPath, convertedSize, width, height, format }

    // 转换配置
    targetFormat: 'png',
    quality: 0.85,
    qualityPercent: 85,  // 显示用的百分比
    resizeIndex: 0,

    // 配置选项
    formatOptions: imageFormats,
    qualityPresets: qualityPresets,
    resizeOptions: resizeOptions,

    // 状态
    isConverting: false,
    convertProgress: 0,

    // 统计
    totalOriginalSize: 0,
    totalConvertedSize: 0,
    savingsPercent: 0
  },

  /**
   * 页面加载
   */
  onLoad(options) {
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
                  convertedPath: null,
                  convertedSize: null,
                  format: null
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
   * 选择目标格式
   */
  onFormatChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      targetFormat: this.data.formatOptions[index].value
    });
  },

  /**
   * 选择质量预设
   */
  selectQualityPreset(e) {
    const quality = parseFloat(e.currentTarget.dataset.quality);
    this.setData({
      quality: quality,
      qualityPercent: Math.round(quality * 100)
    });
  },

  /**
   * 调整质量滑块
   */
  onQualityChange(e) {
    const percent = parseFloat(e.detail.value);
    this.setData({
      quality: percent / 100,
      qualityPercent: Math.round(percent)
    });
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
   * 开始转换
   */
  async startConvert() {
    if (this.data.images.length === 0) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none'
      });
      return;
    }

    this.setData({ isConverting: true, convertProgress: 0 });

    try {
      // 获取转换选项
      const resizeOption = this.data.resizeOptions[this.data.resizeIndex];

      const options = {
        quality: this.data.quality,
        maxWidth: resizeOption.maxWidth,
        maxHeight: resizeOption.maxHeight
      };

      console.log('转换选项:', {
        targetFormat: this.data.targetFormat,
        ...options
      });

      // 批量转换
      const imagePaths = this.data.images.map(img => img.path);
      const results = await converter.batchConvert(
        imagePaths,
        this.data.targetFormat,
        options,
        (progress) => {
          this.setData({
            convertProgress: progress.percent
          });
        }
      );

      console.log('转换结果:', results);

      // 更新图片数据
      const updatedImages = this.data.images.map((img, index) => {
        const result = results[index];
        if (result.success) {
          return {
            ...img,
            convertedPath: result.filePath,
            convertedSize: result.convertedSize,
            format: result.format
          };
        }
        return img;
      });

      this.setData({
        images: updatedImages,
        isConverting: false
      });

      this.calculateTotalSize();

      wx.showToast({
        title: '转换完成',
        icon: 'success'
      });

    } catch (error) {
      console.error('转换失败:', error);
      this.setData({ isConverting: false });

      wx.showModal({
        title: '转换失败',
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

    if (!image.convertedPath) {
      wx.showToast({
        title: '请先转换图片',
        icon: 'none'
      });
      return;
    }

    // 检查权限
    const hasAuth = await this.checkPhotoAuth();
    if (!hasAuth) return;

    wx.showLoading({ title: '保存中...' });

    try {
      await this.saveImageToPhotos(image.convertedPath);
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
    const convertedImages = this.data.images.filter(img => img.convertedPath);

    if (convertedImages.length === 0) {
      wx.showToast({
        title: '请先转换图片',
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
      for (let img of convertedImages) {
        try {
          await this.saveImageToPhotos(img.convertedPath);
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
   * 清空列表
   */
  clearAll() {
    if (this.data.images.length === 0) {
      return;
    }

    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有图片吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            images: [],
            totalOriginalSize: 0,
            totalConvertedSize: 0,
            savingsPercent: 0
          });

          wx.showToast({
            title: '已清空',
            icon: 'success'
          });
        }
      }
    });
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
    const totalConverted = this.data.images.reduce(
      (sum, img) => sum + (img.convertedSize || 0), 0
    );

    const savingsPercent = totalOriginal > 0 && totalConverted > 0
      ? ((1 - totalConverted / totalOriginal) * 100).toFixed(1)
      : 0;

    this.setData({
      totalOriginalSize: totalOriginal,
      totalConvertedSize: totalConverted,
      savingsPercent: savingsPercent
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
      fs.stat({
        path: filePath,
        success: resolve,
        fail: reject
      });
    });
  },

  /**
   * 格式化文件大小
   */
  formatSize(bytes) {
    return converter.formatFileSize(bytes);
  }
});
