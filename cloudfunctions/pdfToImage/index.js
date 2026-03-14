//路径：cloudfunctions/pdfToImage
//作用：使用 pdfjs-dist + canvas 将 PDF 各页渲染为 PNG/JPG 图片，上传云存储后返回临时链接

const cloud = require('wx-server-sdk');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas } = require('canvas');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const { action } = event;
  try {
    switch (action) {
      case 'getPageCount':
        return await getPageCount(event);
      case 'convert':
        return await convertPdfToImages(event);
      default:
        return { success: false, error: '未知的操作类型' };
    }
  } catch (error) {
    console.error('云函数执行错误:', error);
    return { success: false, error: error.message || '处理失败' };
  }
};

/**
 * 获取PDF页数
 */
async function getPageCount(event) {
  const { fileID } = event;
  try {
    const res = await cloud.downloadFile({ fileID });
    const data = new Uint8Array(res.fileContent);
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdfDoc = await loadingTask.promise;
    const pageCount = pdfDoc.numPages;
    await pdfDoc.destroy();
    return { success: true, pageCount };
  } catch (error) {
    console.error('获取页数失败:', error);
    return { success: false, error: error.message || '获取页数失败' };
  }
}

/**
 * 转换PDF为图片
 */
async function convertPdfToImages(event) {
  const { fileID, pages, format = 'png', dpi = 150 } = event;
  try {
    const res = await cloud.downloadFile({ fileID });
    const data = new Uint8Array(res.fileContent);

    const loadingTask = pdfjsLib.getDocument({ data });
    const pdfDoc = await loadingTask.promise;

    // PDF 默认 72 DPI，按比例缩放
    const scale = dpi / 72;
    const images = [];

    for (const pageNum of pages) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
      const ctx = canvas.getContext('2d');

      // 白色背景（JPG 不支持透明）
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport }).promise;

      const imageFormat = format === 'jpg' ? 'jpeg' : 'png';
      const imageBuffer = imageFormat === 'jpeg'
        ? canvas.toBuffer('image/jpeg', { quality: 0.9 })
        : canvas.toBuffer('image/png');

      const imageFileName = `page-${pageNum}.${format}`;
      const cloudPath = `pdf-to-image/output/${Date.now()}_${imageFileName}`;

      const uploadRes = await cloud.uploadFile({
        cloudPath,
        fileContent: imageBuffer
      });

      const tempUrlRes = await cloud.getTempFileURL({
        fileList: [uploadRes.fileID]
      });

      images.push({
        page: pageNum,
        cloudPath: uploadRes.fileID,
        tempUrl: tempUrlRes.fileList[0].tempFileURL,
        size: imageBuffer.length
      });
    }

    await pdfDoc.destroy();

    return { success: true, images };
  } catch (error) {
    console.error('转换失败:', error);
    return { success: false, error: error.message || '转换失败' };
  }
}
