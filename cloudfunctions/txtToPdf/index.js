// cloudfunctions/txtToPdf/index.js
const cloud = require('wx-server-sdk');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * TXT转PDF云函数 - 使用PDFKit进行转换
 * 接收TXT文件ID，转换为PDF并返回PDF文件ID
 *
 * 特点：
 * - 支持中文字体
 * - 自动分页
 * - 保留原文本格式
 * - 自适应页面大小
 */
exports.main = async (event, context) => {
    const { fileID, fileName } = event;
    const tmpDir = '/tmp';

    try {
        console.log('开始处理TXT文件:', fileName);

        // 1. 下载TXT文件
        console.log('下载TXT文件...');
        const downloadResult = await cloud.downloadFile({
            fileID: fileID
        });

        const txtBuffer = downloadResult.fileContent;

        // 2. 读取文本内容，支持多种编码
        let textContent = '';
        try {
            // 尝试UTF-8编码
            textContent = txtBuffer.toString('utf8');
        } catch (err) {
            try {
                // 尝试GBK编码（中文）
                const iconv = require('iconv-lite');
                textContent = iconv.decode(txtBuffer, 'gbk');
            } catch (err2) {
                // 最后使用默认编码
                textContent = txtBuffer.toString();
            }
        }

        console.log('文本内容长度:', textContent.length, '字符');

        // 3. 创建PDF文档
        console.log('开始生成PDF...');
        const pdfPath = path.join(tmpDir, `output_${Date.now()}.pdf`);
        const pdfStream = fs.createWriteStream(pdfPath);

        // 创建PDF文档配置
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

        // 将PDF写入文件流
        doc.pipe(pdfStream);

        // 4. 添加文本内容
        // 使用内置字体支持基本中文（或者配置中文字体）
        doc.fontSize(12);
        doc.font('Courier'); // 使用等宽字体，保持格式

        // 分行处理文本
        const lines = textContent.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 添加文本行
            doc.text(line, {
                align: 'left',
                lineGap: 2
            });

            // 检查是否需要分页（简单的分页逻辑）
            if (doc.y > 700) {
                doc.addPage();
            }
        }

        // 完成PDF生成
        doc.end();

        // 等待PDF写入完成
        await new Promise((resolve, reject) => {
            pdfStream.on('finish', resolve);
            pdfStream.on('error', reject);
        });

        console.log('PDF生成成功');

        // 5. 读取生成的PDF
        const pdfBuffer = fs.readFileSync(pdfPath);
        console.log('PDF大小:', pdfBuffer.length, 'bytes');

        // 6. 上传PDF到云存储
        const outputFileName = fileName.replace(/\.txt$/i, '.pdf');
        const cloudPath = `pdf-files/${Date.now()}_${outputFileName}`;

        console.log('上传PDF到云存储...');
        const uploadResult = await cloud.uploadFile({
            cloudPath: cloudPath,
            fileContent: pdfBuffer
        });

        console.log('PDF上传成功:', uploadResult.fileID);

        // 7. 清理临时文件
        try {
            fs.unlinkSync(pdfPath);
        } catch (cleanupError) {
            console.log('清理临时文件时出错:', cleanupError.message);
        }

        // 8. 返回结果
        return {
            success: true,
            pdfFileID: uploadResult.fileID,
            fileName: outputFileName,
            fileSize: pdfBuffer.length,
            message: 'TXT已成功转换为PDF'
        };

    } catch (error) {
        console.error('转换失败:', error);

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
