import test from 'node:test'
import assert from 'node:assert/strict'
import { hasClearedLandmarkRights } from './landmark-shipping-gate.mjs'
const cleared = () => ({ shippingEligible: true, decision: 'cleared-for-shipping', remainingGates: [], globalGates: [{ id: 'source', status: 'closed' }], destinations: [{ id: 'one', shippingEligible: true }], clearanceEvidence: [{ path: 'docs/rights/source.json', sha256: 'a'.repeat(64) }] })
test('existing non-cleared records stay non-shipping', () => {
  assert.equal(hasClearedLandmarkRights(null), false)
  assert.equal(hasClearedLandmarkRights({ shippingEligible: false, decision: 'review-complete-not-cleared' }), false)
})
test('explicit clearance supports promotion with fingerprinted evidence', () => assert.equal(hasClearedLandmarkRights(cleared()), true))
test('a flipped flag, pending gate or absent evidence cannot clear shipping', () => {
  for (const patch of [{ decision: 'review-complete-not-cleared' }, { globalGates: [{ status: 'open' }] }, { remainingGates: ['source'] }, { clearanceEvidence: [] }, { destinations: [{ shippingEligible: false }] }, { clearanceEvidence: [{ path: 'docs/../secret', sha256: 'a'.repeat(64) }] }]) {
    assert.throws(() => hasClearedLandmarkRights({ ...cleared(), ...patch }))
  }
})
