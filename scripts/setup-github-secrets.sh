#!/bin/bash

# Sub-Store GitHub Secrets 配置脚本
# 用于设置 Cloudflare D1 数据库配置的 GitHub Repository Secrets

set -e

echo "🚀 Sub-Store GitHub Secrets 配置向导"
echo "======================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查必需的工具
check_requirements() {
    echo "🔍 检查必需的工具..."
    
    if ! command -v gh &> /dev/null; then
        echo -e "${RED}❌ GitHub CLI (gh) 未安装${NC}"
        echo "请安装 GitHub CLI: https://cli.github.com/"
        exit 1
    fi
    
    if ! command -v wrangler &> /dev/null; then
        echo -e "${YELLOW}⚠️ Wrangler CLI 未安装，某些功能可能不可用${NC}"
        echo "可选：安装 Wrangler CLI: npm install -g wrangler"
    fi
    
    echo -e "${GREEN}✅ 工具检查完成${NC}"
    echo ""
}

# 检查 GitHub 认证状态
check_github_auth() {
    echo "🔐 检查 GitHub 认证状态..."
    
    if ! gh auth status &> /dev/null; then
        echo -e "${RED}❌ GitHub CLI 未认证${NC}"
        echo "请先运行: gh auth login"
        exit 1
    fi
    
    echo -e "${GREEN}✅ GitHub 认证正常${NC}"
    echo ""
}

# 获取仓库信息
get_repo_info() {
    echo "📋 获取仓库信息..."
    
    if [ -d ".git" ]; then
        REPO_URL=$(git remote get-url origin 2>/dev/null || echo "")
        if [[ $REPO_URL =~ github\.com[:/]([^/]+)/([^/.]+) ]]; then
            REPO_OWNER="${BASH_REMATCH[1]}"
            REPO_NAME="${BASH_REMATCH[2]}"
            echo -e "${GREEN}✅ 检测到仓库: ${REPO_OWNER}/${REPO_NAME}${NC}"
        else
            echo -e "${RED}❌ 无法解析仓库信息${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ 当前目录不是 Git 仓库${NC}"
        exit 1
    fi
    echo ""
}

