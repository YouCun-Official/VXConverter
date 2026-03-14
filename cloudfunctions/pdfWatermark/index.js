//路径：cloudfunctions/pdfWatermark

const cloud = require('wx-server-sdk');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs = require('fs');
const path = require('path');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const {
    fileID,
    watermarkText,
    fontSize = 60,
    opacity = 0.3,
    color = '#999999',
    rotation = 45,
    position = 'tile'
  } = event;

  if (!fileID || !watermarkText) {
    return {
      success: false,
      error: '缺少必要参数'
    };
  }

  try {
    console.log('开始添加水印:', { watermarkText, fontSize, opacity, position });

    // 1. 下载PDF文件
    const res = await cloud.downloadFile({
      fileID: fileID
    });

    const pdfBytes = res.fileContent;

    // 2. 加载PDF，注册 fontkit 以支持自定义字体（含中文）
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);

    // 3. 嵌入中文字体（font.ttf 需放在本云函数目录下一起部署）
    const fontPath = path.join(__dirname, 'font.ttf');
    let customFont;
    try {
      const fontBytes = fs.readFileSync(fontPath);
      customFont = await pdfDoc.embedFont(fontBytes);
    } catch (e) {
      console.error('加载字体失败:', e.message);
      return {
        success: false,
        error: '缺少中文字体文件 font.ttf，请将支持中文的 TTF 字体重命名为 font.ttf 放入云函数目录后重新部署'
      };
    }

    const pages = pdfDoc.getPages();
    console.log('PDF页数:', pages.length);

    // 4. 解析颜色
    const colorRgb = hexToRgb(color);

    // 5. 为每一页添加水印
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();

      console.log(`处理第 ${i + 1} 页, 尺寸: ${width}x${height}`);

      if (position === 'tile') {
        addTiledWatermark(page, watermarkText, {
          fontSize, opacity, color: colorRgb, rotation, width, height, font: customFont
        });
      } else {
        addSingleWatermark(page, watermarkText, {
          fontSize, opacity, color: colorRgb, rotation, width, height, position, font: customFont
        });
      }
    }

    // 5. 保存PDF
    console.log('保存PDF...');
    const watermarkedPdfBytes = await pdfDoc.save();

    // 6. 上传到云存储
    const uploadRes = await cloud.uploadFile({
      cloudPath: `pdf-watermark/output/watermarked_${Date.now()}.pdf`,
      fileContent: Buffer.from(watermarkedPdfBytes)
    });

    console.log('水印添加完成, 文件ID:', uploadRes.fileID);

    return {
      success: true,
      fileID: uploadRes.fileID,
      pageCount: pages.length,
      size: watermarkedPdfBytes.length
    };

  } catch (error) {
    console.error('添加水印失败:', error);
    return {
      success: false,
      error: error.message || '添加水印失败'
    };
  }
};

/**
 * 添加平铺水印
 */
function addTiledWatermark(page, text, options) {
  const { fontSize, opacity, color, rotation, width, height, font } = options;

  const spacingX = fontSize * 4;
  const spacingY = fontSize * 3;
  const startX = -fontSize * 2;
  const startY = -fontSize * 2;
  const endX = width + fontSize * 2;
  const endY = height + fontSize * 2;

  for (let x = startX; x < endX; x += spacingX) {
    for (let y = startY; y < endY; y += spacingY) {
      page.drawText(text, {
        x, y,
        size: fontSize,
        font,
        color: rgb(color.r, color.g, color.b),
        opacity,
        rotate: degrees(rotation)
      });
    }
  }
}

/**
 * 添加单个位置水印
 */
function addSingleWatermark(page, text, options) {
  const { fontSize, opacity, color, rotation, width, height, position, font } = options;

  // 计算文字宽度（近似值）
  const textWidth = fontSize * text.length * 0.6;
  const textHeight = fontSize;

  // 根据位置计算坐标
  let x, y;

  switch (position) {
    case 'top-left':
      x = 50;
      y = height - 50 - textHeight;
      break;
    case 'top-center':
      x = (width - textWidth) / 2;
      y = height - 50 - textHeight;
      break;
    case 'top-right':
      x = width - 50 - textWidth;
      y = height - 50 - textHeight;
      break;
    case 'middle-left':
      x = 50;
      y = (height - textHeight) / 2;
      break;
    case 'center':
      x = (width - textWidth) / 2;
      y = (height - textHeight) / 2;
      break;
    case 'middle-right':
      x = width - 50 - textWidth;
      y = (height - textHeight) / 2;
      break;
    case 'bottom-left':
      x = 50;
      y = 50;
      break;
    case 'bottom-center':
      x = (width - textWidth) / 2;
      y = 50;
      break;
    case 'bottom-right':
      x = width - 50 - textWidth;
      y = 50;
      break;
    default:
      x = (width - textWidth) / 2;
      y = (height - textHeight) / 2;
  }

  page.drawText(text, {
    x, y,
    size: fontSize,
    font,
    color: rgb(color.r, color.g, color.b),
    opacity,
    rotate: degrees(rotation)
  });
}

/**
 * 将十六进制颜色转换为RGB
 */
function hexToRgb(hex) {
  // 移除 # 号
  hex = hex.replace('#', '');

  // 解析RGB值
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  return { r, g, b };
}
