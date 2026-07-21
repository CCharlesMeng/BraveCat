import {
  defineAssetCatalog,
  type AssetCatalog,
} from './index'
import {
  LANDMARK_DESTINATIONS,
  LANDMARK_SCENES_SHIPPING_ELIGIBLE,
} from './landmarkCatalog.generated'
import {
  DEV_LATEST_ART_DESTINATIONS,
  DEV_LATEST_ART_METADATA,
  DEV_LATEST_ART_MINHO_POSES,
  DEV_LATEST_ART_PORTRAIT_SET_REVISION,
  DEV_LATEST_ART_SCENE_REVISIONS,
  DEV_LATEST_ART_SCENE_SET_REVISION,
} from './devLatestArtCatalog.generated'
import { STARTER_ITEMS } from './starterItems'
import { STARTER_SOUVENIRS } from './starterSouvenirs'
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

const PRODUCTION_SCENE_SET_REVISION =
  'a818cdb6f3b665d4c411bf8db982bb0ddc475cfa66b5a63b7b2f4fa2be7fd525'

const PRODUCTION_SCENE_REVISIONS = Object.fromEntries(
  LANDMARK_DESTINATIONS.flatMap(({ sceneVariants }) => (
    sceneVariants.map((scene) => [
      scene.id,
      `${PRODUCTION_SCENE_SET_REVISION}:${scene.imageSrc}`,
    ])
  )),
)

const starterCopy = {
  postcardNotes: [
    '人，咪在{destination}的屋檐下坐了一会儿，风从胡须边绕过去。',
    '人，咪到{destination}啦。今天的光很好，咪替你多看了一会儿。',
    '人，咪在{destination}闻到一点新味道，慢慢跟过去看了看。',
    '人，咪走到{destination}这边了。这里和家里不一样，不过也很安静。',
    '人，咪在{destination}找到一个小小的落脚处，回家再讲给你听。',
    '人，咪在{destination}听见远处有人说话，就停下来听了一会儿。',
    '人，咪路过{destination}一处有阳光的地方，暖得不想马上走。',
    '人，咪在{destination}看见一只小鸟飞过去，抬头看了很久。',
    '人，咪在{destination}找到一段安静的路，踩着影子慢慢往前走。',
    '人，咪从{destination}捎来一点风，先放在明信片的角落。',
  ],
  travelNotes: [
    '窗边有风，我出去看看。',
    '行囊刚刚好。我走一小段路，很快写信。',
    '我听见远处有声音，想去看看是什么。',
    '别担心，我认得回家的路。',
    '太阳正好。我先出门，回来再睡。',
  ],
} as const

export const PRODUCTION_STARTER_CATALOG = defineAssetCatalog({
  sceneSetRevision: PRODUCTION_SCENE_SET_REVISION,
  sceneRevisions: PRODUCTION_SCENE_REVISIONS,
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
  souvenirs: STARTER_SOUVENIRS,
  copy: starterCopy,
} as const satisfies AssetCatalog)

export const USE_DEVELOPMENT_LATEST_ART = import.meta.env.DEV

export const DEVELOPMENT_LATEST_ART_CATALOG = USE_DEVELOPMENT_LATEST_ART
  ? defineAssetCatalog({
      sceneSetRevision: DEV_LATEST_ART_SCENE_SET_REVISION,
      sceneRevisions: DEV_LATEST_ART_SCENE_REVISIONS,
      portraitSetRevisions: {
        minho: DEV_LATEST_ART_PORTRAIT_SET_REVISION,
      },
      destinations: DEV_LATEST_ART_DESTINATIONS,
      portraits: [
        {
          id: 'minho',
          name: 'Minho',
          poses: DEV_LATEST_ART_MINHO_POSES,
        },
      ],
      items: STARTER_ITEMS,
      souvenirs: STARTER_SOUVENIRS,
      copy: starterCopy,
    } as const satisfies AssetCatalog)
  : null

export const STARTER_CATALOG = DEVELOPMENT_LATEST_ART_CATALOG
  ?? PRODUCTION_STARTER_CATALOG

export const STARTER_DESTINATIONS = STARTER_CATALOG.destinations.map(({ id }) => ({
  id,
  region: destinationRegions[id],
})) satisfies readonly ItineraryDestination[]
