import {
  defineAssetCatalog,
  type AssetCatalog,
} from './index'
import {
  LANDMARK_DESTINATIONS,
  LANDMARK_SCENES_SHIPPING_ELIGIBLE,
} from './landmarkCatalog.generated'
import { STARTER_ITEMS } from './starterItems'
import type { ItineraryDestination } from '../itinerary'

export { LANDMARK_SCENES_SHIPPING_ELIGIBLE }

/**
 * 区域只服务心愿车票的同区域绕路；不作为玩家可见的地理分类。
 */
const destinationRegions = {
  'china-beijing-forbidden-city-corner-tower': 'asia',
  'japan-kyoto-fushimi-inari-taisha': 'asia',
  'singapore-singapore-merlion': 'asia',
  'australia-sydney-opera-house': 'oceania',
  'france-paris-eiffel-tower': 'europe',
  'united-kingdom-london-tower-bridge': 'europe',
  'italy-rome-colosseum': 'europe',
  'egypt-giza-pyramids': 'africa',
  'united-states-new-york-brooklyn-bridge': 'americas',
  'peru-cusco-machu-picchu': 'americas',
  'china-beijing-mutianyu-great-wall': 'asia',
  'china-shanghai-the-bund': 'asia',
  'china-xian-giant-wild-goose-pagoda': 'asia',
  'china-guilin-elephant-trunk-hill': 'asia',
  'china-dongguan-xiliubeipo-village': 'asia',
  'china-hangzhou-west-lake-leifeng-pagoda': 'asia',
  'india-agra-taj-mahal': 'asia',
  'turkey-istanbul-hagia-sophia': 'asia',
  'brazil-rio-de-janeiro-christ-the-redeemer': 'americas',
  'south-africa-cape-town-table-mountain': 'africa',
  'mexico-yucatan-chichen-itza': 'americas',
  'jordan-petra-al-khazneh': 'asia',
  'cambodia-siem-reap-angkor-wat': 'asia',
  'new-zealand-fiordland-milford-sound': 'oceania',
  'morocco-ouarzazate-ait-benhaddou': 'africa',
} as const satisfies Record<string, string>

export const STARTER_DESTINATIONS = LANDMARK_DESTINATIONS.map(({ id }) => ({
  id,
  region: destinationRegions[id],
})) satisfies readonly ItineraryDestination[]

const STARTER_SCENE_SET_REVISION =
  'a818cdb6f3b665d4c411bf8db982bb0ddc475cfa66b5a63b7b2f4fa2be7fd525'

const STARTER_SCENE_REVISIONS = Object.fromEntries(
  LANDMARK_DESTINATIONS.flatMap(({ sceneVariants }) => (
    sceneVariants.map((scene) => [
      scene.id,
      `${STARTER_SCENE_SET_REVISION}:${scene.imageSrc}`,
    ])
  )),
)

export const STARTER_CATALOG = defineAssetCatalog({
  sceneSetRevision: STARTER_SCENE_SET_REVISION,
  sceneRevisions: STARTER_SCENE_REVISIONS,
  portraitSetRevisions: {
    minho: 'd9b3935b749ff221a3d5bafcae5e5a5428146c9861a3bd41b1677190b99a4c5f',
  },
  destinations: LANDMARK_DESTINATIONS,
  portraits: [
    {
      id: 'minho',
      name: 'Minho',
      poses: {
        sit: '/portraits/minho/portrait--minho--sit--v01.png',
        sleep: '/portraits/minho/portrait--minho--sleep--v01.png',
        walk: '/portraits/minho/portrait--minho--walk--v01.png',
        eat: '/portraits/minho/portrait--minho--eat--v01.png',
        play: '/portraits/minho/portrait--minho--play--v01.png',
        gaze: '/portraits/minho/portrait--minho--gaze--v01.png',
      },
    },
  ],
  items: STARTER_ITEMS,
  souvenirs: [],
  copy: {
    postcardNotes: [
      '风从屋檐下绕过去，我在这里坐了一会儿。',
      '今天的光很好，我替你多看了一会儿。',
      '路边有一点好闻的味道，我慢慢跟了过去。',
      '这里和家里不一样，不过也很安静。',
      '我把这阵风先记下来，回家再讲给你听。',
    ],
    travelNotes: [
      '窗边有风，我出去看看。',
      '行囊刚刚好。我走一小段路，很快写信。',
      '我听见远处有声音，想去看看是什么。',
      '别担心，我认得回家的路。',
      '太阳正好。我先出门，回来再睡。',
    ],
  },
} as const satisfies AssetCatalog)
