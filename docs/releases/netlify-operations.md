# Netlify 操作手册

适用：BraveCat 的认证、部署、状态查询、发布验收与回滚。用户要求后续优先 CLI/API，浏览器用于视觉验收或 CLI 无法完成的设置。发布历史见 [发布记录](netlify-launch.md)，逐次产物与证据见 `docs/releases/archive/`。

## 固定目标与已配置状态

- 仓库：`/Users/moon/Documents/Code/BraveCat`；在 main 推进，保留用户修改与旧归档。
- 公网站点：`https://bravecat.netlify.app/`；site ID：`2a965a34-74ab-457c-89f6-de16a1286d87`。
- 免费、免注册、本机 v5 存档 Web/PWA；无首发服务端依赖。保持原域名，避免 origin 变化导致存档看似丢失。
- 采用 **CI 通过后主动发布完整产物**，未连接 Git push 自动生产发布。`netlify link` 只关联本地目录；不要以 `netlify init` 替换它来引入持续部署。
- 2026-09-30 已安装全局 CLI `27.10.2`，用户已完成授权，`apps/web` 已关联原站点。MCP 未配置，CLI 足够完成当前部署工作。
- 平台徽章已通过项目官方设置关闭，无需改应用 CSS。旧部署及批准素材母版继续保留。

版本、认证、发布状态会变化；新会话先实时核验。2026-09-30 的生产基线为 `e7d9985` / deploy `6abc76805fd66da6add32d1b`，后续以 API 返回及最新发布归档为准。

## 1. 认证与关联

```sh
cd /Users/moon/Documents/Code/BraveCat/apps/web
netlify --version
netlify status
```

应显示项目 `bravecat`、固定 site ID 和仓库根 `netlify.toml`。根目录运行 `status` 会报告未关联；`status` 不支持 `--filter`。需要恢复关联时：

```sh
cd /Users/moon/Documents/Code/BraveCat
netlify link --id 2a965a34-74ab-457c-89f6-de16a1286d87 --filter @bravecat/web
```

缺 CLI 才运行 `npm install -g netlify-cli`。只有实际未登录或认证失效才发起登录：

```sh
netlify login --request 'Authorize Netlify CLI for BraveCat deployment and status checks' --json
# 将返回的 URL 交给用户完成授权，再用返回的 ticket_id 查询：
netlify login --check '<ticket_id>' --json
```

不要复用历史 ticket。macOS 凭据由 CLI 存在 `~/Library/Preferences/netlify/config.json`；不读取展示 token、不写进仓库。`.netlify/state.json` 是本地关联信息，已被 Git 忽略。授权成功不代表已发布。

## 2. 只读查询

下面在 `apps/web` 执行，使用已登录凭据；API 方法无需手填 token：

```sh
netlify api getSite --data '{"site_id":"2a965a34-74ab-457c-89f6-de16a1286d87"}'
netlify api listSiteDeploys --data '{"site_id":"2a965a34-74ab-457c-89f6-de16a1286d87","per_page":5}'
netlify api getSiteDeploy --data '{"site_id":"2a965a34-74ab-457c-89f6-de16a1286d87","deploy_id":"<deploy_id>"}'
```

对外报告只提取需要的项目 ID、域名、`published_deploy.id`、部署状态与 URL，避免倾倒完整账号/项目元数据。已验证认证、关联及 `getSite` 只读调用；以下 deploy/restore 命令按已安装 CLI 帮助和官方 API 核实，本次写文档未实际执行发布或回滚。

## 3. 构建与冻结产物

先检查 Git 状态，保留无关修改。按改动范围完成测试及 check；提交明确路径、push main，并核验**待发布提交**的 CI 和 E2E 已 completed/success。push 成功不等于 CI 成功。

根目录 `npm run build` 包含 contracts、素材放行、Vite/PWA、生产资产检查；不要用单独 Vite build 代替这些门禁。若依赖未安装或锁文件变化，先 `npm ci`。

在干净且对应已验收提交的 checkout 中执行：

```sh
cd /Users/moon/Documents/Code/BraveCat
release_sha=$(git rev-parse HEAD)
gh run list --commit "$release_sha" --json databaseId,name,status,conclusion
npm run build
node scripts/package-web-release.mjs
release_dir="$PWD/.asset-publish/web-pwa-rc-${release_sha:0:12}"
mkdir -p "$release_dir/deploy-dist"
tar -xzf "$release_dir/web-pwa.tar.gz" -C "$release_dir/deploy-dist"
```

确认 CI/E2E 成功后才进入发布步骤。`package-web-release.mjs` 会拒绝 tracked dirty 状态，产生 tar.gz 与含完整文件 SHA-256 的 manifest。已有同 SHA 归档时先核对复用，不覆盖历史发布包或向非空 `deploy-dist` 混入旧文件。必要时使用新的日期目录保存独立候选。

上传前验证 tar 和解包文件都与 manifest 完全一致，包含文件集合；运行后应输出 `Verified <N> files`：

