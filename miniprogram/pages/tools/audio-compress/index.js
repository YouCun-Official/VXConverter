// pages/tools/audio-compress/index.js

const FormatUtils = require('../../../utils/formatUtils.js');
const CONFIG = require('./config.js');

Page({
  data: {
    audios: [],

    quality: CONFIG.defaults.quality,
    resizeIndex: 0,
    formatIndex: 0,

    qualityPresets: CONFIG.qualityPresets,
    resizeOptions: CONFIG.resizeOptions,
    formatOptions: CONFIG.formatOptions,

    isCompressing: false,
    compressProgress: 0,

    totalOriginalSize: 0,
    totalCompressedSize: 0,
    overallRatio: 0
  },

  chooseAudios() {
    wx.chooseMessageFile({
      count: 5,
      type: 'file',
      success: async (res) => {
        const files = (res.tempFiles || []).filter(file => {
          const ext = this.getExtension(file.name || '');
          return FormatUtils.AUDIO_FORMATS.includes(ext);
        });

        if (files.length === 0) {
          wx.showToast({
            title: '未选择可用音频',
            icon: 'none'
          });
          return;
        }

        wx.showLoading({
          title: '加载中...',
          mask: true
        });

        try {
          const audios = files.map((file) => ({
            path: file.path,
            name: file.name,
            originalSize: file.size || 0,
            compressedFileID: '',
            compressedSize: null,
            ratio: null
          }));

          this.setData({
            audios: this.data.audios.concat(audios)
          });

          this.calculateTotalSize();

          wx.hideLoading();
          wx.showToast({
            title: `已添加 ${audios.length} 个音频`,
            icon: 'success'
          });
        } catch (error) {
          wx.hideLoading();
          wx.showToast({
            title: '加载音频失败',
            icon: 'none'
          });
        }
      },
      fail: (error) => {
        if (error && error.errMsg && error.errMsg.includes('cancel')) {
          return;
        }
        wx.showToast({
          title: '选择音频失败',
          icon: 'none'
        });
      }
    });
  },

  deleteAudio(e) {
    const index = e.currentTarget.dataset.index;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个音频吗？',
      success: (res) => {
        if (res.confirm) {
          const audios = this.data.audios;
          audios.splice(index, 1);

          this.setData({ audios });
          this.calculateTotalSize();

          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  onQualityChange(e) {
    this.setData({
      quality: parseFloat(e.detail.value)
    });
  },

  selectQualityPreset(e) {
    const quality = parseFloat(e.currentTarget.dataset.quality);
    this.setData({ quality });
  },

  onResizeChange(e) {
    this.setData({
      resizeIndex: parseInt(e.detail.value, 10)
    });
  },

  onFormatChange(e) {
    this.setData({
      formatIndex: parseInt(e.detail.value, 10)
    });
  },

  async startCompress() {
    if (this.data.audios.length === 0) {
      wx.showToast({
        title: '请先选择音频',
        icon: 'none'
      });
      return;
    }

    this.setData({ isCompressing: true, compressProgress: 0 });

    try {
      const bitrateOption = this.data.resizeOptions[this.data.resizeIndex];
      const formatOption = this.data.formatOptions[this.data.formatIndex];

      const options = {
        quality: this.data.quality,
        bitrate: bitrateOption.bitrate,
        format: formatOption.value
      };

      const results = [];
      for (let index = 0; index < this.data.audios.length; index++) {
        const audio = this.data.audios[index];
        const ext = this.getExtension(audio.name || '') || 'mp3';
        const fileName = `audio_${Date.now()}_${index}.${ext}`;
        const cloudPath = `audio-files/input/${fileName}`;

        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: audio.path
        });

        const callRes = await wx.cloud.callFunction({
          name: 'audioCompress',
          data: {
            fileID: uploadRes.fileID,
            fileName,
            ...options
          }
        });

        if (!callRes.result || !callRes.result.success) {
          throw new Error((callRes.result && callRes.result.error) || '云端压缩失败');
        }

        results.push({
          success: true,
          compressedFileID: callRes.result.outputFileID,
          compressedSize: callRes.result.outputSize || 0
        });

        this.setData({
          compressProgress: Math.round(((index + 1) / this.data.audios.length) * 100)
        });
      }

      const updatedAudios = this.data.audios.map((audio, index) => {
        const result = results[index];
        if (result.success) {
          const ratio = audio.originalSize > 0
            ? ((1 - result.compressedSize / audio.originalSize) * 100).toFixed(1)
            : '0.0';
          return {
            ...audio,
            compressedFileID: result.compressedFileID,
            compressedSize: result.compressedSize,
            ratio
          };
        }
        return audio;
      });

      this.setData({
        audios: updatedAudios,
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

  async saveSingleAudio(e) {
    const index = e.currentTarget.dataset.index;
    const audio = this.data.audios[index];

    if (!audio.compressedFileID) {
      wx.showToast({
        title: '请先压缩音频',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      await this.saveAudioToLocal(audio.compressedFileID, audio.name);
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

  async saveAllToLocal() {
    const compressedAudios = this.data.audios.filter(item => item.compressedFileID);

    if (compressedAudios.length === 0) {
      wx.showToast({
        title: '请先压缩音频',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    try {
      let successCount = 0;
      for (const item of compressedAudios) {
        try {
          await this.saveAudioToLocal(item.compressedFileID, item.name);
          successCount++;
        } catch (error) {
          console.error('保存音频失败:', error);
        }
      }

      wx.hideLoading();
      wx.showToast({
        title: `已保存 ${successCount} 个音频`,
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

  async saveAudioToLocal(fileID, originalName) {
    const fileURLRes = await wx.cloud.getTempFileURL({
      fileList: [fileID]
    });

    const tempUrl = fileURLRes.fileList[0].tempFileURL;
    const downloadRes = await wx.downloadFile({ url: tempUrl });

    if (downloadRes.statusCode !== 200) {
      throw new Error('下载失败');
    }

    const fs = wx.getFileSystemManager();
    const savedPath = `${wx.env.USER_DATA_PATH}/compressed_${Date.now()}_${originalName || 'audio.mp3'}`;

    return new Promise((resolve, reject) => {
      fs.saveFile({
        tempFilePath: downloadRes.tempFilePath,
        filePath: savedPath,
        success: () => resolve(savedPath),
        fail: reject
      });
    });
  },

  calculateTotalSize() {
    const totalOriginal = this.data.audios.reduce(
      (sum, item) => sum + (item.originalSize || 0), 0
    );
    const totalCompressed = this.data.audios.reduce(
      (sum, item) => sum + (item.compressedSize || 0), 0
    );

    const ratio = totalOriginal > 0 && totalCompressed > 0
      ? ((1 - totalCompressed / totalOriginal) * 100).toFixed(1)
      : 0;

    this.setData({
      totalOriginalSize: totalOriginal,
      totalCompressedSize: totalCompressed,
      overallRatio: ratio
    });
  },

  getExtension(fileName = '') {
    const matched = fileName.match(/\.([a-zA-Z0-9]+)$/);
    return matched ? matched[1].toLowerCase() : '';
  },

  formatSize(bytes) {
    return FormatUtils.formatFileSize(bytes || 0);
  }
});
