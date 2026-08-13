import { defineConfig, devices } from '@playwright/test'

/**
 * E2E 冒烟测试跑在 vite dev server 上：
 * - 种子存档注入依赖 dev server 的 /@fs 模块直连（见 e2e/seed.ts）；
 * - 「小猫出发」用例依赖 dev 构建的时钟加速按钮与 250ms 结算节拍。
 */
const port = 5273

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
