import type { MetaResponse } from '@bravecat/contracts'

export interface EconomyConfig {
  maxEarnPerHour: number
  initialAllowance: number
}

export interface ApiConfig {
  port: number
  host: string
  databaseUrl: string | undefined
  economy: EconomyConfig
}

const numberFromEnv = (
  name: string,
  value: string | undefined,
  fallback: number,
): number => {
  if (value === undefined || value === '') {
    return fallback
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`环境变量 ${name} 不是合法数字：${value}`)
  }
  return parsed
}

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): ApiConfig => ({
  port: numberFromEnv('PORT', env.PORT, 3000),
  host: env.HOST ?? '0.0.0.0',
  databaseUrl: env.DATABASE_URL,
  economy: {
    // 占位速率常量：每现实小时最多积累的小鱼干；Phase 1b 换 core 重放验算后仍可作兜底。
    maxEarnPerHour: numberFromEnv(
      'ECONOMY_MAX_EARN_PER_HOUR',
      env.ECONOMY_MAX_EARN_PER_HOUR,
      600,
    ),
    initialAllowance: numberFromEnv(
      'ECONOMY_INITIAL_EARN_ALLOWANCE',
      env.ECONOMY_INITIAL_EARN_ALLOWANCE,
      100,
    ),
  },
})

/** 平台元信息先以代码常量下发；后续可挪到库表或配置中心。 */
export const defaultPlatformMeta: MetaResponse['platforms'] = {
  web: {
    minClientVersion: '0.0.0',
    featureFlags: { cloudSave: true, economyLedger: true, aigcAvatar: false, iap: false },
  },
  ios: {
    minClientVersion: '0.0.0',
    featureFlags: { cloudSave: true, economyLedger: true, aigcAvatar: false, iap: false },
  },
  android: {
    minClientVersion: '0.0.0',
    featureFlags: { cloudSave: true, economyLedger: true, aigcAvatar: false, iap: false },
  },
  miniprogram: {
    minClientVersion: '0.0.0',
    // iOS 端微信小程序禁虚拟支付：只消费不售卖。
    featureFlags: {
      cloudSave: true,
      economyLedger: true,
      aigcAvatar: false,
      iap: false,
      virtualPaymentIos: false,
    },
  },
}
