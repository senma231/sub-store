@echo off
echo 🔧 修复 GitHub 推送问题
echo ========================
echo.

echo 📋 当前分支状态：
git branch -a
echo.

echo 📋 当前状态：
git status
echo.

echo 🔄 解决方案：
echo.

echo 1. 确认分支已重命名为 main：
git branch -m master main 2>nul
echo    分支已设置为 main
echo.

echo 2. 检查远程仓库配置：
git remote -v
echo.

echo 3. 尝试推送到 main 分支：
echo    正在推送...
git push -u origin main
if %errorlevel% equ 0 (
    echo    ✅ 推送成功！
    echo    访问 https://github.com/senma231/sub-store 查看结果
) else (
    echo    ❌ 推送失败，请尝试以下解决方案：
    echo.
    echo    方案 A - 重新设置远程仓库：
    echo    git remote remove origin
    echo    git remote add origin https://github.com/senma231/sub-store.git
    echo    git push -u origin main
    echo.
    echo    方案 B - 强制推送：
    echo    git push -u origin main --force
    echo.
    echo    方案 C - 手动上传：
    echo    1. 访问 https://github.com/senma231/sub-store
    echo    2. 点击 "uploading an existing file"
    echo    3. 拖拽项目文件夹上传
)

echo.
echo 📝 完成后请在 GitHub 设置中：
echo 1. 将默认分支设置为 main
echo 2. 删除 master 分支（如果存在）
echo.
pause
