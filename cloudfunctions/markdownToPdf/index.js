//路径：cloudfunctions/markdownToPdf
const cloud = require('wx-server-sdk');
const PDFDocument = require('pdfkit');
const { marked } = require('marked');
const axios = require('axios');
const probe = require('probe-image-size');
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
        console.log('开始处理Markdown文件 (v1.2优化版):', fileName);

        // 1. 下载Markdown文件
        console.log('下载Markdown文件...');
        const downloadResult = await cloud.downloadFile({
            fileID: fileID
        });

        const mdBuffer = downloadResult.fileContent;

        // 2. 读取Markdown内容，支持多种编码
        let markdownContent = '';
        try {
            markdownContent = mdBuffer.toString('utf8');
        } catch (err) {
            try {
                const iconv = require('iconv-lite');
                markdownContent = iconv.decode(mdBuffer, 'gbk');
            } catch (err2) {
                markdownContent = mdBuffer.toString();
            }
        }

        console.log('Markdown内容长度:', markdownContent.length, '字符');

        // 检查内容大小限制（防止超大文件）
        if (markdownContent.length > 500000) {
            return {
                success: false,
                error: '文件内容过大，最多支持50万字符'
            };
        }

        // 3. 创建PDF文档
        console.log('开始生成PDF...');
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

        // 4. 解析并渲染Markdown
        await renderMarkdownToPDF(doc, markdownContent);

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
        const outputFileName = fileName.replace(/\.(md|markdown)$/i, '.pdf');
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
            // 清理可能的图片临时文件
            const files = fs.readdirSync(tmpDir);
            files.forEach(file => {
                if (file.startsWith('image_') && (file.endsWith('.jpg') || file.endsWith('.png'))) {
                    try {
                        fs.unlinkSync(path.join(tmpDir, file));
                    } catch (e) {}
                }
            });
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
            version: 'v1.2',
            features: ['tables', 'images-optimized'],
            message: 'Markdown已成功转换为PDF (v1.2优化版)'
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
                if ((file.startsWith('output_') || file.startsWith('image_')) &&
                    (file.endsWith('.pdf') || file.endsWith('.jpg') || file.endsWith('.png'))) {
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
 * 渲染Markdown内容到PDF
 */
async function renderMarkdownToPDF(doc, markdownContent) {
    marked.setOptions({
        breaks: true,
        gfm: true // 支持GitHub Flavored Markdown（包括表格）
    });

    const tokens = marked.lexer(markdownContent);

    // 使用for...of保证异步顺序执行（图片需要异步处理）
    for (const token of tokens) {
        await renderToken(doc, token);
    }
}

/**
 * 渲染单个token
 */
async function renderToken(doc, token) {
    switch (token.type) {
        case 'heading':
            renderHeading(doc, token);
            break;
        case 'paragraph':
            await renderParagraph(doc, token);
            break;
        case 'list':
            renderList(doc, token);
            break;
        case 'code':
            renderCodeBlock(doc, token);
            break;
        case 'blockquote':
            renderBlockquote(doc, token);
            break;
        case 'hr':
            renderHorizontalRule(doc);
            break;
        case 'table':  // 新增：表格支持
            renderTable(doc, token);
            break;
        case 'space':
            doc.moveDown(0.5);
            break;
        default:
            if (token.text) {
                doc.fontSize(12).text(token.text, {
                    align: 'left'
                });
                doc.moveDown(0.5);
            }
    }

    checkAndAddPage(doc);
}

/**
 * 渲染标题
 */
function renderHeading(doc, token) {
    const sizes = {
        1: 24,
        2: 20,
        3: 18,
        4: 16,
        5: 14,
        6: 12
    };

    const size = sizes[token.depth] || 12;

    doc.fontSize(size)
       .font('Helvetica-Bold')
       .text(token.text, {
           align: 'left'
       })
       .font('Helvetica')
       .moveDown(0.5);
}

/**
 * 渲染段落（增强版：支持图片）
 */
async function renderParagraph(doc, token) {
    // 检查是否包含图片
    if (token.tokens && token.tokens.length > 0) {
        let hasImage = false;
        let textParts = [];

        for (const subToken of token.tokens) {
            if (subToken.type === 'image') {
                hasImage = true;
                // 先输出之前的文本
                if (textParts.length > 0) {
                    const text = textParts.join('');
                    doc.fontSize(12).text(text, {
                        align: 'left',
                        lineGap: 2
                    });
                    textParts = [];
                    doc.moveDown(0.3);
                }
                // 渲染图片
                await renderImage(doc, subToken);
            } else if (subToken.type === 'text' || subToken.text) {
                textParts.push(stripInlineFormatting(subToken.text || subToken.raw || ''));
            }
        }

        // 输出剩余文本
        if (textParts.length > 0) {
            const text = textParts.join('');
            doc.fontSize(12).text(text, {
                align: 'left',
                lineGap: 2
            });
        }

        if (hasImage || textParts.length > 0) {
            doc.moveDown(0.5);
        }
    } else {
        // 普通段落
        const text = stripInlineFormatting(token.text);
        doc.fontSize(12).text(text, {
            align: 'left',
            lineGap: 2
        });
        doc.moveDown(0.5);
    }
}

/**
 * 渲染图片（优化版：移除sharp依赖）
 */
async function renderImage(doc, token) {
    try {
        const imageUrl = token.href;
        const imageAlt = token.text || '图片';

        console.log('处理图片:', imageUrl);

        // 下载或读取图片
        const imageBuffer = await getImageBuffer(imageUrl);

        if (!imageBuffer) {
            // 图片加载失败，显示占位文本
            doc.fontSize(10)
               .fillColor('#999999')
               .text(`[图片加载失败: ${imageAlt}]`, {
                   align: 'left'
               })
               .fillColor('#000000');
            doc.moveDown(0.5);
            return;
        }

        console.log('图片大小:', formatBytes(imageBuffer.length));

        // 检查图片大小限制（5MB）
        const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
        if (imageBuffer.length > MAX_IMAGE_SIZE) {
            console.log('图片过大，跳过');
            doc.fontSize(10)
               .fillColor('#ff9800')
               .text(`[图片过大(${formatBytes(imageBuffer.length)})，已跳过: ${imageAlt}]`, {
                   align: 'left'
               })
               .fillColor('#000000');
            doc.moveDown(0.5);
            return;
        }

        // 使用 probe-image-size 获取图片尺寸（不加载整个图片）
        let width, height;
        try {
            const dimensions = await probe.sync(imageBuffer);
            width = dimensions.width;
            height = dimensions.height;
            console.log('图片尺寸:', width, 'x', height);
        } catch (err) {
            console.log('无法获取图片尺寸，使用默认值');
            width = 400;
            height = 300;
        }

        // 计算缩放后的尺寸
        const maxWidth = doc.page.width - 100; // 减去边距
        const maxHeight = 400;

        // 按比例缩放
        let scaledWidth = width;
        let scaledHeight = height;

        if (scaledWidth > maxWidth) {
            scaledHeight = (scaledHeight * maxWidth) / scaledWidth;
            scaledWidth = maxWidth;
        }
        if (scaledHeight > maxHeight) {
            scaledWidth = (scaledWidth * maxHeight) / scaledHeight;
            scaledHeight = maxHeight;
        }

        // 检查是否需要分页
        if (doc.y + scaledHeight > 700) {
            doc.addPage();
        }

        // 直接插入图片（PDFKit 会自动处理）
        const centerX = (doc.page.width - scaledWidth) / 2;

        try {
            doc.image(imageBuffer, centerX, doc.y, {
                width: scaledWidth,
                height: scaledHeight,
                align: 'center'
            });

            // 更新Y坐标
            doc.y += scaledHeight;

            // 显示图片描述（如果有）
            if (imageAlt && imageAlt !== '图片') {
                doc.moveDown(0.2);
                doc.fontSize(10)
                   .fillColor('#666666')
                   .text(imageAlt, {
                       align: 'center'
                   })
                   .fillColor('#000000');
            }

            doc.moveDown(1);

        } catch (pdfError) {
            console.error('PDFKit 插入图片失败:', pdfError);
            // 显示错误占位
            doc.fontSize(10)
               .fillColor('#ff0000')
               .text(`[图片格式不支持: ${imageAlt}]`, {
                   align: 'left'
               })
               .fillColor('#000000');
            doc.moveDown(0.5);
        }

    } catch (error) {
        console.error('图片渲染失败:', error);

        // 显示错误占位
        doc.fontSize(10)
           .fillColor('#ff0000')
           .text(`[图片错误: ${token.text || 'unknown'}]`, {
               align: 'left'
           })
           .fillColor('#000000');
        doc.moveDown(0.5);
    }
}

/**
 * 获取图片Buffer（优化版）
 */
async function getImageBuffer(imageUrl) {
    try {
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            // 网络图片
            console.log('下载网络图片:', imageUrl);
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 8000, // 8秒超时（降低以避免云函数超时）
                maxContentLength: 5 * 1024 * 1024, // 最大5MB
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                validateStatus: (status) => status === 200 // 只接受200状态码
            });
            return Buffer.from(response.data);
        } else if (imageUrl.startsWith('data:image/')) {
            // Base64图片
            console.log('处理Base64图片');
            const base64Data = imageUrl.split(',')[1];
            if (!base64Data) {
                console.log('Base64数据格式错误');
                return null;
            }
            const buffer = Buffer.from(base64Data, 'base64');
            // 检查大小
            if (buffer.length > 5 * 1024 * 1024) {
                console.log('Base64图片过大');
                return null;
            }
            return buffer;
        } else {
            // 本地图片（云函数环境中不支持）
            console.log('本地图片路径不支持:', imageUrl);
            return null;
        }
    } catch (error) {
        console.error('获取图片失败:', error.message);
        if (error.code === 'ECONNABORTED') {
            console.log('图片下载超时');
        } else if (error.response) {
            console.log('HTTP错误:', error.response.status);
        }
        return null;
    }
}

