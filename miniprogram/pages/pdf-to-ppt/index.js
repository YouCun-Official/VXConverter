// pages/pdf-to-ppt/index.js

Page({
  data: {
    // PDF文件
    pdfFile: null,  // { tempFilePath, name, size, fileID }
    pageCount: 0,   // 总页数

    // 转换设置
    pageMode: 'all',      // all: 全部页面, custom: 自定义
    customPages: '',      // 自定义页码字符串
    quality: 2,           // 1:低, 2:中, 3:高
    qualityText: '中',
    dpi: 150,             // 默认DPI

    // 转换状态
    isConverting: false,
    convertProgress: 0,

    // 转换结果
    convertedFile: null // { fileID, tempUrl }
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
            cloudPath: `pdf-to-ppt/input/${Date.now()}_${file.name}`,
            filePath: file.path
          });

          // 调用云函数获取页数
          const getInfoRes = await wx.cloud.callFunction({
            name: 'pdfToPpt',
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
              convertedFile: null,
              customPages: '' // 重置自定义页码
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
          console.error('上传或分析失败:', error);
          wx.showToast({
            title: '上传失败: ' + (error.message || '未知错误'),
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        // 用户取消选择不做提示
        if (err.errMsg.indexOf('cancel') === -1) {
          console.error('选择文件失败:', err);
        }
      }
    });
  },

  /**
   * 更换PDF文件
   */
  deletePDF() {
    this.setData({
      pdfFile: null,
      pageCount: 0,
      convertedFile: null
    });
  },

  /**
   * 页面模式改变
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
   * 质量改变
   */
  onQualityChange(e) {
    const value = e.detail.value;
    let text = '中';
    let dpi = 150;
    
    if (value === 1) {
      text = '低';
      dpi = 72;
    } else if (value === 3) {
      text = '高';
      dpi = 300;
    }

    this.setData({
      quality: value,
      qualityText: text,
      dpi: dpi
    });
  },

  /**
   * 开始转换
   */
  async startConvert() {
    if (this.data.isConverting) return;

    // 解析要转换的页码
    let pagesToConvert = [];
    if (this.data.pageMode === 'all') {
      pagesToConvert = Array.from({length: this.data.pageCount}, (_, i) => i + 1);
    } else {
      // 解析自定义页码字符串 "1,3,5-8"
      const parts = this.data.customPages.split(',');
      const pages = new Set();
      
      for (const part of parts) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(Number);
          if (!isNaN(start) && !isNaN(end) && start <= end) {
            for (let i = start; i <= end; i++) {
              if (i >= 1 && i <= this.data.pageCount) {
                pages.add(i);
              }
            }
          }
        } else {
          const num = Number(part);
          if (!isNaN(num) && num >= 1 && num <= this.data.pageCount) {
            pages.add(num);
          }
        }
      }
      
      pagesToConvert = Array.from(pages).sort((a, b) => a - b);
      
      if (pagesToConvert.length === 0) {
        wx.showToast({
          title: '请输入有效的页码',
          icon: 'none'
        });
        return;
      }
    }

    let progressTimer;
    this.setData({
      isConverting: true,
      convertProgress: 0
    });

    try {
      // 模拟进度条
      progressTimer = setInterval(() => {
        if (this.data.convertProgress < 90) {
          this.setData({
            convertProgress: this.data.convertProgress + 2
          });
        }
      }, 500);

      // 调用云函数转换
      const res = await wx.cloud.callFunction({
        name: 'pdfToPpt',
        data: {
          action: 'convert',
          fileID: this.data.pdfFile.fileID,
          pages: pagesToConvert,
          dpi: this.data.dpi,
          quality: this.data.quality
        }
      });

      clearInterval(progressTimer);

      if (res.result.success) {
        this.setData({
          convertProgress: 100,
          isConverting: false,
          convertedFile: {
            fileID: res.result.fileID,
            tempUrl: res.result.tempUrl
          }
        });

        wx.showToast({
          title: '转换成功',
          icon: 'success'
        });
      } else {
        throw new Error(res.result.error);
      }

    } catch (error) {
      if (progressTimer) clearInterval(progressTimer);
      console.error('转换失败:', error);
      this.setData({
        isConverting: false,
        convertProgress: 0
      });
      wx.showToast({
        title: '转换失败: ' + (error.message || '未知错误'),
        icon: 'none'
      });
    }
  },

  /**
   * 下载PPT文件
   */
  downloadPpt() {
    if (!this.data.convertedFile) return;

    wx.showLoading({ title: '下载中...' });

    const fileUrl = this.data.convertedFile.tempUrl;
    
    // 如果已有tempUrl，尝试直接用downloadFile下载，然后openDocument
    // 注意：PPT文件可能需要由第三方应用打开，在小程序中直接预览可能不支持
    // 这里我们先下载到本地，然后使用 openDocument
    
    // 或者直接复制链接
    wx.setClipboardData({
      data: fileUrl,
      success: () => {
        wx.showToast({
          title: '链接已复制',
          icon: 'success'
        });
      }
    });

    // 尝试保存文件流程
    wx.downloadFile({
      url: fileUrl,
      success: (res) => {
        const filePath = res.tempFilePath;
        wx.openDocument({
          filePath: filePath,
          fileType: 'pptx',
          success: function (res) {
            console.log('打开文档成功');
            wx.hideLoading();
          },
          fail: function(err) {
            console.error('打开文档失败', err);
            wx.hideLoading();
            // 如果打开失败，提示用户复制链接
            wx.showModal({
              title: '提示',
              content: '无法直接预览PPTX文件，链接已复制到剪贴板，请粘贴到浏览器下载查看',
              showCancel: false
            });
          }
        });
      },
      fail: (err) => {
        console.error('下载失败', err);
        wx.hideLoading();
        wx.showToast({
          title: '下载失败',
          icon: 'none'
        });
      }
    });
  }
});
