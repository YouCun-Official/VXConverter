# PDF转图片功能说明文档

## 功能概述

将PDF文档的每一页转换为独立的图片文件（支持PNG、JPG格式）

## 功能特性

- ✅ PDF文件选择（最大50MB）
- ✅ 页面选择（全部/自定义）
- ✅ 输出格式（PNG/JPG）
- ✅ 图片质量设置（低/中/高 对应 72/150/300 DPI）
- ✅ 单张保存/批量保存
- ✅ 图片预览

## 文件结构

```
miniprogram/pages/tools/pdf-to-image/
├── index.js       # 页面逻辑
├── index.wxml     # 页面结构
├── index.wxss     # 页面样式
└── index.json     # 页面配置

cloudfunctions/pdfToImage/
├── index.js       # 云函数主文件
├── package.json   # 依赖配置
└── config.json    # 云函数配置
```

## 云函数部署

### 方法一：使用微信开发者工具（推荐）

1. 打开微信开发者工具
2. 右键点击 `cloudfunctions/pdfToImage` 目录
3. 选择 "上传并部署：云端安装依赖"
4. 等待部署完成

### 方法二：使用命令行

```bash
cd cloudfunctions/pdfToImage
npm install
```

然后在微信开发者工具中右键部署。

## 云函数依赖说明

由于微信云开发环境的限制，PDF转图片功能需要特殊处理：

### 重要提示 ⚠️

**pdf-poppler** 依赖系统级的 poppler-utils 工具，在云函数环境中可能无法直接使用。

### 推荐的替代方案

#### 方案一：使用 pdf-lib + Canvas（推荐）

修改 `cloudfunctions/pdfToImage/package.json`：

```json
{
  "dependencies": {
    "wx-server-sdk": "~2.6.3",
    "pdf-lib": "^1.17.1",
    "canvas": "^2.11.2"
  }
}
```

#### 方案二：使用第三方API服务

调用第三方PDF转图片API服务（如阿里云、腾讯云等）

修改云函数代码，使用 HTTP 请求调用API：

```javascript
const cloud = require('wx-server-sdk');
const axios = require('axios');

// 调用第三方API
const response = await axios.post('https://api.example.com/pdf-to-image', {
  pdfUrl: cloudFileUrl,
  pages: pages,
  format: format
});
```

#### 方案三：使用云托管 Docker 容器

在云托管环境中安装 poppler-utils：

```dockerfile
FROM node:16
RUN apt-get update && apt-get install -y poppler-utils
```

## 云函数API说明

### 1. getPageCount - 获取PDF页数

**请求参数：**
```javascript
{
  action: 'getPageCount',
  fileID: 'cloud://xxx.pdf'  // 云存储文件ID
}
```

**返回结果：**
```javascript
{
  success: true,
  pageCount: 10  // PDF总页数
}
```

### 2. convert - 转换PDF为图片

**请求参数：**
```javascript
{
  action: 'convert',
  fileID: 'cloud://xxx.pdf',  // 云存储文件ID
  pages: [1, 2, 3],           // 要转换的页码数组
  format: 'png',              // 输出格式：'png' 或 'jpg'
  dpi: 150                    // 分辨率：72/150/300
}
```

**返回结果：**
```javascript
{
  success: true,
  images: [
    {
      page: 1,
      cloudPath: 'cloud://image-1.png',
      tempUrl: 'https://xxx',
      size: 123456
    },
    // ...
  ]
}
```

## 使用流程

1. **用户选择PDF文件**
   - 文件上传到云存储
   - 调用云函数获取页数

2. **设置转换选项**
   - 选择页面范围
   - 选择输出格式
   - 设置图片质量

3. **执行转换**
   - 调用云函数转换
   - 显示进度
   - 返回图片列表

4. **查看和保存**
   - 预览图片
   - 单张保存
   - 批量保存

## 注意事项

### 1. 文件大小限制

- 单个PDF文件限制50MB
- 云存储上传限制100MB
- 建议对大文件进行分片处理

### 2. 并发处理

- 云函数有执行时间限制（默认60秒）
- 转换大量页面时建议分批处理
- 可以考虑使用消息队列

### 3. 成本优化

- 及时清理云存储中的临时文件
- 设置云存储自动过期策略
- 监控云函数调用次数

### 4. 权限设置

需要在小程序中申请以下权限：
- `scope.writePhotosAlbum` - 保存图片到相册

### 5. 性能优化建议

- 使用图片压缩减小文件大小
- 实现缓存机制避免重复转换
- 考虑使用CDN加速图片访问

## 测试建议

1. 测试不同大小的PDF文件
2. 测试不同页数的PDF
3. 测试PNG和JPG两种格式
4. 测试不同DPI设置
5. 测试网络异常情况
6. 测试并发转换

## 常见问题

### Q1: 云函数部署失败？
- 检查网络连接
- 确认云开发环境已开通
- 查看控制台错误日志

### Q2: 转换失败或超时？
- 检查PDF文件是否损坏
- 减少单次转换的页数
- 增加云函数超时时间

### Q3: 图片质量不理想？
- 调整DPI设置（建议150-300）
- 使用PNG格式保持清晰度
- 检查原PDF质量

### Q4: 保存图片失败？
- 检查是否授权相册权限
- 确认图片URL有效
- 查看网络连接

## 后续优化方向

1. 支持批量PDF转换
2. 添加图片水印
3. 支持图片裁剪和旋转
4. 添加OCR文字识别
5. 支持ZIP打包下载
6. 添加转换历史记录

## 技术支持

如有问题，请查看：
- 微信官方文档：https://developers.weixin.qq.com/miniprogram/dev/
- 云开发文档：https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html
