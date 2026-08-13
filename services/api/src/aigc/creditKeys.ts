/**
 * 生成次数账目的幂等键命名约定：同一业务动作天然只入账一次。
 *
 * - 购买核销按订单号幂等（重复核销标记 duplicate，不重复入账）；
 * - 每个 job 的 hold / release / consume 各只有一个键，
 *   失败退回与确认结算即使重放也不会重复记账。
 */

export const purchaseCreditKey = (platform: string, orderId: string): string =>
  `purchase:${platform}:${orderId}`

export const jobHoldKey = (jobId: string): string => `job:${jobId}:hold`

export const jobReleaseKey = (jobId: string): string => `job:${jobId}:release`

export const jobConsumeKey = (jobId: string): string => `job:${jobId}:consume`
