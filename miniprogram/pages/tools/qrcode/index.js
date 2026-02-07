// pages/tools/qrcode/index.js
const QRCode = require('../../../utils/weapp-qrcode.js');

Page({
  data: {
    inputText: '',
    qrcodeGenerated: false,
    canvasSize: 260,
    canvas: null,
    ctx: null
  },

  onLoad(options) {
    this.initCanvas();
  },

  async initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#qrcode-canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res[0]) {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');

          const dpr = wx.getSystemInfoSync().pixelRatio;
          canvas.width = this.data.canvasSize * dpr;
          canvas.height = this.data.canvasSize * dpr;
          ctx.scale(dpr, dpr);

          this.setData({
            canvas: canvas,
            ctx: ctx
          });
        }
      });
  },

  onInput(e) {
    this.setData({
      inputText: e.detail.value
    });
  },

  generateQRCode() {
    const { inputText, ctx, canvasSize } = this.data;

    if (!inputText || inputText.trim() === '') {
      wx.showToast({
        title: '请输入内容',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (!ctx) {
      wx.showToast({
        title: 'Canvas初始化失败，请重试',
        icon: 'none',
        duration: 2000
      });
      this.initCanvas();
      return;
    }

    try {
      ctx.clearRect(0, 0, canvasSize, canvasSize);

      QRCode.drawQrcode({
        text: inputText,
        size: canvasSize,
        margin: 10,
        background: '#ffffff',
        foreground: '#000000',
        ctx: ctx,
        canvas: this.data.canvas
      });

      this.setData({
        qrcodeGenerated: true
      });

      wx.showToast({
        title: '生成成功',
        icon: 'success',
        duration: 1500
      });
    } catch (error) {
      console.error('生成二维码失败:', error);
      wx.showToast({
        title: '生成失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  async saveToAlbum() {
    if (!this.data.qrcodeGenerated) {
      wx.showToast({
        title: '请先生成二维码',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    try {
      const authResult = await this.checkPhotoAuth();
      if (!authResult) {
        return;
      }

      wx.showLoading({
        title: '保存中...',
        mask: true
      });

      const tempFilePath = await this.canvasToTempFile();

      await this.saveImageToPhotos(tempFilePath);

      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000
      });
    } catch (error) {
      wx.hideLoading();
      console.error('保存失败:', error);
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  checkPhotoAuth() {
    return new Promise((resolve, reject) => {
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
              success: () => {
                resolve(true);
              },
              fail: () => {
                resolve(false);
              }
            });
          }
        },
        fail: () => {
          reject(new Error('获取授权状态失败'));
        }
      });
    });
  },

  canvasToTempFile() {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas: this.data.canvas,
        success: (res) => {
          resolve(res.tempFilePath);
        },
        fail: (err) => {
          console.error('导出图片失败:', err);
          reject(new Error('导出图片失败'));
        }
      });
    });
  },

  saveImageToPhotos(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath: filePath,
        success: () => {
          resolve();
        },
        fail: (err) => {
          console.error('保存到相册失败:', err);
          reject(new Error('保存到相册失败'));
        }
      });
    });
  }
});
