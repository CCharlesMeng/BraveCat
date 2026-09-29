/**
 * 认证域的可插拔 provider 端口。
 * 生产实现见 src/auth/adapters/（阿里云短信），本地演示与测试用
 * src/auth/fakes.ts；生产环境变量未配置时注入 src/auth/unavailable.ts
 * 的占位实现（发码接口回 503）。
 */

/** unavailable 表示短信通道未接入（路由回 503）；发送故障请抛错（500）。 */
export type SmsSendResult =
  | { ok: true }
  | { ok: false; code: 'unavailable'; message: string }

/** 短信验证码下发端口；phone 为 E.164 规范化后的手机号。 */
export interface SmsProvider {
  sendCode(phone: string, code: string): Promise<SmsSendResult>
}
