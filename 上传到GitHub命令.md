# 将Converter_vx上传至GitHub完整指南

## 项目信息
- 本地路径：C:\Users\lv\Desktop\Converter_vx
- GitHub仓库：https://github.com/YouCun-Official/VXConverter
- 当前分支：main

---

## 方式一：完整命令（推荐）

### 步骤1：打开命令行

**Windows**：
- 按 `Win + R`
- 输入 `cmd` 或 `powershell`
- 按回车

或者：
- 在 `C:\Users\lv\Desktop\Converter_vx` 文件夹中
- 按住 `Shift` + 右键点击空白处
- 选择"在此处打开PowerShell窗口"或"在此处打开命令提示符"

### 步骤2：进入项目目录

```bash
cd C:\Users\lv\Desktop\Converter_vx
```

### 步骤3：检查Git状态

```bash
# 查看当前状态
git status

# 查看当前分支
git branch

# 查看远程仓库配置
git remote -v
```

### 步骤4：配置远程仓库

#### 情况A：如果还没有配置远程仓库

```bash
# 添加远程仓库
git remote add origin https://github.com/YouCun-Official/VXConverter.git

# 验证配置
git remote -v
```

#### 情况B：如果已有远程仓库但URL不对

```bash
# 移除旧的远程仓库
git remote remove origin

# 添加新的远程仓库
git remote add origin https://github.com/YouCun-Official/VXConverter.git

# 验证配置
git remote -v
```

#### 情况C：如果远程仓库URL正确

直接跳到步骤5。

### 步骤5：暂存所有文件

```bash
# 添加所有文件到暂存区
git add .

# 查看暂存的文件
git status
```

**预期输出**：
```
Changes to be committed:
  modified: miniprogram/app.json
  modified: miniprogram/pages/converter/index.js
  new file: miniprogram/pages/excel-to-pdf/...
  new file: miniprogram/pages/txt-to-pdf/...
  new file: miniprogram/pages/markdown-to-pdf/...
  ...
```

### 步骤6：提交更改

```bash
# 创建提交（使用详细的提交信息）
git commit -m "feat: 新增Excel、TXT、Markdown转PDF功能及v1.1增强

- ✅ 新增Excel转PDF功能（使用LibreOffice）
- ✅ 新增TXT转PDF功能（使用PDFKit）
- ✅ 新增Markdown转PDF功能（使用marked + PDFKit）
- ✅ Markdown v1.1：添加表格和图片支持
- ✅ 完善功能说明文档和部署指南
- ✅ 统一界面风格（绿色主题）

版本：v1.1
日期：2026-02-11"
```

### 步骤7：推送到GitHub

#### 情况A：首次推送（推荐）

```bash
# 推送到远程仓库，并设置上游分支
git push -u origin main
```

如果GitHub仓库是空的或刚创建，使用：

```bash
# 强制推送（覆盖远程仓库）
git push -u origin main --force
```

#### 情况B：如果远程仓库已有内容且需要合并

```bash
# 先拉取远程更改
git pull origin main --allow-unrelated-histories

# 如果有冲突，解决后提交
git add .
git commit -m "merge: 合并远程更改"

# 再推送
git push -u origin main
```

#### 情况C：如果需要覆盖远程仓库

```bash
# 强制推送（警告：会覆盖远程所有内容）
git push -u origin main --force
```

### 步骤8：验证上传

```bash
# 查看推送结果
git log --oneline -5

# 检查远程分支
git branch -a
```

然后访问：https://github.com/YouCun-Official/VXConverter

---

## 方式二：分步命令（安全）

如果你想更谨慎地上传，可以分批次提交：

### 第一批：Excel转PDF

```bash
cd C:\Users\lv\Desktop\Converter_vx

git add miniprogram/pages/excel-to-pdf/
git add cloudfunctions/excelToPdf/
git add "Excel转PDF功能说明.md"
git add "Excel转PDF-快速开始.md"
git add "Excel转PDF功能开发总结.md"

git commit -m "feat: 新增Excel转PDF功能

- 支持.xls和.xlsx格式
- 使用LibreOffice转换
- 完整的文件上传、转换、下载流程
- 完善的错误处理和用户提示"

git push origin main
```

