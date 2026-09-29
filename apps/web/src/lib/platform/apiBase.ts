/** 免费 Web/PWA 首发生产包固定关闭云功能；开发联调仍可注入 API URL。 */
export const apiBaseUrl: string = import.meta.env.DEV ? (import.meta.env.VITE_API_BASE_URL ?? '') : ''
