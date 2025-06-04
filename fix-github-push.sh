#!/bin/bash

# 修复 GitHub 推送问题的脚本

echo "🔧 修复 GitHub 推送问题"
echo "========================"

# 检查当前分支
echo "📋 当前分支状态："
git branch -a

echo ""
echo "📋 当前状态："
git status

echo ""
echo "🔄 解决方案："

echo "1. 确认分支已重命名为 main："
git branch -m master main 2>/dev/null || echo "   分支已经是 main"

echo ""
echo "2. 检查远程仓库配置："
git remote -v

echo ""
echo "3. 尝试推送到 main 分支："
echo "   如果网络连接正常，运行以下命令："
echo "   git push -u origin main"

echo ""
echo "4. 如果推送失败，请尝试以下解决方案："
echo ""
echo "   方案 A - 重新设置远程仓库："
echo "   git remote remove origin"
echo "   git remote add origin https://github.com/senma231/sub-store.git"
echo "   git push -u origin main"
echo ""
echo "   方案 B - 使用 SSH（如果已配置 SSH 密钥）："
echo "   git remote set-url origin git@github.com:senma231/sub-store.git"
echo "   git push -u origin main"
echo ""
echo "   方案 C - 强制推送（谨慎使用）："
echo "   git push -u origin main --force"

echo ""
echo "5. 验证推送成功："
echo "   访问 https://github.com/senma231/sub-store"
echo "   确认文件已上传到 main 分支"

echo ""
echo "6. 在 GitHub 上设置默认分支："
echo "   - 访问 https://github.com/senma231/sub-store/settings/branches"
echo "   - 将默认分支设置为 main"
echo "   - 删除 master 分支（如果存在）"

echo ""
echo "📝 注意事项："
echo "- 确保网络连接正常"
echo "- 确保 GitHub 账户有推送权限"
echo "- 如果仍有问题，可以手动上传文件到 GitHub"

echo ""
echo "🎯 手动上传方案："
echo "1. 访问 https://github.com/senma231/sub-store"
echo "2. 点击 'uploading an existing file'"
echo "3. 将项目文件夹拖拽上传"
echo "4. 提交更改"
