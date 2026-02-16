// cloudfunctions/pdfToWord/index.js
const cloud = require('wx-server-sdk');
const pdfParse = require('pdf-parse');
const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } = require('docx');
const { PDFDocument } = require('pdf-lib');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * PDF转Word云函数
 * 接收PDF文件ID，提取内容转换为Word并返回Word文件ID
 * 
 * 注意：PDF转Word是有损转换，主要提取文本内容
 * 复杂的排版、图片、表格等可能无法完美还原
 */
exports.main = async (event, context) => {
  const { fileID, fileName, options = {} } = event;

  // 默认选项
  const {
    preserveFormatting = true,  // 尝试保留格式
    includeImages = false,      // 是否包含图片（暂不支持）
    pageBreaks = true          // 是否保留分页符
  } = options;

  try {
    console.log('开始处理PDF文件:', fileName);

    // 1. 下载PDF文件
    console.log('下载PDF文件...');
    const downloadResult = await cloud.downloadFile({
      fileID: fileID
    });

    const pdfBuffer = downloadResult.fileContent;
    console.log('PDF文件大小:', pdfBuffer.length, 'bytes');

    // 2. 使用pdf-lib获取PDF基本信息
    console.log('读取PDF信息...');
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    console.log('PDF页数:', pageCount);

    // 3. 使用pdf-parse提取文本内容
    console.log('提取PDF文本内容...');
    const pdfData = await pdfParse(pdfBuffer);
    
    const textContent = pdfData.text;
    const totalPages = pdfData.numpages;
    
    console.log('提取的文本长度:', textContent.length);
    console.log('提取的页数:', totalPages);

    if (!textContent || textContent.trim().length === 0) {
      throw new Error('PDF中未找到可提取的文本内容，可能是扫描版或图片PDF');
    }

    // 4. 将文本转换为Word文档
    console.log('生成Word文档...');
    const wordDoc = await createWordDocument(textContent, fileName, {
      preserveFormatting,
      pageBreaks,
      pageCount: totalPages
    });

    // 5. 生成Word文件Buffer
    const wordBuffer = await Packer.toBuffer(wordDoc);
    console.log('Word文档生成成功，大小:', wordBuffer.length, 'bytes');

    // 6. 上传Word文档到云存储
    const wordFileName = fileName.replace(/\.pdf$/i, '.docx');
    const cloudPath = `word-files/${Date.now()}_${wordFileName}`;

    console.log('上传Word文档到云存储...');
    const uploadResult = await cloud.uploadFile({
      cloudPath: cloudPath,
      fileContent: wordBuffer
    });

    console.log('Word文档上传成功:', uploadResult.fileID);

    // 7. 返回结果
    return {
      success: true,
      wordFileID: uploadResult.fileID,
      fileName: wordFileName,
      fileSize: wordBuffer.length,
      pageCount: totalPages,
      textLength: textContent.length,
      message: 'PDF已成功转换为Word文档'
    };

  } catch (error) {
    console.error('转换失败:', error);
    return {
      success: false,
      error: error.message || '转换过程中发生错误',
      details: error.stack
    };
  }
};

/**
 * 创建Word文档
 * @param {String} textContent - PDF提取的文本内容
 * @param {String} fileName - 原始文件名
 * @param {Object} options - 转换选项
 * @returns {Document} Word文档对象
 */
async function createWordDocument(textContent, fileName, options) {
  const { preserveFormatting, pageBreaks, pageCount } = options;

  // 分割文本为段落（按双换行符分割）
  const rawParagraphs = textContent.split(/\n\n+/);
  const paragraphs = [];

  // 添加标题
  paragraphs.push(
    new Paragraph({
      text: `从PDF转换: ${fileName}`,
      heading: HeadingLevel.HEADING_1,
      spacing: {
        after: 200
      }
    })
  );

  // 添加转换信息
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `转换时间: ${new Date().toLocaleString('zh-CN')}`,
          italics: true,
          size: 20,
          color: '666666'
        })
      ],
      spacing: {
        after: 200
      }
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `原PDF页数: ${pageCount}`,
          italics: true,
          size: 20,
          color: '666666'
        })
      ],
      spacing: {
        after: 400
      }
    })
  );

  // 处理提取的文本内容
  let pageCounter = 1;
  
  for (let i = 0; i < rawParagraphs.length; i++) {
    const text = rawParagraphs[i].trim();
    
    if (text.length === 0) continue;

    // 检测是否是标题（简单规则：短行且以大写或数字开头）
    const isHeading = text.length < 100 && 
                      /^[A-Z0-9第一二三四五六七八九十\d]+/.test(text) &&
                      !text.endsWith('。') &&
                      !text.endsWith('.');

    if (isHeading) {
      // 作为标题
      paragraphs.push(
        new Paragraph({
          text: text,
          heading: HeadingLevel.HEADING_2,
          spacing: {
            before: 240,
            after: 120
          }
        })
      );
    } else {
      // 普通段落 - 处理单行换行
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      
      for (const line of lines) {
        paragraphs.push(
          new Paragraph({
            text: line,
            spacing: {
              after: 120,
              line: 360
            }
          })
        );
      }
    }

    // 每隔一定段落数添加分页符（模拟原PDF的分页）
    if (pageBreaks && i > 0 && i % Math.ceil(rawParagraphs.length / pageCount) === 0) {
      pageCounter++;
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '',
              break: 1
            })
          ],
          pageBreakBefore: true
        })
      );
    }
  }

  // 创建Word文档
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 inch = 1440 twips
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        children: paragraphs
      }
    ],
    creator: 'VXConverter',
    description: `Converted from PDF: ${fileName}`,
    title: fileName.replace(/\.pdf$/i, '')
  });

  return doc;
}