/**
 * 渲染列表
 */
function renderList(doc, token) {
    token.items.forEach((item, index) => {
        const bullet = token.ordered ? `${index + 1}. ` : '• ';
        const text = stripInlineFormatting(item.text);

        doc.fontSize(12)
           .text(bullet + text, {
               indent: 20,
               align: 'left'
           });
    });

    doc.moveDown(0.5);
}

/**
 * 渲染代码块
 */
function renderCodeBlock(doc, token) {
    const lines = token.text.split('\n');
    const lineHeight = 12;
    const padding = 10;
    const boxHeight = lines.length * lineHeight + padding * 2;

    doc.fontSize(10)
       .font('Courier')
       .fillColor('#333333');

    // 绘制背景
    doc.rect(doc.x - 5, doc.y - 5, doc.page.width - 100, boxHeight)
       .fillAndStroke('#f5f5f5', '#cccccc');

    // 绘制代码文本
    doc.fillColor('#000000')
       .text(token.text, doc.x, doc.y, {
           align: 'left'
       })
       .font('Helvetica')
       .moveDown(1);
}

/**
 * 渲染引用块
 */
function renderBlockquote(doc, token) {
    const text = stripInlineFormatting(token.text);

    doc.fontSize(12)
       .fillColor('#666666')
       .text('  ' + text, {
           indent: 20,
           align: 'left'
       })
       .fillColor('#000000')
       .moveDown(0.5);
}

