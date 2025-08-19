import React from 'react';
import { Typography, Space, Alert } from 'antd';
import { CloudServerOutlined } from '@ant-design/icons';
import XUIPanelManagerSimple from '../components/XUIPanelManagerSimple';

const { Title, Paragraph } = Typography;

const XUIPanelsPage: React.FC = () => {
  return (
    <div style={{ padding: '0 24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 页面标题 */}
        <div>
          <Title level={2}>
            <CloudServerOutlined /> X-UI面板管理
          </Title>
          <Paragraph type="secondary">
            管理X-UI面板连接，自动同步节点配置到Sub-Store系统
          </Paragraph>
        </div>

        {/* 功能说明 */}
        <Alert
          message="X-UI面板集成功能"
          description={
            <div>
              <p><strong>支持的功能：</strong></p>
              <ul>
                <li>🔗 连接X-UI面板并验证登录凭据</li>
                <li>📡 自动获取面板中的所有入站配置</li>
                <li>🔄 解析并导入节点到Sub-Store系统</li>
                <li>📊 支持VMess、VLESS、Trojan、Shadowsocks协议</li>
                <li>📝 记录详细的同步日志和状态</li>
              </ul>
              <p><strong>使用说明：</strong></p>
              <ol>
                <li>点击"添加面板"按钮，填入X-UI面板的连接信息</li>
                <li>使用"测试连接"功能验证面板连接是否正常</li>
                <li>点击"同步节点"按钮，自动导入面板中的节点配置</li>
                <li>查看"同步日志"了解详细的同步过程和结果</li>
              </ol>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        {/* X-UI面板管理组件 */}
        <XUIPanelManagerSimple />
      </Space>
    </div>
  );
};

export default XUIPanelsPage;
