import { createHmac, randomUUID } from 'node:crypto'

/**
 * 阿里云 RPC 风格 API 的公共参数与 V1 签名（HMAC-SHA1）。
 * 内容安全（green-cip）与 VIAPI（imageseg）等 RPC 接口通用。
 * 未与真实服务联调；联调时与官方 SDK 的签名输出对拍。
 */

/** RFC 3986 百分号编码（阿里云签名规范要求）。 */
const percentEncode = (value: string): string =>
  encodeURIComponent(value)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~')

export interface AliyunRpcRequest {
  method: 'GET' | 'POST'
  accessKeyId: string
  accessKeySecret: string
  /** 业务参数（Action / Version / 各接口自有参数）。 */
  params: Record<string, string>
}

/** 返回带 Signature 的完整查询参数。 */
export const signAliyunRpcParams = (
  request: AliyunRpcRequest,
): URLSearchParams => {
  const all: Record<string, string> = {
    Format: 'JSON',
    SignatureMethod: 'HMAC-SHA1',
    SignatureVersion: '1.0',
    SignatureNonce: randomUUID(),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    AccessKeyId: request.accessKeyId,
    ...request.params,
  }
  const canonicalized = Object.keys(all)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(all[key])}`)
    .join('&')
  const stringToSign = `${request.method}&${percentEncode('/')}&${percentEncode(canonicalized)}`
  const signature = createHmac('sha1', `${request.accessKeySecret}&`)
    .update(stringToSign)
    .digest('base64')

  const query = new URLSearchParams(all)
  query.set('Signature', signature)
  return query
}
