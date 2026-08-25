declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v0.1.0-CR194'
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'Dev Build'
export const VERSION_LABEL = `PMFlow ${APP_VERSION}`
export const FULL_VERSION_LABEL = `PMFlow ${APP_VERSION} · ${BUILD_TIME}`
