import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // 占位 appId：上架前需最终确认（见 README「上架前检查」）。
  appId: 'com.bravecat.app',
  appName: '咪游记',
  // 直接指向 @bravecat/web 的构建产物，壳里不复制第二份产物；
  // cap sync 前先执行 npm run build:web（或仓库根目录的 npm run build）。
  webDir: '../web/dist',
}

export default config
