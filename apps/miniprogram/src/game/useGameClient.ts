/**
 * controller 快照 → React 的桥（对应 web 端 gameClient.svelte.ts）。
 * controller 不含框架原语；这里用 useSyncExternalStore 订阅不可变快照。
 */
import { useDidShow } from '@tarojs/taro'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { GameSnapshot, SettleOutcome } from '@bravecat/core'
import { controller, hydrateOnce } from './controller'

export const useGameSnapshot = (): GameSnapshot => (
  useSyncExternalStore(controller.subscribe, controller.getSnapshot)
)

const SETTLE_INTERVAL_MS = process.env.NODE_ENV === 'development'
  ? 1_000
  : 60_000

/**
 * 游戏主循环：页面可见时先水合再结算，之后按节拍推进。
 * onOutcome 用于把「小猫回家了」翻成页面提示。
 */
export const useSettleLoop = (
  onOutcome?: (outcome: SettleOutcome) => void,
) => {
  const outcomeRef = useRef(onOutcome)
  outcomeRef.current = onOutcome

  const settle = () => {
    void hydrateOnce().then(() => controller.settle()).then((outcome) => {
      outcomeRef.current?.(outcome)
    })
  }

  useDidShow(settle)
  useEffect(() => {
    const timer = setInterval(settle, SETTLE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])
}
