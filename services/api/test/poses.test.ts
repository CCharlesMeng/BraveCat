import { describe, expect, it } from 'vitest'
import { portraitGenerationPoses } from '@bravecat/contracts'
// 姿势词汇的单一来源在 packages/core；contracts 因依赖方向只能复制 id 列表，
// 此测试保证两侧不漂移（core 增删姿势时会在这里失败）。
import {
  BASELINE_PORTRAIT_POSES,
  PORTRAIT_POSES,
} from '../../../packages/core/src/assets/portraitPoseVocabulary.js'

describe('姿势词汇对齐', () => {
  it('contracts 的姿势枚举与 core 姿势词汇逐项一致（含顺序）', () => {
    expect([...portraitGenerationPoses]).toEqual([...PORTRAIT_POSES])
  })

  it('baseline 姿势是生成套图的子集', () => {
    for (const pose of BASELINE_PORTRAIT_POSES) {
      expect(portraitGenerationPoses).toContain(pose)
    }
  })
})
