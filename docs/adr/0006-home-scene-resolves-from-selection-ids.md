# Home 场景在运行时由选择 ID 解析，存档只存 ID

Home Theme（家主题）与 Home Part（家中部件）落地后，存档里的
`homeCustomization` 只保存 `presetId`、`formId`、`finishId` 和逐
socket 的 `pieceId`，不保存任何派生坐标、图层顺序或图片路径。渲染
时 `resolveHomeScene` 把选择 ID 加动态上下文（时间、活动、形象）解析
成完整场景，`App.svelte` 只消费解析结果，不认识具体 form 的坐标。

存档校验（`isHomeCustomization`）只看形状：引用已下架内容不算损坏，
不阻止导入。归一化在解析时统一回退——form 已下架整体回退默认预设，
finish/piece 已下架回退该 form 预设默认值——但存档中的原始选择不被
改写。

## Consequences

- 下架任何 form/finish/piece 永远不会让旧存档失效或导入失败；内容
  重新上架后玩家的原始选择自动恢复。
- 坐标、投影、z 序等派生数据只存在于 form/piece 注册表（代码）中，
  美术迭代改注册表即可，不需要存档迁移。
- 注册表是唯一事实来源：`resolveHomeScene` 对任何形状合法的输入都
  必须解析成功，不允许因内容缺失抛错到渲染层。
- 选择 ID 的类型是开放字符串而非字面量联合，防止编译期类型把
  "已下架"错当成"非法"。
