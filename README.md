# 文件格式转换器 - 微信小程序

一个基于微信云开发的文件格式转换小程序，支持图片转PDF和Word转PDF功能。

## 功能特性

### 📸 图片转PDF（前端本地处理）
- ✅ **多次添加图片** - 支持多次点击添加按钮选择图片
- ✅ **批量管理** - 图片预览、重新排序、删除
- ✅ **合并输出** - 所有图片合并为单个PDF文件
- ✅ **即时转换** - 本地处理，无需等待服务器

### 📄 Word转PDF（云函数处理）
- ✅ **格式支持** - 支持.doc和.docx格式
- ✅ **云端转换** - 使用云函数进行高质量转换
- ✅ **文件管理** - 自动上传、转换、下载流程

## 项目结构

```
Converter_vx/
├── miniprogram/              # 小程序前端代码
│   ├── pages/
│   │   ├── converter/        # 主页（选择转换类型）
│   │   ├── image-to-pdf/     # 图片转PDF页面
│   │   └── word-to-pdf/      # Word转PDF页面
│   ├── utils/
│   │   └── pdfGenerator.js   # PDF生成工具
│   ├── libs/
│   │   └── jspdf.min.js      # jsPDF库
│   ├── app.js
│   ├── app.json
│   └── app.wxss
└── cloudfunctions/           # 云函数
    └── wordToPdf/           # Word转PDF云函数
        ├── index.js
        ├── package.json
        └── config.json
```

## 快速开始

### 1. 环境准备
- 安装微信开发者工具
- 注册微信小程序账号
- 开通云开发功能

### 2. 克隆项目

将项目文件夹导入微信开发者工具

### 3. 配置云开发

1. 打开微信开发者工具
2. 点击顶部菜单栏的"云开发"按钮
3. 开通云开发并创建环境
4. 复制环境ID

编辑 `miniprogram/app.js`，填入环境ID：

```javascript
env: "your-env-id",  // 替换为你的云环境ID
```

### 4. 部署云函数

右键点击 `cloudfunctions/wordToPdf` → 选择"上传并部署：云端安装依赖"

### 5. 配置云存储权限

在云开发控制台的"存储"中设置权限：

```json
{
  "read": true,
  "write": true
}
```

### 6. 运行项目

点击"编译"按钮，在模拟器中查看效果

## 使用说明

### 图片转PDF

1. 点击主页的"图片转PDF"卡片
2. 点击"添加图片"按钮选择图片（可多次添加）
3. 使用↑↓按钮调整图片顺序
4. 点击×按钮删除不需要的图片
5. 点击"生成PDF"开始转换
6. 转换完成后可选择分享或保存

### Word转PDF

1. 点击主页的"Word转PDF"卡片
2. 点击"点击选择Word文档"
3. 从聊天记录或文件中选择Word文件
4. 点击"转换为PDF"
5. 等待云端处理完成
6. 选择下载或分享生成的PDF

## 技术栈

- **前端框架**: 微信小程序原生开发
- **云服务**: 微信云开发
  - 云函数
  - 云存储
- **PDF生成**: 
  - 前端：jsPDF (图片转PDF)
  - 后端：mammoth.js (Word解析)

## 注意事项

> ⚠️ **当前实现说明**
>
> 由于微信小程序环境限制，当前版本的PDF生成功能是简化实现：
> - 图片转PDF：处理后保存为图片格式
> - Word转PDF：转换为HTML格式
>
> **生产环境建议**：
> - 集成puppeteer到云函数进行真正的PDF生成
> - 使用LibreOffice或专业转换服务处理Word文档

> 💡 **费用说明**
>
> - 云函数调用、云存储使用会产生费用
> - 开发测试期间可使用免费额度
> - 生产环境需要开通按量付费

## 常见问题

**Q: 为什么图片转换后不是真正的PDF？**  
A: 由于小程序环境限制，需要在云函数中集成专业PDF库（如puppeteer）才能生成标准PDF。当前版本是MVP实现。

**Q: Word转换质量不理想怎么办？**  
A: mammoth.js对复杂格式支持有限。建议生产环境使用LibreOffice或第三方API服务。

**Q: 云函数调用失败？**  
A: 
1. 确认环境ID配置正确
2. 检查云函数是否成功部署
3. 查看云开发控制台的日志

## 后续优化计划

- [ ] 集成puppeteer实现真正的PDF生成
- [ ] 优化Word转换质量
- [ ] 添加PDF预览功能
- [ ] 支持Excel、PPT等更多格式
- [ ] 添加批量转换功能
- [ ] 优化大文件处理

## 许可证

MIT

## 作者

开发者

## 相关文档

- [部署指南](../../.gemini/antigravity/brain/a3bff567-41b6-488b-8f79-b1bf9308b618/deployment_guide.md)
- [实现计划](../../.gemini/antigravity/brain/a3bff567-41b6-488b-8f79-b1bf9308b618/implementation_plan.md)
- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
