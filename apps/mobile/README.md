# @bravecat/mobile — Capacitor iOS/Android 壳

把 `@bravecat/web`（Svelte + Vite）的构建产物原样装进原生壳。本包不含业务代码：
`capacitor.config.ts` 的 `webDir` 直接指向 `../web/dist`，`npx cap sync` 时把产物
复制进两个原生工程（复制结果已被 gitignore）。

- **appId：`com.bravecat.app` 是占位 id，上架前必须最终确认**（一旦提审便不可更改）。
- iOS 工程用 Swift Package Manager（`ios/App/CapApp-SPM`），不需要 CocoaPods。
- 应用名：咪游记。

## 本地跑模拟器 / 真机

前置：Node ≥ 20；iOS 需要 Xcode（本仓库在 Xcode 26 验证过）；Android 需要
Android Studio + Android SDK + JDK 17+（`ANDROID_HOME` 指向 SDK）。

```bash
# 仓库根目录
npm install
npm run build          # 构建 apps/web 并跑资产门禁

cd apps/mobile
npx cap sync           # 复制 web 产物 + 同步原生插件

# iOS：打开 Xcode 选模拟器/真机运行（真机需要在 Signing 里选开发者团队）
npx cap open ios
# 或直接跑：npx cap run ios

# Android：打开 Android Studio 运行
npx cap open android
# 或直接跑：npx cap run android
```

web 产物变更后重跑 `npm run build`（根目录）+ `npx cap sync` 即可，原生工程不用动。

## 平台端口的原生实现

原生实现随 web 代码打包（同一份 JS 产物跑在壳里），按
`Capacitor.isNativePlatform()` 在运行时选择，浏览器行为不变：

- 分享/保存（已实现）：`apps/web/src/lib/platform/nativePorts.ts`，接线位在
  `apps/web/src/lib/platform/ports.ts` 的 `sharePort`。分享明信片走
  `@capacitor/share`（先经 `@capacitor/filesystem` 写入缓存），系统分享面板自带
  「存储图像」可存入相册；「下载」语义落为写入应用 Documents 目录，iOS 已开
  `UIFileSharingEnabled`，用户在「文件」App 里可见。
- 存档导出/导入（已实现）：同在 `nativePorts.ts`，接线位是 `ports.ts` 的
  `saveTransferPort`（浏览器里为 null，web 端仍走锚点下载 + `<input type=file>`）。
  导出把存档 JSON 经 `@capacitor/filesystem` 写入缓存后交给 `@capacitor/share`
  系统分享面板（可存文件 App / 隔空投送 / 发微信）；导入用
  `@capawesome/capacitor-file-picker` 的系统文件选择器读取 JSON，校验与迁移
  仍走 core 的 `SaveStore.import`。
- IAP（只有骨架）：`apps/web/src/lib/platform/purchase.ts` 定义 `PurchasePort`，
  当前实现是 stub，见下面的接入清单。
- 推送（未实现）：只留文档占位，见下。

## IAP 接入清单（按 ADR-0006）

SKU 只有两类（`docs/adr/0006-sell-ai-generation-not-game-currency.md`）：
**AI 形象生成次数包（消耗型）** 与 **会员（自动续期订阅）**。没有任何游戏币
（Treat）直购 SKU，文案避免「金币/充值/礼包」表述。

推荐插件（二选一，均不需要付费账号即可编译，仓库当前未引入）：

1. `@revenuecat/purchases-capacitor`（RevenueCat 托管）：托管商品、凭证校验与
   订阅状态，接入最快；代价是引第三方 SaaS，凭证核销仍要回 `services/api` 入账。
2. `cordova-plugin-purchase`（v13+，直连 StoreKit 2 / Play Billing）：无第三方
   依赖，服务端全权核销，与「经济域服务端权威」的架构最贴合；接入工作量更大。

步骤：

1. App Store Connect / Play Console 配置商品（消耗型次数包 + 订阅），需要
   Apple Developer Program 与 Play 开发者账号（付费账号只在配置商品与真机联调
   时需要，编译不需要）。
2. 在 `apps/web/src/lib/platform/purchase.ts` 用插件实现 `PurchasePort` 四个方法
   （`listProducts` / `purchase` / `restorePurchases` / `redeemReceipt`），替换
   `purchasePort` 接线位的 stub；iOS 凭证用 StoreKit 2 JWS transaction，Android
   用 purchaseToken。
3. `services/api` 加核销端点：用 Apple App Store Server API / Google Play
   Developer API 验证凭证，验证通过才在服务端账本发放生成次数或会员权益
   （客户端不自行入账）。
4. 实现「恢复购买」入口（Apple 审核硬性要求）。
5. 沙盒测试：iOS Sandbox 测试账号 / Play 内部测试轨道。

## 推送（占位，未实现）

本阶段刻意不接：无插件、无原生配置。将来接入时：

1. 安装 `@capacitor/push-notifications`。
2. iOS：Xcode 开 Push Notifications capability，APNs Key 配到推送服务商。
3. Android：接 FCM（`google-services.json`）。
4. 国内安卓渠道到时评估厂商通道（华为/小米等）。

## 图标与启动屏

当前保持 Capacitor 默认图标与启动屏，**不放占位美术**（仓库规则
`.cursor/rules/visual-assets.mdc` 禁止用占位视觉资产代替正式游戏美术）。
替换流程：美术候选走 `docs/art/` 的审批流程，批准后用 `@capacitor/assets`
从源图生成各尺寸图标/启动屏再提交。

## 已知待办

- 状态栏样式（`@capacitor/status-bar`）与启动屏时序未调，目前用默认值。
- 微信登录 / Apple 登录插件（计划 Phase 2 后半段，随账号系统接入）。

## 上架前检查

- [ ] 最终确认 appId（现为占位 `com.bravecat.app`），iOS bundle id 与 Android
      applicationId（`android/app/build.gradle`、`ios/App` 的 Xcode 工程）同步改。
- [ ] 签名：iOS 开发者团队 / Android release keystore。
- [ ] 图标与启动屏替换为已审批美术。
- [ ] 隐私政策、App 隐私标注（Apple Privacy Nutrition Labels / Play Data safety）。
- [ ] 版本号策略（`MARKETING_VERSION` / `versionName`）。
