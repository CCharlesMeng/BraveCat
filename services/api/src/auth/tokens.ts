import { createHash, randomBytes } from 'node:crypto'

/** 生成不透明 bearer token：256 位随机数，客户端持有明文。 */
export const generateToken = (): string => randomBytes(32).toString('base64url')

/** 库中只存 sha256 哈希，泄库不泄 token。 */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex')
