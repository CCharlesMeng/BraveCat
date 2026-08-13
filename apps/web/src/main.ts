import { Capacitor } from '@capacitor/core'
import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

// Capacitor 原生壳（apps/mobile）里给根元素打标记，供安全区等
// 原生适配 CSS 选择器使用；浏览器里不加标记，web 视觉不变。
if (Capacitor.isNativePlatform()) {
  document.documentElement.dataset.nativePlatform = Capacitor.getPlatform()
}

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
