//路径：cloudfunctions/pdfToPpt
//版本：4.0.0 - 用 jszip 手动构建 PPTX，彻底无重型依赖

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const { action } = event;
  try {
    switch (action) {
      case 'ping':
        return { success: true, version: '4.0.0', engine: 'pdf-lib+pdfToImage+jszip' };
      case 'getPageCount':
        return await getPageCount(event);
      case 'convert':
        return await convertPdfToPpt(event);
      default:
        return { success: false, error: '未知的操作类型' };
    }
  } catch (error) {
    console.error('云函数执行错误:', error);
    return { success: false, error: error.message || '处理失败' };
  }
};

async function getPageCount(event) {
  const { fileID } = event;
  try {
    const { PDFDocument } = require('pdf-lib');
    const res = await cloud.downloadFile({ fileID });
    const pdfDoc = await PDFDocument.load(res.fileContent);
    return { success: true, pageCount: pdfDoc.getPageCount() };
  } catch (error) {
    console.error('获取页数失败:', error);
    return { success: false, error: error.message || '获取页数失败' };
  }
}

async function convertPdfToPpt(event) {
  const { fileID, pages, dpi = 150 } = event;

  // 记录初始内存使用
  const memStart = process.memoryUsage();
  console.log('开始转换 - 初始内存:', formatMemory(memStart));

  try {
    const { PDFDocument } = require('pdf-lib');
    const JSZip = require('jszip');

    // 1. 获取页面尺寸
    const downloadRes = await cloud.downloadFile({ fileID });
    const pdfDoc = await PDFDocument.load(downloadRes.fileContent);
    let pagesToConvert = pages;
    if (!pagesToConvert || pagesToConvert.length === 0) {
      pagesToConvert = Array.from({ length: pdfDoc.getPageCount() }, (_, i) => i + 1);
    }

    // 页面数量限制（防止内存溢出）
    const MAX_PAGES = 15;
    if (pagesToConvert.length > MAX_PAGES) {
      return {
        success: false,
        error: `页面数量超过限制，最多支持${MAX_PAGES}页，当前选择了${pagesToConvert.length}页`
      };
    }

    console.log(`准备转换 ${pagesToConvert.length} 页`);

    const firstPdfPage = pdfDoc.getPage(pagesToConvert[0] - 1);
    const { width: pdfW, height: pdfH } = firstPdfPage.getSize();
    console.log(`页面尺寸: ${pdfW} x ${pdfH}`);

    // 2. 调用 pdfToImage 渲染图片
    console.log('调用 pdfToImage 云函数...');
    const imageResult = await cloud.callFunction({
      name: 'pdfToImage',
      data: { action: 'convert', fileID, pages: pagesToConvert, format: 'png', dpi }
    });

    if (!imageResult.result || !imageResult.result.success) {
      const errorMsg = (imageResult.result && imageResult.result.error) || 'PDF渲染图片失败';
      console.error('pdfToImage 失败:', errorMsg);
      throw new Error(errorMsg);
    }
    const images = imageResult.result.images;
    console.log(`成功生成 ${images.length} 张图片`);

    // 3. 流式下载图片并构建 PPTX（逐页处理，减少内存占用）
    console.log('开始流式构建PPTX...');
    const pptxBuffer = await buildPptxFromImagesStreaming(JSZip, images, pdfW, pdfH);

    // 记录构建后内存
    const memAfterBuild = process.memoryUsage();
    console.log('PPTX构建完成 - 内存:', formatMemory(memAfterBuild));

    // 5. 上传
    console.log('上传PPTX到云存储...');
    const pptFileName = 'converted_' + Date.now() + '.pptx';
    const uploadRes = await cloud.uploadFile({
      cloudPath: 'pdf-to-ppt/output/' + pptFileName,
      fileContent: pptxBuffer
    });
    const tempUrlRes = await cloud.getTempFileURL({ fileList: [uploadRes.fileID] });

    // 记录最终内存
    const memEnd = process.memoryUsage();
    console.log('转换完成 - 最终内存:', formatMemory(memEnd));
    console.log('内存增长:', formatBytes(memEnd.heapUsed - memStart.heapUsed));

    return {
      success: true,
      fileID: uploadRes.fileID,
      tempUrl: tempUrlRes.fileList[0].tempFileURL
    };
  } catch (error) {
    console.error('转换失败 - 错误详情:', error);
    console.error('错误堆栈:', error.stack);
    const memError = process.memoryUsage();
    console.log('失败时内存:', formatMemory(memError));
    return { success: false, error: error.message || '转换失败' };
  }
}

