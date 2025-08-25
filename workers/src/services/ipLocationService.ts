/**
 * IP地理位置查询服务
 * 使用免费的IP地理位置API来获取IP的地理位置信息
 */

export interface IPLocationInfo {
  country?: string;
  region?: string;
  city?: string;
  countryCode?: string;
  regionCode?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
}

export class IPLocationService {
  private static cache = new Map<string, IPLocationInfo>();
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时缓存

  /**
   * 获取IP地理位置信息
   */
  static async getLocation(ip: string): Promise<IPLocationInfo> {
    // 检查缓存
    const cached = this.cache.get(ip);
    if (cached) {
      return cached;
    }

    try {
      // 使用ip-api.com免费API（每分钟1000次请求限制）
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,countryCode,region,lat,lon,timezone,isp`, {
        headers: {
          'User-Agent': 'Sub-Store/2.0.0'
        },
        signal: AbortSignal.timeout(5000) // 5秒超时
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'fail') {
        console.warn(`IP地理位置查询失败: ${data.message} (IP: ${ip})`);
        return {};
      }

      const locationInfo: IPLocationInfo = {
        country: data.country || undefined,
        region: data.regionName || undefined,
        city: data.city || undefined,
        countryCode: data.countryCode || undefined,
        regionCode: data.region || undefined,
        lat: data.lat || undefined,
        lon: data.lon || undefined,
        timezone: data.timezone || undefined,
        isp: data.isp || undefined
      };

      // 缓存结果
      this.cache.set(ip, locationInfo);

      // 设置缓存过期（简单实现，实际应该使用更好的缓存策略）
      setTimeout(() => {
        this.cache.delete(ip);
      }, this.CACHE_TTL);

      return locationInfo;
    } catch (error) {
      console.error(`IP地理位置查询失败 (IP: ${ip}):`, error);
      
      // 尝试备用API - ipinfo.io
      try {
        const response = await fetch(`https://ipinfo.io/${ip}/json`, {
          headers: {
            'User-Agent': 'Sub-Store/2.0.0'
          },
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const data = await response.json();
          const locationInfo: IPLocationInfo = {
            country: data.country || undefined,
            region: data.region || undefined,
            city: data.city || undefined,
            countryCode: data.country || undefined,
            timezone: data.timezone || undefined,
            isp: data.org || undefined
          };

          // 缓存结果
          this.cache.set(ip, locationInfo);
          setTimeout(() => {
            this.cache.delete(ip);
          }, this.CACHE_TTL);

          return locationInfo;
        }
      } catch (backupError) {
        console.error(`备用IP地理位置查询也失败 (IP: ${ip}):`, backupError);
      }

      return {};
    }
  }

  /**
   * 批量获取IP地理位置信息
   */
  static async getLocations(ips: string[]): Promise<Map<string, IPLocationInfo>> {
    const results = new Map<string, IPLocationInfo>();
    
    // 并发查询，但限制并发数量以避免API限制
    const batchSize = 5;
    for (let i = 0; i < ips.length; i += batchSize) {
      const batch = ips.slice(i, i + batchSize);
      const promises = batch.map(async (ip) => {
        const location = await this.getLocation(ip);
        results.set(ip, location);
      });
      
      await Promise.all(promises);
      
      // 在批次之间添加小延迟以避免API限制
      if (i + batchSize < ips.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * 格式化地理位置信息为显示字符串
   */
  static formatLocation(location: IPLocationInfo): string {
    const parts: string[] = [];
    
    if (location.country) {
      parts.push(location.country);
    }
    
    if (location.region && location.region !== location.country) {
      parts.push(location.region);
    }
    
    if (location.city && location.city !== location.region) {
      parts.push(location.city);
    }
    
    return parts.join(', ') || '未知';
  }

  /**
   * 获取国家旗帜emoji
   */
  static getCountryFlag(countryCode?: string): string {
    if (!countryCode || countryCode.length !== 2) {
      return '🌍';
    }
    
    // 将国家代码转换为旗帜emoji
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    
    return String.fromCodePoint(...codePoints);
  }

  /**
   * 清除缓存
   */
  static clearCache(): void {
    this.cache.clear();
  }
}
