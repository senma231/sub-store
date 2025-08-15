import React from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  Form, 
  Input, 
  Button, 
  Switch, 
  Select,
  Divider,
  Space,
  Alert,
  Tabs
} from 'antd';
import { 
  SettingOutlined, 
  SecurityScanOutlined, 
  DatabaseOutlined,
  InfoCircleOutlined,
  SaveOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const SettingsPage: React.FC = () => {
  const { isDarkMode, toggleTheme } = useTheme();

  const tabItems = [
    {
      key: 'general',
      label: '常规设置',
      icon: <SettingOutlined />,
      children: (
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card title="基础配置">
              <Form layout="vertical">
                <Form.Item label="系统名称" name="appName">
                  <Input placeholder="Sub-Store" />
                </Form.Item>
                
                <Form.Item label="系统描述" name="appDescription">
                  <TextArea 
                    rows={3} 
                    placeholder="代理节点订阅管理系统"
                  />
                </Form.Item>
                
                <Form.Item label="默认语言" name="language">
                  <Select
                    options={[
                      { label: '简体中文', value: 'zh-CN' },
                      { label: 'English', value: 'en-US' },
                    ]}
                  />
                </Form.Item>
                
                <Form.Item label="主题模式">
                  <Space>
                    <Switch 
                      checked={isDarkMode}
                      onChange={toggleTheme}
                      checkedChildren="深色"
                      unCheckedChildren="浅色"
                    />
                    <Text type="secondary">
                      {isDarkMode ? '当前为深色模式' : '当前为浅色模式'}
                    </Text>
                  </Space>
                </Form.Item>
                
                <Form.Item>
                  <Space>
                    <Button type="primary" icon={<SaveOutlined />}>
                      保存设置
                    </Button>
                    <Button icon={<ReloadOutlined />}>
                      重置
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'security',
      label: '安全设置',
      icon: <SecurityScanOutlined />,
      children: (
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card title="访问控制">
              <Form layout="vertical">
                <Form.Item label="管理员密码" name="adminPassword">
                  <Input.Password placeholder="输入新密码" />
                </Form.Item>
                
                <Form.Item label="确认密码" name="confirmPassword">
                  <Input.Password placeholder="再次输入密码" />
                </Form.Item>
                
                <Form.Item label="启用访问令牌" name="enableToken">
                  <Switch />
                </Form.Item>
                
                <Form.Item label="访问令牌" name="accessToken">
                  <Input.Password placeholder="用于订阅访问的令牌" />
                </Form.Item>
                
                <Form.Item label="速率限制" name="rateLimit">
                  <Input 
                    addonAfter="请求/分钟" 
                    placeholder="100"
                    type="number"
                  />
                </Form.Item>
                
                <Form.Item>
                  <Button type="primary" icon={<SaveOutlined />}>
                    保存安全设置
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'data',
      label: '数据管理',
      icon: <DatabaseOutlined />,
      children: (
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card title="数据备份与恢复">
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Alert
                  message="数据备份"
                  description="定期备份您的节点配置和设置，以防数据丢失。"
                  type="info"
                  showIcon
                />
                
                <div>
                  <Title level={4}>导出数据</Title>
                  <Space>
                    <Button>导出节点配置</Button>
                    <Button>导出系统设置</Button>
                    <Button>导出完整备份</Button>
                  </Space>
                </div>
                
                <Divider />
                
                <div>
                  <Title level={4}>导入数据</Title>
                  <Space direction="vertical">
                    <Button>选择备份文件</Button>
                    <Text type="secondary">
                      支持 JSON 格式的配置文件
                    </Text>
                  </Space>
                </div>
                
                <Divider />
                
                <div>
                  <Title level={4}>清理数据</Title>
                  <Space direction="vertical">
                    <Button danger>清理访问日志</Button>
                    <Button danger>清理统计数据</Button>
                    <Button danger>重置所有设置</Button>
                    <Text type="secondary">
                      ⚠️ 清理操作不可恢复，请谨慎操作
                    </Text>
                  </Space>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'about',
      label: '关于系统',
      icon: <InfoCircleOutlined />,
      children: (
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card title="系统信息">
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div>
                  <Title level={3}>Sub-Store</Title>
                  <Paragraph>
                    一个基于 GitHub + Cloudflare 的免费代理节点订阅管理系统，
                    支持多种代理协议和客户端格式。
                  </Paragraph>
                </div>
                
                <Divider />
                
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12}>
                    <Card size="small" title="版本信息">
                      <Space direction="vertical">
                        <div>
                          <Text strong>版本:</Text> v1.0.0
                        </div>
                        <div>
                          <Text strong>构建时间:</Text> 2024-01-01
                        </div>
                        <div>
                          <Text strong>Git 提交:</Text> abc123
                        </div>
                      </Space>
                    </Card>
                  </Col>
                  
                  <Col xs={24} sm={12}>
                    <Card size="small" title="技术栈">
                      <Space direction="vertical">
                        <div>
                          <Text strong>前端:</Text> React + TypeScript
                        </div>
                        <div>
                          <Text strong>后端:</Text> Cloudflare Workers
                        </div>
                        <div>
                          <Text strong>存储:</Text> Cloudflare KV
                        </div>
                      </Space>
                    </Card>
                  </Col>
                </Row>
                
                <Divider />
                
                <div>
                  <Title level={4}>支持的协议</Title>
                  <Space wrap>
                    <Text code>VLESS</Text>
                    <Text code>VMess</Text>
                    <Text code>Trojan</Text>
                    <Text code>Shadowsocks</Text>
                    <Text code>SOCKS5</Text>
                    <Text code>Hysteria2</Text>
                    <Text code>Hysteria</Text>
                  </Space>
                </div>
                
                <div>
                  <Title level={4}>支持的客户端</Title>
                  <Space wrap>
                    <Text code>V2Ray</Text>
                    <Text code>V2RayN</Text>
                    <Text code>Clash</Text>
                    <Text code>ClashX</Text>
                    <Text code>Shadowrocket</Text>
                    <Text code>Quantumult X</Text>
                    <Text code>Surge</Text>
                  </Space>
                </div>
                
                <Divider />
                
                <div>
                  <Title level={4}>相关链接</Title>
                  <Space direction="vertical">
                    <a href="https://github.com/your-username/sub-store" target="_blank" rel="noopener noreferrer">
                      📖 项目文档
                    </a>
                    <a href="https://github.com/your-username/sub-store/issues" target="_blank" rel="noopener noreferrer">
                      🐛 问题反馈
                    </a>
                    <a href="https://github.com/your-username/sub-store/releases" target="_blank" rel="noopener noreferrer">
                      🚀 版本发布
                    </a>
                  </Space>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      ),
    },
  ];

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          系统设置
        </Title>
        <Text type="secondary">配置和管理系统参数</Text>
      </div>

      <Card>
        <Tabs
          defaultActiveKey="general"
          items={tabItems}
          tabPosition="left"
          style={{ minHeight: 400 }}
        />
      </Card>
    </div>
  );
};

export default SettingsPage;