// 流式构建PPTX（逐页下载图片，避免同时加载所有图片到内存）
async function buildPptxFromImagesStreaming(JSZip, images, pdfW, pdfH) {
  const zip = new JSZip();
  const slideCount = images.length;

  // PDF 点转英寸 (72pt = 1inch)
  const slideWInch = pdfW / 72;
  const slideHInch = pdfH / 72;
  const cx = emu(slideWInch);
  const cy = emu(slideHInch);

  // 构建基础结构（与原方法相同）
  buildPptxStructure(zip, slideCount, cx, cy);

  // 逐页下载图片并添加到ZIP
  for (let i = 0; i < slideCount; i++) {
    const slideNum = i + 1;
    console.log(`处理第 ${slideNum}/${slideCount} 页...`);

    try {
      // 下载单张图片
      const dl = await cloud.downloadFile({ fileID: images[i].cloudPath });
      const imageBuffer = Buffer.from(dl.fileContent);
      console.log(`  图片大小: ${formatBytes(imageBuffer.length)}`);

      // 添加slide和图片到ZIP
      addSlideToZip(zip, slideNum, cx, cy, imageBuffer);

      // 强制垃圾回收建议（如果Node.js启用了--expose-gc）
      if (global.gc) {
        global.gc();
      }

    } catch (error) {
      console.error(`处理第 ${slideNum} 页失败:`, error);
      throw new Error(`处理第 ${slideNum} 页失败: ${error.message}`);
    }
  }

  console.log('生成PPTX文件...');
  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// 构建PPTX基础结构
function buildPptxStructure(zip, slideCount, cx, cy) {
  // [Content_Types].xml
  let slideContentTypes = '';
  for (let i = 1; i <= slideCount; i++) {
    slideContentTypes += '<Override PartName="/ppt/slides/slide' + i + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>';
  }
  zip.file('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="png" ContentType="image/png"/>' +
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
    slideContentTypes +
    '</Types>'
  );

  // _rels/.rels
  zip.file('_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>' +
    '</Relationships>'
  );

  // ppt/presentation.xml
  let sldIdList = '';
  for (let i = 1; i <= slideCount; i++) {
    sldIdList += '<p:sldId id="' + (255 + i) + '" r:id="rId' + (i + 2) + '"/>';
  }
  zip.file('ppt/presentation.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    '<p:sldIdLst>' + sldIdList + '</p:sldIdLst>' +
    '<p:sldSz cx="' + cx + '" cy="' + cy + '"/>' +
    '<p:notesSz cx="' + cy + '" cy="' + cx + '"/>' +
    '</p:presentation>'
  );

  // ppt/_rels/presentation.xml.rels
  let presRels = '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>';
  presRels += '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>';
  for (let i = 1; i <= slideCount; i++) {
    presRels += '<Relationship Id="rId' + (i + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide' + i + '.xml"/>';
  }
  zip.file('ppt/_rels/presentation.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    presRels +
    '</Relationships>'
  );

  // theme
  zip.file('ppt/theme/theme1.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Default">' +
    '<a:themeElements>' +
    '<a:clrScheme name="Default"><a:dk1><a:sysClr val="windowText"/></a:dk1><a:lt1><a:sysClr val="window"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme>' +
    '<a:fontScheme name="Default"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
    '<a:fmtScheme name="Default"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>' +
    '</a:themeElements>' +
    '</a:theme>'
  );

  // slideMaster
  zip.file('ppt/slideMasters/slideMaster1.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>' +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
    '</p:sldMaster>'
  );
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>' +
    '</Relationships>'
  );

  // slideLayout
  zip.file('ppt/slideLayouts/slideLayout1.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">' +
    '<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>' +
    '</p:sldLayout>'
  );
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>' +
    '</Relationships>'
  );
}

// 添加单个slide到ZIP
function addSlideToZip(zip, slideNum, cx, cy, imageBuffer) {
  // slide XML
  zip.file('ppt/slides/slide' + slideNum + '.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld><p:spTree>' +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
    '<p:pic>' +
    '<p:nvPicPr><p:cNvPr id="2" name="Image' + slideNum + '"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>' +
    '<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
    '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
    '</p:pic>' +
    '</p:spTree></p:cSld>' +
    '</p:sld>'
  );

  // slide rels
  zip.file('ppt/slides/_rels/slide' + slideNum + '.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image' + slideNum + '.png"/>' +
    '</Relationships>'
  );

  // image binary
  zip.file('ppt/media/image' + slideNum + '.png', imageBuffer);
}

// 内存格式化工具函数
function formatMemory(mem) {
  return `堆: ${formatBytes(mem.heapUsed)}/${formatBytes(mem.heapTotal)}, RSS: ${formatBytes(mem.rss)}`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + 'KB';
  return (bytes / 1024 / 1024).toFixed(2) + 'MB';
}

// ========== 以下为 PPTX 构建函数 ==========

function emu(inches) {
  return Math.round(inches * 914400);
}
