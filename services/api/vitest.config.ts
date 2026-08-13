import { defineConfig } from 'vitest/config'

// 独立配置，避免 vitest 向上查找并加载仓库根部 Web 应用的 vite.config.ts。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
