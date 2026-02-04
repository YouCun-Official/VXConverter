// cloudfunctions/wordToPdf/index.js
const cloud = require('wx-server-sdk');
const mammoth = require('mammoth');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * Word转PDF云函数 - 使用Puppeteer生成真正的PDF
 * 接收Word文件ID，转换为PDF并返回PDF文件ID
 */
exports.main = async (event, context) => {
    const { fileID, fileName } = event;

    try {
        console.log('开始处理Word文件:', fileName);

        // 1. 下载Word文件
        console.log('下载Word文件...');
        const downloadResult = await cloud.downloadFile({
            fileID: fileID
        });

        const wordBuffer = downloadResult.fileContent;

        // 2. 使用mammoth将Word转换为HTML
        console.log('转换Word为HTML...');
        const htmlResult = await mammoth.convertToHtml({
            buffer: wordBuffer
        });

        const htmlContent = htmlResult.value;
        const messages = htmlResult.messages;

        if (messages && messages.length > 0) {
            console.log('转换警告:', messages);
        }

        // 3. 准备完整的HTML文档（添加样式）
        const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: 'Microsoft YaHei', SimSun, sans-serif;
              line-height: 1.6;
              padding: 40px;
              color: #333;
            }
            h1, h2, h3, h4, h5, h6 {
              margin-top: 1.5em;
              margin-bottom: 0.5em;
            }
            p {
              margin: 0.5em 0;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 1em 0;
            }
            table td, table th {
              border: 1px solid #ddd;
              padding: 8px;
            }
            img {
              max-width: 100%;
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;

        // 4. 使用Puppeteer生成PDF
        console.log('启动Puppeteer生成PDF...');

        let browser = null;
        let pdfBuffer = null;

        try {
            // 启动浏览器
            browser = await puppeteer.launch({
                args: chromium.args,
                defaultViewport: chromium.defaultViewport,
                executablePath: await chromium.executablePath(),
                headless: chromium.headless,
            });

            const page = await browser.newPage();

            // 设置HTML内容
            await page.setContent(fullHtml, {
                waitUntil: 'networkidle0'
            });

            // 生成PDF
            pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20mm',
                    right: '15mm',
                    bottom: '20mm',
                    left: '15mm'
                }
            });

            console.log('PDF生成成功，大小:', pdfBuffer.length, 'bytes');

        } finally {
            // 确保关闭浏览器
            if (browser) {
                await browser.close();
            }
        }

        // 5. 上传PDF到云存储
        const pdfFileName = fileName.replace(/\.(doc|docx)$/i, '.pdf');
        const cloudPath = `pdf-files/${Date.now()}_${pdfFileName}`;

        console.log('上传PDF到云存储...');
        const uploadResult = await cloud.uploadFile({
            cloudPath: cloudPath,
            fileContent: pdfBuffer
        });

        console.log('PDF上传成功:', uploadResult.fileID);

        // 6. 返回结果
        return {
            success: true,
            pdfFileID: uploadResult.fileID,
            fileName: pdfFileName,
            fileSize: pdfBuffer.length,
            message: 'Word文档已成功转换为PDF'
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
