// pages/converter/index.js
Page({
    /**
     * 页面的初始数据
     */
    data: {

    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {

    },

    /**
     * 导航到图片转PDF页面
     */
    navigateToImageConverter() {
        wx.navigateTo({
            url: '/pages/image-to-pdf/image-to-pdf'
        });
    },

    /**
     * 导航到Word转PDF页面
     */
    navigateToWordConverter() {
        wx.navigateTo({
            url: '/pages/word-to-pdf/word-to-pdf'
        });
    },

    /**
     * 导航到PDF转Word页面
     */
    navigateToPdfToWord() {
        wx.showToast({
            title: '功能开发中，敬请期待',
            icon: 'none',
            duration: 2000
        });
    },

    /**
     * 导航到图片文字提取页面
     */
    navigateToImageOCR() {
        wx.showToast({
            title: '功能开发中，敬请期待',
            icon: 'none',
            duration: 2000
        });
    },

    /**
     * PDF操作功能导航方法
     */
    navigateToPdfMerge() {
        wx.navigateTo({
            url: '/pages/tools/pdf-merge/index'
        });
    },

    navigateToPdfToPpt() {
        wx.showToast({
            title: '功能开发中，敬请期待',
            icon: 'none',
            duration: 2000
        });
    },

    navigateToPdfToExcel() {
        wx.showToast({
            title: '功能开发中，敬请期待',
            icon: 'none',
            duration: 2000
        });
    },

    navigateToPptToPdf() {
        wx.showToast({
            title: '功能开发中，敬请期待',
            icon: 'none',
            duration: 2000
        });
    },

    navigateToExcelToPdfNew() {
        wx.showToast({
            title: '功能开发中，敬请期待',
            icon: 'none',
            duration: 2000
        });
    },

    navigateToTxtToPdf() {
        wx.showToast({
            title: '功能开发中，敬请期待',
            icon: 'none',
            duration: 2000
        });
    },

    navigateToMarkdownToPdf() {
        wx.showToast({
            title: '功能开发中，敬请期待',
            icon: 'none',
            duration: 2000
        });
    },

    navigateToPdfToImage() {
        wx.showToast({
            title: '功能开发中，敬请期待',
            icon: 'none',
            duration: 2000
        });
    },

    navigateToPdfSplit() {
        wx.navigateTo({
            url: '/pages/tools/pdf-split/index'
        });
    },

    navigateToPdfWatermark() {
        wx.navigateTo({
            url: '/pages/tools/pdf-watermark/index'
        });
    },

    navigateToAiCorrection() {
        wx.showToast({
            title: '功能开发中，敬请期待',
            icon: 'none',
            duration: 2000
        });
    },

    navigateToESignature() {
        wx.navigateTo({
            url: '/pages/tools/signature/index'
        });
    },

    navigateToQrCodeGenerator() {
        wx.navigateTo({
            url: '/pages/tools/qrcode/index'
        });
    },

    navigateToIDPhotoResize() {
        wx.showToast({
            title: '功能开发中，敬请期待',
            icon: 'none',
            duration: 2000
        });
    },

    // 多媒体处理功能
    navigateToImageFormat() {
        wx.navigateTo({
            url: '/pages/tools/image-format/index'
        });
    },

    navigateToVideoFormat() {
        wx.showToast({
            title: '功能开发中，敬请期待',
            icon: 'none',
            duration: 2000
        });
    },

    navigateToAudioFormat() {
        wx.showToast({
            title: '功能开发中，敬请期待',
            icon: 'none',
            duration: 2000
        });
    },

    navigateToVideoToAudio() {
        wx.showToast({
            title: '功能开发中，敬请期待',
            icon: 'none',
            duration: 2000
        });
    },

    navigateToVideoCompress() {
        wx.showToast({
            title: '功能开发中，敬请期待',
            icon: 'none',
            duration: 2000
        });
    },

    navigateToImageCompress() {
        wx.navigateTo({
            url: '/pages/tools/image-compress/index'
        });
    },

    navigateToVideoToGif() {
        wx.showToast({
            title: '功能开发中，敬请期待',
            icon: 'none',
            duration: 2000
        });
    },

    navigateToAudioCompress() {
        wx.showToast({
            title: '功能开发中，敬请期待',
            icon: 'none',
            duration: 2000
        });
    }
});
