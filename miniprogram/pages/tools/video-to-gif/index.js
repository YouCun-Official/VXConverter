const FormatUtils = require('../../../utils/formatUtils.js');

Page({
  data: {
    videos: [],
    resolutionOptions: [
      { label: '480P (推荐)', value: '480p' },
      { label: '320P (小体积)', value: '320p' },
      { label: '保持原分辨率', value: 'original' }
    ],
    resolutionIndex: 0,
    fpsOptions: [
      { label: '低 (5帧/秒)', value: 5 },
      { label: '标准 (10帧/秒)', value: 10 },
      { label: '高 (15帧/秒)', value: 15 },
      { label: '流畅 (20帧/秒)', value: 20 }
    ],
    fpsIndex: 1,
    isConverting: false,
    convertProgress: 0
  },

  chooseVideos() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      maxDuration: 60, // Limit duration for GIF conversion as it can be slow/large
      camera: 'back',
      success: (res) => {
        const file = res.tempFiles[0];
        if (file.size > 50 * 1024 * 1024) {
             wx.showToast({ title: '视频大小不能超过50MB', icon: 'none' });
             return;
        }

        const path = file.tempFilePath;
        const ext = this.getExtension(path);

        const video = {
            path,
            thumbPath: file.thumbTempFilePath || '',
            originalSize: file.size || 0,
            duration: file.duration || 0,
            durationText: this.formatDuration(file.duration || 0),
            format: ext ? ext.toUpperCase() : 'UNKNOWN',
            convertedFileID: '',
            convertedSize: 0,
            targetFormat: 'GIF'
        };

        this.setData({
          videos: [video]
        });
      },
      fail: (err) => {
        console.log(err);
      }
    });
  },

  onResolutionChange(e) {
    this.setData({
      resolutionIndex: e.detail.value
    });
  },

  onFpsChange(e) {
    this.setData({
      fpsIndex: e.detail.value
    });
  },

  deleteVideo(e) {
    this.setData({ videos: [] });
  },

  getExtension(path) {
    return path.substring(path.lastIndexOf('.') + 1);
  },

  formatDuration(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
  },

  async startConvert() {
    if (this.data.videos.length === 0) return;
    if (this.data.isConverting) return;

    this.setData({ isConverting: true, convertProgress: 0 });
    wx.showLoading({ title: '正在转换...', mask: true });

    try {
      const video = this.data.videos[0];
      const resolution = this.data.resolutionOptions[this.data.resolutionIndex].value;
      const fps = this.data.fpsOptions[this.data.fpsIndex].value;

      const result = await wx.cloud.callFunction({
        name: 'videoFormatConvert',
        data: {
          fileID: await this.uploadFile(video.path),
          targetFormat: 'gif',
          resolution: resolution,
          fps: fps,
          fileName: 'animation.gif' 
        }
      });

      if (result.result && result.result.success) {
        const updatedVideo = { ...video, 
             convertedFileID: result.result.outputFileID,
             convertedSize: result.result.outputSize 
        };
        this.setData({ videos: [updatedVideo] });
        wx.showToast({ title: '转换成功', icon: 'success' });
      } else {
        throw new Error(result.result?.error || '转换失败');
      }
    } catch (err) {
      console.error(err);
      wx.showToast({ title: '转换失败: ' + err.message, icon: 'none' });
    } finally {
      this.setData({ isConverting: false });
      wx.hideLoading();
    }
  },

  async uploadFile(path) {
    const cloudPath = `temp/${Date.now()}-${Math.floor(Math.random() * 1000)}.mp4`;
    const res = await wx.cloud.uploadFile({
      cloudPath,
      filePath: path
    });
    return res.fileID;
  },

  saveSingleVideo() {
    const video = this.data.videos[0];
    if (!video || !video.convertedFileID) return;

    wx.cloud.downloadFile({
      fileID: video.convertedFileID,
      success: res => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
             wx.showToast({ title: '保存成功', icon: 'success' });
          },
          fail: (err) => {
             console.error(err);
             wx.showToast({ title: '保存失败', icon: 'none' });
             // Preview if save fails (e.g. no permission)
             wx.previewImage({
                 urls: [res.tempFilePath]
             });
          }
        });
      },
      fail: () => {
        wx.showToast({ title: '下载失败', icon: 'none' });
      }
    });
  },
  
  clearAll() {
      this.setData({ videos: [] });
  }

});