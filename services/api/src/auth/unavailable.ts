import type { SmsProvider } from './ports.js'

/** 生产入口在短信服务未配置时注入的占位实现：发码接口回 503。 */
export const createUnavailableSmsProvider = (): SmsProvider => ({
  sendCode: async () => ({
    ok: false,
    code: 'unavailable',
    message:
      '短信服务未配置（缺少 ALIYUN_SMS_ACCESS_KEY_ID/SECRET/SIGN_NAME/TEMPLATE_CODE）',
  }),
})
