# 墙面投影保留 clip-path + skew 近似，暂不引入 matrix3d homography

陈列 quad 的渲染方式是：外接矩形定位 + `clip-path: polygon` 裁形 +
内容统一 `skewY`，不是真透视变换。曾计划在多 form 落地时升级为 CSS
`matrix3d` homography，但两个 form（classic-v4 与 split-level-den）
验证下来近似已经够用：slot quad 本身实测自最终美术，近似误差已经被
测量吸收；水彩画风下内容的透视短缩差异肉眼不可辨；保留近似还让
classic 迁移保持像素一致。

复审触发条件：出现墙面角度陡峭到内容变形可辨的 form（如强两点透视
的近角墙面），或需要动态内容沿墙面大幅移动/缩放动画时，再引入
matrix3d。届时改动只在渲染层——`resolveHomeScene` 输出的 quad 已经
携带升级所需的全部数据。

## Consequences

- slot 内容按统一 skew 倾斜、按多边形裁切，不做逐像素透视短缩；
  美术评审按最终渲染效果验收，不按数学正确性验收。
- 每个新 form 的 slot 坐标必须实测自该 form 的美术候选，不能只从
  理想控制图推导（近似误差靠实测吸收）。
- 升级 matrix3d 时不需要改存档、form 数据或解析器接口，只改
  `displayCanvasStyle` 的输出与消费它的样式。
