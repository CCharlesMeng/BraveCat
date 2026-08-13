/**
 * @tarojs/taro 的 vitest 手工 mock（经 vitest.config.ts 的 resolve.alias
 * 接管模块解析）。只覆盖适配器用到的 wx API 面；测试直接 import 本模块
 * 操纵状态与断言调用。
 */
import { vi } from 'vitest'

type AnyRecord = Record<string, unknown>

export const storage = new Map<string, unknown>()

export const fakeCanvasContext = () => ({
  moveTo: vi.fn(),
  arcTo: vi.fn(),
  closePath: vi.fn(),
})

export const createFakeCanvas = () => {
  const context = fakeCanvasContext()
  const images: AnyRecord[] = []
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    createImage: vi.fn(() => {
      const image: AnyRecord = {
        width: 0,
        height: 0,
        onload: null,
        onerror: null,
        set src(value: string) {
          this._src = value
          const handler = value.includes('missing')
            ? (this.onerror as (() => void) | null)
            : (this.onload as (() => void) | null)
          queueMicrotask(() => handler?.())
        },
      }
      images.push(image)
      return image
    }),
    toDataURL: vi.fn(() => 'data:image/png;base64,ZmFrZQ=='),
    __context: context,
    __images: images,
  }
  return canvas
}

export const state = {
  randomValuesAvailable: true,
  randomBytes: null as Uint8Array | null,
  canvasToTempFilePathFails: false,
  saveImageErrors: [] as string[],
  modalConfirm: true,
  openSettingGrants: true,
  devicePlatform: 'android',
  writtenFiles: [] as { filePath: string, data: string, encoding: string }[],
  lastCreatedCanvas: null as ReturnType<typeof createFakeCanvas> | null,
}

export const resetTaroMock = () => {
  storage.clear()
  state.randomValuesAvailable = true
  state.randomBytes = null
  state.canvasToTempFilePathFails = false
  state.saveImageErrors = []
  state.modalConfirm = true
  state.openSettingGrants = true
  state.devicePlatform = 'android'
  state.writtenFiles = []
  state.lastCreatedCanvas = null
  vi.clearAllMocks()
}

const taro = {
  env: { USER_DATA_PATH: 'wxfile://usr' },

  getStorage: vi.fn(async ({ key }: { key: string }) => {
    if (!storage.has(key)) {
      throw { errMsg: 'getStorage:fail data not found' }
    }
    return { data: storage.get(key) }
  }),
  setStorage: vi.fn(async ({ key, data }: { key: string, data: unknown }) => {
    storage.set(key, data)
  }),

  get getRandomValues() {
    if (!state.randomValuesAvailable) return undefined
    return this._getRandomValues
  },
  _getRandomValues: vi.fn(async ({ length }: { length: number }) => {
    const bytes = state.randomBytes
      ?? Uint8Array.from({ length }, (_, index) => index % 256)
    return { randomValues: bytes.buffer }
  }),

  createOffscreenCanvas: vi.fn(() => {
    const canvas = createFakeCanvas()
    state.lastCreatedCanvas = canvas
    return canvas
  }),
  canvasToTempFilePath: vi.fn(async () => {
    if (state.canvasToTempFilePathFails) {
      throw { errMsg: 'canvasToTempFilePath:fail canvas is offscreen' }
    }
    return { tempFilePath: 'wxfile://tmp/composed.png' }
  }),
  getFileSystemManager: vi.fn(() => ({
    writeFile: (options: {
      filePath: string
      data: string
      encoding: string
      success: () => void
      fail: (error: { errMsg: string }) => void
    }) => {
      state.writtenFiles.push({
        filePath: options.filePath,
        data: options.data,
        encoding: options.encoding,
      })
      options.success()
    },
  })),

  saveImageToPhotosAlbum: vi.fn(async () => {
    const error = state.saveImageErrors.shift()
    if (error) throw { errMsg: error }
  }),
  showModal: vi.fn(async () => ({
    confirm: state.modalConfirm,
    cancel: !state.modalConfirm,
  })),
  openSetting: vi.fn(async () => ({
    authSetting: { 'scope.writePhotosAlbum': state.openSettingGrants },
  })),

  getDeviceInfo: vi.fn(() => ({ platform: state.devicePlatform })),
  getSystemInfoSync: vi.fn(() => ({ platform: state.devicePlatform })),
}

export default taro
