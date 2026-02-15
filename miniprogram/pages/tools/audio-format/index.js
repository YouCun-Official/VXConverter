// pages/tools/audio-format/index.js

const FormatUtils = require('../../../utils/formatUtils.js');
const { audioFormats } = require('../../../config/mediaFormats.js');

const qualityOptions = [
  { label: '高音质', value: 'high' },
  { label: '标准', value: 'standard' },
  { label: '压缩', value: 'compress' }
];

const bitrateOptions = [
  { label: '保持原比特率', value: 'original' },
  { label: '320 kbps', value: '320k' },
  { label: '256 kbps', value: '256k' },
  { label: '192 kbps', value: '192k' },
  { label: '128 kbps', value: '128k' },
  { label: '96 kbps', value: '96k' }
];

Page({
  data: {
    audios: [],
    formatOptions: audioFormats,
    qualityOptions,
    bitrateOptions,
    targetFormatIndex: 0,
    targetFormat: audioFormats[0].value,
    qualityPreset: 'standard',
    bitrateIndex: 0,
    isConverting: false,
    convertProgress: 0,
    totalOriginalSize: 0,
    totalConvertedSize: 0,
    savingsPercent: 0
  },

  /**
   * 选择音频文件
   */
  chooseAudios() {
    wx.chooseMessageFile({
      count: 5,
      type: 'file',
      success: (res) => {
        // 过滤音频文件
        const audioFiles = res.tempFiles.filter(file => {
          const ext = this.getExtension(file.name);
          return FormatUtils.AUDIO_FORMATS.includes(ext);
        });

        // 过滤大小限制
        const selected = audioFiles.filter(file => file.size <= 50 * 1024 * 1024);
        const rejectedCount = audioFiles.length - selected.length;

        const audios = selected.map(file => {
          const ext = this.getExtension(file.name);

          return {
            path: file.path,
            name: file.name,
            originalSize: file.size || 0,
            duration: 0,
            durationText: '--:--',
            format: ext ? ext.toUpperCase() : 'UNKNOWN',
            convertedFileID: '',
            convertedSize: 0,
            targetFormat: ''
          };
        });

        if (audios.length === 0) {
          wx.showToast({
            title: rejectedCount > 0 ? '文件超限或格式不支持' : '未选择可用音频',
            icon: 'none'
          });
          return;
        }

        this.setData({
          audios: this.data.audios.concat(audios)
        });

        this.calculateTotalSize();

        const suffix = rejectedCount > 0 ? `，${rejectedCount}个超限已跳过` : '';
        wx.showToast({
          title: `已添加${audios.length}个音频${suffix}`,
          icon: 'none'
        });

        // 获取音频信息
        this.loadAudioInfo();
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

  /**
   * 获取音频信息
   */
  async loadAudioInfo() {
    const audios = [...this.data.audios];
    let hasUpdate = false;

    for (let i = 0; i < audios.length; i++) {
      if (audios[i].duration === 0) {
        try {
          const info = await this.getAudioInfo(audios[i].path);
          audios[i].duration = info.duration;
          audios[i].durationText = this.formatDuration(info.duration);
          hasUpdate = true;
        } catch (error) {
          console.error('获取音频信息失败:', error);
        }
      }
    }

    if (hasUpdate) {
      this.setData({ audios });
    }
  },

  /**
   * 获取音频信息
   */
  getAudioInfo(path) {
    return new Promise((resolve, reject) => {
      const innerAudioContext = wx.createInnerAudioContext();
      innerAudioContext.src = path;

      innerAudioContext.onCanplay(() => {
        const duration = innerAudioContext.duration;
        innerAudioContext.destroy();
        resolve({ duration });
      });

      innerAudioContext.onError((error) => {
        innerAudioContext.destroy();
        reject(error);
      });
    });
  },

  /**
   * 删除音频
   */
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

  /**
   * 清空列表
   */
  clearAll() {
    if (this.data.audios.length === 0) {
      return;
    }

    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有音频吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            audios: [],
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
   * 选择目标格式
   */
  onFormatChange(e) {
    const index = parseInt(e.detail.value, 10);
    this.setData({
      targetFormatIndex: index,
      targetFormat: this.data.formatOptions[index].value
    });
  },

  /**
   * 选择质量预设
   */
  selectQualityPreset(e) {
    this.setData({
      qualityPreset: e.currentTarget.dataset.quality
    });
  },

  /**
   * 选择比特率
   */
  onBitrateChange(e) {
    this.setData({
      bitrateIndex: parseInt(e.detail.value, 10)
    });
  },

  /**
   * 开始转换
   */
  async startConvert() {
    if (this.data.audios.length === 0) {
      wx.showToast({
        title: '请先选择音频',
        icon: 'none'
      });
      return;
    }

    this.setData({
      isConverting: true,
      convertProgress: 0
    });

    const bitrate = this.data.bitrateOptions[this.data.bitrateIndex].value;
    const total = this.data.audios.length;
    const updatedAudios = [...this.data.audios];

    try {
      for (let index = 0; index < updatedAudios.length; index++) {
        const audio = updatedAudios[index];
        const fileName = `audio_${Date.now()}_${index}.${this.getExtension(audio.name) || 'mp3'}`;
        const cloudPath = `audio-files/input/${fileName}`;

        // 上传文件到云存储
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: audio.path
        });

        // 调用云函数进行转换
        const callRes = await wx.cloud.callFunction({
          name: 'audioFormatConvert',
          data: {
            fileID: uploadRes.fileID,
            fileName,
            targetFormat: this.data.targetFormat,
            qualityPreset: this.data.qualityPreset,
            bitrate
          }
        });

        if (!callRes.result || !callRes.result.success) {
          throw new Error((callRes.result && callRes.result.error) || '云端转换失败');
        }

        updatedAudios[index] = {
          ...audio,
          convertedFileID: callRes.result.outputFileID,
          convertedSize: callRes.result.outputSize || 0,
          targetFormat: (this.data.targetFormat || '').toUpperCase()
        };

        const progress = Math.round(((index + 1) / total) * 100);

        this.setData({
          audios: updatedAudios,
          convertProgress: progress
        });
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
      console.error('转换失败:', error);

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

  /**
   * 保存单个音频
   */
  async saveSingleAudio(e) {
    const index = e.currentTarget.dataset.index;
    const audio = this.data.audios[index];

    if (!audio || !audio.convertedFileID) {
      wx.showToast({
        title: '请先转换音频',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      await this.saveAudioByFileID(audio.convertedFileID, audio.name);
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
   * 保存全部到本地
   */
  async saveAllToLocal() {
    const converted = this.data.audios.filter(item => item.convertedFileID);

    if (converted.length === 0) {
      wx.showToast({
        title: '请先转换音频',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    let successCount = 0;
    for (const item of converted) {
      try {
        await this.saveAudioByFileID(item.convertedFileID, item.name);
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
  },

  /**
   * 根据FileID保存音频
   */
  async saveAudioByFileID(fileID, originalName) {
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

    // 保存到本地
    const fs = wx.getFileSystemManager();
    const savedFileName = `converted_${originalName}`;
    const savedPath = `${wx.env.USER_DATA_PATH}/${savedFileName}`;

    return new Promise((resolve, reject) => {
      fs.saveFile({
        tempFilePath: downloadRes.tempFilePath,
        filePath: savedPath,
        success: () => {
          wx.showModal({
            title: '保存成功',
            content: `文件已保存至：${savedPath}`,
            showCancel: false
          });
          resolve(savedPath);
        },
        fail: reject
      });
    });
  },

  /**
   * 计算总体大小
   */
  calculateTotalSize() {
    const totalOriginal = this.data.audios.reduce(
      (sum, item) => sum + (item.originalSize || 0),
      0
    );
    const totalConverted = this.data.audios.reduce(
      (sum, item) => sum + (item.convertedSize || 0),
      0
    );
    const savingsPercent = totalOriginal > 0 && totalConverted > 0
      ? ((1 - totalConverted / totalOriginal) * 100).toFixed(1)
      : 0;

    this.setData({
      totalOriginalSize: totalOriginal,
      totalConvertedSize: totalConverted,
      savingsPercent
    });
  },

  /**
   * 获取文件扩展名
   */
  getExtension(fileName = '') {
    const matched = fileName.match(/\.([a-zA-Z0-9]+)$/);
    return matched ? matched[1].toLowerCase() : '';
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
   * 格式化文件大小
   */
  formatSize(bytes) {
    return FormatUtils.formatFileSize(bytes || 0);
  }
});
