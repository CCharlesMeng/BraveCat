import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // 适配器单测在 node 环境跑，wx API 面由手工 mock 接管。
      '@tarojs/taro': fileURLToPath(
        new URL('./src/platform/testing/taroMock.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
