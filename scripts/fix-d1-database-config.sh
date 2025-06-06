#!/bin/bash

# Sub-Store Cloudflare D1数据库配置修复脚本
# 用于创建D1数据库并配置GitHub Repository Secrets

set -e

echo "🔧 Sub-Store Cloudflare D1数据库配置修复"
echo "========================================"
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
    
    if ! command -v wrangler &> /dev/null; then
        echo -e "${RED}❌ Wrangler CLI 未安装${NC}"
        echo "请安装 Wrangler CLI: npm install -g wrangler"
        exit 1
    fi
    
    if ! command -v gh &> /dev/null; then
        echo -e "${YELLOW}⚠️ GitHub CLI 未安装，将提供手动配置说明${NC}"
        GITHUB_CLI_AVAILABLE=false
    else
        GITHUB_CLI_AVAILABLE=true
    fi
    
    echo -e "${GREEN}✅ 工具检查完成${NC}"
    echo ""
}

# 检查Wrangler认证状态
check_wrangler_auth() {
    echo "🔐 检查Wrangler认证状态..."
    
    if ! wrangler whoami &> /dev/null; then
        echo -e "${RED}❌ Wrangler未认证${NC}"
        echo "请先运行: wrangler auth login"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Wrangler认证正常${NC}"
    echo ""
}

