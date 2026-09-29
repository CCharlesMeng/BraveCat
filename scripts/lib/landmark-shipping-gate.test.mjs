import test from 'node:test'
import assert from 'node:assert/strict'
import { hasLandmarkShippingAuthorization } from './landmark-shipping-gate.mjs'
const cleared = () => ({ shippingEligible: true, decision: 'cleared-for-shipping', remainingGates: [], globalGates: [{ id: 'source', status: 'closed' }], destinations: [{ id: 'one', shippingEligible: true }], clearanceEvidence: [{ path: 'docs/rights/source.json', sha256: 'a'.repeat(64) }] })
test('existing non-cleared records stay non-shipping', () => {
  assert.equal(hasLandmarkShippingAuthorization(null), false)
  assert.equal(hasLandmarkShippingAuthorization({ shippingEligible: false, decision: 'review-complete-not-cleared' }), false)
})
test('explicit clearance supports promotion with fingerprinted evidence', () => assert.equal(hasLandmarkShippingAuthorization(cleared()), true))
test('a flipped flag, pending gate or absent evidence cannot clear shipping', () => {
  for (const patch of [{ decision: 'review-complete-not-cleared' }, { globalGates: [{ status: 'open' }] }, { remainingGates: ['source'] }, { clearanceEvidence: [] }, { destinations: [{ shippingEligible: false }] }, { clearanceEvidence: [{ path: 'docs/../secret', sha256: 'a'.repeat(64) }] }]) {
    assert.throws(() => hasLandmarkShippingAuthorization({ ...cleared(), ...patch }))
  }
})
test('explicit user release authorization is distinct from third-party clearance', () => {
  const record = { decision: 'user-authorized-for-shipping', reviewer: 'user', shippingEligible: true, remainingGates: [], authorization: { userStatement: '图片全部放通', rightsClearanceClaim: false, approvalInventory: 'docs/art/approval.json', approvalInventorySha256: 'a'.repeat(64) } }
  assert.equal(hasLandmarkShippingAuthorization(record), true)
  assert.throws(() => hasLandmarkShippingAuthorization({ ...record, authorization: undefined }))
})