```sh
python3 - "$release_dir" <<'PY'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
m = json.loads((root / 'manifest.json').read_text())
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
assert digest(root / m['archive']) == m['sha256'], 'Archive hash mismatch'
expected = {row['path']: row for row in m['files']}
dist = root / 'deploy-dist'
actual = {p.relative_to(dist).as_posix(): p for p in dist.rglob('*') if p.is_file()}
assert set(actual) == set(expected), 'File set mismatch'
for name, p in actual.items():
    assert p.stat().st_size == expected[name]['bytes'], name
    assert digest(p) == expected[name]['sha256'], name
print(f'Verified {len(actual)} files')
PY
```

完整上传目录必须包含 `_headers`、manifest、SW、JS/CSS、全部素材；CLI 会按差异传输，但部署输入仍须完整。无需为 CLI 另打 ZIP；原 ZIP 发布归档保留。

## 4. 发布现有站点

在上一步的同一个 shell 中、仓库根目录执行。先检查当前版本的 `netlify deploy --help`；`--no-build` 保证直接上传刚刚验证的冻结目录，绝对路径避免 monorepo 相对目录歧义。CLI 27.10.2 实测拒绝同时传 `--context` 与 `--no-build`；冻结产物发布省略 `--context`，由 `--prod` 指定正式发布。

**以下命令会更新正式站点；只在已授权的发布任务中执行，不用于单纯检查配置：**

```sh
netlify deploy \
  --filter @bravecat/web \
  --site 2a965a34-74ab-457c-89f6-de16a1286d87 \
  --dir "$release_dir/deploy-dist" \
  --no-build --prod \
  --message "BraveCat $release_sha" \
  --json > "$release_dir/netlify-deploy.json"
```

需要草稿预览时去掉 `--prod`，使用单独 JSON 文件记录；草稿不是正式发布，生产以 `getSite` 的 `published_deploy.id` 为准。固定传 `--site`，不创建新站，不使用匿名部署。`--trigger` 是远端构建，不属于本方案。

命令异常或超时后，先查询部署列表及生产 ID，确认是否已发布再决定下一步，避免重复上传。记录结果中的 deploy ID、部署专属 URL 和日志 URL，再以 API 确认状态及生产引用。

## 5. 验收与落盘

- 部署专属 URL：按 manifest 校验全部公开文件的状态码、内容指纹与 MIME；`_headers` 是配置文件，验证其效果，不要求它作为公开文件返回。文件数随版本变化，不硬编码 147。
- 首页若仅增加已识别的 Netlify 托管注释，可精确扣除该注释后比较，并记录规范化规则；不任意忽略脚本或其他内容差异。
- HTML、manifest、SW、注册脚本须重新校验；哈希 JS/CSS 长缓存；manifest 为 `application/manifest+json`，WebP 为 `image/webp`。以 `apps/web/public/_headers` 为规则来源，缺失素材须返回 404。
- 再查主域名首页、manifest、SW 与发布产物对应；HTTPS 正常，不跳过 TLS 校验。失败可有限重试，保留错误事实，不把一次成功说成长期网络健康。
- 浏览器验证实际页面与存档保留。视觉变更至少覆盖 1280×720 和 390×844，短屏检查滚动与导航。测试夹具使用隔离环境，不清空公网用户存档。
- 旧 PWA 首次刷新可能返回历史缓存，等待后台更新后再次刷新，核对实际 JS/CSS 指纹。不要靠清除 IndexedDB 来完成升级验收。
- 真机安装、系统分享、完整公网离线与备份往返分别记录；本地测试、CI、文件校验和截图各自证明不同事实。

落盘到 `docs/releases/archive/<日期与版本>/`：README（代码 SHA、CI 链接及结论、site/deploy ID、URL、包指纹、回滚目标、验证边界）、原始 manifest、筛选后的部署回执、HTTP 校验结果、独立截图。完整二进制包保留在 `.asset-publish/`，不重复入 Git。更新 `netlify-launch.md` 的最新发布入口；旧快照不回写。按具体路径提交/push 文档，文档提交不重新发布。

## 6. 回滚

选择已验证、仍保留且兼容当前 v5 存档的旧 deploy，先用 `getSiteDeploy` 核验归属和状态。记录目前生产 ID作为恢复点。在已授权的回滚任务中运行：

```sh
netlify api restoreSiteDeploy --data '{"site_id":"2a965a34-74ab-457c-89f6-de16a1286d87","deploy_id":"<verified_rollback_deploy_id>"}'
```

这是实际生产切换，不是查询。不要照抄历史 ID 盲目回滚，也不删除旧部署。切换后核对 `published_deploy.id`、主域名资源、SW 更新和存档兼容，并归档回滚原因与证据。当前 CLI 没有独立的 `netlify rollback` 命令。

## 官方依据

2026-09-30 核对本机 `netlify deploy/link/status/login/api --help`、安装包 OpenAPI schema 与下列官方文档。升级 CLI 后参数有差异时先查帮助。

- [CLI 安装与认证](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/)
- [手动部署与持续部署](https://docs.netlify.com/deploy/create-deploys/)
- [API 与 restore deploy](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/)
- [部署管理与回滚](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/)
- [平台徽章开关](https://docs.netlify.com/manage/projects/powered-by-netlify-badge/)
