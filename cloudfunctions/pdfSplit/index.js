// cloudfunctions/pdfSplit/index.js

const cloud = require('wx-server-sdk');
const { PDFDocument } = require('pdf-lib');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const { action } = event;

  try {
    if (action === 'getPageCount') {
      // 获取PDF页数
      return await getPageCount(event);
    } else if (action === 'split') {
      // 拆分PDF
      return await splitPDF(event);
    } else {
      return {
        success: false,
        error: '未知操作'
      };
    }
  } catch (error) {
    console.error('处理失败:', error);
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
    console.log('获取PDF页数, fileID:', fileID);

    // 下载PDF
    const res = await cloud.downloadFile({
      fileID: fileID
    });

    const pdfBytes = res.fileContent;

    // 加载PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();

    console.log('PDF页数:', pageCount);

    return {
      success: true,
      pageCount: pageCount
    };

  } catch (error) {
    console.error('获取页数失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 拆分PDF
 */
async function splitPDF(event) {
  const { fileID, mode } = event;

  try {
    console.log('拆分PDF, mode:', mode);

    // 下载PDF
    const res = await cloud.downloadFile({
      fileID: fileID
    });

    const pdfBytes = res.fileContent;
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();

    console.log('PDF总页数:', totalPages);

    let splitRanges = [];

    // 根据模式生成拆分范围
    if (mode === 'range') {
      // 范围拆分
      splitRanges = event.ranges;

    } else if (mode === 'single') {
      // 单页拆分
      for (let i = 1; i <= totalPages; i++) {
        splitRanges.push({ start: i, end: i });
      }

    } else if (mode === 'average') {
      // 平均拆分
      const splitCount = event.splitCount;
      const pagesPerSplit = Math.ceil(totalPages / splitCount);

      for (let i = 0; i < splitCount; i++) {
        const start = i * pagesPerSplit + 1;
        const end = Math.min((i + 1) * pagesPerSplit, totalPages);
        if (start <= totalPages) {
          splitRanges.push({ start, end });
        }
      }

    } else if (mode === 'oddeven') {
      // 奇偶拆分
      const oddEvenMode = event.oddEvenMode;
      const pages = [];

      for (let i = 1; i <= totalPages; i++) {
        if (oddEvenMode === 'odd' && i % 2 === 1) {
          pages.push(i);
        } else if (oddEvenMode === 'even' && i % 2 === 0) {
          pages.push(i);
        }
      }

      // 将连续的页码合并为范围
      if (pages.length > 0) {
        let start = pages[0];
        let end = pages[0];

        for (let i = 1; i < pages.length; i++) {
          if (pages[i] === end + 1) {
            end = pages[i];
          } else {
            splitRanges.push({ start, end });
            start = pages[i];
            end = pages[i];
          }
        }
        splitRanges.push({ start, end });
      }
    }

    console.log('拆分范围:', splitRanges);

    // 执行拆分
    const resultFiles = [];

    for (let i = 0; i < splitRanges.length; i++) {
      const range = splitRanges[i];
      const { start, end } = range;

      console.log(`拆分第 ${i + 1} 个文件: 页 ${start}-${end}`);

      // 创建新PDF
      const newPdfDoc = await PDFDocument.create();

      // 复制页面（注意：PDF页码从0开始）
      const pagesToCopy = [];
      for (let pageNum = start - 1; pageNum < end; pageNum++) {
        pagesToCopy.push(pageNum);
      }

      const copiedPages = await newPdfDoc.copyPages(pdfDoc, pagesToCopy);

      // 添加页面
      copiedPages.forEach((page) => {
        newPdfDoc.addPage(page);
      });

      // 保存PDF
      const newPdfBytes = await newPdfDoc.save();

      // 上传到云存储
      const fileName = generateFileName(start, end, i + 1);
      const uploadRes = await cloud.uploadFile({
        cloudPath: `pdf-split/output/${Date.now()}_${fileName}`,
        fileContent: Buffer.from(newPdfBytes)
      });

      resultFiles.push({
        fileID: uploadRes.fileID,
        name: fileName,
        pageRange: start === end ? `第${start}页` : `第${start}-${end}页`,
        pageCount: end - start + 1
      });

      console.log(`文件 ${i + 1} 生成成功`);
    }

    console.log('拆分完成, 共生成', resultFiles.length, '个文件');

    return {
      success: true,
      files: resultFiles
    };

  } catch (error) {
    console.error('拆分失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 生成文件名
 */
function generateFileName(start, end, index) {
  if (start === end) {
    return `page_${start}.pdf`;
  } else {
    return `pages_${start}-${end}.pdf`;
  }
}
