/** 素材目录查询小助手（与 web 端 App.svelte 内联函数等价）。 */
import { STARTER_CATALOG } from '@bravecat/core/assets/starterCatalog'
import { STARTER_ITEMS } from '@bravecat/core/assets/starterItems'

export { STARTER_CATALOG, STARTER_ITEMS }

export const findItem = (itemId: string) => STARTER_ITEMS.find(
  ({ id }) => id === itemId,
)

export const findDestination = (destinationId?: string) => (
  STARTER_CATALOG.destinations.find(({ id }) => id === destinationId)
)

export const findSouvenir = (souvenirId: string) => (
  STARTER_CATALOG.souvenirs.find(({ id }) => id === souvenirId)
)
