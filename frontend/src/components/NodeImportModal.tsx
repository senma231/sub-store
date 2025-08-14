import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Space,
  Typography,
  message,
  Table,
  Tag,
  Alert,
  Divider,
  Upload,
  Tabs,
  Row,
  Col
} from 'antd';
import {
  UploadOutlined,
  LinkOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import type { ProxyNode } from '@/types';
import api from '@/services/api';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { TabPane } = Tabs;

interface ParsedNode {
  id: string;
  name: string;
  type: string;
  server: string;
  port: number;
  uuid?: string;
  password?: string;
  method?: string;
  network?: string;
  tls?: boolean;
  sni?: string;
  wsPath?: string;
  remark?: string;
  enabled: boolean;
  isValid: boolean;
  error?: string;
  // 额外的解析字段
  encryption?: string;
  alterId?: number;
  flow?: string;
  security?: string;
  [key: string]: any; // 允许其他动态属性
}

interface NodeImportModalProps {
  open: boolean;
  onCancel: () => void;
  onImport: (nodes: Partial<ProxyNode>[]) => Promise<void>;
  loading?: boolean;
}

export const NodeImportModal: React.FC<NodeImportModalProps> = ({
  open,
  onCancel,
  onImport,
  loading = false
}) => {
  const [form] = Form.useForm();
  const [parsedNodes, setParsedNodes] = useState<ParsedNode[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('links');
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  // 解析节点链接
  const parseNodeLinks = (linksText: string): ParsedNode[] => {
    const lines = linksText.split('\n').filter(line => line.trim());
    const nodes: ParsedNode[] = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      try {
        const node = parseNodeLink(trimmedLine, index);
        nodes.push(node);
      } catch (error) {
        nodes.push({
          id: `error-${index}`,
          name: `解析失败 ${index + 1}`,
          type: 'unknown',
          server: '',
          port: 0,
          enabled: false,
          isValid: false,
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    });

    return nodes;
  };

  // 解析订阅链接
  const handleParseSubscription = async () => {
    const subscriptionUrl = form.getFieldValue('subscriptionUrl');
    if (!subscriptionUrl?.trim()) {
      message.warning('请输入订阅链接');
      return;
    }

    console.log('🔍 [订阅解析] 开始解析订阅链接');
    console.log('📋 [订阅解析] 订阅URL:', subscriptionUrl);
    console.log('🌐 [订阅解析] 当前域名:', window.location.hostname);
    console.log('🔗 [订阅解析] API基础URL:', api.defaults.baseURL);
    console.log('📡 [订阅解析] 完整请求URL:', `${api.defaults.baseURL}/subscription/parse`);

    setSubscriptionLoading(true);
    try {
      console.log('🚀 [订阅解析] 发送API请求...');
      // 通过代理获取订阅内容 (无需认证) - 使用API客户端
      const result = await api.post('/subscription/parse', { url: subscriptionUrl });
      console.log('✅ [订阅解析] API请求成功:', result);
      if (!result.success) {
        throw new Error(result.message || '解析失败');
      }

      const nodes = result.data.nodes || [];
      console.log('✅ [订阅解析] 解析到的节点:', nodes);
      console.log('📊 [订阅解析] 节点数量:', nodes.length);

      if (nodes.length === 0) {
        console.warn('⚠️ [订阅解析] 未找到有效节点');
        message.warning('订阅链接中没有找到有效节点');
        return;
      }

      // 转换为ParsedNode格式
      const parsedNodes = nodes.map((node: any, index: number) => ({
        id: `sub-${Date.now()}-${index}`,
        name: node.name || `节点-${index + 1}`,
        type: node.type,
        server: node.server,
        port: node.port,
        enabled: true,
        isValid: true,
        ...node
      }));

      setParsedNodes(parsedNodes);
      setSelectedNodes(parsedNodes.map((node: ParsedNode) => node.id));
      message.success(`从订阅链接解析到 ${parsedNodes.length} 个节点`);

    } catch (error) {
      console.error('❌ [订阅解析] 请求失败:', error);
      console.error('❌ [订阅解析] 错误类型:', error.constructor.name);
      console.error('❌ [订阅解析] 错误消息:', error instanceof Error ? error.message : String(error));
      console.error('❌ [订阅解析] 错误堆栈:', error instanceof Error ? error.stack : 'No stack trace');

      // 检查是否是网络错误
      if (error.response) {
        console.error('❌ [订阅解析] HTTP响应错误:', error.response.status, error.response.statusText);
        console.error('❌ [订阅解析] 响应数据:', error.response.data);
        console.error('❌ [订阅解析] 响应头:', error.response.headers);
        console.error('❌ [订阅解析] 请求配置:', error.config);
      } else if (error.request) {
        console.error('❌ [订阅解析] 网络请求错误:', error.request);
      }

      message.error(`订阅解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  // 解析手动输入的订阅内容
  const handleParseContent = async () => {
    const content = form.getFieldValue('subscriptionContent');
    if (!content?.trim()) {
      message.warning('请输入订阅内容');
      return;
    }

    console.log('🔍 [手动解析] 开始解析手动输入内容');
    console.log('📋 [手动解析] 内容长度:', content.trim().length);
    console.log('📋 [手动解析] 内容预览:', content.trim().substring(0, 100));
    console.log('🌐 [手动解析] 当前域名:', window.location.hostname);
    console.log('🔗 [手动解析] API基础URL:', api.defaults.baseURL);
    console.log('📡 [手动解析] 完整请求URL:', `${api.defaults.baseURL}/subscription/parse`);

    setSubscriptionLoading(true);
    try {
      console.log('🚀 [手动解析] 发送API请求...');
      // 直接解析内容 - 使用API客户端
      const result = await api.post('/subscription/parse', { content: content.trim() });
      console.log('✅ [手动解析] API请求成功:', result);
      if (!result.success) {
        throw new Error(result.message || '解析失败');
      }

      const nodes = result.data.nodes || [];
      console.log('✅ [手动解析] 解析到的节点:', nodes);
      console.log('📊 [手动解析] 节点数量:', nodes.length);

      if (nodes.length === 0) {
        console.warn('⚠️ [手动解析] 未找到有效节点');
        message.warning('内容中没有找到有效节点');
        return;
      }

      // 转换为ParsedNode格式
      const parsedNodes = nodes.map((node: any, index: number) => ({
        id: `content-${Date.now()}-${index}`,
        name: node.name || `节点-${index + 1}`,
        type: node.type,
        server: node.server,
        port: node.port,
        enabled: true,
        isValid: true,
        ...node
      }));

      setParsedNodes(parsedNodes);
      setSelectedNodes(parsedNodes.map((node: ParsedNode) => node.id));
      message.success(`从内容解析到 ${parsedNodes.length} 个节点`);

    } catch (error) {
      console.error('❌ [手动解析] 请求失败:', error);
      console.error('❌ [手动解析] 错误类型:', error.constructor.name);
      console.error('❌ [手动解析] 错误消息:', error instanceof Error ? error.message : String(error));
      console.error('❌ [手动解析] 错误堆栈:', error instanceof Error ? error.stack : 'No stack trace');

      // 检查是否是网络错误
      if (error.response) {
        console.error('❌ [手动解析] HTTP响应错误:', error.response.status, error.response.statusText);
        console.error('❌ [手动解析] 响应数据:', error.response.data);
        console.error('❌ [手动解析] 响应头:', error.response.headers);
        console.error('❌ [手动解析] 请求配置:', error.config);
      } else if (error.request) {
        console.error('❌ [手动解析] 网络请求错误:', error.request);
      }

      message.error(`内容解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  // 解析单个节点链接
  const parseNodeLink = (link: string, index: number): ParsedNode => {
    const id = `parsed-${Date.now()}-${index}`;
    
    try {
      // VLESS 链接解析
      if (link.startsWith('vless://')) {
        return parseVlessLink(link, id);
      }
      
      // VMess 链接解析
      if (link.startsWith('vmess://')) {
        return parseVmessLink(link, id);
      }
      
      // Trojan 链接解析
      if (link.startsWith('trojan://')) {
        return parseTrojanLink(link, id);
      }
      
      // SS 链接解析
      if (link.startsWith('ss://')) {
        return parseSsLink(link, id);
      }

      throw new Error('不支持的链接格式');
    } catch (error) {
      throw new Error(`解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 解析 VLESS 链接
  const parseVlessLink = (link: string, id: string): ParsedNode => {
    const url = new URL(link);
    const uuid = url.username;
    const server = url.hostname;
    const port = parseInt(url.port) || 443;
    const params = new URLSearchParams(url.search);
    
    return {
      id,
      name: decodeURIComponent(url.hash.slice(1)) || `VLESS-${server}`,
      type: 'vless',
      server,
      port,
      uuid,
      encryption: params.get('encryption') || 'none',
      flow: params.get('flow') || undefined,
      network: params.get('type') || 'tcp',
      tls: params.get('security') === 'tls',
      sni: params.get('sni') || undefined,
      wsPath: params.get('path') || undefined,
      enabled: true,
      isValid: true
    };
  };

  // 解析 VMess 链接
  const parseVmessLink = (link: string, id: string): ParsedNode => {
    const base64Data = link.replace('vmess://', '');
    const jsonStr = atob(base64Data);
    const config = JSON.parse(jsonStr);
    
    return {
      id,
      name: config.ps || `VMess-${config.add}`,
      type: 'vmess',
      server: config.add,
      port: parseInt(config.port),
      uuid: config.id,
      alterId: parseInt(config.aid) || 0,
      security: config.scy || 'auto',
      network: config.net || 'tcp',
      tls: config.tls === 'tls',
      sni: config.sni || undefined,
      wsPath: config.path || undefined,
      enabled: true,
      isValid: true
    };
  };

  // 解析 Trojan 链接
  const parseTrojanLink = (link: string, id: string): ParsedNode => {
    const url = new URL(link);
    const password = url.username;
    const server = url.hostname;
    const port = parseInt(url.port) || 443;
    const params = new URLSearchParams(url.search);
    
    return {
      id,
      name: decodeURIComponent(url.hash.slice(1)) || `Trojan-${server}`,
      type: 'trojan',
      server,
      port,
      password,
      sni: params.get('sni') || undefined,
      network: params.get('type') || 'tcp',
      tls: true,
      enabled: true,
      isValid: true
    };
  };

  // 解析 SS 链接
  const parseSsLink = (link: string, id: string): ParsedNode => {
    const url = new URL(link);
    const userInfo = atob(url.username);
    const [method, password] = userInfo.split(':');
    const server = url.hostname;
    const port = parseInt(url.port);
    
    return {
      id,
      name: decodeURIComponent(url.hash.slice(1)) || `SS-${server}`,
      type: 'ss',
      server,
      port,
      method,
      password,
      enabled: true,
      isValid: true
    };
  };

  // 处理链接解析
  const handleParseLinks = () => {
    const linksText = form.getFieldValue('links');
    if (!linksText?.trim()) {
      message.warning('请输入节点链接');
      return;
    }

    const nodes = parseNodeLinks(linksText);
    setParsedNodes(nodes);
    
    // 默认选择所有有效节点
    const validNodeIds = nodes.filter(node => node.isValid).map(node => node.id);
    setSelectedNodes(validNodeIds);

    message.success(`解析完成，共解析 ${nodes.length} 个节点，其中 ${validNodeIds.length} 个有效`);
  };

  // 处理文件上传
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        
        if (file.name.endsWith('.json')) {
          // JSON 文件导入
          const data = JSON.parse(content);
          if (data.nodes && Array.isArray(data.nodes)) {
            const nodes = data.nodes.map((node: any, index: number) => ({
              ...node,
              id: `imported-${Date.now()}-${index}`,
              isValid: true,
              enabled: node.enabled !== undefined ? node.enabled : true
            }));
            setParsedNodes(nodes);
            setSelectedNodes(nodes.map((node: any) => node.id));
            message.success(`从 JSON 文件导入 ${nodes.length} 个节点`);
          } else {
            message.error('无效的 JSON 文件格式');
          }
        } else {
          // 文本文件导入（节点链接）
          const nodes = parseNodeLinks(content);
          setParsedNodes(nodes);
          const validNodeIds = nodes.filter(node => node.isValid).map(node => node.id);
          setSelectedNodes(validNodeIds);
          message.success(`从文件解析 ${nodes.length} 个节点，其中 ${validNodeIds.length} 个有效`);
        }
      } catch (error) {
        message.error('文件解析失败');
      }
    };
    reader.readAsText(file);
    return false; // 阻止自动上传
  };

  // 表格列定义
  const columns = [
    {
      title: '节点名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ParsedNode) => (
        <Space>
          <span>{text}</span>
          {!record.isValid && <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
          {record.isValid && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => (
        <Tag color={type === 'unknown' ? 'red' : 'blue'}>
          {type.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: '服务器',
      dataIndex: 'server',
      key: 'server',
      ellipsis: true,
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
      width: 80,
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: any, record: ParsedNode) => (
        record.isValid ? (
          <Tag color="green">有效</Tag>
        ) : (
          <Tag color="red" title={record.error}>无效</Tag>
        )
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: any, record: ParsedNode) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            setParsedNodes(nodes => nodes.filter(n => n.id !== record.id));
            setSelectedNodes(ids => ids.filter(id => id !== record.id));
          }}
        />
      ),
    },
  ];

  // 处理导入
  const handleImport = async () => {
    const selectedNodesData = parsedNodes.filter(node => 
      selectedNodes.includes(node.id) && node.isValid
    );

    if (selectedNodesData.length === 0) {
      message.warning('请选择要导入的有效节点');
      return;
    }

    try {
      // 转换为 Partial<ProxyNode> 格式
      const convertedNodes = selectedNodesData.map(node => ({
        name: node.name,
        type: node.type as any, // 类型转换
        server: node.server,
        port: node.port,
        enabled: node.enabled,
        uuid: node.uuid,
        password: node.password,
        method: node.method,
        network: node.network,
        tls: node.tls,
        sni: node.sni,
        wsPath: node.wsPath,
        remark: node.remark,
        encryption: node.encryption,
        alterId: node.alterId,
        flow: node.flow,
        security: node.security,
      }));

      await onImport(convertedNodes);
      handleCancel();
    } catch (error) {
      // 错误处理由父组件处理
    }
  };

  // 处理取消
  const handleCancel = () => {
    form.resetFields();
    setParsedNodes([]);
    setSelectedNodes([]);
    setActiveTab('links');
    onCancel();
  };

  // 表格选择配置
  const rowSelection = {
    selectedRowKeys: selectedNodes,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedNodes(selectedRowKeys as string[]);
    },
    getCheckboxProps: (record: ParsedNode) => ({
      disabled: !record.isValid,
    }),
  };

  return (
    <Modal
      title="导入节点"
      open={open}
      onCancel={handleCancel}
      width={1000}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button
          key="import"
          type="primary"
          onClick={handleImport}
          loading={loading}
          disabled={selectedNodes.length === 0}
        >
          导入选中节点 ({selectedNodes.length})
        </Button>,
      ]}
      destroyOnClose
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="节点链接" key="links" icon={<LinkOutlined />}>
          <Form form={form} layout="vertical">
            <Form.Item
              label="节点链接"
              name="links"
              help="支持 VLESS、VMess、Trojan、Shadowsocks 链接，每行一个"
            >
              <TextArea
                rows={8}
                placeholder="vless://uuid@server:port?encryption=none&security=tls&type=ws&path=/path#name&#10;vmess://base64config&#10;trojan://password@server:port?sni=example.com#name&#10;ss://method:password@server:port#name"
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleParseLinks}>
                解析链接
              </Button>
            </Form.Item>
          </Form>
        </TabPane>

        <TabPane tab="订阅链接" key="subscription" icon={<GlobalOutlined />}>
          <Form form={form} layout="vertical">
            <Form.Item
              label="订阅链接"
              name="subscriptionUrl"
              help="输入订阅链接，系统将自动获取并解析其中的节点"
            >
              <Input
                placeholder="https://example.com/subscription"
                suffix={
                  <Button
                    type="text"
                    size="small"
                    onClick={handleParseSubscription}
                    loading={subscriptionLoading}
                  >
                    获取
                  </Button>
                }
              />
            </Form.Item>
            <Alert
              message="订阅链接导入说明"
              description="支持标准的 V2Ray、Clash 订阅链接。系统会自动获取订阅内容并解析其中的节点信息。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          </Form>
        </TabPane>

        <TabPane tab="手动输入" key="content" icon={<GlobalOutlined />}>
          <Form form={form} layout="vertical">
            <Form.Item
              label="订阅内容"
              name="subscriptionContent"
              help="粘贴订阅内容（Base64编码或纯文本节点链接）"
            >
              <TextArea
                rows={8}
                placeholder="请粘贴订阅内容，支持Base64编码或多行节点链接..."
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                onClick={handleParseContent}
                loading={subscriptionLoading}
                block
              >
                解析内容
              </Button>
            </Form.Item>
            <Alert
              message="手动输入说明"
              description="如果订阅链接无法访问，您可以手动复制订阅内容到此处进行解析。支持Base64编码的订阅内容或多行节点链接。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          </Form>
        </TabPane>

        <TabPane tab="文件导入" key="file" icon={<UploadOutlined />}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              message="支持的文件格式"
              description="JSON 格式的节点配置文件或包含节点链接的文本文件"
              type="info"
              showIcon
            />
            <Upload
              beforeUpload={handleFileUpload}
              accept=".json,.txt"
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
          </Space>
        </TabPane>
      </Tabs>

      {parsedNodes.length > 0 && (
        <>
          <Divider />
          <div style={{ marginBottom: 16 }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={5}>解析结果</Title>
                <Text type="secondary">
                  共 {parsedNodes.length} 个节点，有效 {parsedNodes.filter(n => n.isValid).length} 个
                </Text>
              </Col>
              <Col>
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      const validIds = parsedNodes.filter(n => n.isValid).map(n => n.id);
                      setSelectedNodes(validIds);
                    }}
                  >
                    全选有效
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setSelectedNodes([])}
                  >
                    取消全选
                  </Button>
                </Space>
              </Col>
            </Row>
          </div>
          
          <Table
            rowSelection={rowSelection}
            columns={columns}
            dataSource={parsedNodes}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 600 }}
          />
        </>
      )}
    </Modal>
  );
};
