# main 代码收敛 · 2026-09-29

用户授权：先进行代码收敛，仅保留一个 main 作为最新代码；其他分支全部归档；现有素材全部批准；其他工作写入下一步计划，然后继续 grill。

## 代码结果

- 4c5c528：保存当前开发工作区全部显式列出的修改和新文件，包括手机号、主题/用品、动画、美术、仓库技能与审核报告。
- a7d7528：合入 origin/main=2777788，保留 monorepo 和当前 v4 存档契约。
- 主干 tripReturned 的返还累加/幂等与当前实现语义等价，保留当前实现并合并验证意图。
- 主干单体 src 的同名模块已有 core/web 继任，不复活旧目录；纪念品图片继续保留，主干“无图片占位”测试改为验证现有正式图片路径。
- 保留主干新增素材校验/旅行纪念品测试，补充 v1→v4 导入回归；没有回退存档版本或多猫时钟。
- 旧 home-screen-v1 UI 使用旧房间坐标/旧 Postcard 组件，已被当前 HomeTheme resolver 与合成配方替代；完整保全供追溯，不覆盖最新实现。

## 归档与恢复

逐分支原 SHA 与归档标签见 `branch-archives-2026-09-29.json`。

- 标签前缀：`archive/2026-09-29/local/` 与 `archive/2026-09-29/remote/`。
- 当前开发脏文件快照：`archive/2026-09-29/working-tree/latest-development`。
- 旧脏工作树完整快照：`archive/2026-09-29/working-tree/home-screen-v1`，包含 10 个原已跟踪修改与 981 个原未跟踪文件。
- 本机另有经过 git bundle verify 的完整历史包：`.git/archives/2026-09-29/pre-convergence.bundle`。不把它作为大二进制塞回 Git。
- 旧目录保留，退休分支工作树转为 detached HEAD；不删除文件，不影响原未提交内容。
- 恢复单文件：`git show archive/2026-09-29/working-tree/home-screen-v1:path/to/file > /tmp/recovered-file`；检查归档：`git show --stat <archive-tag>`。无需恢复长期分支。
- 归档范围为 tracked 与 non-ignored untracked 文件；ignored 本地文件未进归档，原目录原样保留。

## 素材决定

全量批准见 `docs/art/reviews/all-existing-assets-approval-2026-09-29.json`。已冻结 2043 个图片/媒体条目的 SHA-256（跨当前树与旧工作树，包含重复副本的独立路径）。
83 个文档引用的本地源文件已核实存在，39 个复用仓内同字节文件，44 个源稿复制入 `docs/art/archive/approved-source-snapshot-2026-09-29/`，不再仅依赖生成器临时目录。

用户审批已完成。待办为版本选择、runtime/生产接入和适用第三方权利证据；本次没有捏造外部许可、真实服务验证或素材技术QA。

## 检查

- 合并后 `npm run check` 通过。
- 合并后 `npm test` 通过：47 个 Vitest 文件、335 个用例，另有 24 个脚本测试，总计 359。
- `npm run build` 与小程序 `build:weapp` 均通过；生产资产 gate 保持生效（地标仍未技术晋升）。
- 远端 CI 状态在最终交付消息中另报，不把本地通过写成远端通过。
- PR #16 与 c3156e5 的 stable patch-id 完全相同（b4a9312277924cff6171beecf3b043340713311a），无需重复合入同一文档修改。
- 真实短信/云模型/支付/Postgres恢复/移动真机未执行。
- 全量原始快照的 `git diff --check` 提示既有技能 HTML 的 CRLF/尾空白；原字节保全，不把这项格式提示写成通过。合并补丁自身 diff check 通过。

## 下一步

任务与依赖见 `docs/plans/next-step-plan-2026-09-29.md`。审计旧报告保留为收敛前快照；不再用其旧审批状态指导当前工作。
