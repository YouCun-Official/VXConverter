// cloudfunctions/pdfToImage/index.js

const cloud = require('wx-server-sdk');
const { convert } = require('pdf-poppler');
const fs = require('fs');
const path = require('path');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * PDF转图片云函数
 *
 * 支持的操作：
 * 1. getPageCount - 获取PDF页数
 * 2. convert - 转换PDF为图片
 */
exports.main = async (event, context) => {
  const { action } = event;

  try {
    switch (action) {
      case 'getPageCount':
        return await getPageCount(event);
      case 'convert':
        return await convertPdfToImages(event);
      default:
        return {
          success: false,
          error: '未知的操作类型'
        };
    }
  } catch (error) {
    console.error('云函数执行错误:', error);
    return {
      success: false,
      error: error.message || '处理失败'
    };
  }
};

/**
 * 获取PDF页数
 */
async function getPageCount(event) {
  const { fileID } = event;

  try {
    // 下载PDF文件
    const res = await cloud.downloadFile({
      fileID: fileID
    });

    const tempFilePath = res.tempFilePath;

    // 使用pdf-poppler获取页数
    // 注意：这里需要安装poppler-utils
    // 在云函数环境中，可能需要使用其他方法，如pdf-lib
    const PDFDocument = require('pdf-lib').PDFDocument;
    const pdfBytes = fs.readFileSync(tempFilePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();

    return {
      success: true,
      pageCount: pageCount
    };

  } catch (error) {
    console.error('获取页数失败:', error);
    return {
      success: false,
      error: error.message || '获取页数失败'
    };
  }
}

/**
 * 转换PDF为图片
 */
async function convertPdfToImages(event) {
  const { fileID, pages, format, dpi } = event;

  try {
    // 下载PDF文件
    const downloadRes = await cloud.downloadFile({
      fileID: fileID
    });

    const tempFilePath = downloadRes.tempFilePath;
    const tempDir = path.dirname(tempFilePath);
    const outputDir = path.join(tempDir, 'output_' + Date.now());

    // 创建输出目录
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const images = [];

    // 转换选项
    const options = {
      format: format || 'png',  // png 或 jpeg
      out_dir: outputDir,
      out_prefix: 'page',
      page: null,  // 将为每页单独设置
      scale: dpi || 150
    };

    // 逐页转换
    for (let pageNum of pages) {
      options.page = pageNum;

      // 转换单页
      await convert(tempFilePath, options);

      // 生成的文件名
      const imageFileName = `page-${pageNum}.${format}`;
      const imagePath = path.join(outputDir, imageFileName);

      // 上传到云存储
      const uploadRes = await cloud.uploadFile({
        cloudPath: `pdf-to-image/output/${Date.now()}_${imageFileName}`,
        fileContent: fs.createReadStream(imagePath)
      });

      // 获取临时链接
      const tempUrlRes = await cloud.getTempFileURL({
        fileList: [uploadRes.fileID]
      });

      // 获取文件大小
      const stats = fs.statSync(imagePath);

      images.push({
        page: pageNum,
        cloudPath: uploadRes.fileID,
        tempUrl: tempUrlRes.fileList[0].tempFileURL,
        size: stats.size
      });

      // 删除临时文件
      fs.unlinkSync(imagePath);
    }

    // 清理输出目录
    if (fs.existsSync(outputDir)) {
      fs.rmdirSync(outputDir, { recursive: true });
    }

    return {
      success: true,
      images: images
    };

  } catch (error) {
    console.error('转换失败:', error);
    return {
      success: false,
      error: error.message || '转换失败'
    };
  }
}
