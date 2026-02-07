// pages/tools/signature/index.js
Page({
  data: {
    penColor: '#000000',
    penWidth: 4,
    bgColor: '#FFFFFF',
    hasSignature: false,
    canvas: null,
    ctx: null,
    isDrawing: false
  },

  onLoad(options) {
    // 延迟初始化，确保页面渲染完成
    setTimeout(() => {
      this.initCanvas();
    }, 500);
  },

  onReady() {
    // 备用初始化
    if (!this.data.ctx) {
      this.initCanvas();
    }
  },

  initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#signature-canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res && res[0] && res[0].node) {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const width = res[0].width;
          const height = res[0].height;

          console.log('Canvas 原始尺寸:', width, height);

          // 设置 canvas 尺寸
          const dpr = wx.getSystemInfoSync().pixelRatio;
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          ctx.scale(dpr, dpr);

          // 清空并设置白色背景
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          // 设置画笔样式 - 明确黑色粗笔画
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          this.setData({
            canvas: canvas,
            ctx: ctx
          });

          console.log('Canvas 初始化完成，背景白色，笔迹黑色，线宽5');
        } else {
          console.error('Canvas 初始化失败！');
        }
      });
  },

  touchStart(e) {
    if (!this.data.ctx) {
      console.log('Canvas 未初始化，无法绘制');
      wx.showToast({
        title: 'Canvas未初始化',
        icon: 'none'
      });
      return;
    }

    const touch = e.touches[0];
    const x = touch.x;
    const y = touch.y;

    console.log('开始绘制:', x, y);

    this.setData({
      isDrawing: true,
      hasSignature: true
    });

    this.data.ctx.beginPath();
    this.data.ctx.moveTo(x, y);
  },

  touchMove(e) {
    if (!this.data.isDrawing || !this.data.ctx) return;

    const touch = e.touches[0];
    const x = touch.x;
    const y = touch.y;

    this.data.ctx.lineTo(x, y);
    this.data.ctx.stroke();
  },

  touchEnd(e) {
    if (this.data.ctx) {
      this.data.ctx.closePath();
    }
    this.setData({
      isDrawing: false
    });
    console.log('绘制结束');
  },

  selectColor(e) {
    const color = e.currentTarget.dataset.color;
    this.setData({
      penColor: color
    });
    if (this.data.ctx) {
      this.data.ctx.strokeStyle = color;
      console.log('切换颜色:', color);
    }
  },

  selectWidth(e) {
    const width = parseInt(e.currentTarget.dataset.width);
    this.setData({
      penWidth: width
    });
    if (this.data.ctx) {
      this.data.ctx.lineWidth = width;
      console.log('切换线宽:', width);
    }
  },

  selectBackground(e) {
    const bg = e.currentTarget.dataset.bg;

    if (this.data.hasSignature) {
      wx.showModal({
        title: '提示',
        content: '更改背景会清除当前签名，是否继续？',
        success: (res) => {
          if (res.confirm) {
            this.setData({ bgColor: bg });
            this.clearCanvas();
          }
        }
      });
    } else {
      this.setData({ bgColor: bg });
    }
  },

  clearCanvas() {
    if (!this.data.ctx) return;

    const query = wx.createSelectorQuery();
    query.select('#signature-canvas')
      .fields({ size: true })
      .exec((res) => {
        if (res && res[0]) {
          const width = res[0].width;
          const height = res[0].height;

          if (this.data.bgColor === 'transparent') {
            this.data.ctx.clearRect(0, 0, width, height);
          } else {
            this.data.ctx.fillStyle = this.data.bgColor;
            this.data.ctx.fillRect(0, 0, width, height);
          }

          // 恢复画笔颜色
          this.data.ctx.strokeStyle = this.data.penColor;

          this.setData({
            hasSignature: false
          });

          wx.showToast({
            title: '已清除',
            icon: 'success',
            duration: 1500
          });
        }
      });
  },

  async saveAsImage() {
    if (!this.data.hasSignature) {
      wx.showToast({
        title: '请先签名',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    try {
      wx.showLoading({
        title: '生成中...',
        mask: true
      });

      const tempFilePath = await this.canvasToTempFile();

      wx.hideLoading();

      wx.showModal({
        title: '生成成功',
        content: '签名图片已生成，是否预览？',
        confirmText: '预览',
        cancelText: '关闭',
        success: (res) => {
          if (res.confirm) {
            wx.previewImage({
              urls: [tempFilePath],
              current: tempFilePath
            });
          }
        }
      });
    } catch (error) {
      wx.hideLoading();
      console.error('生成图片失败:', error);
      wx.showToast({
        title: '生成失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  async saveToAlbum() {
    if (!this.data.hasSignature) {
      wx.showToast({
        title: '请先签名',
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
        fileType: 'png',
        quality: 1,
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
