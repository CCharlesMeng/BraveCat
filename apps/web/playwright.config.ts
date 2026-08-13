import { defineConfig, devices } from '@playwright/test'

/**
 * E2E 冒烟测试跑在 vite dev server 上：
 * - 种子存档注入依赖 dev server 的 /@fs 模块直连（见 e2e/seed.ts）；
 * - 「小猫出发」用例依赖 dev 构建的时钟加速按钮与 250ms 结算节拍。
 *
 * 端口默认 19173（高位端口，避开本机常用服务），可用 E2E_WEB_PORT 覆盖。
 */
const port = Number(process.env.E2E_WEB_PORT ?? 19173)

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.e2e\.ts/,
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 与 scripts/capture-home-scene-regression.mjs 一致的移动优先视口。
        viewport: { width: 470, height: 900 },
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
