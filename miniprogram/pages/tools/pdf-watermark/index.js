// pages/tools/pdf-watermark/index.js

Page({
  data: {
    // PDF文件
    pdfFile: null,  // { tempFilePath, name, size, pageCount }

    // 水印设置
    watermarkText: '机密文件',  // 水印文字
    fontSize: 60,               // 字体大小
    opacity: 0.3,               // 透明度
    opacityPercent: 30,         // 透明度百分比（用于显示）
    color: '#999999',           // 颜色
    rotation: 45,               // 旋转角度
    positionIndex: 2,           // 位置索引

    // 位置选项
    positionOptions: [
      { label: '左上角', value: 'top-left' },
      { label: '顶部居中', value: 'top-center' },
      { label: '右上角', value: 'top-right' },
      { label: '左侧居中', value: 'middle-left' },
      { label: '正中央', value: 'center' },
      { label: '右侧居中', value: 'middle-right' },
      { label: '左下角', value: 'bottom-left' },
      { label: '底部居中', value: 'bottom-center' },
      { label: '右下角', value: 'bottom-right' },
      { label: '平铺', value: 'tile' }
    ],

    // 颜色选项
    colorOptions: [
      { label: '灰色', value: '#999999' },
      { label: '红色', value: '#ef4444' },
      { label: '蓝色', value: '#3b82f6' },
      { label: '绿色', value: '#16a34a' },
      { label: '黑色', value: '#000000' }
    ],

    // 处理状态
    isProcessing: false,
    processProgress: 0,

    // 结果
    resultFileID: null
  },

  /**
   * 页面加载
   */
  onLoad(options) {
    // 初始化
  },

  /**
   * 选择PDF文件
   */
  choosePDF() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf'],
      success: async (res) => {
        const file = res.tempFiles[0];

        // 检查文件类型
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          wx.showToast({
            title: '请选择PDF文件',
            icon: 'none'
          });
          return;
        }

        // 检查文件大小（限制50MB）
        if (file.size > 50 * 1024 * 1024) {
          wx.showToast({
            title: '文件不能超过50MB',
            icon: 'none'
          });
          return;
        }

        this.setData({
          pdfFile: {
            tempFilePath: file.path,
            name: file.name,
            size: file.size
          },
          resultFileID: null
        });

        wx.showToast({
          title: '文件已选择',
          icon: 'success'
        });
      },
      fail: (error) => {
        console.error('选择文件失败:', error);
      }
    });
  },

  /**
   * 删除PDF文件
   */
  deletePDF() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除已选择的PDF文件吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            pdfFile: null,
            resultFileID: null
          });

          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 水印文字输入
   */
  onWatermarkInput(e) {
    this.setData({
      watermarkText: e.detail.value
    });
  },

  /**
   * 字体大小调整
   */
  onFontSizeChange(e) {
    this.setData({
      fontSize: parseInt(e.detail.value)
    });
  },

  /**
   * 透明度调整
   */
  onOpacityChange(e) {
    const percent = parseFloat(e.detail.value);
    this.setData({
      opacity: percent / 100,
      opacityPercent: Math.round(percent)
    });
  },

  /**
   * 旋转角度调整
   */
  onRotationChange(e) {
    this.setData({
      rotation: parseInt(e.detail.value)
    });
  },

  /**
   * 选择位置
   */
  onPositionChange(e) {
    this.setData({
      positionIndex: parseInt(e.detail.value)
    });
  },

  /**
   * 选择颜色
   */
  onColorChange(e) {
    this.setData({
      color: e.currentTarget.dataset.color
    });
  },

  /**
   * 预设水印样式
   */
  applyPreset(e) {
    const preset = e.currentTarget.dataset.preset;

    const presets = {
      confidential: {
        watermarkText: '机密文件',
        fontSize: 60,
        opacity: 0.3,
        opacityPercent: 30,
        color: '#ef4444',
        rotation: 45,
        positionIndex: 9  // 平铺
      },
      draft: {
        watermarkText: '草稿',
        fontSize: 80,
        opacity: 0.2,
        opacityPercent: 20,
        color: '#999999',
        rotation: 45,
        positionIndex: 9
      },
      sample: {
        watermarkText: '样本',
        fontSize: 70,
        opacity: 0.25,
        opacityPercent: 25,
        color: '#3b82f6',
        rotation: 45,
        positionIndex: 9
      },
      copy: {
        watermarkText: '副本',
        fontSize: 50,
        opacity: 0.3,
        opacityPercent: 30,
        color: '#16a34a',
        rotation: 0,
        positionIndex: 4  // 中央
      }
    };

    if (presets[preset]) {
      this.setData(presets[preset]);

      wx.showToast({
        title: '已应用预设',
        icon: 'success'
      });
    }
  },

  /**
   * 开始添加水印
   */
  async startAddWatermark() {
    // 验证
    if (!this.data.pdfFile) {
      wx.showToast({
        title: '请先选择PDF文件',
        icon: 'none'
      });
      return;
    }

    if (!this.data.watermarkText.trim()) {
      wx.showToast({
        title: '请输入水印文字',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认添加水印',
      content: `将为 ${this.data.pdfFile.name} 添加水印`,
      success: async (res) => {
        if (res.confirm) {
          await this.addWatermark();
        }
      }
    });
  },

  /**
   * 添加水印
   */
  async addWatermark() {
    this.setData({ isProcessing: true, processProgress: 0 });

    wx.showLoading({
      title: '上传中...',
      mask: true
    });

    try {
      // 1. 上传PDF到云存储
      this.setData({ processProgress: 20 });

      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `pdf-watermark/input/${Date.now()}_${this.data.pdfFile.name}`,
        filePath: this.data.pdfFile.tempFilePath
      });

      // 2. 调用云函数添加水印
      wx.showLoading({ title: '添加水印中...' });
      this.setData({ processProgress: 50 });

      const position = this.data.positionOptions[this.data.positionIndex].value;

      const cloudRes = await wx.cloud.callFunction({
        name: 'pdfWatermark',
        data: {
          fileID: uploadRes.fileID,
          watermarkText: this.data.watermarkText,
          fontSize: this.data.fontSize,
          opacity: this.data.opacity,
          color: this.data.color,
          rotation: this.data.rotation,
          position: position
        }
      });

      wx.hideLoading();

      if (cloudRes.result.success) {
        this.setData({
          isProcessing: false,
          processProgress: 100,
          resultFileID: cloudRes.result.fileID
        });

        wx.showModal({
          title: '添加成功',
          content: '已为PDF添加水印',
          showCancel: false
        });
      } else {
        throw new Error(cloudRes.result.error || '添加水印失败');
      }

    } catch (error) {
      console.error('添加水印失败:', error);

      wx.hideLoading();
      this.setData({ isProcessing: false });

      wx.showModal({
        title: '添加失败',
        content: error.message || '请重试',
        showCancel: false
      });
    }
  },

  /**
   * 下载带水印的PDF
   */
  async downloadResult() {
    if (!this.data.resultFileID) {
      wx.showToast({
        title: '请先添加水印',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '准备下载...' });

    try {
      // 下载文件
      const downloadRes = await wx.cloud.downloadFile({
        fileID: this.data.resultFileID
      });

      wx.hideLoading();

      // 打开文件
      wx.openDocument({
        filePath: downloadRes.tempFilePath,
        fileType: 'pdf',
        showMenu: true,
        success: () => {
          console.log('打开PDF成功');
        },
        fail: (error) => {
          console.error('打开PDF失败:', error);
          wx.showToast({
            title: '打开失败',
            icon: 'none'
          });
        }
      });

    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: '下载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 格式化文件大小
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  }
});
