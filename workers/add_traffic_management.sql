-- 添加流量管理功能的数据库迁移
-- 执行时间: 2025-08-14

-- 为 custom_subscriptions 表添加流量限制相关字段
ALTER TABLE custom_subscriptions ADD COLUMN traffic_limit INTEGER DEFAULT 0;
ALTER TABLE custom_subscriptions ADD COLUMN traffic_used INTEGER DEFAULT 0;
ALTER TABLE custom_subscriptions ADD COLUMN traffic_reset_cycle TEXT DEFAULT 'monthly';
ALTER TABLE custom_subscriptions ADD COLUMN traffic_reset_date TEXT;
ALTER TABLE custom_subscriptions ADD COLUMN traffic_enabled BOOLEAN DEFAULT false;

-- 添加时效性配置字段
ALTER TABLE custom_subscriptions ADD COLUMN expiry_hours INTEGER DEFAULT 24;
ALTER TABLE custom_subscriptions ADD COLUMN show_expiry_in_name BOOLEAN DEFAULT true;
ALTER TABLE custom_subscriptions ADD COLUMN add_reminder_nodes BOOLEAN DEFAULT true;

-- 创建流量统计索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_custom_subscriptions_traffic_enabled ON custom_subscriptions(traffic_enabled);
CREATE INDEX IF NOT EXISTS idx_custom_subscriptions_traffic_reset_date ON custom_subscriptions(traffic_reset_date);
CREATE INDEX IF NOT EXISTS idx_custom_subscriptions_expiry_hours ON custom_subscriptions(expiry_hours);

-- 更新现有记录的默认值
UPDATE custom_subscriptions 
SET traffic_limit = 0, 
    traffic_used = 0, 
    traffic_reset_cycle = 'monthly', 
    traffic_enabled = false,
    expiry_hours = 24,
    show_expiry_in_name = true,
    add_reminder_nodes = true
WHERE traffic_limit IS NULL;

-- 验证迁移结果
SELECT 
  COUNT(*) as total_subscriptions,
  COUNT(CASE WHEN traffic_enabled = true THEN 1 END) as enabled_traffic_limit,
  COUNT(CASE WHEN traffic_limit > 0 THEN 1 END) as has_traffic_limit
FROM custom_subscriptions;
