// cloudfunctions/pdfMerge/index.js

const cloud = require('wx-server-sdk');
const { PDFDocument } = require('pdf-lib');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const { fileIDs } = event;

  if (!fileIDs || fileIDs.length < 2) {
    return {
      success: false,
      error: '至少需要2个PDF文件'
    };
  }

  try {
    console.log('开始合并PDF, 文件数量:', fileIDs.length);

    // 1. 创建新的PDF文档
    const mergedPdf = await PDFDocument.create();

    // 2. 下载并合并每个PDF
    for (let i = 0; i < fileIDs.length; i++) {
      const fileID = fileIDs[i];
      console.log(`处理第 ${i + 1} 个PDF: ${fileID}`);

      try {
        // 下载PDF文件
        const res = await cloud.downloadFile({
          fileID: fileID
        });

        // 加载PDF
        const pdfBytes = res.fileContent;
        const pdf = await PDFDocument.load(pdfBytes);

        // 复制所有页面
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

        // 添加到合并后的PDF
        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
        });

        console.log(`第 ${i + 1} 个PDF合并完成, 页数: ${pdf.getPageCount()}`);

      } catch (error) {
        console.error(`处理第 ${i + 1} 个PDF失败:`, error);
        throw new Error(`第 ${i + 1} 个PDF处理失败: ${error.message}`);
      }
    }

    // 3. 保存合并后的PDF
    console.log('保存合并后的PDF...');
    const mergedPdfBytes = await mergedPdf.save();

    // 4. 上传到云存储
    const uploadRes = await cloud.uploadFile({
      cloudPath: `pdf-merge/output/merged_${Date.now()}.pdf`,
      fileContent: Buffer.from(mergedPdfBytes)
    });

    console.log('合并完成, 文件ID:', uploadRes.fileID);

    return {
      success: true,
      fileID: uploadRes.fileID,
      pageCount: mergedPdf.getPageCount(),
      size: mergedPdfBytes.length
    };

  } catch (error) {
    console.error('PDF合并失败:', error);
    return {
      success: false,
      error: error.message || 'PDF合并失败'
    };
  }
};
