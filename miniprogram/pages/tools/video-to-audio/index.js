const FormatUtils = require('../../../utils/formatUtils.js');

Page({
  data: {
    videos: [],
    isConverting: false,
    convertProgress: 0,
    totalOriginalSize: 0,
    totalConvertedSize: 0,
    buttonText: '开始提取音频'
  },

  chooseVideos() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      maxDuration: 300,
      camera: 'back',
      success: (res) => {
        const file = res.tempFiles[0];
        if (file.size > 100 * 1024 * 1024) {
             wx.showToast({ title: '视频大小不能超过100MB', icon: 'none' });
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
            targetFormat: 'MP3'
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

  formatSize(size) {
    return FormatUtils.formatSize(size);
  },

  async startConvert() {
    if (this.data.videos.length === 0) return;
    if (this.data.isConverting) return;

    this.setData({ isConverting: true, convertProgress: 0 });
    wx.showLoading({ title: '正在提取...', mask: true });

    try {
      const video = this.data.videos[0];
      const result = await wx.cloud.callFunction({
        name: 'videoFormatConvert',
        data: {
          fileID: await this.uploadFile(video.path),
          targetFormat: 'mp3',
          fileName: 'audio.mp3'
        }
      });

      if (result.result && result.result.success) {
        const updatedVideo = { ...video, 
             convertedFileID: result.result.outputFileID,
             convertedSize: result.result.outputSize 
        };
        this.setData({ videos: [updatedVideo] });
        wx.showToast({ title: '提取成功', icon: 'success' });
      } else {
        throw new Error(result.result?.error || '转换失败');
      }
    } catch (err) {
      console.error(err);
      wx.showToast({ title: '提取失败: ' + err.message, icon: 'none' });
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
        wx.saveFile({
          tempFilePath: res.tempFilePath,
          success: (saveRes) => {
             wx.showToast({ title: '保存成功', icon: 'success' });
             wx.openDocument({
               filePath: saveRes.savedFilePath,
               showMenu: true
             });
          },
          fail: () => {
             // Fallback for saving if saveFile/openDocument isn't ideal for mp3 on all platforms, 
             // but user asked for "save". usually just opening it is fine or shareFile.
             wx.shareFileMessage({ filePath: res.tempFilePath });
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