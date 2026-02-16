// pages/pdf-to-word/pdf-to-word.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    selectedFile: null,       // 选中的PDF文件信息
    isConverting: false,      // 是否正在转换
    progressText: '',         // 进度文本
    convertOptions: {
      preserveFormatting: true,
      pageBreaks: true
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 检查云开发是否初始化
    if (!wx.cloud) {
      wx.showModal({
        title: '云开发未开通',
        content: '请先开通云开发功能才能使用PDF转Word',
        showCancel: false
      });
    }
  },

  /**
   * 选择PDF文件
   */
  selectPDFFile() {
    const that = this;

    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf'],
      success(res) {
        const file = res.tempFiles[0];

        // 检查文件大小（限制20MB）
        if (file.size > 20 * 1024 * 1024) {
          wx.showToast({
            title: '文件过大，请选择小于20MB的PDF',
            icon: 'none',
            duration: 2500
          });
          return;
        }

        // 格式化文件大小
        const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
        const sizeText = sizeInMB > 1
          ? `${sizeInMB} MB`
          : `${(file.size / 1024).toFixed(2)} KB`;

        that.setData({
          selectedFile: {
            path: file.path,
            name: file.name,
            size: sizeText,
            rawSize: file.size
          }
        });

        wx.showToast({
          title: 'PDF文件已选择',
          icon: 'success'
        });
      },
      fail(err) {
        console.error('选择文件失败:', err);
        
        // 如果用户取消选择，不显示错误
        if (err.errMsg && err.errMsg.includes('cancel')) {
          return;
        }

        wx.showToast({
          title: '选择文件失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 移除文件
   */
  removeFile() {
    this.setData({
      selectedFile: null
    });

    wx.showToast({
      title: '已移除',
      icon: 'success',
      duration: 1500
    });
  },

  /**
   * 切换保留格式选项
   */
  toggleFormatting(e) {
    this.setData({
      'convertOptions.preserveFormatting': e.detail.value
    });
  },

  /**
   * 切换分页符选项
   */
  togglePageBreaks(e) {
    this.setData({
      'convertOptions.pageBreaks': e.detail.value
    });
  },

  /**
   * 转换为Word
   */
  async convertToWord() {
    if (!this.data.selectedFile) {
      wx.showToast({
        title: '请先选择PDF文件',
        icon: 'none'
      });
      return;
    }

    this.setData({
      isConverting: true,
      progressText: '正在上传PDF文件...'
    });

    try {
      // 上传PDF文件到云存储
      const cloudPath = `pdf-files/${Date.now()}_${this.data.selectedFile.name}`;

      this.setData({
        progressText: '上传中... 请稍候'
      });

      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: this.data.selectedFile.path
      });

      console.log('PDF上传成功:', uploadResult.fileID);

      this.setData({
        progressText: '正在转换为Word文档...'
      });

      // 调用云函数进行转换
      const convertResult = await wx.cloud.callFunction({
        name: 'pdfToWord',
        data: {
          fileID: uploadResult.fileID,
          fileName: this.data.selectedFile.name,
          options: this.data.convertOptions
        }
      });

      console.log('转换结果:', convertResult);

      this.setData({
        isConverting: false,
        progressText: ''
      });

      if (convertResult.result && convertResult.result.success) {
        // 转换成功
        const result = convertResult.result;
        
        wx.showModal({
          title: '✅ 转换成功',
          content: `PDF已转换为Word文档\n页数：${result.pageCount}\n文本长度：${result.textLength}字符`,
          confirmText: '打开文档',
          cancelText: '完成',
          success: async (res) => {
            if (res.confirm) {
              // 打开Word文档
              this.openWordDocument(result.wordFileID, result.fileName);
            }
          }
        });
      } else {
        throw new Error(convertResult.result?.error || '转换失败');
      }

    } catch (error) {
      console.error('转换失败:', error);

      this.setData({
        isConverting: false,
        progressText: ''
      });

      let errorMessage = '转换过程中出现错误，请重试';
      
      if (error.message) {
        if (error.message.includes('未找到可提取的文本')) {
          errorMessage = 'PDF中未找到文本内容\n可能是扫描版或图片PDF\n建议使用OCR工具先识别文字';
        } else if (error.message.includes('超时')) {
          errorMessage = '转换超时，文件可能太大\n请尝试较小的PDF文件';
        } else {
          errorMessage = error.message;
        }
      }

      wx.showModal({
        title: '❌ 转换失败',
        content: errorMessage,
        showCancel: false,
        confirmText: '知道了'
      });
    }
  },

  /**
   * 打开Word文档
   */
  async openWordDocument(fileID, fileName) {
    wx.showLoading({
      title: '准备打开文档...'
    });

    try {
      // 获取临时链接
      const tempFileURL = await wx.cloud.getTempFileURL({
        fileList: [fileID]
      });

      if (tempFileURL.fileList && tempFileURL.fileList.length > 0) {
        const downloadURL = tempFileURL.fileList[0].tempFileURL;

        wx.hideLoading();

        // 下载文件到本地临时目录
        wx.downloadFile({
          url: downloadURL,
          success: (res) => {
            if (res.statusCode === 200) {
              // 打开文件预览
              wx.openDocument({
                filePath: res.tempFilePath,
                fileType: 'docx',
                showMenu: true,
                success: () => {
                  console.log('Word文档打开成功');
                },
                fail: (err) => {
                  console.error('打开Word文档失败:', err);

                  // 如果打开失败，提供保存或分享选项
                  wx.showModal({
                    title: '提示',
                    content: '无法直接打开文档，是否保存到本地或分享？',
                    confirmText: '保存',
                    cancelText: '分享',
                    success: (modalRes) => {
                      if (modalRes.confirm) {
                        this.saveToLocal(res.tempFilePath, fileName);
                      } else if (modalRes.cancel) {
                        this.shareDocument(res.tempFilePath);
                      }
                    }
                  });
                }
              });
            }
          },
          fail: (err) => {
            console.error('下载失败:', err);
            wx.showToast({
              title: '下载失败',
              icon: 'none'
            });
          }
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('获取文件失败:', error);
      wx.showToast({
        title: '获取文件失败',
        icon: 'none'
      });
    }
  },

  /**
   * 保存文件到本地
   */
  saveToLocal(tempPath, fileName) {
    wx.showLoading({
      title: '保存中...'
    });

    const savedPath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    const fs = wx.getFileSystemManager();

    fs.copyFile({
      srcPath: tempPath,
      destPath: savedPath,
      success: () => {
        wx.hideLoading();
        wx.showToast({
          title: 'Word文档已保存',
          icon: 'success'
        });

        // 询问是否分享
        setTimeout(() => {
          wx.showModal({
            title: '分享文件',
            content: '是否要分享这个Word文档？',
            success: (res) => {
              if (res.confirm) {
                this.shareDocument(savedPath);
              }
            }
          });
        }, 1000);
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('保存文件失败:', err);
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 分享文档
   */
  shareDocument(filePath) {
    wx.shareFileMessage({
      filePath: filePath,
      success: () => {
        wx.showToast({
          title: '分享成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        console.error('分享失败:', err);
        wx.showToast({
          title: '分享失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 查看转换说明
   */
  showConversionInfo() {
    wx.showModal({
      title: '💡 转换说明',
      content: '• PDF转Word是有损转换\n• 主要提取文本内容\n• 复杂排版可能无法完美还原\n• 不支持扫描版PDF\n• 建议文件大小：< 20MB',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  /**
   * 分享页面
   */
  onShareAppMessage() {
    return {
      title: 'PDF转Word - 快速转换工具',
      path: '/pages/pdf-to-word/pdf-to-word'
    };
  }
});
