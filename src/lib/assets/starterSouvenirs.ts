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
        imageSrc: '/assets/souvenirs/souvenir--postmark-pin--v01.png',
      },
      {
        id: `${destinationId}--travel-charm`,
        destinationId,
        name: `${name}旅途挂饰`,
        visualToken: '念',
        imageSrc: '/assets/souvenirs/souvenir--travel-charm--v01.png',
      },
    ],
  )