# 创建或获取D1数据库
create_or_get_d1_database() {
    echo "🗄️ 创建或获取D1数据库..."
    
    DB_NAME="sub-store-db"
    
    # 检查数据库是否已存在
    echo "检查数据库是否已存在..."
    if wrangler d1 list | grep -q "$DB_NAME"; then
        echo -e "${YELLOW}⚠️ 数据库 '$DB_NAME' 已存在${NC}"
        
        # 获取现有数据库信息
        DB_INFO=$(wrangler d1 list | grep "$DB_NAME")
        DB_ID=$(echo "$DB_INFO" | awk '{print $1}')
        
        echo "数据库ID: $DB_ID"
        echo "数据库名称: $DB_NAME"
        
    else
        echo "创建新的D1数据库..."
        
        # 创建新数据库
        CREATE_OUTPUT=$(wrangler d1 create "$DB_NAME" 2>&1)
        
        if echo "$CREATE_OUTPUT" | grep -q "Successfully created"; then
            echo -e "${GREEN}✅ 数据库创建成功${NC}"
            
            # 从输出中提取数据库ID
            DB_ID=$(echo "$CREATE_OUTPUT" | grep "database_id" | sed 's/.*database_id = "\([^"]*\)".*/\1/')
            
            if [ -z "$DB_ID" ]; then
                echo -e "${RED}❌ 无法从创建输出中提取数据库ID${NC}"
                echo "创建输出："
                echo "$CREATE_OUTPUT"
                exit 1
            fi
            
            echo "新数据库ID: $DB_ID"
            echo "新数据库名称: $DB_NAME"
            
        else
            echo -e "${RED}❌ 数据库创建失败${NC}"
            echo "$CREATE_OUTPUT"
            exit 1
        fi
    fi
    
    # 验证数据库ID格式
    if [[ ! $DB_ID =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
        echo -e "${YELLOW}⚠️ 数据库ID格式可能不正确: $DB_ID${NC}"
        read -p "是否继续? (y/N): " CONTINUE
        if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    echo ""
}

# 配置GitHub Repository Secrets
configure_github_secrets() {
    echo "🔐 配置GitHub Repository Secrets..."
    
    if [ "$GITHUB_CLI_AVAILABLE" = true ]; then
        # 检查GitHub认证
        if ! gh auth status &> /dev/null; then
            echo -e "${RED}❌ GitHub CLI未认证${NC}"
            echo "请先运行: gh auth login"
            exit 1
        fi
        
        # 获取仓库信息
        if [ -d ".git" ]; then
            REPO_URL=$(git remote get-url origin 2>/dev/null || echo "")
            if [[ $REPO_URL =~ github\.com[:/]([^/]+)/([^/.]+) ]]; then
                REPO_OWNER="${BASH_REMATCH[1]}"
                REPO_NAME="${BASH_REMATCH[2]}"
                echo "检测到仓库: $REPO_OWNER/$REPO_NAME"
            else
                echo -e "${RED}❌ 无法解析仓库信息${NC}"
                exit 1
            fi
        else
            echo -e "${RED}❌ 当前目录不是Git仓库${NC}"
            exit 1
        fi
        
        # 设置Secrets
        echo "设置CF_D1_DATABASE_NAME..."
        if gh secret set CF_D1_DATABASE_NAME --body "$DB_NAME" --repo "$REPO_OWNER/$REPO_NAME"; then
            echo -e "${GREEN}✅ CF_D1_DATABASE_NAME 设置成功${NC}"
        else
            echo -e "${RED}❌ CF_D1_DATABASE_NAME 设置失败${NC}"
            exit 1
        fi
        
        echo "设置CF_D1_DATABASE_ID..."
        if gh secret set CF_D1_DATABASE_ID --body "$DB_ID" --repo "$REPO_OWNER/$REPO_NAME"; then
            echo -e "${GREEN}✅ CF_D1_DATABASE_ID 设置成功${NC}"
        else
            echo -e "${RED}❌ CF_D1_DATABASE_ID 设置失败${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}🎉 GitHub Secrets配置完成!${NC}"
        
    else
        # 提供手动配置说明
        echo -e "${YELLOW}📋 请手动配置GitHub Repository Secrets:${NC}"
        echo ""
        echo "1. 访问: https://github.com/senma231/sub-store/settings/secrets/actions"
        echo "2. 点击 'New repository secret'"
        echo "3. 添加以下Secrets:"
        echo ""
        echo "   Secret名称: CF_D1_DATABASE_NAME"
        echo "   Secret值: $DB_NAME"
        echo ""
        echo "   Secret名称: CF_D1_DATABASE_ID"
        echo "   Secret值: $DB_ID"
        echo ""
        echo "4. 保存后继续下一步"
        echo ""
        read -p "按Enter键继续..." 
    fi
    
    echo ""
}

# 创建数据库表结构
create_database_schema() {
    echo "📋 创建数据库表结构..."
    
    # 创建临时SQL文件
    cat > /tmp/sub-store-schema.sql << 'EOF'
-- 创建节点表
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    server TEXT NOT NULL,
    port INTEGER NOT NULL,
    enabled BOOLEAN DEFAULT true,
    uuid TEXT,
    password TEXT,
    method TEXT,
    network TEXT,
    path TEXT,
    host TEXT,
    tls BOOLEAN DEFAULT false,
    sni TEXT,
    alpn TEXT,
    fingerprint TEXT,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建自定义订阅表
CREATE TABLE IF NOT EXISTS custom_subscriptions (
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    node_ids TEXT NOT NULL, -- JSON数组字符串
    format TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    access_count INTEGER DEFAULT 0,
    last_accessed DATETIME
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_nodes_enabled ON nodes(enabled);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_custom_subscriptions_expires ON custom_subscriptions(expires_at);
EOF

    # 执行SQL
    echo "执行数据库表创建..."
    if wrangler d1 execute "$DB_NAME" --file=/tmp/sub-store-schema.sql; then
        echo -e "${GREEN}✅ 数据库表创建成功${NC}"
    else
        echo -e "${RED}❌ 数据库表创建失败${NC}"
        exit 1
    fi
    
    # 清理临时文件
    rm -f /tmp/sub-store-schema.sql
    
    echo ""
}

# 验证数据库连接
verify_database() {
    echo "🔍 验证数据库连接..."
    
    # 测试查询
    if wrangler d1 execute "$DB_NAME" --command="SELECT name FROM sqlite_master WHERE type='table';" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 数据库连接验证成功${NC}"
        
        # 显示表信息
        echo "数据库表："
        wrangler d1 execute "$DB_NAME" --command="SELECT name FROM sqlite_master WHERE type='table';" | grep -E "(nodes|custom_subscriptions)" || echo "  (表可能还未创建)"
        
    else
        echo -e "${RED}❌ 数据库连接验证失败${NC}"
        exit 1
    fi
    
    echo ""
}

# 显示配置总结
show_summary() {
    echo "📋 配置总结"
    echo "==========="
    echo ""
    echo "✅ D1数据库配置:"
    echo "   数据库名称: $DB_NAME"
    echo "   数据库ID: ${DB_ID:0:8}...${DB_ID: -8}" # 隐藏中间部分
    echo ""
    echo "✅ GitHub Secrets配置:"
    echo "   CF_D1_DATABASE_NAME: $DB_NAME"
    echo "   CF_D1_DATABASE_ID: ${DB_ID:0:8}...${DB_ID: -8}"
    echo ""
    echo "🔧 下一步操作:"
    echo "1. 确保GitHub Actions workflow已更新（参考WORKFLOW_UPDATE_INSTRUCTIONS.md）"
    echo "2. 推送代码到master分支触发部署"
    echo "3. 检查部署日志确认数据库配置正确"
    echo "4. 验证Sub-Store系统功能正常"
    echo ""
    echo "📚 相关文档:"
    echo "- docs/GITHUB_SECRETS_SETUP.md"
    echo "- WORKFLOW_UPDATE_INSTRUCTIONS.md"
    echo ""
    echo -e "${GREEN}🎉 D1数据库配置修复完成!${NC}"
}

# 主函数
main() {
    check_requirements
    check_wrangler_auth
    create_or_get_d1_database
    configure_github_secrets
    create_database_schema
    verify_database
    show_summary
}

# 运行主函数
main "$@"
