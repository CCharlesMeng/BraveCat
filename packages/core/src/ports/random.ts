/**
 * 平台随机源端口。旅行种子与姿势抽取都从这里取熵；
 * web 端注入 crypto.getRandomValues，其他端各自实现。
 */
export interface RandomPort {
  /** 均匀分布的 32 位无符号整数。 */
  nextUint32(): number
}
