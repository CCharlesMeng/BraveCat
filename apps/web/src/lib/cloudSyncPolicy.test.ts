// web 消费方视角的启动同步决策用例；实现在 @bravecat/core/cloud（原 web 本地实现已统一到 core）。
import { describe, expect, it } from 'vitest'
import {
  SAVE_SCHEMA_VERSION,
  decideStartupSync,
  type SaveDocument,
} from '@bravecat/core/cloud'

const cloudDocument = (exportedAt: number): SaveDocument => ({
  schemaVersion: SAVE_SCHEMA_VERSION,
  exportedAt,
  state: {},
})

describe('decideStartupSync', () => {
  it('云端没有存档时推送本地（首次同步）', () => {
    expect(decideStartupSync({ status: 'empty' }, 100)).toEqual({
      action: 'push-local',
    })
  })

  it('云端 schemaVersion 更高时要求升级，不做任何覆盖', () => {
    const decision = decideStartupSync(
      {
        status: 'schema-too-new',
        cloudSchemaVersion: SAVE_SCHEMA_VERSION + 1,
      },
      100,
    )
    expect(decision).toEqual({
      action: 'upgrade-required',
      cloudSchemaVersion: SAVE_SCHEMA_VERSION + 1,
    })
  })

  it('云端 exportedAt 较新（其他设备玩过）时以云端为准', () => {
    const document = cloudDocument(200)
    expect(
      decideStartupSync({ status: 'ok', document, savedAt: 300 }, 100),
    ).toEqual({ action: 'adopt-cloud', document, savedAt: 300 })
  })

  it('同设备回访（云端 exportedAt 等于本地标记）时本地优先推送', () => {
    expect(
      decideStartupSync(
        { status: 'ok', document: cloudDocument(100), savedAt: 300 },
        100,
      ),
    ).toEqual({ action: 'push-local' })
  })

  it('本地改动较新时本地优先推送', () => {
    expect(
      decideStartupSync(
        { status: 'ok', document: cloudDocument(100), savedAt: 300 },
        250,
      ),
    ).toEqual({ action: 'push-local' })
  })

  it('本设备从未记录改动而云端有存档时以云端为准', () => {
    const document = cloudDocument(1)
    expect(
      decideStartupSync({ status: 'ok', document, savedAt: 2 }, null),
    ).toEqual({ action: 'adopt-cloud', document, savedAt: 2 })
  })
})
