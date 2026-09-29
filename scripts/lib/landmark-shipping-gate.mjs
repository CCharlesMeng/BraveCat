/** Validate an explicit cleared decision; user art approval alone is not this record. */
export const hasClearedLandmarkRights = (decision) => {
  if (!decision || (decision.shippingEligible === false && decision.decision === 'review-complete-not-cleared')) return false
  const valid = decision.shippingEligible === true
    && decision.decision === 'cleared-for-shipping'
    && Array.isArray(decision.remainingGates) && decision.remainingGates.length === 0
    && Array.isArray(decision.globalGates) && decision.globalGates.length > 0
    && decision.globalGates.every(gate => gate.status === 'closed')
    && Array.isArray(decision.destinations) && decision.destinations.length > 0
    && decision.destinations.every(destination => destination.shippingEligible === true)
    && Array.isArray(decision.clearanceEvidence) && decision.clearanceEvidence.length > 0
    && decision.clearanceEvidence.every(entry => typeof entry.path === 'string' && entry.path.startsWith('docs/') && !entry.path.split('/').includes('..') && /^[a-f0-9]{64}$/.test(entry.sha256))
  if (!valid) throw new Error('Landmark shipping requires a cleared rights decision with closed gates and fingerprinted evidence')
  return true
}
