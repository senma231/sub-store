# Cloudflare免费账号安全配置完整指南

## 📋 免费账号限制说明

| 功能 | 免费限制 | 付费版本 |
|------|----------|----------|
| **WAF Custom Rules** | 5条规则 | 100条+ |
| **Rate Limiting** | 1条规则 | 10条+ |
| **Bot Fight Mode** | 基础版 | 高级版 |
| **Page Rules** | 3条规则 | 20条+ |

## 🔧 配置步骤

### 第一步：登录Cloudflare
1. 访问 https://dash.cloudflare.com
2. 选择域名 `senma.io`

---

### 第二步：配置WAF Custom Rules
**路径**: Security → Security rules → Create rule

#### 规则1：综合安全保护 (最重要)
```yaml
规则名称: Block Crawlers and Bots
表达式: 
(http.user_agent contains "curl") or 
(http.user_agent contains "wget") or 
(http.user_agent contains "python-requests") or 
(http.user_agent contains "bot") or 
(http.user_agent contains "spider") or 
(http.user_agent eq "") or
(http.user_agent contains "scrapy")

动作: Block
优先级: 1
```

#### 规则2：API综合保护 (免费账号优化版)
```yaml
规则名称: API Protection
表达式:
(http.request.uri.path contains "/api/") and
(not http.referer contains "sub.senma.io") and
(not http.user_agent contains "v2ray") and
(not http.user_agent contains "clash") and
(not http.user_agent contains "shadowrocket") and
(not http.user_agent contains "quantumult")

动作: JS Challenge
优先级: 2
```

#### 规则3：管理API严格保护 (免费账号优化版)
```yaml
规则名称: Admin API Block
表达式:
(http.request.uri.path contains "/api/admin/") and
(not http.referer contains "sub.senma.io")

动作: Block
优先级: 3
```

#### 规则4：高威胁IP阻止
```yaml
规则名称: High Threat IP Block
表达式: (cf.threat_score gt 15)
动作: JS Challenge
优先级: 4
```

#### 规则5：订阅链接保护 (免费账号优化版)
```yaml
规则名称: Subscription Links Protection
表达式:
(http.request.uri.path starts with "/s/") and
(not http.user_agent contains "v2ray") and
(not http.user_agent contains "clash") and
(not http.user_agent contains "shadowrocket")

动作: JS Challenge
优先级: 5
```

---

### 第三步：配置Rate Limiting
**路径**: Security → Rate Limiting → Create rule

#### API综合速率限制 (免费账号版本) - ✅ 已优化
```yaml
规则名称: API Rate Limiting
表达式: (http.request.uri.path contains "/api/")

限制配置:
- 特征: IP
- 请求数: 200 (已从100调整为200)
- 时间段: 10 seconds (Cloudflare免费账号固定选项)

动作: Block

持续时间: 10 seconds

注意: 200 requests per 10 seconds = 1200 requests per minute
这个配置对正常使用来说非常宽松
```

**说明**: 免费账号不支持复杂的时间段配置，这个设置相当于每秒最多10次API请求。

---

### 第四步：启用Bot Fight Mode
**路径**: Security → Bots

#### 配置选项 (全部启用):
```yaml
✅ Bot Fight Mode: 已开启
   - JS Detections: On
   - 覆盖: Bot traffic + DDoS attacks

✅ AI训练机器人防护: 已开启
   - robots.txt信号防护
   - 覆盖: General + Bot traffic

✅ AI Labyrinth: 已开启
   - nofollow链接干扰
   - 覆盖: General + Bot traffic

✅ Block AI Bots: 已开启
   - 阻止AI训练爬虫
   - 作用范围: 所有页面
```

---

### 第五步：配置Page Rules (可选优化)
**路径**: Rules → Page Rules → Create Page Rule

#### 规则1：API缓存控制
```yaml
URL: sub-api.senma.io/api/*
设置:
- Cache Level: Bypass
- Browser Integrity Check: On
```

#### 规则2：静态资源缓存
```yaml
URL: sub.senma.io/*.{css,js,png,jpg,jpeg,gif,ico,svg,woff,woff2}
设置:
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month
- Browser Cache TTL: 1 day
```

#### 规则3：订阅链接安全
```yaml
URL: sub-api.senma.io/s/*
设置:
- Cache Level: Bypass
- Browser Integrity Check: On
![1755500850270](image/cloudflare_security_config_free/1755500850270.png)![1755500860769](image/cloudflare_security_config_free/1755500860769.png)```

---

### 第六步：DNS设置优化
**路径**: DNS → Records

确认您的DNS记录：
```yaml
类型: CNAME
名称: sub
内容: sub-store-frontend.pages.dev
代理状态: 已代理 (橙色云朵)

类型: CNAME  
名称: sub-api
内容: substore-api.senmago231.workers.dev
代理状态: 已代理 (橙色云朵)
```

---

### 第七步：SSL/TLS设置
**路径**: SSL/TLS → Overview

```yaml
加密模式: Full (strict)
最低TLS版本: 1.2
TLS 1.3: 开启
自动HTTPS重写: 开启
```

## 🎯 配置优先级建议

### ✅ 已完成配置:
1. ✅ **Rate Limiting**: API速率限制 (200 requests per 10 seconds)
2. ✅ **Bot Fight Mode**: 基础机器人防护 (已重新启用)
3. ✅ **系统功能**: 所有功能正常运行

### 🔄 正在进行配置:
4. **温和WAF规则**: 逐步恢复精确的安全防护

### 推荐配置 (有时间时):
4. ✅ **WAF规则2-5**: 更精细的API保护
5. ✅ **Page Rules**: 缓存和安全优化
6. ✅ **SSL/TLS**: 安全传输优化

## 🧪 配置完成后测试

### 功能测试:
1. **正常访问**: https://sub.senma.io 应该正常工作
2. **API功能**: 登录、节点管理、订阅管理正常
3. **移动端**: 手机访问正常

### 安全测试:
1. **爬虫阻止**: 使用curl访问应该被阻止
2. **频率限制**: 快速刷新页面应该触发Challenge
3. **恶意访问**: 异常请求应该被拦截

## 📊 预期效果

配置完成后您将获得：

### 安全防护:
- 阻止99%的恶意爬虫
- 防止API滥用
- 保护订阅链接

### 性能提升:
- 减少恶意流量
- 静态资源缓存
- CDN加速

### 成本控制:
- 减少无效请求
- 节省带宽成本
- 提升用户体验

## ⚠️ 重要提醒

1. **域名配置**: 确保只使用自定义域名 `sub.senma.io` 和 `sub-api.senma.io`
2. **测试验证**: 每配置一项都要测试功能是否正常
3. **逐步配置**: 建议先配置必须项，再配置可选项
4. **监控观察**: 配置后观察Analytics中的安全事件

## 🚀 开始配置

按照上述步骤逐一配置，建议先配置**必须配置**的3项，然后再配置其他项目。

配置过程中如有任何问题，请参考此文档或寻求技术支持。

---

**文档版本**: v1.0  
**更新时间**: 2025-08-18  
**适用账号**: Cloudflare免费账号  
**域名**: senma.io (sub.senma.io + sub-api.senma.io)
