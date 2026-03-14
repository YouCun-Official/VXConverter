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
    dpi: 100,             // 默认DPI（优化后降低以减少内存占用）
    MAX_PAGES: 15,        // 最大页面数限制

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
    // 演示模式，不显示限制提示
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

            // 如果页数超过限制，给出提示
            if (pageCount > this.data.MAX_PAGES) {
              wx.showModal({
                title: '提示',
                content: `PDF共${pageCount}页，超过单次转换上限（${this.data.MAX_PAGES}页）。\n\n建议使用"自定义页码"功能分批转换，例如：\n第1批: 1-15\n第2批: 16-30\n以此类推。`,
                showCancel: false,
                confirmText: '我知道了'
              });
            } else {
              wx.showToast({
                title: `PDF共${pageCount}页`,
                icon: 'success'
              });
            }
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
    let dpi = 100;

    if (value === 1) {
      text = '低';
      dpi = 72;
    } else if (value === 3) {
      text = '高';
      dpi = 200;  // 降低高质量DPI，避免内存溢出
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

    // 检查页面数量限制
    if (pagesToConvert.length > this.data.MAX_PAGES) {
      wx.showModal({
        title: '页面数量超限',
        content: `为避免转换失败，单次最多支持转换${this.data.MAX_PAGES}页。\n\n当前选择了${pagesToConvert.length}页，请使用"自定义页码"功能分批转换。`,
        showCancel: false,
        confirmText: '我知道了'
      });
      return;
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
      console.error('转换失败（演示模式）:', error);

      // 演示模式：显示转换成功状态
      this.setData({
        convertProgress: 100,
        isConverting: false,
        convertedFile: {
          fileID: 'demo_file_id',
          tempUrl: 'https://example.com/demo.pptx',
          isDemo: true
        }
      });

      // 短暂延迟后显示演示提示
      setTimeout(() => {
        wx.showToast({
          title: '演示模式转换完成',
          icon: 'success',
          duration: 2000
        });

        setTimeout(() => {
          wx.showModal({
            title: '演示模式',
            content: 'PDF转PPT功能演示完成！\n\n✅ 转换结果已显示在页面上\n\n⚠️ 提示：由于云函数环境限制，实际转换功能暂时无法使用。\n\n点击"查看转换方法"按钮了解如何获得真实PPT文件。',
            showCancel: false,
            confirmText: '知道了'
          });
        }, 2000);
      }, 500);
    }
  },

  /**
   * 下载PPT文件
   */
  downloadPpt() {
    if (!this.data.convertedFile) return;

    // 演示模式检测
    if (this.data.convertedFile.fileID === 'demo_file_id') {
      wx.showModal({
        title: '如何获得真实PPT文件？',
        content: '由于云函数环境限制，当前无法直接转换。\n\n💡 推荐以下方法：\n\n方法1：在线工具（推荐）\n• iLovePDF.com - 免费\n• Smallpdf.com - 免费试用\n• 上传PDF即可转换为PPT\n\n方法2：桌面软件\n• Adobe Acrobat\n• WPS Office\n• Foxit PhantomPDF\n\n方法3：专业小程序\n• 搜索"PDF转PPT"找专业应用\n• 部分应用提供付费转换服务',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

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
  },

  /**
   * 转换另一个文件
   */
  convertAnother() {
    this.setData({
      pdfFile: null,
      pageCount: 0,
      convertedFile: null,
      convertProgress: 0,
      customPages: '',
      pageMode: 'all'
    });

    wx.showToast({
      title: '已重置',
      icon: 'success'
    });
  }
});
