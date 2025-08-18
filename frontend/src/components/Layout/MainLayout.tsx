import React, { useState, useEffect } from 'react';
import { Menu, Button, Dropdown, Avatar, Space, Typography, theme } from 'antd';
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

// 不再使用Ant Design的Layout组件
const { Text } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { token } = theme.useToken();

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // 移动端默认折叠，但不强制覆盖用户操作
      if (mobile && !isMobile) {
        setCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, [isMobile]);

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
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
    }}>
      {/* 侧边栏 */}
      <div
        style={{
          width: isMobile ? '200px' : (collapsed ? '80px' : '200px'),
          height: '100vh',
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorder}`,
          transition: isMobile ? 'transform 0.3s ease' : 'width 0.3s ease',
          overflow: 'hidden',
          position: isMobile ? 'fixed' : 'relative',
          zIndex: isMobile ? 1001 : 'auto',
          left: 0,
          top: 0,
          flexShrink: 0,
          transform: isMobile ? (collapsed ? 'translateX(-100%)' : 'translateX(0)') : 'none',
        }}
        onClick={(e) => {
          // 防止侧边栏内部点击关闭菜单
          if (isMobile) {
            e.stopPropagation();
          }
        }}
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
          inlineCollapsed={collapsed}
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            border: 'none',
            background: 'transparent',
            width: '100%',
          }}
        />
      </div>

      {/* 主要内容区域 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        marginLeft: isMobile ? '0' : '0', // 不需要margin，因为用的是flex布局
      }}>
        {/* 顶部导航栏 */}
        <div style={{
          height: '64px',
          padding: '0 16px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: '64px',
              height: '64px',
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
        </div>

        {/* 内容区域 */}
        <div style={{
          flex: 1,
          padding: '24px',
          backgroundColor: '#f0f2f5',
          overflow: 'auto',
        }}>
          {children}
        </div>
      </div>

      {/* 移动端遮罩层 */}
      {isMobile && !collapsed && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            zIndex: 1000,
          }}
          onClick={() => setCollapsed(true)}
        />
      )}
    </div>
  );
};

export default MainLayout;
