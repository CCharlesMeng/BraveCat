/**
 * monorepo 搬迁（Phase 0）后的仓库相对路径重定向。
 *
 * docs/ 下各清单与审批记录里保存的历史路径字符串（`public/…`、
 * `src/lib/assets/…`）保持原样不改写；脚本只在真正访问文件系统时
 * 把它们映射到搬迁后的实际位置。
 */
const MOVED_PREFIXES = [
  ['public/', 'apps/web/public/'],
  ['src/lib/assets/', 'packages/core/src/assets/'],
]

export const movedRepoRelativePath = (repoRelativePath) => {
  const moved = MOVED_PREFIXES.find(([prefix]) => (
    repoRelativePath.startsWith(prefix)
  ))
  return moved
    ? moved[1] + repoRelativePath.slice(moved[0].length)
    : repoRelativePath
}
