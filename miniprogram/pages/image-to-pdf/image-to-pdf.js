// pages/image-to-pdf/image-to-pdf.js
const pdfUtils = require('../../utils/pdfGenerator.js');

Page({
    /**
     * 页面的初始数据
     */
    data: {
        images: [],          // 图片路径数组
        isGenerating: false, // 是否正在生成PDF
        progressText: ''     // 进度文本
    },

    /**
     * 添加图片
     */
    addImages() {
        const that = this;
        wx.chooseImage({
            count: 9, // 一次最多选择9张
            sizeType: ['original', 'compressed'],
            sourceType: ['album', 'camera'],
            success(res) {
                const tempFilePaths = res.tempFilePaths;
                // 合并到现有图片数组
                const newImages = that.data.images.concat(tempFilePaths);
                that.setData({
                    images: newImages
                });

                wx.showToast({
                    title: `已添加 ${tempFilePaths.length} 张图片`,
                    icon: 'success'
                });
            },
            fail(err) {
                console.error('选择图片失败:', err);
                wx.showToast({
                    title: '选择图片失败',
                    icon: 'none'
                });
            }
        });
    },

    /**
     * 删除图片
     */
    deleteImage(e) {
        const index = e.currentTarget.dataset.index;
        const that = this;

        wx.showModal({
            title: '确认删除',
            content: '确定要删除这张图片吗？',
            success(res) {
                if (res.confirm) {
                    const images = that.data.images;
                    images.splice(index, 1);
                    that.setData({
                        images: images
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
     * 上移图片
     */
    moveUp(e) {
        const index = e.currentTarget.dataset.index;
        if (index === 0) return;

        const images = this.data.images;
        const temp = images[index];
        images[index] = images[index - 1];
        images[index - 1] = temp;

        this.setData({
            images: images
        });
    },

    /**
     * 下移图片
     */
    moveDown(e) {
        const index = e.currentTarget.dataset.index;
        const images = this.data.images;
        if (index === images.length - 1) return;

        const temp = images[index];
        images[index] = images[index + 1];
        images[index + 1] = temp;

        this.setData({
            images: images
        });
    },

    /**
     * 生成PDF
     */
    async generatePDF() {
        if (this.data.images.length === 0) {
            wx.showToast({
                title: '请先添加图片',
                icon: 'none'
            });
            return;
        }

        this.setData({
            isGenerating: true,
            progressText: '准备中...'
        });

        try {
            // 调用工具函数生成PDF
            const result = await pdfUtils.imagesToPDF(
                this.data.images,
                (progress) => {
                    // 更新进度
                    this.setData({
                        progressText: progress
                    });
                }
            );

            this.setData({
                isGenerating: false
            });

            if (result.success) {
                wx.showModal({
                    title: '生成成功',
                    content: 'PDF已生成，是否要分享文件？',
                    confirmText: '分享',
                    cancelText: '完成',
                    success: (res) => {
                        if (res.confirm) {
                            // 分享文件
                            wx.shareFileMessage({
                                filePath: result.filePath,
                                success() {
                                    wx.showToast({
                                        title: '分享成功',
                                        icon: 'success'
                                    });
                                },
                                fail(err) {
                                    console.error('分享失败:', err);
                                    wx.showToast({
                                        title: '分享失败',
                                        icon: 'none'
                                    });
                                }
                            });
                        } else {
                            // 显示文件保存位置
                            wx.showToast({
                                title: 'PDF已保存',
                                icon: 'success'
                            });
                        }
                    }
                });
            } else {
                throw new Error(result.error || '生成失败');
            }
        } catch (error) {
            console.error('生成PDF失败:', error);
            this.setData({
                isGenerating: false
            });

            wx.showModal({
                title: '生成失败',
                content: error.message || '生成PDF时出现错误，请重试',
                showCancel: false
            });
        }
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {

    }
});
