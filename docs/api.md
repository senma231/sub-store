# Sub-Store API 文档

Sub-Store 提供了完整的 RESTful API 接口，支持节点管理、订阅生成、统计查询等功能。

## 🔐 认证

### 认证方式

API 支持两种认证方式：

1. **JWT Token** (推荐)
```http
Authorization: Bearer <jwt_token>
```

2. **Admin Token** (管理员操作)
```http
Authorization: Admin <admin_token>
```

### 获取 JWT Token

```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your_admin_token"
}
```

响应：
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "admin",
      "username": "admin",
      "role": "admin"
    },
    "expiresIn": 86400
  }
}
```

## 📊 节点管理 API

### 获取节点列表

```http
GET /api/nodes?page=1&limit=20&search=keyword&type=vless&enabled=true
```

参数：
- `page`: 页码 (默认: 1)
- `limit`: 每页数量 (默认: 20, 最大: 100)
- `search`: 搜索关键词
- `type`: 节点类型过滤
- `enabled`: 启用状态过滤

响应：
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "node-1",
        "name": "节点名称",
        "type": "vless",
        "server": "example.com",
        "port": 443,
        "enabled": true,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### 获取单个节点

```http
GET /api/nodes/{id}
```

### 创建节点

```http
POST /api/nodes
Content-Type: application/json

{
  "name": "测试节点",
  "type": "vless",
  "server": "example.com",
  "port": 443,
  "uuid": "12345678-1234-1234-1234-123456789abc",
  "encryption": "none",
  "network": "tcp",
  "security": "tls",
  "enabled": true
}
```

### 更新节点

```http
PUT /api/nodes/{id}
Content-Type: application/json

{
  "name": "更新后的节点名称",
  "enabled": false
}
```

### 删除节点

```http
DELETE /api/nodes/{id}
```

### 批量操作

```http
POST /api/nodes/batch
Content-Type: application/json

{
  "action": "enable",  // enable, disable, delete
  "nodeIds": ["node-1", "node-2", "node-3"]
}
```

## 🔗 订阅 API

### 获取支持的格式

```http
GET /sub
```

响应：
```json
{
  "success": true,
  "data": {
    "formats": [
      {
        "format": "v2ray",
        "name": "V2Ray/V2RayN",
        "description": "Base64 encoded subscription for V2Ray clients",
        "extension": "txt",
        "contentType": "text/plain",
        "url": "https://api.example.com/sub/v2ray"
      }
    ],
    "parameters": {
      "token": "Subscription token (optional)",
      "filename": "Custom filename",
      "types": "Filter by node types (comma-separated)",
      "include": "Include keywords (comma-separated)",
      "exclude": "Exclude keywords (comma-separated)",
      "sort": "Sort by: name, type, latency",
      "group": "Enable grouping (true/false)",
      "rename": "Rename rules (JSON encoded)"
    }
  }
}
```

### 获取订阅内容

```http
GET /sub/{format}?token=xxx&types=vless,vmess&sort=name
```

支持的格式：
- `v2ray`: V2Ray/V2RayN Base64 格式
- `v2ray-json`: V2Ray JSON 配置
- `clash`: Clash YAML 配置
- `shadowrocket`: Shadowrocket Base64 格式
- `quantumult-x`: Quantumult X 配置
- `surge`: Surge 配置

参数：
- `token`: 访问令牌 (可选)
- `filename`: 自定义文件名
- `types`: 节点类型过滤 (逗号分隔)
- `include`: 包含关键词 (逗号分隔)
- `exclude`: 排除关键词 (逗号分隔)
- `sort`: 排序方式 (name, type, latency)
- `group`: 启用分组 (true/false)
- `group_by`: 分组方式 (type, region, provider)
- `rename`: 重命名规则 (JSON 编码)

### 获取订阅信息

```http
GET /sub/{format}/info
```

响应：
```json
{
  "success": true,
  "data": {
    "format": {
      "format": "v2ray",
      "name": "V2Ray/V2RayN",
      "description": "Base64 encoded subscription"
    },
    "statistics": {
      "totalNodes": 10,
      "enabledNodes": 8,
      "nodeTypes": {
        "vless": 5,
        "vmess": 3
      }
    },
    "lastUpdated": 1704067200000
  }
}
```

## 📈 统计 API

### 获取基础统计

```http
GET /api/stats
```

响应：
```json
{
  "success": true,
  "data": {
    "totalNodes": 50,
    "totalSubscriptions": 1,
    "totalRequests": 1000,
    "activeNodes": 45,
    "requestsByFormat": {
      "v2ray": 500,
      "clash": 300,
      "shadowrocket": 200
    },
    "requestsByDate": {
      "2024-01-01": 100,
      "2024-01-02": 150
    }
  }
}
```

### 获取详细统计

```http
GET /api/stats/detailed?days=30
```

参数：
- `days`: 统计天数 (默认: 30, 最大: 90)

### 清理统计数据

```http
DELETE /api/stats/cleanup?retention_days=30
```

## 🔧 系统 API

### 健康检查

```http
GET /health
```

响应：
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production",
  "version": "1.0.0",
  "services": {
    "kv": "healthy"
  }
}
```

### 详细健康检查

```http
GET /health/detailed
```

### 就绪检查

```http
GET /health/ready
```

### 存活检查

```http
GET /health/live
```

## 🔑 认证 API

### 登录

```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your_password"
}
```

### 验证 Token

```http
POST /auth/verify
Authorization: Bearer <token>
```

### 刷新 Token

```http
POST /auth/refresh
Authorization: Bearer <token>
```

### 登出

```http
POST /auth/logout
Authorization: Bearer <token>
```

### 修改密码

```http
POST /auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

## 📝 错误处理

### 错误响应格式

```json
{
  "success": false,
  "error": "Error Type",
  "message": "详细错误信息"
}
```

### 常见错误码

- `400 Bad Request`: 请求参数错误
- `401 Unauthorized`: 未授权访问
- `403 Forbidden`: 权限不足
- `404 Not Found`: 资源不存在
- `409 Conflict`: 资源冲突
- `429 Too Many Requests`: 请求过于频繁
- `500 Internal Server Error`: 服务器内部错误

## 🚀 使用示例

### JavaScript/Node.js

```javascript
const API_BASE = 'https://your-api-domain.workers.dev';

// 登录获取 token
async function login(username, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await response.json();
  return data.data.token;
}

// 获取节点列表
async function getNodes(token) {
  const response = await fetch(`${API_BASE}/api/nodes`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}

// 创建节点
async function createNode(token, nodeData) {
  const response = await fetch(`${API_BASE}/api/nodes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(nodeData)
  });
  return response.json();
}
```

### Python

```python
import requests

API_BASE = 'https://your-api-domain.workers.dev'

class SubStoreAPI:
    def __init__(self):
        self.token = None
    
    def login(self, username, password):
        response = requests.post(f'{API_BASE}/auth/login', json={
            'username': username,
            'password': password
        })
        data = response.json()
        self.token = data['data']['token']
        return self.token
    
    def get_nodes(self):
        headers = {'Authorization': f'Bearer {self.token}'}
        response = requests.get(f'{API_BASE}/api/nodes', headers=headers)
        return response.json()
    
    def create_node(self, node_data):
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
        response = requests.post(f'{API_BASE}/api/nodes', 
                               json=node_data, headers=headers)
        return response.json()
```

## 📋 速率限制

- **API 接口**: 100 请求/分钟/IP
- **订阅接口**: 10 请求/分钟/IP
- **认证接口**: 5 请求/分钟/IP

超过限制将返回 `429 Too Many Requests` 错误。
