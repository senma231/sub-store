# GitHub Actions Workflow 更新说明

## 🚨 重要说明

由于GitHub OAuth权限限制，无法通过当前的认证方式直接推送对 `.github/workflows/deploy.yml` 文件的修改。需要手动应用以下更改。

## 📋 需要应用的修改

### 文件：`.github/workflows/deploy.yml`

在 `deploy-workers` job 中，需要在 `Install workers dependencies` 步骤之后添加以下配置：

```yaml
    - name: Configure D1 Database Settings
      run: |
        echo "🔧 配置 D1 数据库设置..."
        cd workers
        
        # 验证必需的 Secrets 是否存在
        if [ -z "${{ secrets.CF_D1_DATABASE_ID }}" ]; then
          echo "❌ 错误：CF_D1_DATABASE_ID secret 未配置"
          echo "请在 GitHub Repository Settings > Secrets 中添加 CF_D1_DATABASE_ID"
          exit 1
        fi
        
        if [ -z "${{ secrets.CF_D1_DATABASE_NAME }}" ]; then
          echo "❌ 错误：CF_D1_DATABASE_NAME secret 未配置"
          echo "请在 GitHub Repository Settings > Secrets 中添加 CF_D1_DATABASE_NAME"
          exit 1
        fi
        
        # 备份原始 wrangler.toml
        cp wrangler.toml wrangler.toml.backup
        
        # 使用 envsubst 替换环境变量占位符
        export CF_D1_DATABASE_ID="${{ secrets.CF_D1_DATABASE_ID }}"
        export CF_D1_DATABASE_NAME="${{ secrets.CF_D1_DATABASE_NAME }}"
        
        # 替换占位符并生成最终配置文件
        envsubst < wrangler.toml > wrangler.toml.tmp && mv wrangler.toml.tmp wrangler.toml
        
        echo "✅ D1 数据库配置完成"
        echo "数据库名称: ${{ secrets.CF_D1_DATABASE_NAME }}"
        echo "数据库ID: $(echo "${{ secrets.CF_D1_DATABASE_ID }}" | sed 's/./*/g')" # 隐藏敏感信息
        
        # 验证配置文件格式
        echo "🔍 验证 wrangler.toml 配置..."
        if grep -q "CF_D1_DATABASE" wrangler.toml; then
          echo "❌ 错误：环境变量替换失败"
          cat wrangler.toml
          exit 1
        fi
        
        echo "✅ 配置文件验证通过"

    - name: Create D1 Database (if not exists)
      uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        workingDirectory: workers
        command: d1 create ${{ secrets.CF_D1_DATABASE_NAME }}
      continue-on-error: true # 数据库可能已存在

    - name: Verify D1 Database Connection
      uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        workingDirectory: workers
        command: d1 info ${{ secrets.CF_D1_DATABASE_NAME }}
```

### 修改 Deploy 步骤

在 `Deploy to Cloudflare Workers` 步骤中，需要添加环境变量：

```yaml
    - name: Deploy to Cloudflare Workers
      uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        workingDirectory: workers
        command: deploy --compatibility-date=2024-01-15
        secrets: |
          ADMIN_TOKEN
          JWT_SECRET
      env:
        # 管理员认证配置
        ADMIN_TOKEN: ${{ secrets.ADMIN_TOKEN }}
        # JWT 密钥（可选，系统会自动生成）
        JWT_SECRET: ${{ secrets.JWT_SECRET }}
        # D1 数据库配置（用于验证）
        CF_D1_DATABASE_ID: ${{ secrets.CF_D1_DATABASE_ID }}
        CF_D1_DATABASE_NAME: ${{ secrets.CF_D1_DATABASE_NAME }}

    - name: Verify Deployment and Database Connection
      run: |
        echo "🔍 验证部署和数据库连接..."
        
        # 等待部署完成
        sleep 30
        
        # 检查 Workers 健康状态
        echo "检查 Workers API 健康状态..."
        HEALTH_RESPONSE=$(curl -s https://substore-api.senmago231.workers.dev/health || echo "failed")
        
        if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
          echo "✅ Workers API 部署成功"
          
          # 检查数据库连接状态
          if echo "$HEALTH_RESPONSE" | grep -q '"database"'; then
            echo "✅ 数据库连接配置正常"
            echo "数据库健康状态："
            echo "$HEALTH_RESPONSE" | grep -o '"database":[^}]*}' || echo "无法解析数据库状态"
          else
            echo "⚠️ 数据库健康检查信息不可用"
          fi
        else
          echo "❌ Workers API 部署可能失败"
          echo "响应内容: $HEALTH_RESPONSE"
          exit 1
        fi
        
        echo "✅ 部署验证完成"
```

## 🔧 手动应用步骤

### 方法 1: 通过 GitHub Web 界面

1. **访问文件**：
   - 打开 https://github.com/senma231/sub-store/blob/master/.github/workflows/deploy.yml
   - 点击编辑按钮（铅笔图标）

2. **应用修改**：
   - 在第80行（`Install workers dependencies` 之后）插入上述 `Configure D1 Database Settings` 步骤
   - 在第140行（`Deploy to Cloudflare Workers` 步骤）添加环境变量配置
   - 在最后添加 `Verify Deployment and Database Connection` 步骤

3. **提交更改**：
   - 添加提交信息：`添加GitHub Repository Secrets支持到GitHub Actions workflow`
   - 选择 "Commit directly to the master branch"
   - 点击 "Commit changes"

### 方法 2: 通过本地Git（需要workflow权限）

如果你有足够的权限：

```bash
# 添加workflow文件修改
git add .github/workflows/deploy.yml

# 提交修改
git commit -m "添加GitHub Repository Secrets支持到GitHub Actions workflow"

# 推送到远程
git push origin master
```

## ✅ 验证修改

修改应用后，推送任何代码到master分支应该会：

1. **触发GitHub Actions**
2. **读取Repository Secrets**：CF_D1_DATABASE_NAME 和 CF_D1_DATABASE_ID
3. **动态配置wrangler.toml**
4. **部署到Cloudflare Workers**
5. **验证数据库连接**

## 🔍 检查部署日志

在GitHub Actions运行时，你应该看到：

```
🔧 配置 D1 数据库设置...
✅ D1 数据库配置完成
数据库名称: sub-store-db
数据库ID: ********
🔍 验证 wrangler.toml 配置...
✅ 配置文件验证通过
```

## 📞 获取帮助

如果遇到问题：

1. **检查Secrets配置**：确保 CF_D1_DATABASE_NAME 和 CF_D1_DATABASE_ID 已在Repository Secrets中配置
2. **查看Actions日志**：检查GitHub Actions的详细运行日志
3. **运行验证脚本**：使用 `npm run verify:secrets` 检查配置状态
4. **参考文档**：查看 `docs/GITHUB_SECRETS_SETUP.md` 获取详细指南

---

**应用这些修改后，Sub-Store项目将完全支持GitHub Repository Secrets管理！** 🚀
