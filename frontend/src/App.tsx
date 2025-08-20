import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Spin } from 'antd';
import { useAuth } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';

// 懒加载页面组件
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const NodesPage = React.lazy(() => import('./pages/NodesPage'));
const SubscriptionsPage = React.lazy(() => import('./pages/SubscriptionsPage'));
const XUIPanelsPage = React.lazy(() => import('./pages/XUIPanelsPage'));
const StatisticsPage = React.lazy(() => import('./pages/StatisticsPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));

// 布局组件
const MainLayout = React.lazy(() => import('./components/Layout/MainLayout'));

const { Content } = Layout;

// 加载组件
const PageLoading: React.FC = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '200px' 
  }}>
    <Spin size="large" tip="加载中..." />
  </div>
);

// 受保护的路由组件
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <PageLoading />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// 公共路由组件（已登录用户重定向到仪表板）
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <PageLoading />;
  }
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

const App: React.FC = () => {
  const { isDarkMode } = useTheme();
  
  return (
    <div className={`app ${isDarkMode ? 'dark' : 'light'}`}>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* 公共路由 */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            } 
          />
          
          {/* 受保护的路由 */}
          <Route 
            path="/*" 
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Content style={{ margin: '16px', minHeight: 'calc(100vh - 112px)' }}>
                    <Suspense fallback={<PageLoading />}>
                      <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/nodes" element={<NodesPage />} />
                        <Route path="/subscriptions" element={<SubscriptionsPage />} />
                        <Route path="/xui-panels" element={<XUIPanelsPage />} />
                        <Route path="/statistics" element={<StatisticsPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="*" element={<NotFoundPage />} />
                      </Routes>
                    </Suspense>
                  </Content>
                </MainLayout>
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Suspense>
    </div>
  );
};

export default App;
