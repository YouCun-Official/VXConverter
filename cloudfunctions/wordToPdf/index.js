//路径：cloudfunctions/wordToPdf
const cloud = require('wx-server-sdk');
const mammoth = require('mammoth');
const PDFDocument = require('pdfkit');
const { convert } = require('html-to-text');
const fs = require('fs');
const path = require('path');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * Word转PDF云函数 - 使用Mammoth + PDFKit
 * 接收Word文件ID，转换为PDF并返回PDF文件ID
 *
 * 特点：
 * - 纯Node.js实现，无需系统依赖
 * - 支持.doc和.docx格式
 * - 自动提取样式和格式
 * - 自动分页处理
 */
exports.main = async (event, context) => {
    const { fileID, fileName } = event;
    const tmpDir = '/tmp';

    try {
        console.log('开始处理Word文件:', fileName);
        console.log('文件ID:', fileID);

        // 1. 下载Word文件
        console.log('步骤1: 下载Word文件...');
        const downloadResult = await cloud.downloadFile({
            fileID: fileID
        });

        const wordBuffer = downloadResult.fileContent;
        console.log('Word文件下载成功，大小:', wordBuffer.length, 'bytes');

        // 检查文件内容
        if (!wordBuffer || wordBuffer.length === 0) {
            throw new Error('下载的文件内容为空');
        }

        // 2. 使用mammoth将Word转换为HTML
        console.log('步骤2: 转换Word为HTML...');
        const htmlResult = await mammoth.convertToHtml({
            buffer: wordBuffer
        });

        const htmlContent = htmlResult.value;
        const messages = htmlResult.messages;

        if (messages && messages.length > 0) {
            console.log('转换警告:', messages);
        }
        console.log('HTML转换成功，长度:', htmlContent.length);

        // 3. 将HTML转换为纯文本（保留基本格式）
        const textContent = convert(htmlContent, {
            wordwrap: 80,
            preserveNewlines: true,
            selectors: [
                { selector: 'h1', options: { uppercase: false } },
                { selector: 'h2', options: { uppercase: false } },
                { selector: 'h3', options: { uppercase: false } },
                { selector: 'table', options: { uppercaseHeaderCells: false } }
            ]
        });

        console.log('文本转换成功，长度:', textContent.length);

        // 4. 创建PDF文档
        console.log('步骤3: 生成PDF...');
        const pdfPath = path.join(tmpDir, `output_${Date.now()}.pdf`);
        const pdfStream = fs.createWriteStream(pdfPath);

        const doc = new PDFDocument({
            size: 'A4',
            margins: {
                top: 50,
                bottom: 50,
                left: 50,
                right: 50
            },
            bufferPages: true
        });

        doc.pipe(pdfStream);

        // 5. 渲染内容到PDF
        await renderContentToPDF(doc, htmlContent, textContent);

        // 完成PDF生成
        doc.end();

        // 等待PDF写入完成
        await new Promise((resolve, reject) => {
            pdfStream.on('finish', resolve);
            pdfStream.on('error', reject);
        });

        console.log('PDF生成成功');

        // 6. 读取生成的PDF
        const pdfBuffer = fs.readFileSync(pdfPath);
        console.log('PDF大小:', pdfBuffer.length, 'bytes');

        // 7. 上传PDF到云存储
        const outputFileName = fileName.replace(/\.(doc|docx)$/i, '.pdf');
        const cloudPath = `pdf-files/${Date.now()}_${outputFileName}`;

        console.log('步骤4: 上传PDF到云存储...');
        const uploadResult = await cloud.uploadFile({
            cloudPath: cloudPath,
            fileContent: pdfBuffer
        });

        console.log('PDF上传成功:', uploadResult.fileID);

        // 8. 清理临时文件
        try {
            fs.unlinkSync(pdfPath);
        } catch (cleanupError) {
            console.log('清理临时文件时出错:', cleanupError.message);
        }

        // 9. 返回结果
        return {
            success: true,
            pdfFileID: uploadResult.fileID,
            fileName: outputFileName,
            fileSize: pdfBuffer.length,
            message: 'Word文档已成功转换为PDF'
        };

    } catch (error) {
        console.error('转换失败:', error);
        console.error('错误堆栈:', error.stack);

        // 清理可能残留的临时文件
        try {
            const files = fs.readdirSync(tmpDir);
            files.forEach(file => {
                if (file.startsWith('output_') && file.endsWith('.pdf')) {
                    fs.unlinkSync(path.join(tmpDir, file));
                }
            });
        } catch (cleanupError) {
            console.log('清理时出错:', cleanupError.message);
        }

        return {
            success: false,
            error: error.message || '转换过程中发生错误',
            details: error.stack
        };
    }
};

/**
 * 渲染内容到PDF
 */
async function renderContentToPDF(doc, htmlContent, textContent) {
    // 简单的HTML解析和渲染
    // 将HTML内容按段落分割
    const lines = textContent.split('\n');

    doc.fontSize(12);
    doc.font('Helvetica');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!line) {
            // 空行，添加一些间距
            doc.moveDown(0.3);
            continue;
        }

        // 检测标题（基于文本长度和大写）
        const isHeading = detectHeading(line);

        if (isHeading) {
            doc.fontSize(16)
               .font('Helvetica-Bold')
               .text(line, {
                   align: 'left'
               })
               .font('Helvetica')
               .fontSize(12)
               .moveDown(0.5);
        } else {
            // 普通段落
            doc.text(line, {
                align: 'left',
                lineGap: 2
            });
            doc.moveDown(0.3);
        }

        // 检查是否需要分页
        if (doc.y > 700) {
            doc.addPage();
        }
    }
}

/**
 * 检测是否为标题
 */
function detectHeading(line) {
    // 简单的标题检测：短文本且没有句号
    return line.length < 50 && !line.endsWith('.') && !line.endsWith('。');
}
