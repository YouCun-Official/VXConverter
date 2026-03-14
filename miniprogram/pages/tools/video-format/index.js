// pages/tools/video-format/index.js

const FormatUtils = require('../../../utils/formatUtils.js');
const { videoFormats } = require('../../../config/mediaFormats.js');

const qualityOptions = [
  { label: '高质量', value: 'high' },
  { label: '标准', value: 'standard' },
  { label: '压缩', value: 'compress' }
];

const resolutionOptions = [
  { label: '保持原分辨率', value: 'original' },
  { label: '1920x1080 (1080P)', value: '1080p' },
  { label: '1280x720 (720P)', value: '720p' },
  { label: '854x480 (480P)', value: '480p' }
];

Page({
  data: {
    videos: [],
    formatOptions: videoFormats,
    qualityOptions,
    resolutionOptions,
    targetFormatIndex: 0,
    targetFormat: videoFormats[0].value,
    qualityPreset: 'standard',
    resolutionIndex: 0,
    isConverting: false,
    convertProgress: 0,
    totalOriginalSize: 0,
    totalConvertedSize: 0,
    savingsPercent: 0
  },

  chooseVideos() {
    wx.chooseMedia({
      count: 3,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      maxDuration: 120,
      camera: 'back',
      success: (res) => {
        const selected = (res.tempFiles || []).filter(file => file.size <= 100 * 1024 * 1024);
        const rejectedCount = (res.tempFiles || []).length - selected.length;

        const videos = selected.map(file => {
          const path = file.tempFilePath;
          const ext = this.getExtension(path);

          return {
            path,
            thumbPath: file.thumbTempFilePath || '',
            originalSize: file.size || 0,
            duration: file.duration || 0,
            durationText: this.formatDuration(file.duration || 0),
            format: ext ? ext.toUpperCase() : 'UNKNOWN',
            convertedFileID: '',
            convertedSize: 0,
            targetFormat: ''
          };
        });

        if (videos.length === 0) {
          wx.showToast({
            title: '未选择可用视频',
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

  deleteVideo(e) {
    const index = e.currentTarget.dataset.index;
    const videos = this.data.videos;
    videos.splice(index, 1);

    this.setData({ videos });
    this.calculateTotalSize();
  },

  clearAll() {
    this.setData({
      videos: [],
      totalOriginalSize: 0,
      totalConvertedSize: 0,
      savingsPercent: 0
    });
  },

  onFormatChange(e) {
    const index = parseInt(e.detail.value, 10);
    this.setData({
      targetFormatIndex: index,
      targetFormat: this.data.formatOptions[index].value
    });
  },

  selectQualityPreset(e) {
    this.setData({
      qualityPreset: e.currentTarget.dataset.quality
    });
  },

  onResolutionChange(e) {
    this.setData({
      resolutionIndex: parseInt(e.detail.value, 10)
    });
  },

  async startConvert() {
    if (this.data.videos.length === 0) {
      wx.showToast({
        title: '请先选择视频',
        icon: 'none'
      });
      return;
    }

    this.setData({
      isConverting: true,
      convertProgress: 0
    });

    const resolution = this.data.resolutionOptions[this.data.resolutionIndex].value;
    const total = this.data.videos.length;
    const updatedVideos = [...this.data.videos];

    try {
      for (let index = 0; index < updatedVideos.length; index++) {
        const video = updatedVideos[index];

        // 演示模式：模拟格式转换结果
        // 注意：视频格式转换需要大量时间和计算资源，云函数环境有60秒时间限制
        // 实际项目中需要使用专门的视频处理服务器或第三方API

        // 模拟转换后的文件大小（根据目标格式和质量）
        let sizeFactor = 1.0;

        // 根据目标格式调整大小
        const targetFormat = this.data.targetFormat.toLowerCase();
        if (targetFormat === 'mp3') {
          // 转音频，大幅减小
          sizeFactor = 0.1;
        } else if (targetFormat === 'gif') {
          // 转GIF，可能增大
          sizeFactor = 0.8;
        } else if (targetFormat === 'mp4') {
          sizeFactor = 0.9;
        } else if (targetFormat === 'mov') {
          sizeFactor = 1.1;
        } else if (targetFormat === 'avi') {
          sizeFactor = 1.2;
        }

        // 根据质量调整
        if (this.data.qualityPreset === 'high') {
          sizeFactor *= 1.1;
        } else if (this.data.qualityPreset === 'compress') {
          sizeFactor *= 0.7;
        }

        // 根据分辨率调整
        if (resolution === '1080p') {
          sizeFactor *= 1.0;
        } else if (resolution === '720p') {
          sizeFactor *= 0.7;
        } else if (resolution === '480p') {
          sizeFactor *= 0.4;
        }

        const simulatedSize = Math.floor(video.originalSize * sizeFactor);

        // 生成演示用的文件ID
        const demoFileID = `demo_converted_${Date.now()}_${index}`;

        updatedVideos[index] = {
          ...video,
          convertedFileID: demoFileID,
          convertedSize: simulatedSize,
          targetFormat: (this.data.targetFormat || '').toUpperCase()
        };

        const progress = Math.round(((index + 1) / total) * 100);

        this.setData({
          videos: updatedVideos,
          convertProgress: progress
        });

        // 模拟处理时间
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      this.calculateTotalSize();

      this.setData({
        isConverting: false
      });

      wx.showToast({
        title: '转换完成',
        icon: 'success'
      });
    } catch (error) {
      this.setData({
        isConverting: false
      });

      wx.showModal({
        title: '转换失败',
        content: error.message || '请稍后重试',
        showCancel: false
      });
    }
  },

  async saveSingleVideo(e) {
    const index = e.currentTarget.dataset.index;
    const video = this.data.videos[index];

    if (!video || !video.convertedFileID) {
      wx.showToast({ title: '请先转换视频', icon: 'none' });
      return;
    }

    // 检测演示模式
    if (video.convertedFileID.startsWith('demo_')) {
      wx.showModal({
        title: '演示模式说明',
        content: '视频格式转换功能需要专业的视频处理服务器支持。当前显示的是演示效果。\n\n实际应用中，建议使用：\n• 腾讯云点播服务\n• 阿里云视频处理\n• 或其他专业视频处理API',
        showCancel: false,
        confirmText: '我知道了'
      });
      return;
    }

    const hasAuth = await this.checkVideoAuth();
    if (!hasAuth) return;

    wx.showLoading({ title: '保存中...' });

    try {
      await this.saveVideoByFileID(video.convertedFileID);
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  async saveAllToAlbum() {
    const converted = this.data.videos.filter(item => item.convertedFileID);
    if (converted.length === 0) {
      wx.showToast({ title: '请先转换视频', icon: 'none' });
      return;
    }

    // 检测演示模式
    const hasDemoFiles = converted.some(v => v.convertedFileID.startsWith('demo_'));
    if (hasDemoFiles) {
      wx.showModal({
        title: '演示模式说明',
        content: '视频格式转换功能需要专业的视频处理服务器支持。当前显示的是演示效果。\n\n实际应用中，建议使用：\n• 腾讯云点播服务\n• 阿里云视频处理\n• 或其他专业视频处理API',
        showCancel: false,
        confirmText: '我知道了'
      });
      return;
    }

    const hasAuth = await this.checkVideoAuth();
    if (!hasAuth) return;

    wx.showLoading({ title: '保存中...', mask: true });

    let successCount = 0;
    for (const item of converted) {
      try {
        await this.saveVideoByFileID(item.convertedFileID);
        successCount++;
      } catch (error) {
        console.error('保存视频失败:', error);
      }
    }

    wx.hideLoading();
    wx.showToast({ title: `已保存 ${successCount} 个视频`, icon: 'success' });
  },

  async saveVideoByFileID(fileID) {
    const fileURLRes = await wx.cloud.getTempFileURL({
      fileList: [fileID]
    });

    const tempUrl = fileURLRes.fileList[0].tempFileURL;

    const downloadRes = await wx.downloadFile({
      url: tempUrl
    });

    if (downloadRes.statusCode !== 200) {
      throw new Error('下载失败');
    }

    await wx.saveVideoToPhotosAlbum({
      filePath: downloadRes.tempFilePath
    });
  },

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
            fail: () => resolve(false)
          });
        },
        fail: () => resolve(false)
      });
    });
  },

  calculateTotalSize() {
    const totalOriginal = this.data.videos.reduce((sum, item) => sum + (item.originalSize || 0), 0);
    const totalConverted = this.data.videos.reduce((sum, item) => sum + (item.convertedSize || 0), 0);
    const savingsPercent = totalOriginal > 0 && totalConverted > 0
      ? ((1 - totalConverted / totalOriginal) * 100).toFixed(1)
      : 0;

    this.setData({
      totalOriginalSize: totalOriginal,
      totalConvertedSize: totalConverted,
      savingsPercent
    });
  },

  getExtension(filePath = '') {
    const matched = filePath.match(/\.([a-zA-Z0-9]+)$/);
    return matched ? matched[1].toLowerCase() : '';
  },

  formatDuration(duration) {
    const totalSeconds = Math.floor(duration);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  },

  formatSize(bytes) {
    return FormatUtils.formatFileSize(bytes || 0);
  }
});
