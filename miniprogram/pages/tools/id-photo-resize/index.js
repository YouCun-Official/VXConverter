// pages/tools/id-photo-resize/index.js

const CONFIG = require('./config.js');

Page({
  data: {
    // 规格配置
    photoSpecs: CONFIG.ID_PHOTO_SPECS,
    backgroundColors: CONFIG.BACKGROUND_COLORS,
    dpiOptions: CONFIG.DPI_OPTIONS,
    qualityOptions: CONFIG.QUALITY_OPTIONS,

    // 当前选择
    selectedSpecIndex: 0,
    selectedBackgroundIndex: 0,
    selectedDpiIndex: 0,
    selectedQualityIndex: 0,

    // 图片数据
    originalImage: null, // 原始图片路径
    processedImage: null, // 处理后的图片路径
    imageInfo: null, // 图片信息

    // 自定义尺寸
    customWidth: 35,
    customHeight: 45,
    showCustomInput: false,

    // 裁剪区域
    cropArea: {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    },

    // 状态
    isProcessing: false,
    hasImage: false,
    showPreview: false,

    // 文件大小
    originalSize: 0,
    processedSize: 0
  },

  /**
   * 页面加载
   */
  onLoad(options) {
    // 初始化
    this.updateCurrentSpec();
  },

  /**
   * 选择图片
   */
  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        wx.showLoading({
          title: '加载中...',
          mask: true
        });

        try {
          const tempFilePath = res.tempFilePaths[0];
          
          // 获取图片信息
          const imageInfo = await this.getImageInfo(tempFilePath);
          
          // 获取文件大小
          const fileStats = await this.getFileStats(tempFilePath);

          this.setData({
            originalImage: tempFilePath,
            processedImage: null,
            imageInfo: imageInfo,
            hasImage: true,
            originalSize: fileStats.size,
            processedSize: 0
          });

          // 自动处理图片
          await this.processImage();

          wx.hideLoading();
        } catch (error) {
          console.error('加载图片失败:', error);
          wx.hideLoading();
          wx.showToast({
            title: '加载图片失败',
            icon: 'none'
          });
        }
      }
    });
  },

  /**
   * 选择照片规格
   */
  onSpecChange(e) {
    const index = parseInt(e.detail.value);
    const spec = this.data.photoSpecs[index];
    
    this.setData({
      selectedSpecIndex: index,
      showCustomInput: spec.isCustom
    });

    this.updateCurrentSpec();

    // 如果已有图片，重新处理
    if (this.data.hasImage) {
      this.processImage();
    }
  },

  /**
   * 选择背景色
   */
  onBackgroundChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      selectedBackgroundIndex: index
    });

    // 如果已有图片，重新处理
    if (this.data.hasImage) {
      this.processImage();
    }
  },

  /**
   * 选择DPI
   */
  onDpiChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      selectedDpiIndex: index
    });
  },

  /**
   * 选择质量
   */
  onQualityChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      selectedQualityIndex: index
    });
  },

  /**
   * 自定义宽度输入
   */
  onCustomWidthInput(e) {
    const width = parseFloat(e.detail.value) || 35;
    this.setData({
      customWidth: width
    });
  },

  /**
   * 自定义高度输入
   */
  onCustomHeightInput(e) {
    const height = parseFloat(e.detail.value) || 45;
    this.setData({
      customHeight: height
    });
  },

  /**
   * 应用自定义尺寸
   */
  applyCustomSize() {
    if (this.data.hasImage) {
      this.processImage();
    }
  },

  /**
   * 更新当前规格信息
   */
  updateCurrentSpec() {
    const spec = this.data.photoSpecs[this.data.selectedSpecIndex];
    const dpi = this.data.dpiOptions[this.data.selectedDpiIndex];

    let targetWidth, targetHeight;
    
    if (spec.isCustom) {
      // 自定义尺寸，根据mm和DPI计算像素
      targetWidth = Math.round((this.data.customWidth / 25.4) * dpi.value);
      targetHeight = Math.round((this.data.customHeight / 25.4) * dpi.value);
    } else {
      // 标准规格，根据DPI调整
      const scale = dpi.value / 300;
      targetWidth = Math.round(spec.widthPX * scale);
      targetHeight = Math.round(spec.heightPX * scale);
    }

    this.setData({
      currentSpecWidth: targetWidth,
      currentSpecHeight: targetHeight
    });
  },

  /**
   * 处理图片
   */
  async processImage() {
    if (!this.data.originalImage) {
      return;
    }

    this.setData({
      isProcessing: true
    });

    wx.showLoading({
      title: '处理中...',
      mask: true
    });

    try {
      // 更新规格
      this.updateCurrentSpec();

      const spec = this.data.photoSpecs[this.data.selectedSpecIndex];
      const background = this.data.backgroundColors[this.data.selectedBackgroundIndex];
      const quality = this.data.qualityOptions[this.data.selectedQualityIndex];

      const targetWidth = this.data.currentSpecWidth;
      const targetHeight = this.data.currentSpecHeight;

      // 创建Canvas
      const canvas = wx.createOffscreenCanvas({
        type: '2d',
        width: targetWidth,
        height: targetHeight
      });
      const ctx = canvas.getContext('2d');

      // 绘制背景色
      if (background.color) {
        ctx.fillStyle = background.color;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      } else {
        // 白色背景（确保JPG格式正常）
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      // 加载原始图片
      const img = canvas.createImage();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = this.data.originalImage;
      });

      // 计算裁剪区域（智能居中裁剪）
      const imageRatio = this.data.imageInfo.width / this.data.imageInfo.height;
      const targetRatio = targetWidth / targetHeight;

      let sourceX, sourceY, sourceWidth, sourceHeight;

      if (imageRatio > targetRatio) {
        // 图片更宽，裁剪左右
        sourceHeight = this.data.imageInfo.height;
        sourceWidth = sourceHeight * targetRatio;
        sourceX = (this.data.imageInfo.width - sourceWidth) / 2;
        sourceY = 0;
      } else {
        // 图片更高，裁剪上下
        sourceWidth = this.data.imageInfo.width;
        sourceHeight = sourceWidth / targetRatio;
        sourceX = 0;
        sourceY = (this.data.imageInfo.height - sourceHeight) / 2;
      }

      // 绘制图片
      ctx.drawImage(
        img,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, targetWidth, targetHeight
      );

      // 导出图片
      const tempFilePath = canvas.toTempFilePathSync({
        quality: quality.value,
        fileType: 'jpg'
      });

      // 获取处理后文件大小
      const fileStats = await this.getFileStats(tempFilePath);

      this.setData({
        processedImage: tempFilePath,
        processedSize: fileStats.size,
        isProcessing: false
      });

      wx.hideLoading();
      wx.showToast({
        title: '处理完成',
        icon: 'success'
      });
    } catch (error) {
      console.error('处理图片失败:', error);
      this.setData({
        isProcessing: false
      });
      wx.hideLoading();
      wx.showToast({
        title: '处理失败',
        icon: 'none'
      });
    }
  },

  /**
   * 预览图片
   */
  previewImage(e) {
    const src = e.currentTarget.dataset.src;
    if (src) {
      wx.previewImage({
        urls: [src],
        current: src
      });
    }
  },

  /**
   * 保存图片
   */
  async saveImage() {
    if (!this.data.processedImage) {
      wx.showToast({
        title: '请先处理图片',
        icon: 'none'
      });
      return;
    }

    try {
      // 请求保存到相册权限
      const authResult = await wx.getSetting();
      
      if (!authResult.authSetting['scope.writePhotosAlbum']) {
        await wx.authorize({ scope: 'scope.writePhotosAlbum' });
      }

      // 保存到相册
      await wx.saveImageToPhotosAlbum({
        filePath: this.data.processedImage
      });

      wx.showToast({
        title: '已保存到相册',
        icon: 'success'
      });
    } catch (error) {
      console.error('保存图片失败:', error);
      
      if (error.errMsg && error.errMsg.includes('auth')) {
        wx.showModal({
          title: '需要权限',
          content: '需要您授权保存图片到相册',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
      } else {
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
    }
  },

  /**
   * 重新选择图片
   */
  reselect() {
    this.setData({
      originalImage: null,
      processedImage: null,
      imageInfo: null,
      hasImage: false,
      originalSize: 0,
      processedSize: 0
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
   * 获取文件信息
   */
  getFileStats(path) {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      fs.stat({
        path: path,
        success: resolve,
        fail: reject
      });
    });
  },

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes < 1024) {
      return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(2) + ' KB';
    } else {
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: '证件照调尺寸 - 快速制作标准证件照',
      path: '/pages/tools/id-photo-resize/index'
    };
  }
});
