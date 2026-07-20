import type { SouvenirDefinition } from './index'
import { LANDMARK_DESTINATIONS } from './landmarkCatalog.generated'

export const STARTER_SOUVENIRS: readonly SouvenirDefinition[] =
  LANDMARK_DESTINATIONS.flatMap(
    ({ id: destinationId, name }) => [
      {
        id: `${destinationId}--postmark-pin`,
        destinationId,
        name: `${name}邮戳徽章`,
        visualToken: '印',
      },
      {
        id: `${destinationId}--travel-charm`,
        destinationId,
        name: `${name}旅途挂饰`,
        visualToken: '念',
      },
    ],
  )
