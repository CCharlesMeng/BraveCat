# @bravecat/miniprogram

咪游记微信小程序表现层（四端计划 Phase 4）：Taro 4（React + TypeScript，
vite 编译器）薄视图 + 平台端口适配器。领域逻辑、编排（GameController）、
存档迁移链全部来自 `@bravecat/core`，本包只做「端口注入 + 页面渲染 +
小程序开放能力」。

## 快速开始（微信开发者工具）

1. 仓库根目录 `npm install`（workspaces 一次装齐）。
2. 起本地资产服务器（主包不含任何游戏美术图片，全部经 AssetResolver
   加载；开发期指向 web 端的 public 目录）：

   ```bash
   npx serve apps/web/public -l 8787
   ```

   `.env.development` 已默认 `TARO_APP_ASSET_BASE_URL=http://127.0.0.1:8787`；
   换端口/生产 CDN 时改 env 即可（见 `.env.example`）。
3. 编译：

   ```bash
   npm run dev:weapp --workspace @bravecat/miniprogram    # watch
   npm run build:weapp --workspace @bravecat/miniprogram  # 生产构建
   ```

4. 微信开发者工具 →「导入项目」→ 选择 **`apps/miniprogram` 目录**
   （`project.config.json` 的 `miniprogramRoot` 指向 `dist/`），AppID 用
   测试号即可。本地详情里勾选「不校验合法域名」，否则 `http://127.0.0.1`
   的图片与 canvas 图源会被拦截。

## 环境变量（Taro env，见 .env.example）

| 变量 | 说明 |
| --- | --- |
| `TARO_APP_ASSET_BASE_URL` | 运行时游戏美术的 base URL（不带尾斜杠）。生产取 OSS/CDN 发布脚本（`scripts/publish-assets-oss.mjs`）的 `ASSET_CDN_BASE_URL` 同值；开发指向本地静态服务器。留空 = 根相对路径，在小程序里无法加载，等于「无美术」。 |
| `TARO_APP_ID` | 正式小程序 AppID（可选；开发者工具测试号可不填）。 |

## 目录结构

```
src/
  app.tsx / app.config.ts / app.scss   Taro 入口与全局样式
  game/
    controller.ts    GameController 单例接线（注入 wx 存档 + 随机源）
    useGameClient.ts 快照 → React 桥（useSyncExternalStore）+ settle 主循环
    copy.ts          玩家可见文案（复用 web 端中文文案）与 UI chrome 素材表
    catalog.ts       素材目录查询小助手
  platform/          五端口的小程序适配器（详见各文件头注释）
    saveStore.ts     wx storage 单 JSON blob（键 bravecat:current）
    postcardCanvas.ts OffscreenCanvas 2D + roundRect 兜底 + 临时文件导出
    share.ts         存相册（含授权流程）；会话分享走页面 onShareAppMessage
    random.ts        wx.getRandomValues 熵池 + Math.random 退化
    purchase.ts      PurchasePort 微信版接口（stub；iOS 禁虚拟支付 gating）
    assetBase.ts     TARO_APP_ASSET_BASE_URL → AssetResolver
    testing/taroMock.ts  vitest 用的 wx API 手工 mock
  pages/
    home/     家场景（homeTheme backdrop 图层渲染、窗台收小鱼干、领养流程）
    pack/     行囊（装入/取回、心愿地选择）
    shop/     小铺（分类、购买、去向选择；只收 Treat，ADR-0006）
    album/    相册（明信片/纪念品列表、剪贴板导入导出存档）
    postcard/ 详情（canvas 合成展示、保存相册、会话分享）
```

## 适配器取舍说明

- **SaveStore**：wx storage 单 JSON blob，键 `bravecat:current`（对应 web
  IndexedDB 的库名 bravecat/键 current）。落盘带 schemaVersion 信封，
  load 与 import 都走 core 注入的 v0→…→v4 迁移链（web 的 load 只回裸
  state，这里是其语义超集）。**导入导出重定义**：小程序没有文件下载/
  上传，导出 = 存档 JSON 复制到剪贴板，导入 = 读剪贴板 JSON；
  取舍：够跑通「带走这个家」，超长存档受剪贴板容量限制（当前存档
  几十 KB，离 wx storage 单键 1MB 上限也很远）。
