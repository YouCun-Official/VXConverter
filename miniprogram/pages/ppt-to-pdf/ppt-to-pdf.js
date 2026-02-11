// pages/ppt-to-pdf/ppt-to-pdf.js
Page({
    /**
     * 页面的初始数据
     */
    data: {
        selectedFile: null,   // 选中的文件信息
        isConverting: false,  // 是否正在转换
        progressText: ''      // 进度文本
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        // 检查云开发是否初始化
        if (!wx.cloud) {
            wx.showModal({
                title: '云开发未开通',
                content: '请先开通云开发功能才能使用PPT转PDF',
                showCancel: false
            });
        }
    },

    /**
     * 选择PPT文件
     */
    selectPPTFile() {
        const that = this;

        wx.chooseMessageFile({
            count: 1,
            type: 'file',
            extension: ['ppt', 'pptx'],
            success(res) {
                const file = res.tempFiles[0];

                // 检查文件大小（限制10MB）
                if (file.size > 10 * 1024 * 1024) {
                    wx.showToast({
                        title: '文件过大，请选择小于10MB的文件',
                        icon: 'none',
                        duration: 2000
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
                    title: '文件已选择',
                    icon: 'success'
                });
            },
            fail(err) {
                console.error('选择文件失败:', err);
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
            icon: 'success'
        });
    },

    /**
     * 转换为PDF
     */
    async convertToPDF() {
        if (!this.data.selectedFile) {
            wx.showToast({
                title: '请先选择PPT文件',
                icon: 'none'
            });
            return;
        }

        this.setData({
            isConverting: true,
            progressText: '正在上传文件...'
        });

        try {
            // 上传文件到云存储
            const cloudPath = `ppt-files/${Date.now()}_${this.data.selectedFile.name}`;

            const uploadResult = await wx.cloud.uploadFile({
                cloudPath: cloudPath,
                filePath: this.data.selectedFile.path
            });

            this.setData({
                progressText: '正在转换为PDF...'
            });

            // 调用云函数进行转换
            const convertResult = await wx.cloud.callFunction({
                name: 'pptToPdf',
                data: {
                    fileID: uploadResult.fileID,
                    fileName: this.data.selectedFile.name
                }
            });

            this.setData({
                isConverting: false
            });

            if (convertResult.result && convertResult.result.success) {
                // 转换成功
                wx.showModal({
                    title: '转换成功',
                    content: 'PPT已成功转换为PDF',
                    confirmText: '下载',
                    cancelText: '完成',
                    success: async (res) => {
                        if (res.confirm) {
                            // 下载PDF文件
                            this.downloadPDF(convertResult.result.pdfFileID);
                        }
                    }
                });
            } else {
                throw new Error(convertResult.result.error || '转换失败');
            }

        } catch (error) {
            console.error('转换失败:', error);

            this.setData({
                isConverting: false
            });

            wx.showModal({
                title: '转换失败',
                content: error.message || '转换过程中出现错误，请重试',
                showCancel: false
            });
        }
    },

    /**
     * 下载PDF文件
     */
    async downloadPDF(fileID) {
        wx.showLoading({
            title: '准备打开PDF...'
        });

        try {
            // 获取临时链接
            const tempFileURL = await wx.cloud.getTempFileURL({
                fileList: [fileID]
            });

            if (tempFileURL.fileList && tempFileURL.fileList.length > 0) {
                const downloadURL = tempFileURL.fileList[0].tempFileURL;

                wx.hideLoading();

                // 直接打开文件预览
                wx.openDocument({
                    filePath: downloadURL,
                    showMenu: true,
                    success: () => {
                        console.log('PDF打开成功');
                    },
                    fail: (err) => {
                        console.error('打开PDF失败:', err);

                        // 如果打开失败，尝试下载
                        wx.showModal({
                            title: '提示',
                            content: '是否下载PDF文件到本地？',
                            success: (res) => {
                                if (res.confirm) {
                                    this.saveToLocal(downloadURL);
                                }
                            }
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
    saveToLocal(url) {
        wx.showLoading({
            title: '下载中...'
        });

        wx.downloadFile({
            url: url,
            success: (res) => {
                if (res.statusCode === 200) {
                    const savedPath = `${wx.env.USER_DATA_PATH}/converted_${Date.now()}.pdf`;
                    const fs = wx.getFileSystemManager();

                    fs.copyFile({
                        srcPath: res.tempFilePath,
                        destPath: savedPath,
                        success: () => {
                            wx.hideLoading();
                            wx.showToast({
                                title: 'PDF已保存',
                                icon: 'success'
                            });

                            // 询问是否分享
                            setTimeout(() => {
                                wx.showModal({
                                    title: '分享文件',
                                    content: '是否要分享这个PDF文件？',
                                    success: (res) => {
                                        if (res.confirm) {
                                            wx.shareFileMessage({
                                                filePath: savedPath,
                                                success: () => {
                                                    wx.showToast({
                                                        title: '分享成功',
                                                        icon: 'success'
                                                    });
                                                },
                                                fail: (err) => {
                                                    console.error('分享失败:', err);
                                                }
                                            });
                                        }
                                    }
                                });
                            }, 500);
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
                }
            },
            fail: (err) => {
                wx.hideLoading();
                console.error('下载失败:', err);
                wx.showToast({
                    title: '下载失败',
                    icon: 'none'
                });
            }
        });
    }
});
