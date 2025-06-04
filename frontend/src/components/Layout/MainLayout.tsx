import React, { useState } from 'react';
import { Layout, Menu, Button, Dropdown, Avatar, Space, Typography, theme } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  NodeIndexOutlined,
  LinkOutlined,
  BarChartOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  BulbOutlined,
  GithubOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

const { Header, Sider } = Layout;
const { Text } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { token } = theme.useToken();

  // 菜单项配置
  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表板',
    },
    {
      key: '/nodes',
      icon: <NodeIndexOutlined />,
      label: '节点管理',
    },
    {
      key: '/subscriptions',
      icon: <LinkOutlined />,
      label: '订阅管理',
    },
    {
      key: '/statistics',
      icon: <BarChartOutlined />,
      label: '统计分析',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
  ];

  // 用户菜单
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'theme',
      icon: <BulbOutlined />,
      label: isDarkMode ? '浅色模式' : '深色模式',
      onClick: toggleTheme,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'github',
      icon: <GithubOutlined />,
      label: 'GitHub',
      onClick: () => window.open('https://github.com/your-username/sub-store', '_blank'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: logout,
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorder}`,
        }}
        theme="light"
      >
        {/* Logo */}
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 16px',
          borderBottom: `1px solid ${token.colorBorder}`,
        }}>
          <div style={{
            width: 32,
            height: 32,
            background: 'linear-gradient(135deg, #1890ff, #722ed1)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            color: 'white',
            marginRight: collapsed ? 0 : 12,
          }}>
            🚀
          </div>
          {!collapsed && (
            <Text strong style={{ fontSize: 16 }}>
              Sub-Store
            </Text>
          )}
        </div>

        {/* 菜单 */}
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ 
            border: 'none',
            background: 'transparent',
          }}
        />
      </Sider>

      <Layout>
        {/* 顶部导航 */}
        <Header style={{
          padding: '0 16px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />

          <Space>
            {/* 用户信息 */}
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Button type="text" style={{ height: 'auto', padding: '4px 8px' }}>
                <Space>
                  <Avatar 
                    size="small" 
                    icon={<UserOutlined />}
                    style={{ backgroundColor: token.colorPrimary }}
                  />
                  <span>{user?.username}</span>
                </Space>
              </Button>
            </Dropdown>
          </Space>
        </Header>

        {/* 主要内容区域 */}
        {children}
      </Layout>
    </Layout>
  );
};

export default MainLayout;
