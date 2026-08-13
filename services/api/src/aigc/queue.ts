/**
 * 生成 job 的执行队列端口：路由只依赖 enqueue，不关心执行位置。
 *
 * 当前实现为进程内串行队列（单体部署下够用，且天然限制云 API 并发为 1）。
 * 未来量大或需要横向扩展时，可换成独立 worker 拉取模型
 * （Postgres `for update skip locked` 轮询或消息队列），
 * 路由与 executor 的接口都不需要变；进程重启时 pending job 的恢复
 * 也应由那一层负责（当前进程内实现重启会丢队列，job 停在 pending）。
 */
export interface GenerationJobQueue {
  enqueue(jobId: string): void
}

export interface InProcessJobQueue extends GenerationJobQueue {
  /** 等待队列清空（测试用；生产代码不得依赖）。 */
  onIdle(): Promise<void>
}

export const createInProcessJobQueue = (
  execute: (jobId: string) => Promise<void>,
  onError: (error: unknown, jobId: string) => void = () => {},
): InProcessJobQueue => {
  let tail: Promise<void> = Promise.resolve()
  return {
    enqueue: (jobId) => {
      // 每个链节都以 catch 收尾，tail 永不 reject，链条不会因单个 job 中断。
      tail = tail
        .then(() => execute(jobId))
        .catch((error) => onError(error, jobId))
    },
    onIdle: async () => {
      // 执行中可能继续入队，循环直到 tail 稳定。
      let current: Promise<void>
      do {
        current = tail
        await current
      } while (current !== tail)
    },
  }
}
