// pages/tools/video-compress/index.js

const FormatUtils = require('../../../utils/formatUtils.js');
const CONFIG = require('./config.js');

Page({
  data: {
    // 视频列表
    videos: [],  // { path, originalSize, compressedFileID, compressedSize, ratio }

    // 压缩配置
    quality: CONFIG.defaults.quality,
    resolutionIndex: 0, // 选中的分辨率选项索引
    bitrateIndex: 0, // 选中的码率选项索引

    // 配置选项
    qualityPresets: CONFIG.qualityPresets,
    resolutionOptions: CONFIG.resolutionOptions,
    bitrateOptions: CONFIG.bitrateOptions,

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
   * 选择视频
   */
  chooseVideos() {
    wx.chooseMedia({
      count: 3,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      maxDuration: 300,
      camera: 'back',
      success: (res) => {
        const selected = (res.tempFiles || []).filter(file => file.size <= 100 * 1024 * 1024);
        const rejectedCount = (res.tempFiles || []).length - selected.length;

        const videos = selected.map(file => {
          const path = file.tempFilePath;

          return {
            path,
            thumbPath: file.thumbTempFilePath || '',
            originalSize: file.size || 0,
            duration: file.duration || 0,
            durationText: this.formatDuration(file.duration || 0),
            width: file.width || 0,
            height: file.height || 0,
            compressedFileID: '',
            compressedSize: 0,
            ratio: null
          };
        });

        if (videos.length === 0) {
          wx.showToast({
            title: rejectedCount > 0 ? '所选视频超过100MB' : '未选择视频',
            icon: 'none'
          });
          return;
        }

        this.setData({
          videos: this.data.videos.concat(videos)
        });

        this.calculateTotalSize();

        const suffix = rejectedCount > 0 ? `，${rejectedCount}个超限已跳过` : '';
        wx.showToast({
          title: `已添加${videos.length}个视频${suffix}`,
          icon: 'none'
        });
      },
      fail: (error) => {
        if (error && error.errMsg && error.errMsg.includes('cancel')) {
          return;
        }
        wx.showToast({
          title: '选择视频失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 删除视频
   */
  deleteVideo(e) {
    const index = e.currentTarget.dataset.index;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个视频吗？',
      success: (res) => {
        if (res.confirm) {
          const videos = this.data.videos;
          videos.splice(index, 1);

          this.setData({ videos });
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
   * 选择质量预设
   */
  selectQualityPreset(e) {
    const quality = e.currentTarget.dataset.quality;
    this.setData({ quality });
  },

  /**
   * 调整分辨率选项
   */
  onResolutionChange(e) {
    this.setData({
      resolutionIndex: parseInt(e.detail.value)
    });
  },

  /**
   * 调整码率选项
   */
  onBitrateChange(e) {
    this.setData({
      bitrateIndex: parseInt(e.detail.value)
    });
  },

  /**
   * 开始压缩
   */
  async startCompress() {
    if (this.data.videos.length === 0) {
      wx.showToast({
        title: '请先选择视频',
        icon: 'none'
      });
      return;
    }

    this.setData({ isCompressing: true, compressProgress: 0 });

    try {
      // 获取压缩选项
      const resolutionOption = this.data.resolutionOptions[this.data.resolutionIndex];
      const bitrateOption = this.data.bitrateOptions[this.data.bitrateIndex];

      const options = {
        quality: this.data.quality,
        resolution: resolutionOption.value,
        bitrate: bitrateOption.value
      };

      console.log('压缩选项:', options);

      // 批量压缩
      const total = this.data.videos.length;
      const updatedVideos = [...this.data.videos];

      for (let index = 0; index < updatedVideos.length; index++) {
        const video = updatedVideos[index];
        const fileName = `video_compressed_${Date.now()}_${index}.mp4`;
        const cloudPath = `video-files/input/${fileName}`;

        // 上传文件到云存储
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: video.path
        });

        // 调用云函数进行压缩
        const callRes = await wx.cloud.callFunction({
          name: 'videoCompress',
          data: {
            fileID: uploadRes.fileID,
            fileName,
            ...options
          }
        });

        if (!callRes.result || !callRes.result.success) {
          throw new Error((callRes.result && callRes.result.error) || '云端压缩失败');
        }

        // 计算压缩比例
        const ratio = video.originalSize > 0
          ? ((1 - callRes.result.outputSize / video.originalSize) * 100).toFixed(1)
          : 0;

        updatedVideos[index] = {
          ...video,
          compressedFileID: callRes.result.outputFileID,
          compressedSize: callRes.result.outputSize || 0,
          ratio: ratio
        };

        const progress = Math.round(((index + 1) / total) * 100);

        this.setData({
          videos: updatedVideos,
          compressProgress: progress
        });
      }

      this.calculateTotalSize();

      this.setData({
        isCompressing: false
      });

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
   * 保存单个视频
   */
  async saveSingleVideo(e) {
    const index = e.currentTarget.dataset.index;
    const video = this.data.videos[index];

    if (!video || !video.compressedFileID) {
      wx.showToast({
        title: '请先压缩视频',
        icon: 'none'
      });
      return;
    }

    // 检查权限
    const hasAuth = await this.checkVideoAuth();
    if (!hasAuth) return;

    wx.showLoading({ title: '保存中...' });

    try {
      await this.saveVideoByFileID(video.compressedFileID);
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
    const compressedVideos = this.data.videos.filter(v => v.compressedFileID);

    if (compressedVideos.length === 0) {
      wx.showToast({
        title: '请先压缩视频',
        icon: 'none'
      });
      return;
    }

    // 检查权限
    const hasAuth = await this.checkVideoAuth();
    if (!hasAuth) return;

    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    try {
      let successCount = 0;
      for (let video of compressedVideos) {
        try {
          await this.saveVideoByFileID(video.compressedFileID);
          successCount++;
        } catch (error) {
          console.error('保存视频失败:', error);
        }
      }

      wx.hideLoading();
      wx.showToast({
        title: `已保存 ${successCount} 个视频`,
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
   * 根据FileID保存视频
   */
  async saveVideoByFileID(fileID) {
    // 获取临时下载链接
    const fileURLRes = await wx.cloud.getTempFileURL({
      fileList: [fileID]
    });

    const tempUrl = fileURLRes.fileList[0].tempFileURL;

    // 下载文件
    const downloadRes = await wx.downloadFile({
      url: tempUrl
    });

    if (downloadRes.statusCode !== 200) {
      throw new Error('下载失败');
    }

    // 保存到相册
    await wx.saveVideoToPhotosAlbum({
      filePath: downloadRes.tempFilePath
    });
  },

  /**
   * 检查相册权限
   */
  checkVideoAuth() {
    return new Promise((resolve) => {
      wx.getSetting({
        success: (res) => {
          const authKey = 'scope.writePhotosAlbum';
          if (res.authSetting[authKey]) {
            resolve(true);
            return;
          }

          if (res.authSetting[authKey] === false) {
            wx.showModal({
              title: '需要授权',
              content: '需要您授权保存视频到相册',
              confirmText: '去设置',
              success: (modalRes) => {
                if (!modalRes.confirm) {
                  resolve(false);
                  return;
                }
                wx.openSetting({
                  success: (settingRes) => {
                    resolve(!!settingRes.authSetting[authKey]);
                  },
                  fail: () => resolve(false)
                });
              }
            });
            return;
          }

          wx.authorize({
            scope: authKey,
            success: () => resolve(true),
            fail: () => {
              wx.showModal({
                title: '需要授权',
                content: '需要您授权保存视频到相册',
                showCancel: false
              });
              resolve(false);
            }
          });
        },
        fail: () => resolve(false)
      });
    });
  },

  /**
   * 计算总体大小
   */
  calculateTotalSize() {
    const totalOriginal = this.data.videos.reduce(
      (sum, v) => sum + (v.originalSize || 0), 0
    );
    const totalCompressed = this.data.videos.reduce(
      (sum, v) => sum + (v.compressedSize || 0), 0
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
   * 格式化时长
   */
  formatDuration(duration) {
    const totalSeconds = Math.floor(duration);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  },

  /**
   * 格式化文件大小（用于显示）
   */
  formatSize(bytes) {
    return FormatUtils.formatFileSize(bytes);
  }
});