/**
 * 渲染水平线
 */
function renderHorizontalRule(doc) {
    doc.moveTo(doc.x, doc.y)
       .lineTo(doc.page.width - 100, doc.y)
       .stroke('#cccccc')
       .moveDown(1);
}

/**
 * 渲染表格（新增）
 */
function renderTable(doc, token) {
    try {
        console.log('渲染表格');

        const tableData = parseTableToken(token);

        // 表格配置
        const startX = doc.x;
        const tableWidth = doc.page.width - 100;
        const colCount = tableData.header.length;
        const colWidth = tableWidth / colCount;
        const rowHeight = 30;

        // 计算表格总高度
        const totalHeight = (tableData.rows.length + 1) * rowHeight;

        // 检查是否需要分页
        if (doc.y + totalHeight > 700) {
            doc.addPage();
        }

        // 绘制表头
        drawTableRow(doc, tableData.header, startX, doc.y, colWidth, rowHeight, true);
        doc.y += rowHeight;

        // 绘制数据行
        tableData.rows.forEach((row, index) => {
            // 检查单行是否需要分页
            if (doc.y + rowHeight > 700) {
                doc.addPage();
                // 在新页面上重新绘制表头
                drawTableRow(doc, tableData.header, startX, doc.y, colWidth, rowHeight, true);
                doc.y += rowHeight;
            }

            drawTableRow(doc, row, startX, doc.y, colWidth, rowHeight, false);
            doc.y += rowHeight;
        });

        doc.moveDown(1);

    } catch (error) {
        console.error('表格渲染失败:', error);

        // 显示错误占位
        doc.fontSize(10)
           .fillColor('#ff0000')
           .text('[表格渲染失败]', {
               align: 'left'
           })
           .fillColor('#000000');
        doc.moveDown(1);
    }
}

