/**
 * Screen orientation and device adaptation system.
 * Automatically switches between desktop (landscape) and mobile (portrait) modes.
 */

/**
 * Screen orientation types
 * @enum {string}
 */
export const Orientation = {
  LANDSCAPE: 'landscape',
  PORTRAIT: 'portrait'
}

/**
 * Device types
 * @enum {string}
 */
export const DeviceType = {
  DESKTOP: 'desktop',
  TABLET: 'tablet',
  PHONE: 'phone',
  UNKNOWN: 'unknown'
}

/**
 * Get screen orientation based on aspect ratio.
 * @returns {string} Orientation type
 */
export function getScreenOrientation() {
  const width = window.innerWidth
  const height = window.innerHeight
  const aspectRatio = width / height

  // Landscape: width > height (ratio > 1)
  // Portrait: height > width (ratio < 1)
  return aspectRatio > 1 ? Orientation.LANDSCAPE : Orientation.PORTRAIT
}

/**
 * Detect device type based on screen size and capabilities.
 * @returns {string} Device type
 */
export function detectDeviceType() {
  const width = window.innerWidth
  const height = window.innerHeight
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches

  // Desktop: large screen with fine pointer
  if (width >= 1200 && !isCoarsePointer) {
    return DeviceType.DESKTOP
  }

  // Tablet: medium screen
  if (width >= 768 && width < 1200) {
    return DeviceType.TABLET
  }

  // Phone: small screen
  if (width < 768 || isCoarsePointer) {
    return DeviceType.PHONE
  }

  return DeviceType.UNKNOWN
}

/**
 * Calculate screen percentage for scaling.
 * @param {number} targetWidth - Target width for 100%
 * @returns {number} Screen percentage
 */
export function calcScreenPercentage(targetWidth) {
  return (window.innerWidth / targetWidth) * 100
}

/**
 * Get responsive scale factors based on screen size.
 * @returns {Object} Scale factors {scaleX, scaleY, scaleFont}
 */
export function getScaleFactors() {
  const width = window.innerWidth
  const height = window.innerHeight

  // Base reference dimensions (iPhone-like aspect ratio)
  const baseWidth = 390
  const baseHeight = 844

  // Calculate scale factors
  const scaleX = width / baseWidth
  const scaleY = height / baseHeight
  const scaleFont = Math.min(scaleX, scaleY)

  return { scaleX, scaleY, scaleFont }
}

/**
 * Check if screen is in landscape mode.
 * @returns {boolean} True if landscape
 */
export function isLandscape() {
  return getScreenOrientation() === Orientation.LANDSCAPE
}

/**
 * Check if screen is in portrait mode.
 * @returns {boolean} True if portrait
 */
export function isPortrait() {
  return getScreenOrientation() === Orientation.PORTRAIT
}

/**
 * Get device pixel ratio for high-DPI screens.
 * @returns {number} Device pixel ratio
 */
export function getDevicePixelRatio() {
  return window.devicePixelRatio || 1
}

/**
 * Get viewport dimensions in CSS pixels.
 * @returns {Object} Viewport {width, height}
 */
export function getViewportDimensions() {
  return {
    width: window.innerWidth,
    height: window.innerHeight
  }
}

/**
 * Get safe area insets for notched devices.
 * @returns {Object} Safe area {top, right, bottom, left}
 */
export function getSafeAreaInsets() {
  const style = getComputedStyle(document.documentElement)
  return {
    top: parseInt(style.getPropertyValue('--sat') || '0'),
    right: parseInt(style.getPropertyValue('--sar') || '0'),
    bottom: parseInt(style.getPropertyValue('--sab') || '0'),
    left: parseInt(style.getPropertyValue('--sal') || '0')
  }
}

/**
 * Adaptation configuration based on screen orientation and device.
 * @returns {Object} Adaptation config
 */
export function getAdaptationConfig() {
  const orientation = getScreenOrientation()
  const deviceType = detectDeviceType()
  const isLandscapeMode = orientation === Orientation.LANDSCAPE
  const isPortraitMode = orientation === Orientation.PORTRAIT

  return {
    orientation,
    deviceType,
    isLandscapeMode,
    isPortraitMode,
    scaleFactors: getScaleFactors(),
    screenPercentage: calcScreenPercentage(390),
    viewport: getViewportDimensions(),
    pixelRatio: getDevicePixelRatio()
  }
}

export default {
  Orientation,
  DeviceType,
  getScreenOrientation,
  detectDeviceType,
  calcScreenPercentage,
  getScaleFactors,
  isLandscape,
  isPortrait,
  getDevicePixelRatio,
  getViewportDimensions,
  getSafeAreaInsets,
  getAdaptationConfig
}