### 第二批：TXT转PDF

```bash
git add miniprogram/pages/txt-to-pdf/
git add cloudfunctions/txtToPdf/
git add "TXT转PDF功能说明.md"
git add "TXT转PDF-快速开始.md"
git add "TXT转PDF功能开发总结.md"

git commit -m "feat: 新增TXT转PDF功能

- 支持.txt格式纯文本
- 使用PDFKit生成PDF
- 智能编码识别（UTF-8、GBK）
- 自动分页和格式保留"

git push origin main
```

### 第三批：Markdown转PDF

```bash
git add miniprogram/pages/markdown-to-pdf/
git add cloudfunctions/markdownToPdf/
git add "Markdown转PDF功能说明.md"
git add "Markdown转PDF-快速开始.md"
git add "Markdown转PDF功能开发总结.md"
git add "Markdown高级功能实现指南.md"
git add "Markdown功能升级指南.md"
git add "Markdown-v1.1部署指南.md"
git add "Markdown测试文档-v1.1.md"

git commit -m "feat: 新增Markdown转PDF功能（v1.1）

- 支持.md和.markdown格式
- 使用marked解析 + PDFKit渲染
- v1.1: 添加表格和图片支持
- 完整的语法支持和格式化渲染
- 详细的实现指南和升级文档"

git push origin main
```

### 第四批：配置文件更新

```bash
git add miniprogram/app.json
git add miniprogram/pages/converter/index.js

git commit -m "chore: 更新配置文件

- 添加新页面到app.json
- 启用新功能的导航入口"

git push origin main
```

---

## 方式三：使用Git GUI工具

如果你不熟悉命令行，可以使用图形界面工具：

### 推荐工具

1. **GitHub Desktop**（最简单）
   - 下载：https://desktop.github.com/
   - 打开软件 → Add Local Repository → 选择Converter_vx文件夹
   - 点击"Publish repository"
   - 选择账号和仓库名

2. **VS Code**（如果已安装）
   - 打开Converter_vx文件夹
   - 点击左侧"源代码管理"图标
   - 点击"+"暂存所有更改
   - 输入提交信息
   - 点击"✓"提交
   - 点击"..."→"推送"

3. **TortoiseGit**（Windows推荐）
   - 下载：https://tortoisegit.org/
   - 在文件夹中右键 → TortoiseGit → Commit
   - 选择文件 → 输入信息 → Push

---

## 常见问题处理

### 问题1：Git未安装

**症状**：'git' 不是内部或外部命令

**解决方案**：
```bash
# 下载并安装Git
# Windows: https://git-scm.com/download/win
# 安装后重启命令行
```

### 问题2：需要身份验证

**症状**：Authentication failed

**解决方案A：使用Personal Access Token**

1. 访问：https://github.com/settings/tokens
2. 点击"Generate new token (classic)"
3. 选择权限：repo（全部勾选）
4. 生成Token并复制

```bash
# 推送时使用Token作为密码
git push -u origin main
# Username: YouCun-Official
# Password: [粘贴Token]

# 或者配置Git保存凭据
git config --global credential.helper store
git push -u origin main
```

**解决方案B：使用SSH密钥**

```bash
# 生成SSH密钥
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# 复制公钥
cat ~/.ssh/id_rsa.pub

# 添加到GitHub：
# Settings → SSH and GPG keys → New SSH key → 粘贴公钥

# 修改远程仓库URL为SSH
git remote set-url origin git@github.com:YouCun-Official/VXConverter.git

# 推送
git push -u origin main
```

### 问题3：远程仓库已存在内容

**症状**：Updates were rejected because the remote contains work

**解决方案**：

```bash
# 方案A：合并远程更改（推荐）
git pull origin main --allow-unrelated-histories
# 解决冲突（如果有）
git push -u origin main

# 方案B：强制覆盖远程（谨慎使用）
git push -u origin main --force
```

### 问题4：.gitignore未生效

**症状**：node_modules等不应该上传的文件也被包含

**解决方案**：

