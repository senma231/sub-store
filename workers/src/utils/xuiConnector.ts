/**
 * X-UI面板API连接器
 * 用于连接X-UI面板并获取节点配置
 */

export interface XUIPanel {
  id: string;
  name: string;
  host: string;
  port: number;
  basePath?: string;
  username: string;
  password: string;
  protocol: 'http' | 'https';
  enabled: boolean;
}

export interface XUIInbound {
  id: number;
  port: number;
  protocol: string;
  settings: string;
  streamSettings: string;
  tag: string;
  remark: string;
  enable: boolean;
  up: number;
  down: number;
  total: number;
  expiryTime: number;
}

export interface XUILoginResponse {
  success: boolean;
  msg: string;
  obj: any;
}

export interface XUIInboundsResponse {
  success: boolean;
  msg: string;
  obj: XUIInbound[];
}

export class XUIConnector {
  private panel: XUIPanel;
  private sessionCookie: string = '';

  constructor(panel: XUIPanel) {
    this.panel = panel;
  }

  /**
   * 获取完整的API URL
   */
  private getApiUrl(path: string): string {
    const baseUrl = `${this.panel.protocol}://${this.panel.host}:${this.panel.port}`;
    const basePath = this.panel.basePath ? `/${this.panel.basePath.replace(/^\/+|\/+$/g, '')}` : '';
    return `${baseUrl}${basePath}${path}`;
  }

  /**
   * 登录X-UI面板
   */
  async login(): Promise<{ success: boolean; error?: string }> {
    try {
      const loginUrl = this.getApiUrl('/login');
      
      console.log(`🔐 [X-UI连接器] 尝试登录: ${this.panel.host}:${this.panel.port}`);
      
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Sub-Store/1.0'
        },
        body: `username=${encodeURIComponent(this.panel.username)}&password=${encodeURIComponent(this.panel.password)}`
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      // 获取Set-Cookie头
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        // 提取session cookie
        const sessionMatch = setCookieHeader.match(/session=([^;]+)/);
        if (sessionMatch) {
          this.sessionCookie = `session=${sessionMatch[1]}`;
        }
      }

      const result: XUILoginResponse = await response.json();
      
      if (result.success) {
        console.log(`✅ [X-UI连接器] 登录成功: ${this.panel.host}:${this.panel.port}`);
        return { success: true };
      } else {
        console.log(`❌ [X-UI连接器] 登录失败: ${result.msg}`);
        return {
          success: false,
          error: result.msg || 'Login failed'
        };
      }

    } catch (error) {
      console.error(`❌ [X-UI连接器] 登录异常:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 获取所有入站配置
   */
  async getInbounds(): Promise<{ success: boolean; data?: XUIInbound[]; error?: string }> {
    try {
      if (!this.sessionCookie) {
        const loginResult = await this.login();
        if (!loginResult.success) {
          return {
            success: false,
            error: `Login failed: ${loginResult.error}`
          };
        }
      }

      const inboundsUrl = this.getApiUrl('/panel/api/inbounds');
      
      console.log(`📡 [X-UI连接器] 获取入站配置: ${this.panel.host}:${this.panel.port}`);
      
      const response = await fetch(inboundsUrl, {
        method: 'GET',
        headers: {
          'Cookie': this.sessionCookie,
          'User-Agent': 'Sub-Store/1.0',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const result: XUIInboundsResponse = await response.json();
      
      if (result.success && Array.isArray(result.obj)) {
        console.log(`✅ [X-UI连接器] 获取到 ${result.obj.length} 个入站配置`);
        return {
          success: true,
          data: result.obj
        };
      } else {
        return {
          success: false,
          error: result.msg || 'Failed to get inbounds'
        };
      }

    } catch (error) {
      console.error(`❌ [X-UI连接器] 获取入站配置异常:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<{ success: boolean; error?: string; latency?: number }> {
    const startTime = Date.now();
    
    try {
      const loginResult = await this.login();
      const latency = Date.now() - startTime;
      
      if (loginResult.success) {
        return {
          success: true,
          latency
        };
      } else {
        return {
          success: false,
          error: loginResult.error,
          latency
        };
      }

    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        latency
      };
    }
  }

  /**
   * 获取面板信息
   */
  async getPanelInfo(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!this.sessionCookie) {
        const loginResult = await this.login();
        if (!loginResult.success) {
          return {
            success: false,
            error: `Login failed: ${loginResult.error}`
          };
        }
      }

      const infoUrl = this.getApiUrl('/panel/api/status');
      
      const response = await fetch(infoUrl, {
        method: 'GET',
        headers: {
          'Cookie': this.sessionCookie,
          'User-Agent': 'Sub-Store/1.0',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const result = await response.json();
      
      return {
        success: true,
        data: result
      };

    } catch (error) {
      console.error(`❌ [X-UI连接器] 获取面板信息异常:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 获取客户端统计信息
   */
  async getClientStats(inboundId: number): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!this.sessionCookie) {
        const loginResult = await this.login();
        if (!loginResult.success) {
          return {
            success: false,
            error: `Login failed: ${loginResult.error}`
          };
        }
      }

      const statsUrl = this.getApiUrl(`/panel/api/inbounds/clientStats/${inboundId}`);
      
      const response = await fetch(statsUrl, {
        method: 'GET',
        headers: {
          'Cookie': this.sessionCookie,
          'User-Agent': 'Sub-Store/1.0',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const result = await response.json();
      
      return {
        success: true,
        data: result
      };

    } catch (error) {
      console.error(`❌ [X-UI连接器] 获取客户端统计异常:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
