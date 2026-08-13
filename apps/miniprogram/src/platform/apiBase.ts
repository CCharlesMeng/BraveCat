/**
 * 云功能 API base URL 注入点（对应 web 端 apps/web/src/lib/platform/apiBase.ts
 * 的 VITE_API_BASE_URL）。
 *
 * 构建期通过 `TARO_APP_API_BASE_URL` 注入（如 http://127.0.0.1:3000，
 * 不带尾部斜杠；本地联调见 services/api/README.md 与本包 README 的
 * 域名白名单说明）。
 *
 * 默认空字符串：云同步整体关闭，构建产物不发起任何云端请求，
 * 行为与云功能引入前完全一致（ADR-0009 的 feature flag）。
 */
export const apiBaseUrl: string = process.env.TARO_APP_API_BASE_URL ?? ''
