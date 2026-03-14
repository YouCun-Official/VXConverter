//路径：cloudfunctions/excelToPdf
//作用：使用纯JavaScript方案（ExcelJS + PDFKit）将Excel转换为PDF
const cloud = require('wx-server-sdk');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
    const { fileID, fileName } = event;
    const tmpDir = '/tmp';

    // 记录初始内存
    const memStart = process.memoryUsage();
    console.log('开始转换 - 初始内存:', formatMemory(memStart));

    try {
        console.log('开始处理Excel文件 (v2.0纯JS版):', fileName);

        // 1. 下载Excel文件
        console.log('下载Excel文件...');
        const downloadResult = await cloud.downloadFile({
            fileID: fileID
        });

        const excelBuffer = downloadResult.fileContent;
        console.log('Excel文件大小:', formatBytes(excelBuffer.length));

        // 检查文件大小限制（10MB）
        if (excelBuffer.length > 10 * 1024 * 1024) {
            return {
                success: false,
                error: 'Excel文件过大，最多支持10MB'
            };
        }

        // 2. 使用ExcelJS读取Excel
        console.log('解析Excel内容...');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(excelBuffer);

        // 检查工作表数量
        if (workbook.worksheets.length === 0) {
            return {
                success: false,
                error: 'Excel文件为空'
            };
        }

        console.log('工作表数量:', workbook.worksheets.length);

        // 3. 创建PDF文档
        console.log('开始生成PDF...');
        const pdfPath = path.join(tmpDir, `output_${Date.now()}.pdf`);
        const pdfStream = fs.createWriteStream(pdfPath);

        const doc = new PDFDocument({
            size: 'A4',
            layout: 'landscape', // 横向，适合表格
            margins: {
                top: 40,
                bottom: 40,
                left: 40,
                right: 40
            }
        });

        doc.pipe(pdfStream);

        // 4. 渲染每个工作表
        let sheetIndex = 0;
        for (const worksheet of workbook.worksheets) {
            if (sheetIndex > 0) {
                doc.addPage(); // 新工作表从新页开始
            }

            console.log(`处理工作表 ${sheetIndex + 1}: ${worksheet.name}`);
            await renderWorksheetToPDF(doc, worksheet);
            sheetIndex++;

            // 限制最多5个工作表
            if (sheetIndex >= 5) {
                console.log('已达到最大工作表数量限制（5个）');
                break;
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
        console.log('PDF大小:', formatBytes(pdfBuffer.length));

        const memAfterPdf = process.memoryUsage();
        console.log('PDF生成后内存:', formatMemory(memAfterPdf));

        // 6. 上传PDF到云存储
        const outputFileName = fileName.replace(/\.(xls|xlsx)$/i, '.pdf');
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

        const memEnd = process.memoryUsage();
        console.log('转换完成 - 最终内存:', formatMemory(memEnd));
        console.log('内存增长:', formatBytes(memEnd.heapUsed - memStart.heapUsed));

        // 8. 返回结果
        return {
            success: true,
            pdfFileID: uploadResult.fileID,
            fileName: outputFileName,
            fileSize: pdfBuffer.length,
            version: 'v2.0',
            method: 'pure-javascript',
            sheetsProcessed: Math.min(sheetIndex, 5),
            message: 'Excel已成功转换为PDF (v2.0纯JS版)'
        };

    } catch (error) {
        console.error('转换失败:', error);
        console.error('错误堆栈:', error.stack);

        const memError = process.memoryUsage();
        console.log('失败时内存:', formatMemory(memError));

        // 清理可能残留的临时文件
        try {
            const files = fs.readdirSync(tmpDir);
            files.forEach(file => {
                if (file.startsWith('output_') && file.endsWith('.pdf')) {
                    try {
                        fs.unlinkSync(path.join(tmpDir, file));
                    } catch (e) {}
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
 * 渲染工作表到PDF
 */
async function renderWorksheetToPDF(doc, worksheet) {
    // 工作表标题
    doc.fontSize(16)
       .fillColor('#333333')
       .text(worksheet.name, {
           align: 'center'
       });
    doc.moveDown(0.5);

    // 获取实际使用的行列范围
    const dimensions = worksheet.dimensions;
    if (!dimensions || !dimensions.model) {
        doc.fontSize(12).text('(空工作表)', { align: 'center' });
        return;
    }

    const startRow = dimensions.top;
    const endRow = Math.min(dimensions.bottom, dimensions.top + 50); // 最多50行
    const startCol = dimensions.left;
    const endCol = Math.min(dimensions.right, dimensions.left + 10); // 最多10列

    console.log(`  行范围: ${startRow}-${endRow}, 列范围: ${startCol}-${endCol}`);

    // 计算列宽
    const pageWidth = doc.page.width - 80; // 减去边距
    const colCount = endCol - startCol + 1;
    const colWidth = Math.min(pageWidth / colCount, 150); // 每列最多150pt

    // 收集表格数据
    const rows = [];
    for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
        const row = worksheet.getRow(rowNum);
        const cells = [];

        for (let colNum = startCol; colNum <= endCol; colNum++) {
            const cell = row.getCell(colNum);
            let value = '';

            if (cell.value !== null && cell.value !== undefined) {
                if (typeof cell.value === 'object') {
                    // 处理公式、富文本等
                    if (cell.value.result !== undefined) {
                        value = String(cell.value.result);
                    } else if (cell.value.richText) {
                        value = cell.value.richText.map(t => t.text).join('');
                    } else {
                        value = String(cell.value);
                    }
                } else {
                    value = String(cell.value);
                }
            }

            // 限制单元格内容长度
            if (value.length > 100) {
                value = value.substring(0, 97) + '...';
            }

            cells.push(value);
        }

        rows.push(cells);
    }

    // 渲染表格
    const startY = doc.y;
    const startX = 40;

    // 表格边框颜色
    doc.strokeColor('#cccccc');
    doc.lineWidth(0.5);

    // 绘制表格
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const y = startY + (i * 25);

        // 检查是否需要分页
        if (y > doc.page.height - 80) {
            doc.addPage();
            // 重新绘制表头
            if (i > 0 && rows.length > 0) {
                const headerY = 40;
                for (let j = 0; j < rows[0].length; j++) {
                    const x = startX + (j * colWidth);

                    // 背景
                    doc.rect(x, headerY, colWidth, 25)
                       .fillAndStroke('#f0f0f0', '#cccccc');

                    // 文本
                    doc.fillColor('#000000')
                       .fontSize(9)
                       .text(rows[0][j] || '', x + 5, headerY + 8, {
                           width: colWidth - 10,
                           height: 25,
                           ellipsis: true
                       });
                }
            }
            break; // 分页后停止
        }

        // 绘制行
        for (let j = 0; j < row.length; j++) {
            const x = startX + (j * colWidth);
            const cell = row[j];

            // 第一行（表头）使用灰色背景
            if (i === 0) {
                doc.rect(x, y, colWidth, 25)
                   .fillAndStroke('#f0f0f0', '#cccccc');
            } else {
                doc.rect(x, y, colWidth, 25)
                   .stroke();
            }

            // 文本
            doc.fillColor('#000000')
               .fontSize(i === 0 ? 10 : 9)
               .font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
               .text(cell || '', x + 5, y + 8, {
                   width: colWidth - 10,
                   height: 25,
                   ellipsis: true
               });
        }
    }

    doc.moveDown(2);
}

/**
 * 内存格式化工具函数
 */
function formatMemory(mem) {
    return `堆: ${formatBytes(mem.heapUsed)}/${formatBytes(mem.heapTotal)}, RSS: ${formatBytes(mem.rss)}`;
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + 'KB';
    return (bytes / 1024 / 1024).toFixed(2) + 'MB';
}
