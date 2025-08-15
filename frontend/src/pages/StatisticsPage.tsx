import React, { useState } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  Statistic, 
  Select, 
  DatePicker,
  Space,
  Table,
  Tag
} from 'antd';
import { 
  BarChartOutlined, 
  LineChartOutlined, 
  PieChartOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { statsService } from '../services/statsService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const StatisticsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(7, 'days'),
    dayjs()
  ]);
  const [selectedDays, setSelectedDays] = useState(7);

  // 获取基础统计
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: statsService.getStatistics,
  });

  // 获取详细统计
  const { data: detailedStats } = useQuery({
    queryKey: ['detailed-stats', selectedDays],
    queryFn: () => statsService.getDetailedStatistics(selectedDays),
  });

  // 图表颜色
  const COLORS = ['#1890ff', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96', '#13c2c2'];

  // 处理请求数据用于图表
  const requestsChartData = detailedStats?.requests.daily.map(day => ({
    date: dayjs(day.date).format('MM-DD'),
    requests: day.totalRequests,
  })) || [];

  // 处理格式统计数据
  const formatChartData = Object.entries(detailedStats?.requests.byFormat || {}).map(([format, count]) => ({
    name: format.toUpperCase(),
    value: count,
  }));

  // 热门用户代理表格列
  const userAgentColumns = [
    {
      title: '排名',
      dataIndex: 'index',
      key: 'index',
      width: 60,
      render: (_: any, __: any, index: number) => (
        <Space>
          {index < 3 && <TrophyOutlined style={{ color: ['#ffd700', '#c0c0c0', '#cd7f32'][index] }} />}
          {index + 1}
        </Space>
      ),
    },
    {
      title: '用户代理',
      dataIndex: 'userAgent',
      key: 'userAgent',
      ellipsis: true,
    },
    {
      title: '请求次数',
      dataIndex: 'requests',
      key: 'requests',
      width: 100,
      render: (value: number) => <Tag color="blue">{value}</Tag>,
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          统计分析
        </Title>
        <Text type="secondary">查看系统使用情况和访问统计</Text>
      </div>

      {/* 时间范围选择 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Text>时间范围:</Text>
          <Select
            value={selectedDays}
            onChange={setSelectedDays}
            style={{ width: 120 }}
            options={[
              { label: '最近7天', value: 7 },
              { label: '最近30天', value: 30 },
              { label: '最近90天', value: 90 },
            ]}
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
          />
        </Space>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总节点数"
              value={stats?.totalNodes || 0}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃节点"
              value={stats?.activeNodes || 0}
              prefix={<LineChartOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总请求数"
              value={stats?.totalRequests || 0}
              prefix={<PieChartOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="平均日请求"
              value={detailedStats?.summary.avgDailyRequests || 0}
              precision={1}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 请求趋势图 */}
        <Col xs={24} lg={16}>
          <Card title="请求趋势" extra={<Text type="secondary">最近 {selectedDays} 天</Text>}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={requestsChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="requests" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* 格式分布饼图 */}
        <Col xs={24} lg={8}>
          <Card title="订阅格式分布">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={formatChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {formatChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* 热门用户代理 */}
        <Col xs={24} lg={12}>
          <Card title="热门用户代理" extra={<Text type="secondary">Top 10</Text>}>
            <Table
              columns={userAgentColumns}
              dataSource={detailedStats?.requests.topUserAgents || []}
              pagination={false}
              size="small"
              rowKey="userAgent"
            />
          </Card>
        </Col>

        {/* 热门IP */}
        <Col xs={24} lg={12}>
          <Card title="热门访问IP" extra={<Text type="secondary">Top 10</Text>}>
            <Table
              columns={[
                {
                  title: '排名',
                  dataIndex: 'index',
                  key: 'index',
                  width: 60,
                  render: (_: any, __: any, index: number) => index + 1,
                },
                {
                  title: 'IP地址',
                  dataIndex: 'ip',
                  key: 'ip',
                },
                {
                  title: '请求次数',
                  dataIndex: 'requests',
                  key: 'requests',
                  width: 100,
                  render: (value: number) => <Tag color="green">{value}</Tag>,
                },
              ]}
              dataSource={detailedStats?.requests.topIPs || []}
              pagination={false}
              size="small"
              rowKey="ip"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default StatisticsPage;