```bash
# 创建或编辑.gitignore文件
echo "node_modules/" >> .gitignore
echo "miniprogram_npm/" >> .gitignore
echo "*.log" >> .gitignore
echo ".DS_Store" >> .gitignore

# 移除已追踪的文件
git rm -r --cached node_modules/
git rm -r --cached miniprogram_npm/

# 提交
git add .gitignore
git commit -m "chore: 添加.gitignore"
git push origin main
```

### 问题5：文件名包含中文或空格

**症状**：文件名显示乱码或无法添加

**解决方案**：

```bash
# 配置Git支持中文文件名
git config --global core.quotepath false

# 重新添加文件
git add .
```

---

## 完整的一键脚本

将以下内容保存为 `upload-to-github.bat`，放在Converter_vx目录下，双击运行：

```batch
@echo off
chcp 65001
echo ==========================================
echo  将Converter_vx上传至GitHub
echo  仓库: YouCun-Official/VXConverter
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/7] 检查Git状态...
git status
echo.

echo [2/7] 配置远程仓库...
git remote remove origin 2>nul
git remote add origin https://github.com/YouCun-Official/VXConverter.git
git remote -v
echo.

echo [3/7] 添加所有文件...
git add .
echo.

echo [4/7] 查看暂存文件...
git status
echo.

echo [5/7] 创建提交...
git commit -m "feat: 新增多个PDF转换功能（Excel、TXT、Markdown）及v1.1增强版"
echo.

echo [6/7] 推送到GitHub...
git push -u origin main --force
echo.

echo [7/7] 完成！
echo.
echo 请访问 https://github.com/YouCun-Official/VXConverter 查看结果
echo.
pause
```

---

## 推荐的.gitignore文件

在上传前，建议创建 `.gitignore` 文件：

```gitignore
# 依赖
node_modules/
miniprogram_npm/
cloudfunctions/*/node_modules/

# 日志
*.log
npm-debug.log*

# 操作系统
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# 临时文件
*.tmp
.cache/

# 微信开发者工具
project.private.config.json
```

创建命令：

```bash
cd C:\Users\lv\Desktop\Converter_vx

# 创建.gitignore
echo node_modules/ > .gitignore
echo miniprogram_npm/ >> .gitignore
echo *.log >> .gitignore
echo .DS_Store >> .gitignore
echo project.private.config.json >> .gitignore

# 提交.gitignore
git add .gitignore
git commit -m "chore: 添加.gitignore"
```

---

## 验证上传成功

上传完成后，检查以下内容：

1. **访问GitHub仓库**
   https://github.com/YouCun-Official/VXConverter

2. **检查文件结构**
   - ✅ miniprogram/ 目录存在
   - ✅ cloudfunctions/ 目录存在
   - ✅ 各功能的页面文件夹存在
   - ✅ 文档文件（.md）存在

3. **检查提交记录**
   - 点击"commits"查看提交历史
   - 确认最新提交是你刚才的提交

4. **检查README**
   - 如果有README.md，查看是否正常显示

---

## 后续维护

### 日常更新流程

```bash
# 1. 修改代码后
git add .
git commit -m "描述更改内容"
git push

# 2. 拉取远程更新
git pull origin main

# 3. 查看提交历史
git log --oneline -10

# 4. 回退到某个版本
git reset --hard <commit-id>
```

### 创建新分支

```bash
# 创建开发分支
git checkout -b develop

# 推送到远程
git push -u origin develop

# 切换回主分支
git checkout main
```

---

## 总结

**最简单的方式（推荐新手）**：

```bash
cd C:\Users\lv\Desktop\Converter_vx
git remote add origin https://github.com/YouCun-Official/VXConverter.git
git add .
git commit -m "feat: 初次提交 - 多功能PDF转换工具"
git push -u origin main --force
```

**最安全的方式（推荐）**：

```bash
cd C:\Users\lv\Desktop\Converter_vx
git status
git remote add origin https://github.com/YouCun-Official/VXConverter.git
git add .
git status
git commit -m "feat: 新增Excel、TXT、Markdown转PDF功能及v1.1增强"
git push -u origin main
```

选择适合你的方式即可！🚀

---

**最后更新**：2026-02-11
**作者**：开发团队
