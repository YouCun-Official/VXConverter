// pages/tools/pdf-to-image/index.js

Page({
  data: {
    // PDF文件
    pdfFile: null,  // { tempFilePath, name, size, fileID }
    pageCount: 0,   // 总页数

    // 转换设置
    pageMode: 'all',      // all: 全部页面, custom: 自定义
    customPages: '',      // 自定义页码字符串
    outputFormat: 'png',  // png 或 jpg
    quality: 2,           // 1:低, 2:中, 3:高
    qualityText: '中',

    // 转换状态
    isConverting: false,
    convertProgress: 0,

    // 转换结果
    convertedImages: []  // [{ page, cloudPath, tempUrl, size }]
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

        wx.showLoading({ title: '分析PDF...' });

        try {
          // 上传PDF到云存储
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: `pdf-to-image/input/${Date.now()}_${file.name}`,
            filePath: file.path
          });

          // 调用云函数获取页数
          const getInfoRes = await wx.cloud.callFunction({
            name: 'pdfToImage',
            data: {
              action: 'getPageCount',
              fileID: uploadRes.fileID
            }
          });

          wx.hideLoading();

          if (getInfoRes.result.success) {
            const pageCount = getInfoRes.result.pageCount;

            this.setData({
              pdfFile: {
                tempFilePath: file.path,
                name: file.name,
                size: file.size,
                fileID: uploadRes.fileID
              },
              pageCount: pageCount,
              convertedImages: []
            });

            wx.showToast({
              title: `PDF共${pageCount}页`,
              icon: 'success'
            });
          } else {
            throw new Error(getInfoRes.result.error);
          }

        } catch (error) {
          wx.hideLoading();
          console.error('文件处理失败:', error);
          wx.showToast({
            title: '文件处理失败',
            icon: 'none'
          });
        }
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
            pageCount: 0,
            convertedImages: []
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
   * 页面模式切换
   */
  onPageModeChange(e) {
    this.setData({
      pageMode: e.detail.value
    });
  },

  /**
   * 自定义页码输入
   */
  onCustomPagesInput(e) {
    this.setData({
      customPages: e.detail.value
    });
  },

  /**
   * 输出格式切换
   */
  onFormatChange(e) {
    this.setData({
      outputFormat: e.detail.value
    });
  },

  /**
   * 质量调整
   */
  onQualityChange(e) {
    const quality = parseInt(e.detail.value);
    const qualityMap = {
      1: '低',
      2: '中',
      3: '高'
    };

    this.setData({
      quality: quality,
      qualityText: qualityMap[quality]
    });
  },

  /**
   * 解析自定义页码
   */
  parseCustomPages() {
    const { customPages, pageCount } = this.data;
    const pages = [];

    if (!customPages.trim()) {
      return null;
    }

    try {
      // 分割逗号
      const parts = customPages.split(',');

      for (let part of parts) {
        part = part.trim();

        if (part.includes('-')) {
          // 范围：1-5
          const [start, end] = part.split('-').map(s => parseInt(s.trim()));
          if (isNaN(start) || isNaN(end) || start > end || start < 1 || end > pageCount) {
            throw new Error('页码范围无效');
          }
          for (let i = start; i <= end; i++) {
            pages.push(i);
          }
        } else {
          // 单页：1
          const page = parseInt(part);
          if (isNaN(page) || page < 1 || page > pageCount) {
            throw new Error('页码无效');
          }
          pages.push(page);
        }
      }

      // 去重并排序
      return [...new Set(pages)].sort((a, b) => a - b);

    } catch (error) {
      wx.showToast({
        title: error.message || '页码格式错误',
        icon: 'none'
      });
      return null;
    }
  },

  /**
   * 开始转换
   */
  async startConvert() {
    if (!this.data.pdfFile) {
      wx.showToast({
        title: '请先选择PDF文件',
        icon: 'none'
      });
      return;
    }

    const { pageMode, pageCount, quality, outputFormat } = this.data;

    // 确定要转换的页码
    let pages;
    if (pageMode === 'all') {
      pages = Array.from({ length: pageCount }, (_, i) => i + 1);
    } else {
      pages = this.parseCustomPages();
      if (!pages || pages.length === 0) {
        wx.showToast({
          title: '请输入有效的页码',
          icon: 'none'
        });
        return;
      }
    }

    // 确认转换
    wx.showModal({
      title: '确认转换',
      content: `将转换 ${pages.length} 页为 ${outputFormat.toUpperCase()} 格式`,
      success: async (res) => {
        if (res.confirm) {
          await this.executeConvert(pages);
        }
      }
    });
  },

  /**
   * 执行转换
   */
  async executeConvert(pages) {
    this.setData({
      isConverting: true,
      convertProgress: 0,
      convertedImages: []
    });

    wx.showLoading({ title: '转换中 0%' });

    try {
      // 质量映射：1->72dpi, 2->150dpi, 3->300dpi
      const dpiMap = { 1: 72, 2: 150, 3: 300 };
      const dpi = dpiMap[this.data.quality];

      // 调用云函数转换
      const cloudRes = await wx.cloud.callFunction({
        name: 'pdfToImage',
        data: {
          action: 'convert',
          fileID: this.data.pdfFile.fileID,
          pages: pages,
          format: this.data.outputFormat,
          dpi: dpi
        }
      });

      wx.hideLoading();

      if (cloudRes.result.success) {
        this.setData({
          isConverting: false,
          convertProgress: 100,
          convertedImages: cloudRes.result.images
        });

        wx.showModal({
          title: '转换成功',
          content: `已生成 ${cloudRes.result.images.length} 张图片`,
          showCancel: false
        });
      } else {
        throw new Error(cloudRes.result.error || '转换失败');
      }

    } catch (error) {
      console.error('转换失败:', error);

      wx.hideLoading();
      this.setData({ isConverting: false });

      wx.showModal({
        title: '转换失败',
        content: error.message || '请重试',
        showCancel: false
      });
    }
  },

  /**
   * 预览图片
   */
  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    const urls = this.data.convertedImages.map(img => img.tempUrl);

    wx.previewImage({
      urls: urls,
      current: urls[index]
    });
  },

  /**
   * 保存单张图片
   */
  async saveImage(e) {
    const index = e.currentTarget.dataset.index;
    const image = this.data.convertedImages[index];

    wx.showLoading({ title: '保存中...' });

    try {
      // 下载图片
      const downloadRes = await wx.cloud.downloadFile({
        fileID: image.cloudPath
      });

      // 保存到相册
      await wx.saveImageToPhotosAlbum({
        filePath: downloadRes.tempFilePath
      });

      wx.hideLoading();

      wx.showToast({
        title: '已保存到相册',
        icon: 'success'
      });

    } catch (error) {
      wx.hideLoading();

      if (error.errMsg && error.errMsg.includes('auth deny')) {
        wx.showModal({
          title: '需要授权',
          content: '请授权保存图片到相册',
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
   * 全部保存
   */
  async saveAllImages() {
    const images = this.data.convertedImages;

    if (images.length === 0) {
      return;
    }

    wx.showModal({
      title: '保存全部图片',
      content: `确定要保存全部 ${images.length} 张图片到相册吗？`,
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '保存中...' });

          let successCount = 0;
          let failCount = 0;

          for (let i = 0; i < images.length; i++) {
            try {
              const downloadRes = await wx.cloud.downloadFile({
                fileID: images[i].cloudPath
              });

              await wx.saveImageToPhotosAlbum({
                filePath: downloadRes.tempFilePath
              });

              successCount++;
            } catch (error) {
              console.error('保存失败:', error);
              failCount++;
            }

            // 更新进度
            wx.showLoading({
              title: `保存中 ${i + 1}/${images.length}`
            });
          }

          wx.hideLoading();

          wx.showModal({
            title: '保存完成',
            content: `成功：${successCount}张，失败：${failCount}张`,
            showCancel: false
          });
        }
      }
    });
  },

  /**
   * 分享图片
   */
  shareImages() {
    wx.showToast({
      title: '请长按图片分享',
      icon: 'none'
    });
  }
});