/**
 * 解析表格token
 */
function parseTableToken(token) {
    const header = token.header.map(cell => {
        const text = cell.text || cell.tokens?.[0]?.text || '';
        return stripInlineFormatting(text);
    });

    const rows = token.rows.map(row =>
        row.map(cell => {
            const text = cell.text || cell.tokens?.[0]?.text || '';
            return stripInlineFormatting(text);
        })
    );

    return { header, rows };
}

/**
 * 绘制表格行
 */
function drawTableRow(doc, rowData, startX, startY, colWidth, rowHeight, isHeader) {
    const fontSize = isHeader ? 11 : 10;
    const fontStyle = isHeader ? 'Helvetica-Bold' : 'Helvetica';
    const fillColor = isHeader ? '#e8f5e9' : '#ffffff';
    const borderColor = '#4caf50';

    rowData.forEach((cell, colIndex) => {
        const cellX = startX + colIndex * colWidth;

        // 保存当前状态
        doc.save();

        // 绘制单元格背景和边框
        doc.rect(cellX, startY, colWidth, rowHeight)
           .fillAndStroke(fillColor, borderColor);

        // 绘制文字
        doc.fontSize(fontSize)
           .font(fontStyle)
           .fillColor('#000000');

        // 文字垂直居中
        const textY = startY + (rowHeight - fontSize) / 2;

        doc.text(cell || '', cellX + 5, textY, {
            width: colWidth - 10,
            height: rowHeight - 10,
            align: 'left',
            ellipsis: true
        });

        // 恢复状态
        doc.restore();
    });
}

/**
 * 去除内联格式标记
 */
function stripInlineFormatting(text) {
    if (!text) return '';

    return text
        .replace(/\*\*(.+?)\*\*/g, '$1')     // 粗体
        .replace(/\*(.+?)\*/g, '$1')         // 斜体
        .replace(/__(.+?)__/g, '$1')         // 粗体
        .replace(/_(.+?)_/g, '$1')           // 斜体
        .replace(/`(.+?)`/g, '$1')           // 行内代码
        .replace(/\[(.+?)\]\(.+?\)/g, '$1'); // 链接
}

/**
 * 检查是否需要分页
 */
function checkAndAddPage(doc) {
    if (doc.y > 700) {
        doc.addPage();
    }
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
