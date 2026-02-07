# 上传项目到GitHub的完整命令

## 方式一：一步步执行（推荐新手）

```powershell
# 1. 进入项目目录
cd C:\Users\lv\Desktop\Converter_vx

# 2. 查看当前状态
git status

# 3. 添加所有修改的文件到暂存区
git add .

# 4. 提交更改（带上提交信息）
git commit -m "新增二维码生成功能和多媒体工具板块"

# 5. 推送到GitHub远程仓库
git push origin main
```

## 方式二：快速执行（一行命令）

```powershell
cd C:\Users\lv\Desktop\Converter_vx && git add . && git commit -m "新增二维码生成功能和多媒体工具板块" && git push origin main
```

## 详细说明

### 当前项目状态
- 已经初始化Git仓库 ✓
- 已经连接到远程仓库 `https://github.com/YouCun-Official/VXConverter` ✓
- 当前分支：`main`

### 待提交的更改
**新增文件：**
- `miniprogram/pages/tools/qrcode/` - 二维码生成功能页面
- `miniprogram/utils/weapp-qrcode.js` - 二维码生成库
- `rec.md` - 文档文件

**修改文件：**
- `miniprogram/app.json` - 添加了二维码页面路由
- `miniprogram/pages/converter/index.js` - 添加了多媒体工具导航方法
- `miniprogram/pages/converter/index.wxml` - 添加了多媒体工具板块
- `miniprogram/pages/converter/index.wxss` - 添加了新图标样式

**删除文件：**
- `README.md` - 已删除

## 常用Git命令参考

```powershell
# 查看状态
git status

# 查看远程仓库信息
git remote -v

# 查看提交历史
git log --oneline -10

# 撤销未提交的更改（慎用）
git restore <文件名>

# 拉取最新代码
git pull origin main

# 查看分支
git branch -a

# 强制推送（慎用！会覆盖远程仓库）
git push -f origin main
```

## 注意事项

1. **首次推送**：如果这是第一次推送，可能需要输入GitHub用户名和密码（或个人访问令牌）

2. **配置Git用户信息**（如果还未配置）：
```powershell
git config --global user.name "你的名字"
git config --global user.email "你的邮箱@example.com"
```

3. **使用Token认证**（GitHub已不支持密码登录）：
   - 如果推送时要求输入密码，请使用GitHub Personal Access Token
   - 生成Token：GitHub设置 → Developer settings → Personal access tokens → Generate new token

4. **检查.gitignore**：
   - 确保敏感文件（如密钥、配置文件）已添加到 `.gitignore`
   - 小程序的 `project.private.config.json` 等私有配置不应提交

## 如果遇到问题

### 问题1：推送被拒绝（远程有新提交）
```powershell
# 先拉取远程更改
git pull origin main --rebase

# 再推送
git push origin main
```

### 问题2：合并冲突
```powershell
# 手动解决冲突后
git add .
git rebase --continue
git push origin main
```

### 问题3：需要强制推送（谨慎使用）
```powershell
git push -f origin main
```
