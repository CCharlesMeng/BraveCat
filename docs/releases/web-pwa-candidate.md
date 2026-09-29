# Web/PWA 候选包交付

当前候选包含两组小故事、A/B/F、猫窝/隧道、本机存档与备份。普通地标图片仍被权利 gate 排除，因此不是满足完整首发承诺的公开发行版。先补齐审计记录中的三个真实缺口，不把本地或 CI 通过写成上线。

## 可检查的产物

在干净 main 上执行 `npm run release:package`。输出 `.asset-publish/web-pwa-rc-<commit>/web-pwa.tar.gz` 与 `manifest.json`，列出代码 SHA、包 SHA-256、逐文件指纹和 pending 项。CI 的 `web-pwa-candidate` artifact 保存同类产物；浏览器截图/失败 trace 保存在 `playwright-artifacts`。

## 部署约束与回滚

- 托管整个解压目录于一个 HTTPS origin 的根路径，不只上传 JS，也不单独把故事/家素材移到未接入缓存的 CDN。
- `index.html`、`sw.js`、`registerSW.js` 和 manifest 应可及时重新校验；保留旧版本的哈希 JS/CSS 和版本化素材，先上传资源再切换 HTML/SW。
- 发布前在实际域名验证首页、Web App Manifest、SW scope、8 张故事图片及 29 个家素材均为 200 且 MIME 正确；禁止回退 HTML 冒充缺失图片。
- 保留上一版完整部署与 manifest。回滚切换整个版本，不清除用户 IndexedDB。v5 故事存档不能回滚给不认识 v5 的旧应用；代码回滚候选必须保留 v5 读取兼容。
- 服务端回滚不等于浏览器缓存已更新，应在在线刷新后检查控制页面的 SW，再离线回看与导出一次。

## 真机待验

在实际 iOS Safari 与 Android 浏览器记录设备/系统/浏览器/commit/域名：安装到主屏幕；关闭后离线打开；离线跨幕与返程；首幕无后续泄露；四幕/尾页；系统分享或下载；备份文件导出和导入；更新后存档保留；窄屏安全区与小键盘。

用户进度仅保存在当前浏览器。更换设备、清除站点数据前导出 JSON；没有账号或云备份。云账号、照片生成、短信和支付均为后置，不是首发联调依赖。
