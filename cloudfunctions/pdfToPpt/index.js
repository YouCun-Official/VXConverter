// cloudfunctions/pdfToPpt/index.js

const cloud = require('wx-server-sdk');
const { convert } = require('pdf-poppler');
const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');
const { PDFDocument } = require('pdf-lib');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * PDF转PPT云函数
 *
 * 支持的操作：
 * 1. getPageCount - 获取PDF页数
 * 2. convert - 转换PDF为PPT
 */
exports.main = async (event, context) => {
  const { action } = event;

  try {
    switch (action) {
      case 'getPageCount':
        return await getPageCount(event);
      case 'convert':
        return await convertPdfToPpt(event);
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
 * 转换PDF为PPT
 */
async function convertPdfToPpt(event) {
  const { fileID, pages, dpi, quality } = event; // pages: [1, 2, 3]

  try {
    // 下载PDF文件
    const downloadRes = await cloud.downloadFile({
      fileID: fileID
    });

    const tempFilePath = downloadRes.tempFilePath;
    const tempDir = path.dirname(tempFilePath);
    const outputDir = path.join(tempDir, 'ppt_output_' + Date.now());

    // 创建输出目录
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1. 将PDF转换为图片
    const imageOptions = {
      format: 'png',
      out_dir: outputDir,
      out_prefix: 'page',
      page: null,
      scale: dpi || 150
    };

    const imagePaths = [];
    
    // 如果pages为空，则转换所有页面
    // 但通常前端会传pages数组
    // 这里我们假设pages是一个页码数组，例如 [1, 2, 3]
    
    // 确定要转换的页码
    let pagesToConvert = pages;
    if (!pagesToConvert || pagesToConvert.length === 0) {
        // 如果没有传页码，需要先获取总页数，这里暂不处理，假设必须传页码
        // 或者可以再次读取PDF获取页数
        const pdfBytes = fs.readFileSync(tempFilePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const count = pdfDoc.getPageCount();
        pagesToConvert = Array.from({length: count}, (_, i) => i + 1);
    }

    for (let pageNum of pagesToConvert) {
      imageOptions.page = pageNum;
      
      // pdf-poppler convert returns a promise
      await convert(tempFilePath, imageOptions);
      
      // 构建生成的文件名，pdf-poppler通常生成 page-1.png, page-2.png 等
      // 注意：pdf-poppler的文件名格式有时是 page-01.png 或 page-1.png，取决于版本和设置
      // 这里我们需要查找目录下生成的文件
      
      // 简单起见，我们只能假设它按预期生成，或者遍历目录查找
      // pdf-poppler usually appends -number to prefix. e.g. page-1.png
      
      // Let's look for the file
      const expectedFileName = `page-${pageNum}.png`;
      let imagePath = path.join(outputDir, expectedFileName);
      
      // Some versions might use padding, e.g. page-01.png
      if (!fs.existsSync(imagePath)) {
          // Try to find matching file in directory
          const files = fs.readdirSync(outputDir);
          const match = files.find(f => f.startsWith('page-') && (f.includes(`-${pageNum}.`) || f.includes(`-${pageNum.toString().padStart(2, '0')}.`)));
          if (match) {
              imagePath = path.join(outputDir, match);
          }
      }

      if (fs.existsSync(imagePath)) {
        imagePaths.push(imagePath);
      }
    }

    // 2. 创建PPT
    const pres = new PptxGenJS();
    
    // Set slide size (optional, default is 16:9)
    // We could try to match PDF page size but for now use default

    for (const imgPath of imagePaths) {
      const slide = pres.addSlide();
      
      // Add image to slide, filling the slide
      slide.addImage({
        path: imgPath,
        x: 0,
        y: 0,
        w: '100%',
        h: '100%'
      });
    }

    // 3. 保存PPT文件
    const pptFileName = `converted_${Date.now()}.pptx`;
    const pptFilePath = path.join(outputDir, pptFileName);
    
    await pres.writeFile({ fileName: pptFilePath });

    // 4. 上传PPT到云存储
    const uploadRes = await cloud.uploadFile({
      cloudPath: `pdf-to-ppt/output/${pptFileName}`,
      fileContent: fs.createReadStream(pptFilePath)
    });

    // 5. 获取临时下载链接
    const tempUrlRes = await cloud.getTempFileURL({
        fileList: [uploadRes.fileID]
    });

    // 6. 清理临时文件
    // try {
    //   fs.rmdirSync(outputDir, { recursive: true });
    // } catch (e) { console.error('Cleanup error', e); }

    return {
      success: true,
      fileID: uploadRes.fileID,
      tempUrl: tempUrlRes.fileList[0].tempFileURL
    };

  } catch (error) {
    console.error('转换失败:', error);
    return {
      success: false,
      error: error.message || '转换失败'
    };
  }
}