# 配置 Cloudflare D1 数据库 Secrets
configure_d1_secrets() {
    echo "🗄️ 配置 Cloudflare D1 数据库 Secrets"
    echo "=================================="
    echo ""
    
    # 获取数据库名称
    echo -e "${BLUE}请输入 D1 数据库名称:${NC}"
    echo "建议: sub-store-db (生产环境) 或 sub-store-db-dev (开发环境)"
    read -p "数据库名称: " DB_NAME
    
    if [ -z "$DB_NAME" ]; then
        echo -e "${RED}❌ 数据库名称不能为空${NC}"
        exit 1
    fi
    
    # 获取数据库 ID
    echo ""
    echo -e "${BLUE}请输入 D1 数据库 ID:${NC}"
    echo "可以通过以下方式获取:"
    echo "1. Cloudflare Dashboard > D1 > 选择数据库 > 右侧面板查看 Database ID"
    echo "2. 运行命令: wrangler d1 list"
    echo "3. 运行命令: wrangler d1 info $DB_NAME"
    read -p "数据库 ID: " DB_ID
    
    if [ -z "$DB_ID" ]; then
        echo -e "${RED}❌ 数据库 ID 不能为空${NC}"
        exit 1
    fi
    
    # 验证数据库 ID 格式 (通常是 UUID 格式)
    if [[ ! $DB_ID =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
        echo -e "${YELLOW}⚠️ 数据库 ID 格式可能不正确 (应该是 UUID 格式)${NC}"
        read -p "是否继续? (y/N): " CONTINUE
        if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    echo ""
    echo "📝 即将设置以下 Secrets:"
    echo "CF_D1_DATABASE_NAME: $DB_NAME"
    echo "CF_D1_DATABASE_ID: ${DB_ID:0:8}...${DB_ID: -8}" # 隐藏中间部分
    echo ""
    
    read -p "确认设置这些 Secrets? (y/N): " CONFIRM
    if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
        echo "操作已取消"
        exit 0
    fi
    
    # 设置 Secrets
    echo ""
    echo "🔐 设置 GitHub Repository Secrets..."
    
    echo "设置 CF_D1_DATABASE_NAME..."
    if gh secret set CF_D1_DATABASE_NAME --body "$DB_NAME" --repo "$REPO_OWNER/$REPO_NAME"; then
        echo -e "${GREEN}✅ CF_D1_DATABASE_NAME 设置成功${NC}"
    else
        echo -e "${RED}❌ CF_D1_DATABASE_NAME 设置失败${NC}"
        exit 1
    fi
    
    echo "设置 CF_D1_DATABASE_ID..."
    if gh secret set CF_D1_DATABASE_ID --body "$DB_ID" --repo "$REPO_OWNER/$REPO_NAME"; then
        echo -e "${GREEN}✅ CF_D1_DATABASE_ID 设置成功${NC}"
    else
        echo -e "${RED}❌ CF_D1_DATABASE_ID 设置失败${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}🎉 D1 数据库 Secrets 配置完成!${NC}"
}

# 检查其他必需的 Secrets
check_other_secrets() {
    echo ""
    echo "🔍 检查其他必需的 Secrets..."
    
    MISSING_SECRETS=()
    
    # 检查 CLOUDFLARE_API_TOKEN
    if ! gh secret list --repo "$REPO_OWNER/$REPO_NAME" | grep -q "CLOUDFLARE_API_TOKEN"; then
        MISSING_SECRETS+=("CLOUDFLARE_API_TOKEN")
    fi
    
    # 检查 ADMIN_TOKEN
    if ! gh secret list --repo "$REPO_OWNER/$REPO_NAME" | grep -q "ADMIN_TOKEN"; then
        MISSING_SECRETS+=("ADMIN_TOKEN")
    fi
    
    if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
        echo -e "${YELLOW}⚠️ 发现缺失的 Secrets:${NC}"
        for secret in "${MISSING_SECRETS[@]}"; do
            echo "  - $secret"
        done
        echo ""
        echo "请手动设置这些 Secrets:"
        echo "1. 访问: https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions"
        echo "2. 点击 'New repository secret'"
        echo "3. 设置以下 Secrets:"
        echo ""
        for secret in "${MISSING_SECRETS[@]}"; do
            case $secret in
                "CLOUDFLARE_API_TOKEN")
                    echo "   $secret: 你的 Cloudflare API Token (需要 Workers 和 D1 权限)"
                    ;;
                "ADMIN_TOKEN")
                    echo "   $secret: 管理员登录密码 (建议: 强密码)"
                    ;;
            esac
        done
    else
        echo -e "${GREEN}✅ 所有必需的 Secrets 都已配置${NC}"
    fi
}

# 显示配置总结
show_summary() {
    echo ""
    echo "📋 配置总结"
    echo "==========="
    echo ""
    echo "✅ 已配置的 D1 数据库 Secrets:"
    echo "   - CF_D1_DATABASE_NAME"
    echo "   - CF_D1_DATABASE_ID"
    echo ""
    echo "🔧 下一步操作:"
    echo "1. 确保所有必需的 Secrets 都已配置"
    echo "2. 推送代码到 master 分支触发部署"
    echo "3. 检查 GitHub Actions 部署日志"
    echo "4. 验证 Workers 健康检查: https://substore-api.senmago231.workers.dev/health"
    echo ""
    echo "📚 相关文档:"
    echo "- GitHub Secrets: https://docs.github.com/en/actions/security-guides/encrypted-secrets"
    echo "- Cloudflare D1: https://developers.cloudflare.com/d1/"
    echo "- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/"
    echo ""
    echo -e "${GREEN}🎉 配置完成!${NC}"
}

# 主函数
main() {
    check_requirements
    check_github_auth
    get_repo_info
    configure_d1_secrets
    check_other_secrets
    show_summary
}

# 运行主函数
main "$@"
