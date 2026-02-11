// cloudfunctions/excelToPdf/index.js
const cloud = require('wx-server-sdk');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const execPromise = util.promisify(exec);

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * Excel转PDF云函数 - 使用LibreOffice进行转换
 * 接收Excel文件ID，转换为PDF并返回PDF文件ID
 *
 * 注意：此云函数需要在云函数环境中安装LibreOffice
 * 安装方法：
 * 1. 在云函数的package.json中添加layer配置
 * 2. 或者使用自定义运行时容器安装LibreOffice
 *
 * 如果云函数环境不支持LibreOffice，可以考虑：
 * - 使用第三方API服务（如Convertio、CloudConvert等）
 * - 部署独立的转换服务
 */
exports.main = async (event, context) => {
    const { fileID, fileName } = event;
    const tmpDir = '/tmp';

    try {
        console.log('开始处理Excel文件:', fileName);

        // 1. 下载Excel文件
        console.log('下载Excel文件...');
        const downloadResult = await cloud.downloadFile({
            fileID: fileID
        });

        const excelBuffer = downloadResult.fileContent;

        // 2. 保存Excel文件到临时目录
        const excelPath = path.join(tmpDir, `input_${Date.now()}.${fileName.split('.').pop()}`);
        fs.writeFileSync(excelPath, excelBuffer);
        console.log('Excel文件已保存到:', excelPath);

        // 3. 使用LibreOffice转换Excel为PDF
        console.log('开始转换Excel为PDF...');

        try {
            // 尝试使用LibreOffice headless模式转换
            // --headless: 无界面模式
            // --convert-to pdf: 转换为PDF格式
            // --outdir: 输出目录
            const command = `libreoffice --headless --convert-to pdf --outdir ${tmpDir} ${excelPath}`;

            const { stdout, stderr } = await execPromise(command, {
                timeout: 60000 // 60秒超时
            });

            console.log('LibreOffice 输出:', stdout);
            if (stderr) {
                console.log('LibreOffice 错误输出:', stderr);
            }

            // 4. 读取生成的PDF文件
            const pdfFileName = path.basename(excelPath, path.extname(excelPath)) + '.pdf';
            const pdfPath = path.join(tmpDir, pdfFileName);

            if (!fs.existsSync(pdfPath)) {
                throw new Error('PDF文件生成失败');
            }

            const pdfBuffer = fs.readFileSync(pdfPath);
            console.log('PDF生成成功，大小:', pdfBuffer.length, 'bytes');

            // 5. 上传PDF到云存储
            const outputFileName = fileName.replace(/\.(xls|xlsx)$/i, '.pdf');
            const cloudPath = `pdf-files/${Date.now()}_${outputFileName}`;

            console.log('上传PDF到云存储...');
            const uploadResult = await cloud.uploadFile({
                cloudPath: cloudPath,
                fileContent: pdfBuffer
            });

            console.log('PDF上传成功:', uploadResult.fileID);

            // 6. 清理临时文件
            try {
                fs.unlinkSync(excelPath);
                fs.unlinkSync(pdfPath);
            } catch (cleanupError) {
                console.log('清理临时文件时出错:', cleanupError.message);
            }

            // 7. 返回结果
            return {
                success: true,
                pdfFileID: uploadResult.fileID,
                fileName: outputFileName,
                fileSize: pdfBuffer.length,
                message: 'Excel已成功转换为PDF'
            };

        } catch (conversionError) {
            // 如果LibreOffice不可用，返回友好的错误信息
            if (conversionError.message.includes('libreoffice')) {
                console.log('LibreOffice未安装，尝试使用备用方案...');

                // 这里可以添加备用方案，例如调用第三方API
                // 示例：使用Convertio API（需要API key）
                /*
                const convertioResult = await convertUsingConvertio(excelBuffer, fileName);
                return convertioResult;
                */

                throw new Error('云函数环境暂不支持Excel转换，请联系管理员配置LibreOffice或第三方转换服务');
            }

            throw conversionError;
        }

    } catch (error) {
        console.error('转换失败:', error);

        // 清理可能残留的临时文件
        try {
            const files = fs.readdirSync(tmpDir);
            files.forEach(file => {
                if (file.startsWith('input_') &&
                    (file.endsWith('.xls') || file.endsWith('.xlsx') || file.endsWith('.pdf'))) {
                    fs.unlinkSync(path.join(tmpDir, file));
                }
            });
        } catch (cleanupError) {
            console.log('清理时出错:', cleanupError.message);
        }

        return {
            success: false,
            error: error.message || '转换过程中发生错误',
            details: error.stack,
            tip: '如需使用Excel转PDF功能，请确保云函数环境已安装LibreOffice或配置第三方转换服务'
        };
    }
};

/**
 * 使用Convertio API进行转换（备用方案示例）
 * 需要注册Convertio并获取API key
 */
async function convertUsingConvertio(fileBuffer, fileName) {
    // 这是一个示例实现，需要实际的Convertio API key
    // 参考：https://convertio.co/api/docs/

    throw new Error('第三方转换服务未配置');

    /*
    const axios = require('axios');
    const FormData = require('form-data');

    // 1. 上传文件
    const formData = new FormData();
    formData.append('file', fileBuffer, fileName);

    const uploadResponse = await axios.post('https://api.convertio.co/convert', formData, {
        headers: {
            ...formData.getHeaders(),
            'Authorization': 'Bearer YOUR_API_KEY'
        }
    });

    // 2. 等待转换完成
    // 3. 下载转换后的PDF
    // 4. 上传到云存储并返回

    return {
        success: true,
        pdfFileID: '...',
        fileName: fileName.replace(/\.(xls|xlsx)$/i, '.pdf'),
        message: 'Excel已成功转换为PDF'
    };
    */
}
