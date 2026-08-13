/**
 * 云功能 API base URL 注入点（Phase 1b）。
 *
 * 构建期通过 `VITE_API_BASE_URL` 注入（如 http://localhost:3000，
 * 不带尾部斜杠；本地联调见 services/api/README.md）。
 *
 * 默认空字符串：云同步整体关闭，构建产物不发起任何云端请求，
 * 行为与云功能引入前完全一致（ADR-0009 的 feature flag）。
 */
export const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL ?? ''
