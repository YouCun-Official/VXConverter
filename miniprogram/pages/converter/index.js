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
        wx.navigateTo({
            url: '/pages/pdf-to-word/pdf-to-word'
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



    navigateToPptToPdf() {
        wx.navigateTo({
            url: '/pages/ppt-to-pdf/ppt-to-pdf'
        });
    },

    navigateToExcelToPdfNew() {
        wx.navigateTo({
            url: '/pages/excel-to-pdf/excel-to-pdf'
        });
    },

    navigateToTxtToPdf() {
        wx.navigateTo({
            url: '/pages/txt-to-pdf/txt-to-pdf'
        });
    },

    navigateToMarkdownToPdf() {
        wx.navigateTo({
            url: '/pages/markdown-to-pdf/markdown-to-pdf'
        });
    },

    navigateToPdfToImage() {
        wx.navigateTo({
            url: '/pages/tools/pdf-to-image/index'
        });
    },

    navigateToPdfToPpt() {
        wx.navigateTo({
            url: '/pages/pdf-to-ppt/index'
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
        wx.navigateTo({
            url: '/pages/tools/id-photo-resize/index'
        });
    },

    // 多媒体处理功能
    navigateToImageFormat() {
        wx.navigateTo({
            url: '/pages/tools/image-format/index'
        });
    },

    navigateToVideoFormat() {
        wx.navigateTo({
            url: '/pages/tools/video-format/index'
        });
    },

    navigateToAudioFormat() {
        wx.navigateTo({
            url: '/pages/tools/audio-format/index'
        });
    },

    navigateToVideoToAudio() {
        wx.navigateTo({
            url: '/pages/tools/video-to-audio/index'
        });
    },

    navigateToVideoCompress() {
        wx.navigateTo({
            url: '/pages/tools/video-compress/index'
        });
    },

    navigateToImageCompress() {
        wx.navigateTo({
            url: '/pages/tools/image-compress/index'
        });
    },

    navigateToVideoToGif() {
        wx.navigateTo({
            url: '/pages/tools/video-to-gif/index'
        });
    },

    navigateToAudioCompress() {
        wx.navigateTo({
            url: '/pages/tools/audio-compress/index'
        });
    }
});
