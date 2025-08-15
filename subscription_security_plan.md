# Sub-Store 安全策略详细配置方案

## 1. 订阅链接时效性混淆方案

### A. 时效性链接生成
```typescript
// 生成带时效性的订阅链接
const generateTimedSubscriptionUrl = (uuid: string, userId: string) => {
  const timestamp = Date.now();
  const expiry = timestamp + (24 * 60 * 60 * 1000); // 24小时有效期
  
  // 创建签名
  const payload = `${uuid}:${userId}:${expiry}`;
  const signature = crypto.subtle.digest('SHA-256', payload + SECRET_KEY);
  
  // 编码链接
  const encoded = btoa(payload).replace(/[+/=]/g, '');
  
  return `/s/${encoded}?sig=${signature}&t=${timestamp}`;
};

// 验证时效性链接
const validateTimedSubscription = (encoded: string, signature: string) => {
  try {
    const payload = atob(encoded);
    const [uuid, userId, expiry] = payload.split(':');
    
    // 验证签名
    const expectedSig = crypto.subtle.digest('SHA-256', payload + SECRET_KEY);
    if (signature !== expectedSig) return null;
    
    // 验证时效性
    if (Date.now() > parseInt(expiry)) return null;
    
    return { uuid, userId, expiry: parseInt(expiry) };
  } catch {
    return null;
  }
};
```

### B. 流量限制集成
```typescript
// 结合流量限制的订阅访问
const handleSubscriptionAccess = async (request: Request) => {
  const { encoded, sig } = getUrlParams(request);
  const validation = validateTimedSubscription(encoded, sig);
  
  if (!validation) {
    return new Response('Invalid or expired link', { status: 403 });
  }
  
  // 检查流量限制
  const usage = await getSubscriptionUsage(validation.userId);
  if (usage.exceeded) {
    return new Response('Traffic limit exceeded', { status: 429 });
  }
  
  // 记录访问并返回订阅内容
  await recordSubscriptionAccess(validation.userId, request);
  return generateSubscriptionContent(validation.uuid);
};
```

## 2. Cloudflare安全规则配置

### A. WAF Custom Rules

#### 规则1: 阻止爬虫和自动化工具
```javascript
// 表达式
(http.user_agent contains "curl") or 
(http.user_agent contains "wget") or 
(http.user_agent contains "python-requests") or 
(http.user_agent contains "bot") or
(http.user_agent contains "spider") or
(http.user_agent eq "") or
(http.user_agent contains "scrapy") or
(http.user_agent contains "selenium")

// 动作: Block
// 优先级: 1
```

#### 规则2: 订阅API访问控制
```javascript
// 表达式
(http.request.uri.path matches "^/s/.*") and 
(not http.referer contains "sub.senma.io") and
(not http.referer contains "sub-store-frontend.pages.dev") and
(not http.user_agent contains "v2ray") and
(not http.user_agent contains "clash") and
(not http.user_agent contains "shadowrocket")

// 动作: Challenge
// 优先级: 2
```

#### 规则3: 管理API保护
```javascript
// 表达式
(http.request.uri.path matches "^/api/admin/.*") and
(not http.referer contains "sub.senma.io")

// 动作: Block
// 优先级: 3
```

### B. Rate Limiting Rules

#### 订阅API限制
```yaml
名称: "Subscription API Rate Limit"
表达式: (http.request.uri.path matches "^/s/.*")
特征:
  - 按IP地址: 每分钟5次请求
  - 按IP地址: 每小时20次请求
动作: 
  - 超过分钟限制: Challenge
  - 超过小时限制: Block
持续时间: 1小时
```

#### 管理API限制
```yaml
名称: "Admin API Rate Limit"
表达式: (http.request.uri.path matches "^/api/admin/.*")
特征:
  - 按IP地址: 每分钟3次请求
  - 按IP地址: 每小时10次请求
动作: Block
持续时间: 24小时
```

#### 通用API限制
```yaml
名称: "General API Rate Limit"
表达式: (http.request.uri.path matches "^/api/.*")
特征:
  - 按IP地址: 每分钟30次请求
  - 按IP地址: 每小时100次请求
动作: Challenge
持续时间: 1小时
```

### C. Bot Management

#### Super Bot Fight Mode
```yaml
启用功能:
  - 机器学习检测: 开启
  - JavaScript检测: 开启
  - 设备指纹识别: 开启
  - 行为分析: 开启

白名单User-Agent:
  - "v2ray*"
  - "clash*" 
  - "shadowrocket*"
  - "quantumult*"
  - "surge*"

动作:
  - 确定的机器人: Block
  - 可能的机器人: Challenge
  - 验证的机器人: Allow
```

### D. Access Rules

#### 地理位置限制
```yaml
规则1: 允许主要地区
表达式: (ip.geoip.country in {"CN" "HK" "TW" "SG" "JP" "US" "KR"})
动作: Allow
优先级: 1

规则2: 限制订阅API地理访问
表达式: 
  (http.request.uri.path matches "^/s/.*") and 
  (not ip.geoip.country in {"CN" "HK" "TW" "SG" "JP" "US" "KR"})
动作: Block
优先级: 2
```

#### IP声誉过滤
```yaml
规则3: 阻止恶意IP
表达式: (cf.threat_score gt 10)
动作: Challenge
优先级: 3

规则4: 阻止Tor网络
表达式: (cf.bot_management.verified_bot eq false) and (ip.geoip.is_in_european_union eq false) and (cf.threat_score gt 5)
动作: Block
优先级: 4
```

## 3. 代码安全中间件简化

### A. 可以移除的中间件
```typescript
// 这些可以用Cloudflare替代
- basicRateLimit() // 用CF Rate Limiting
- ipWhitelist() // 用CF Access Rules  
- geoRestriction() // 用CF Geographic Rules
- basicBotDetection() // 用CF Bot Management
- ddosProtection() // 用CF DDoS Protection
```

### B. 必须保留的中间件
```typescript
// 这些必须在代码中保留
- jwtAuth() // JWT Token验证
- adminTokenAuth() // ADMIN_TOKEN验证
- subscriptionValidation() // 订阅链接验证
- dataValidation() // 业务数据验证
- auditLogging() // 操作日志记录
```

## 4. 配置步骤

### 立即配置 (免费功能)
1. Security → WAF → Custom Rules → 添加上述3个规则
2. Security → Rate Limiting → 添加上述3个限制规则
3. Security → Bots → 启用Bot Fight Mode
4. Security → Access → 添加地理位置和IP规则

### 付费功能 (可选)
1. Advanced Rate Limiting - 更精细控制
2. Advanced Bot Management - ML检测
3. Load Balancing - 多节点部署
4. Analytics - 详细访问分析

## 5. 监控和调优

### A. 关键指标监控
- 订阅链接访问频率
- 被阻止的请求数量
- Challenge通过率
- 地理位置访问分布

### B. 定期调优
- 每周检查WAF规则效果
- 每月调整Rate Limiting阈值
- 季度更新Bot Management规则
- 年度安全策略评估

## 6. 应急响应

### A. 攻击检测
- 异常流量激增
- 大量Challenge失败
- 特定地区异常访问
- 订阅链接批量访问

### B. 应急措施
- 临时提高安全级别
- 启用Under Attack Mode
- 调整Rate Limiting阈值
- 更新WAF规则
