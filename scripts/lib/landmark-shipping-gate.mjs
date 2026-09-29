/** Validate an explicit rights clearance or separately recorded user shipping authorization. */
export const hasLandmarkShippingAuthorization = (decision) => {
  if (!decision || (decision.shippingEligible === false && decision.decision === 'review-complete-not-cleared')) return false
  if (decision.decision === 'user-authorized-for-shipping') {
    const authorization = decision.authorization
    if (decision.shippingEligible !== true || decision.reviewer !== 'user'
      || !authorization?.userStatement?.trim() || authorization.rightsClearanceClaim !== false
      || !/^docs\//.test(authorization.approvalInventory ?? '')
      || !/^[a-f0-9]{64}$/.test(authorization.approvalInventorySha256 ?? '')
      || !Array.isArray(decision.remainingGates) || decision.remainingGates.length) {
      throw new Error('User shipping authorization is incomplete')
    }
    return true
  }
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
