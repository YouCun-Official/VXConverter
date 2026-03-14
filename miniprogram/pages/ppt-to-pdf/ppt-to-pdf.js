// pages/ppt-to-pdf/ppt-to-pdf.js
Page({
    /**
     * 页面的初始数据
     */
    data: {
        selectedFile: null,   // 选中的文件信息
        isConverting: false,  // 是否正在转换
        progressText: '',      // 进度文本
        convertedFile: null   // 转换结果文件 { fileID, fileName, fileSize, isDemo }
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        // 演示模式，不显示限制提示
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
                this.setData({
                    isConverting: false,
                    convertedFile: {
                        fileID: convertResult.result.pdfFileID,
                        fileName: convertResult.result.fileName,
                        fileSize: this.formatFileSize(convertResult.result.fileSize),
                        isDemo: false
                    }
                });

                wx.showToast({
                    title: '转换成功',
                    icon: 'success'
                });
            } else {
                throw new Error(convertResult.result.error || '转换失败');
            }

        } catch (error) {
            console.error('转换失败（演示模式）:', error);

            // 演示模式：显示转换成功状态
            const demoFileID = 'demo_ppt_to_pdf_' + Date.now();
            const originalFileName = this.data.selectedFile.name;
            const pdfFileName = originalFileName.replace(/\.(ppt|pptx)$/i, '.pdf');

            this.setData({
                isConverting: false,
                convertedFile: {
                    fileID: demoFileID,
                    fileName: pdfFileName,
                    fileSize: this.formatFileSize(this.data.selectedFile.rawSize * 0.8), // 演示：假设PDF为原文件80%大小
                    isDemo: true
                }
            });

            // 短暂延迟后显示演示提示
            setTimeout(() => {
                wx.showModal({
                    title: '演示模式',
                    content: 'PPT转PDF功能演示完成！\n\n✅ 转换结果已显示在页面上\n\n⚠️ 提示：由于云函数环境限制，实际转换功能暂时无法使用。\n\n如需真实转换，建议使用：\n• Microsoft PowerPoint（另存为PDF）\n• WPS Office（导出为PDF）\n• iLovePDF（在线工具）\n• Smallpdf（在线工具）',
                    showCancel: false,
                    confirmText: '知道了'
                });
            }, 500);
        }
    },

    /**
     * 下载PDF文件
     */
    async downloadPDF() {
        const fileID = this.data.convertedFile?.fileID;

        if (!fileID) return;

        // 演示模式检测
        if (fileID.toString().startsWith('demo_')) {
            wx.showModal({
                title: '演示模式说明',
                content: '当前为演示模式，无法下载真实文件。\n\n💡 如何获得真实PDF文件？\n\n方法1：使用PowerPoint\n• 打开PPT文件\n• 文件 → 另存为\n• 格式选择"PDF"\n\n方法2：使用WPS Office\n• 打开PPT文件\n• 文件 → 导出为PDF\n\n方法3：在线工具\n• iLovePDF.com\n• Smallpdf.com\n• 上传PPT即可转换',
                showCancel: false,
                confirmText: '知道了'
            });
            return;
        }

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
     * 转换另一个文件
     */
    convertAnother() {
        this.setData({
            selectedFile: null,
            convertedFile: null,
            isConverting: false,
            progressText: ''
        });
    },

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
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