- **PostcardCanvas**：`Taro.createOffscreenCanvas({type:'2d'})`；图片经
  `canvas.createImage()` 载入；`getImageData` 直接可用；`toBlob` 不存在，
  以 `wx.canvasToTempFilePath({canvas})` 产出**临时文件路径**替代 Blob，
  基础库不支持离屏 canvas 时回退 `toDataURL` + 文件系统写入。
  `context.filter`（接触阴影 blur）部分真机不生效，仅影响柔和度；
  `roundRect` 缺失时打了 arcTo 兜底补丁。
- **SharePort**：明信片图 `wx.saveImageToPhotosAlbum`（授权拒绝 →
  弹窗引导去设置页开启后重试一次）；会话分享用明信片详情页的
  `onShareAppMessage` 开放能力（合成图作分享卡片图）。core 的
  `shareOrDownloadPostcard`（Blob/File 语义）在本端不适用。
- **Random**：`wx.getRandomValues` 为异步 API，无法直接实现同步的
  `nextUint32`；维护异步补给的熵池，池空/API 缺失时退化为
  Math.random 拼 32 位（已在代码标注；不用于安全用途）。
- **Purchase**：接口与 `apps/web/src/lib/platform/purchase.ts` 对齐
  （SKU 只有生成次数包/会员，ADR-0006），实现是 stub。接线清单：
  services/api 统一下单接口 → `wx.requestPayment` → 微信支付回调核销
  （`POST /v1/credits/purchases`，platform='wechat'）。**iOS 端禁虚拟
  支付**：`canPurchase()` 在 iOS 返回 false，购买入口一律隐藏，只保留
  已购权益消费；两端消费方就绪后接口应上移 `@bravecat/core/ports`。

## 已知差异与限制

- 家场景直接消费 `resolveHomeScene` 的样式字符串（百分比定位 +
  transform + clip-path + CSS 变量），按 WebView 渲染器验证口径；
  **Skyline 渲染器未验证**（clip-path 支持存疑），暂不要开 Skyline。
- classic-v4 房型的 shell/exterior 图层仍在 `/dev-art/`（未过上线验收，
  `shippingEligible: false`）；开发期本地静态服务器可加载，**生产 CDN
  发布件里没有这些文件**——小程序上线前需家主题美术过验收并入 CDN
  发布清单。
- 小猫的 sprite 动画（web 端 CSS steps 动画）未接，家场景先用静态
  姿势立绘；`gaze` 姿势与 web 端一致地不在默认姿势池。
- 更换形象、布置家（HomeThemePicker/ThemeLab）、多猫切换器未做
  （web 端为多形象/多主题时才显示，当前单猫单主题下不影响核心循环）。
- 文案沿用 web 端；「保存或分享」在本端拆成「保存到相册」+ 右上角
  会话分享两个动作。

## 无法在无头环境验证、需真机/开发者工具确认的项

- OffscreenCanvas 合成链路：`createImage` 跨 canvas 使用、
  `canvasToTempFilePath` 对离屏 canvas 的支持（已备 toDataURL 兜底）、
  明信片合成图的字体（STKaiti 在小程序里会回退默认字体）。
- 相册授权流程（`scope.writePhotosAlbum` 拒绝→设置页→重试）。
- `onShareAppMessage` 分享卡片图（imageUrl 用合成临时文件）。
- clip-path / CSS 变量在真机 WebView 的一致性（开发者工具先行验证）。
- 剪贴板导入导出在真机上的容量与权限表现。

## 待办（Phase 4 收尾）

- [ ] 微信支付接线（等 services/api 的下单/回调核销位）+ 付费入口页
      （独立于小铺；iOS 隐藏）。
- [ ] 微信登录 + 云存档同步（Phase 1 后端能力接入）。
- [ ] 家主题美术过验收后入 CDN 发布清单，本端家场景切生产资产。
- [ ] 小猫 sprite 动画（steps 动画 WXSS 适配或 canvas 帧动画）。
- [ ] 更换形象 / 布置家 / 多猫切换。
- [ ] 真机回归清单（上面「无法无头验证」各项）+ 提审材料。

## 测试

```bash
npm run test --workspace @bravecat/miniprogram   # 适配器单测（mock wx API）
npm run check --workspace @bravecat/miniprogram  # tsc --noEmit
```
