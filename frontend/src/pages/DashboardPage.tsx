import React from 'react';
import { Row, Col, Card, Statistic, Typography, Space, Button, Alert, Divider } from 'antd';
import {
  NodeIndexOutlined,
  BarChartOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { statsService } from '../services/statsService';
import { nodeService } from '../services/nodeService';
import { subscriptionService } from '../services/subscriptionService';

const { Title, Text, Paragraph } = Typography;

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // 获取统计数据
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: statsService.getStatistics,
    refetchInterval: 30000, // 30秒刷新一次
  });

  // 获取节点数据
  const { data: nodesData, isLoading: nodesLoading } = useQuery({
    queryKey: ['nodes', { page: 1, limit: 5 }],
    queryFn: () => nodeService.getNodes({ page: 1, limit: 5 }),
  });

  // 获取订阅格式
  const { data: subscriptionFormats } = useQuery({
    queryKey: ['subscription-formats'],
    queryFn: subscriptionService.getFormats,
  });

  const recentNodes = nodesData?.items || [];
  const totalNodes = stats?.totalNodes || 0;
  const activeNodes = stats?.activeNodes || 0;
  const totalRequests = stats?.totalRequests || 0;

  return (
    <div style={{ padding: '0 16px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          仪表板
        </Title>
        <Text type="secondary">系统概览和快速操作</Text>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总节点数"
              value={totalNodes}
              prefix={<NodeIndexOutlined />}
              loading={statsLoading}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃节点"
              value={activeNodes}
              prefix={<PlayCircleOutlined />}
              loading={statsLoading}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总请求数"
              value={totalRequests}
              prefix={<BarChartOutlined />}
              loading={statsLoading}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="订阅格式"
              value={subscriptionFormats?.formats?.length || 0}
              prefix={<LinkOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 快速操作 */}
        <Col xs={24} lg={12}>
          <Card title="快速操作" extra={<SettingOutlined />}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Button
                type="primary"
                icon={<NodeIndexOutlined />}
                block
                onClick={() => navigate('/nodes')}
              >
                管理节点
              </Button>
              <Button
                icon={<LinkOutlined />}
                block
                onClick={() => navigate('/subscriptions')}
              >
                订阅管理
              </Button>
              <Button
                icon={<BarChartOutlined />}
                block
                onClick={() => navigate('/statistics')}
              >
                查看统计
              </Button>
            </Space>
          </Card>
        </Col>

        {/* 最近节点 */}
        <Col xs={24} lg={12}>
          <Card 
            title="最近添加的节点" 
            extra={
              <Button 
                type="link" 
                onClick={() => navigate('/nodes')}
              >
                查看全部
              </Button>
            }
          >
            {nodesLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Text type="secondary">加载中...</Text>
              </div>
            ) : recentNodes.length > 0 ? (
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                {recentNodes.map((node: any) => (
                  <div key={node.id} style={{ 
                    padding: '8px 12px', 
                    background: '#fafafa', 
                    borderRadius: 6,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <Text strong>{node.name}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {node.type.toUpperCase()} • {node.server}:{node.port}
                      </Text>
                    </div>
                    <div>
                      {node.enabled ? (
                        <PlayCircleOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <PauseCircleOutlined style={{ color: '#ff4d4f' }} />
                      )}
                    </div>
                  </div>
                ))}
              </Space>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Text type="secondary">暂无节点</Text>
                <br />
                <Button 
                  type="link" 
                  onClick={() => navigate('/nodes')}
                >
                  添加第一个节点
                </Button>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 系统状态 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="系统状态">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Alert
                  message="服务状态"
                  description="所有服务运行正常"
                  type="success"
                  showIcon
                />
              </Col>
              <Col xs={24} md={12}>
                <Alert
                  message="数据同步"
                  description="最后同步时间: 刚刚"
                  type="info"
                  showIcon
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 使用说明 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="使用说明">
            <Paragraph>
              <Title level={4}>快速开始</Title>
              <ol>
                <li>在 <Text code>节点管理</Text> 页面添加代理节点</li>
                <li>在 <Text code>订阅管理</Text> 页面生成订阅链接</li>
                <li>将订阅链接导入到您的代理客户端</li>
                <li>在 <Text code>统计分析</Text> 页面查看使用情况</li>
              </ol>
            </Paragraph>
            
            <Divider />
            
            <Paragraph>
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
            </Paragraph>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
