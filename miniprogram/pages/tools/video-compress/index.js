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
      success: async (res) => {
        const selected = (res.tempFiles || []).filter(file => file.size <= 100 * 1024 * 1024);
        const rejectedCount = (res.tempFiles || []).length - selected.length;

        if (selected.length === 0) {
          wx.showToast({
            title: rejectedCount > 0 ? '所选视频超过100MB' : '未选择视频',
            icon: 'none'
          });
          return;
        }

        const videos = await Promise.all(selected.map(async (file) => {
          const path = file.tempFilePath;
          let width = file.width || 0;
          let height = file.height || 0;
          let duration = file.duration || 0;
          let thumbPath = file.thumbTempFilePath || '';

          // wx.chooseMedia 在真机上 width/height 常为 0，用 getVideoInfo 补全
          // 注意：开发者工具模拟器需安装 FFmpeg 插件，真机无此限制
          if (!width || !height || !duration) {
            try {
              const info = await new Promise((resolve, reject) => {
                wx.getVideoInfo({
                  src: path,
                  success: resolve,
                  fail: reject
                });
              });
              width = info.width || width;
              height = info.height || height;
              duration = info.duration || duration;
              console.log('获取视频信息成功:', { width, height, duration });
            } catch (e) {
              // 模拟器无 FFmpeg 时会失败，真机正常
              console.warn('获取视频信息失败(开发工具正常，真机会自动获取):', e);
            }
          }

          return {
            path,
            thumbPath,
            originalSize: file.size || 0,
            duration,
            durationText: this.formatDuration(duration),
            width,
            height,
            compressedFileID: '',
            compressedSize: 0,
            ratio: null
          };
        }));

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

        // 演示模式：模拟压缩结果
        // 注意：视频转换需要大量时间和计算资源，云函数环境有60秒时间限制
        // 实际项目中需要使用专门的视频处理服务器或第三方API

        // 模拟压缩后的文件大小（根据质量预设）
        let compressionFactor = 0.7; // 默认压缩到70%
        if (options.quality === 'high') {
          compressionFactor = 0.85;
        } else if (options.quality === 'low' || options.quality === 'ultralow') {
          compressionFactor = 0.5;
        }

        const simulatedSize = Math.floor(video.originalSize * compressionFactor);
        const ratio = ((1 - compressionFactor) * 100).toFixed(1);

        // 生成演示用的文件ID
        const demoFileID = `demo_compressed_${Date.now()}_${index}`;

        updatedVideos[index] = {
          ...video,
          compressedFileID: demoFileID,
          compressedSize: simulatedSize,
          ratio: ratio
        };

        const progress = Math.round(((index + 1) / total) * 100);

        this.setData({
          videos: updatedVideos,
          compressProgress: progress
        });

        // 模拟处理时间
        await new Promise(resolve => setTimeout(resolve, 500));
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

    // 检测演示模式
    if (video.compressedFileID.startsWith('demo_')) {
      wx.showModal({
        title: '演示模式说明',
        content: '视频压缩功能需要专业的视频处理服务器支持。当前显示的是演示效果。\n\n实际应用中，建议使用：\n• 腾讯云点播服务\n• 阿里云视频处理\n• 或其他专业视频处理API',
        showCancel: false,
        confirmText: '我知道了'
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

    // 检测演示模式
    const hasDemoFiles = compressedVideos.some(v => v.compressedFileID.startsWith('demo_'));
    if (hasDemoFiles) {
      wx.showModal({
        title: '演示模式说明',
        content: '视频压缩功能需要专业的视频处理服务器支持。当前显示的是演示效果。\n\n实际应用中，建议使用：\n• 腾讯云点播服务\n• 阿里云视频处理\n• 或其他专业视频处理API',
        showCancel: false,
        confirmText: '我知道了'
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
