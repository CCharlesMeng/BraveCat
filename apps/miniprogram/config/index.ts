import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import devConfig from './dev'
import prodConfig from './prod'

// https://taro-docs.jd.com/docs/config
// 编译器固定用 vite：@bravecat/core 的 starterCatalog 依赖
// `import.meta.env.DEV` 做构建期死代码剔除，webpack 宿主无此语义。
export default defineConfig<'vite'>(async (
  merge: (...parts: unknown[]) => UserConfigExport<'vite'>,
) => {
  const baseConfig: UserConfigExport<'vite'> = {
    projectName: 'bravecat-miniprogram',
    date: '2026-8-13',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [],
    defineConstants: {},
    copy: {
      patterns: [],
      options: {},
    },
    framework: 'react',
    compiler: 'vite',
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: false,
        },
      },
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
    },
  }

  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig)
  }
  return merge({}, baseConfig, prodConfig)
})
