/**
 * CloudFetch 的微信小程序实现：把 @bravecat/core/cloud 的最小 HTTP 端口
 * 落到 Taro.request（即 wx.request）上。
 *
 * 与浏览器 fetch 的语义差异及适配：
 * - wx.request 只在网络层失败时 reject，HTTP 4xx/5xx 一样走成功回调，
 *   与 fetch 一致，statusCode 原样透出即可；
 * - 响应体默认按 JSON 自动解析（dataType 'json'）；服务端返回非 JSON
 *   时 data 保持字符串，json() 里再 JSON.parse，失败则照常抛出，
 *   由 CloudSync 客户端的 parseError 兜底；
 * - **域名白名单**：wx.request 只允许访问小程序后台配置的 request
 *   合法域名（须 HTTPS + ICP 备案）。开发期在开发者工具「详情 →
 *   本地设置」勾选「不校验合法域名」即可连 http://127.0.0.1:3000；
 *   生产必须把 API 域名加入白名单（见 README 云同步一节）。
 */
import Taro from '@tarojs/taro'
import type { CloudFetch } from '@bravecat/core/cloud'

export const taroCloudFetch: CloudFetch = async (url, init) => {
  const response = await Taro.request({
    url,
    method: init?.method ?? 'GET',
    header: init?.headers,
    data: init?.body,
  })
  return {
    status: response.statusCode,
    json: async () => (
      typeof response.data === 'string'
        ? JSON.parse(response.data) as unknown
        : response.data as unknown
    ),
  }
}
