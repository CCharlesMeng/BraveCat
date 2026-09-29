/**
 * 手机号规范化与脱敏。
 * 存储与比较一律使用 E.164：中国大陆手机号可省略 +86 前缀由服务端补全，
 * 其余国家必须提交带 + 的完整 E.164（本期产品只面向中国大陆用户，
 * 宽进严出地保留国际号通道）。
 */

const CN_MOBILE_PATTERN = /^1[3-9]\d{9}$/

/** 规范化为 E.164；undefined 表示格式不合法（路由回 400）。 */
export const normalizePhoneNumber = (input: string): string | undefined => {
  const compact = input.replace(/[\s-]/g, '')
  if (CN_MOBILE_PATTERN.test(compact)) {
    return `+86${compact}`
  }
  if (compact.startsWith('+86') && CN_MOBILE_PATTERN.test(compact.slice(3))) {
    return compact
  }
  if (/^\+[1-9]\d{7,14}$/.test(compact)) {
    return compact
  }
  return undefined
}

/** 脱敏展示：+8613800138000 → 138****8000；其余保留前 3 位与末 4 位。 */
export const maskPhone = (e164: string): string => {
  if (e164.startsWith('+86') && e164.length === 14) {
    const national = e164.slice(3)
    return `${national.slice(0, 3)}****${national.slice(7)}`
  }
  return `${e164.slice(0, 3)}****${e164.slice(-4)}`
}
