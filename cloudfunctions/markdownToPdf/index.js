// cloudfunctions/markdownToPdf/index.js - v1.1 增强版
const cloud = require('wx-server-sdk');
const PDFDocument = require('pdfkit');
const { marked } = require('marked');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * Markdown转PDF云函数 - v1.1增强版
 *
 * 新增功能：
 * - ✅ 表格支持
 * - ✅ 图片支持（网络图片和Base64）
 *
 * 原有功能：
 * - 标题 (H1-H6)
 * - 段落
 * - 列表（有序/无序）
 * - 代码块
 * - 引用块
 * - 水平线
 */
exports.main = async (event, context) => {
    const { fileID, fileName } = event;
    const tmpDir = '/tmp';

    try {
        console.log('开始处理Markdown文件 (v1.1):', fileName);

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
        console.log('PDF大小:', pdfBuffer.length, 'bytes');

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

        // 8. 返回结果
        return {
            success: true,
            pdfFileID: uploadResult.fileID,
            fileName: outputFileName,
            fileSize: pdfBuffer.length,
            version: 'v1.1',
            features: ['tables', 'images'],
            message: 'Markdown已成功转换为PDF (v1.1增强版)'
        };

    } catch (error) {
        console.error('转换失败:', error);

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
 * 渲染图片（新增）
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

        // 获取图片元数据
        const metadata = await sharp(imageBuffer).metadata();
        let { width, height } = metadata;

        // 计算图片尺寸
        const maxWidth = doc.page.width - 100; // 减去边距
        const maxHeight = 400;

        // 按比例缩放
        if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }
        if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
        }

        // 检查是否需要分页
        if (doc.y + height > 700) {
            doc.addPage();
        }

        // 保存处理后的图片到临时文件
        const tempImagePath = path.join('/tmp', `image_${Date.now()}.jpg`);
        await sharp(imageBuffer)
            .resize(Math.floor(width), Math.floor(height))
            .jpeg({ quality: 85 })
            .toFile(tempImagePath);

        // 插入图片（居中）
        const centerX = (doc.page.width - width) / 2;
        doc.image(tempImagePath, centerX, doc.y, {
            width: width,
            height: height
        });

        // 更新Y坐标
        doc.y += height;

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

        // 清理临时文件
        try {
            fs.unlinkSync(tempImagePath);
        } catch (err) {
            console.log('清理临时图片失败:', err);
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
 * 获取图片Buffer
 */
async function getImageBuffer(imageUrl) {
    try {
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            // 网络图片
            console.log('下载网络图片:', imageUrl);
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 10000, // 10秒超时
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            return Buffer.from(response.data);
        } else if (imageUrl.startsWith('data:image/')) {
            // Base64图片
            console.log('处理Base64图片');
            const base64Data = imageUrl.split(',')[1];
            return Buffer.from(base64Data, 'base64');
        } else {
            // 本地图片（云函数环境中不支持）
            console.log('本地图片路径不支持:', imageUrl);
            return null;
        }
    } catch (error) {
        console.error('获取图片失败:', error.message);
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
