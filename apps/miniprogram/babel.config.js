// babel-preset-taro 选项与默认值：https://docs.taro.zone/docs/babel-config
module.exports = {
  presets: [
    ['taro', {
      framework: 'react',
      ts: true,
      compiler: 'vite',
    }],
  ],
}
