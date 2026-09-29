# 2026-09-29 Netlify 部署归档

- 正式地址：https://bravecat.netlify.app/
- 生产代码：`ce600e654045f2e6441e2814de15a046b3550790`
- Netlify deploy：`6abb80acb64cd80d2acb4098`
- 详细发布记录与证据边界：[Netlify 首发记录](../../netlify-launch.md)。

## 归档内容

- `manifest.json`：构建时原始候选包清单，148 个文件指纹及 tar.gz 指纹。保留原文，其中候选状态和待托管字段属于发布前快照；部署后的状态以首发记录为准，不回写历史产物。
- `netlify-upload.json`：实际上传 ZIP 的代码版本、字节数与 SHA-256。归档时重新计算 ZIP 和 tar.gz 的 SHA-256，均与记录一致。
- `first-public-home.png`：首个公开部署 bba26ff 的真实浏览器截图，验证过领养和刷新保留存档；ce600e6 仅修复响应头，不能把此图标为新版重新验收截图。
- [首个部署 HTTP 部分结果](../../../audits/netlify-first-deploy-http-2026-09-29.json)。
- [当前部署 HTTP 147 文件校验及主域名检查](../../../audits/netlify-production-http-2026-09-29.json)。
- [本次友商部署与注册调研](../../../research/animaltrip-deployment-registration-2026-09-29.md)。

完整 ZIP、tar.gz 及原始清单保存在本机 `.asset-publish/web-pwa-rc-ce600e654045/`，不将重复的二进制发行包加入 Git。Netlify 保留本次及上一部署；源码和构建配置已在 main。重新构建的归档容器字节未必相同，原始发行包指纹以上述元数据为准。

手机安装、系统分享、公网离线及完整备份文件往返仍待验收；归档不代表这些项目已通过。
