import { ProxyNode } from '../../../shared/types';
import { toV2rayConfig, toV2rayBase64 } from './v2ray';
import { toClashConfig } from './clash';
import { toShadowrocketConfig } from './shadowrocket';
import { toQuantumultXConfig } from './quantumultx';
import { toSurgeConfig } from './surge';

export interface ConversionOptions {
  userAgent?: string;
  filename?: string;
  includeExpired?: boolean;
  sort?: 'name' | 'type' | 'latency';
  filter?: {
    types?: string[];
    keywords?: string[];
    excludeKeywords?: string[];
  };
  rename?: {
    pattern: string;
    replacement: string;
  }[];
  grouping?: {
    enabled: boolean;
    groupBy: 'type' | 'region' | 'provider';
  };
}

export interface ConversionResult {
  content: string;
  contentType: string;
  filename: string;
}

export async function convertNodes(
  nodes: ProxyNode[],
  format: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  // 过滤节点
  let filteredNodes = nodes.filter(node => node.enabled);
  
  // 应用类型过滤
  if (options.filter?.types && options.filter.types.length > 0) {
    filteredNodes = filteredNodes.filter(node => 
      options.filter!.types!.includes(node.type)
    );
  }
  
  // 应用关键词过滤
  if (options.filter?.keywords && options.filter.keywords.length > 0) {
    filteredNodes = filteredNodes.filter(node =>
      options.filter!.keywords!.some(keyword =>
        node.name.toLowerCase().includes(keyword.toLowerCase()) ||
        node.server.toLowerCase().includes(keyword.toLowerCase())
      )
    );
  }
  
  // 应用排除关键词
  if (options.filter?.excludeKeywords && options.filter.excludeKeywords.length > 0) {
    filteredNodes = filteredNodes.filter(node =>
      !options.filter!.excludeKeywords!.some(keyword =>
        node.name.toLowerCase().includes(keyword.toLowerCase()) ||
        node.server.toLowerCase().includes(keyword.toLowerCase())
      )
    );
  }
  
  // 应用重命名规则
  if (options.rename && options.rename.length > 0) {
    filteredNodes = filteredNodes.map(node => {
      let newName = node.name;
      options.rename!.forEach(rule => {
        const regex = new RegExp(rule.pattern, 'gi');
        newName = newName.replace(regex, rule.replacement);
      });
      return { ...node, name: newName };
    });
  }
  
  // 排序
  if (options.sort) {
    filteredNodes.sort((a, b) => {
      switch (options.sort) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          return a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });
  }
  
  // 根据格式转换
  switch (format.toLowerCase()) {
    case 'v2ray':
    case 'v2rayn':
      return {
        content: toV2rayBase64(filteredNodes),
        contentType: 'text/plain; charset=utf-8',
        filename: options.filename || 'v2ray_subscription.txt',
      };
      
    case 'v2ray-json':
      return {
        content: JSON.stringify(toV2rayConfig(filteredNodes), null, 2),
        contentType: 'application/json; charset=utf-8',
        filename: options.filename || 'v2ray_config.json',
      };
      
    case 'clash':
    case 'clashx':
      return {
        content: toClashConfig(filteredNodes, options),
        contentType: 'text/yaml; charset=utf-8',
        filename: options.filename || 'clash_config.yaml',
      };
      
    case 'shadowrocket':
      return {
        content: toShadowrocketConfig(filteredNodes),
        contentType: 'text/plain; charset=utf-8',
        filename: options.filename || 'shadowrocket_subscription.txt',
      };
      
    case 'quantumult-x':
    case 'quantumultx':
      return {
        content: toQuantumultXConfig(filteredNodes),
        contentType: 'text/plain; charset=utf-8',
        filename: options.filename || 'quantumultx_subscription.txt',
      };
      
    case 'surge':
      return {
        content: toSurgeConfig(filteredNodes, options),
        contentType: 'text/plain; charset=utf-8',
        filename: options.filename || 'surge_config.conf',
      };
      
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

// 获取支持的格式列表
export function getSupportedFormats(): string[] {
  return [
    'v2ray',
    'v2ray-json',
    'clash',
    'shadowrocket',
    'quantumult-x',
    'surge',
  ];
}

// 验证格式是否支持
export function isFormatSupported(format: string): boolean {
  return getSupportedFormats().includes(format.toLowerCase());
}

// 获取格式的描述信息
export function getFormatInfo(format: string) {
  const formatMap: Record<string, any> = {
    'v2ray': {
      name: 'V2Ray/V2RayN',
      description: 'Base64 encoded subscription for V2Ray clients',
      extension: 'txt',
      contentType: 'text/plain',
    },
    'v2ray-json': {
      name: 'V2Ray JSON',
      description: 'JSON configuration for V2Ray core',
      extension: 'json',
      contentType: 'application/json',
    },
    'clash': {
      name: 'Clash/ClashX',
      description: 'YAML configuration for Clash clients',
      extension: 'yaml',
      contentType: 'text/yaml',
    },
    'shadowrocket': {
      name: 'Shadowrocket',
      description: 'Base64 encoded subscription for Shadowrocket',
      extension: 'txt',
      contentType: 'text/plain',
    },
    'quantumult-x': {
      name: 'Quantumult X',
      description: 'Configuration for Quantumult X',
      extension: 'txt',
      contentType: 'text/plain',
    },
    'surge': {
      name: 'Surge',
      description: 'Configuration for Surge',
      extension: 'conf',
      contentType: 'text/plain',
    },
  };
  
  return formatMap[format.toLowerCase()] || null;
}
