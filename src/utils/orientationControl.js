/**
 * Screen orientation control for 91writing desktop app.
 * Allows manual switching between landscape and portrait modes on desktop.
 * Mobile devices are forced to portrait mode only.
 */

import { Orientation, DeviceType, detectDeviceType, getScreenOrientation, isLandscape } from './screenAdaptation.js'
import { info, warn, error, LogCategory } from './logger.js'

/**
 * Current orientation preference
 * @type {string} 'landscape' | 'portrait' | 'auto'
 */
let orientationPreference = 'auto'

/**
 * Check if manual orientation switching is allowed.
 * @returns {boolean} True if switching is allowed
 */
export function canSwitchOrientation() {
  const deviceType = detectDeviceType()
  const isMobile = deviceType === DeviceType.PHONE || deviceType === DeviceType.TABLET
  
  // Mobile devices cannot switch orientation
  if (isMobile) {
    warn(LogCategory.UI, 'Orientation switching not allowed on mobile devices', { deviceType })
    return false
  }
  
  // Desktop devices can switch orientation
  info(LogCategory.UI, 'Orientation switching allowed on desktop', { deviceType })
  return true
}

/**
 * Set orientation preference.
 * @param {string} orientation - 'landscape' | 'portrait' | 'auto'
 * @returns {boolean} Success status
 */
export function setOrientationPreference(orientation) {
  const validOrientations = [Orientation.LANDSCAPE, Orientation.PORTRAIT, 'auto']
  
  if (!validOrientations.includes(orientation)) {
    error(LogCategory.UI, 'Invalid orientation preference', { orientation })
    return false
  }
  
  // Check if switching is allowed
  if (orientation !== 'auto' && !canSwitchOrientation()) {
    error(LogCategory.UI, 'Cannot set orientation on mobile devices')
    return false
  }
  
  orientationPreference = orientation
  info(LogCategory.UI, 'Orientation preference set', { orientation })
  
  // Apply the preference
  return applyOrientationPreference(orientation)
}

/**
 * Get current orientation preference.
 * @returns {string} Current preference
 */
export function getOrientationPreference() {
  return orientationPreference
}

/**
 * Apply orientation preference.
 * @param {string} orientation - Orientation to apply
 * @returns {boolean} Success status
 */
export function applyOrientationPreference(orientation) {
  const deviceType = detectDeviceType()
  const isMobile = deviceType === DeviceType.PHONE || deviceType === DeviceType.TABLET
  
  // Mobile devices are forced to portrait
  if (isMobile) {
    warn(LogCategory.UI, 'Mobile device forced to portrait mode', { deviceType })
    forcePortraitMode()
    return true
  }
  
  // Desktop devices can switch based on preference
  switch (orientation) {
    case Orientation.LANDSCAPE:
      info(LogCategory.UI, 'Applying landscape mode')
      forceLandscapeMode()
      return true
    
    case Orientation.PORTRAIT:
      info(LogCategory.UI, 'Applying portrait mode')
      forcePortraitMode()
      return true
    
    case 'auto':
      info(LogCategory.UI, 'Applying auto mode (detect screen orientation)')
      autoDetectOrientation()
      return true
    
    default:
      error(LogCategory.UI, 'Unknown orientation preference', { orientation })
      return false
  }
}

/**
 * Force landscape mode (desktop only).
 * Uses CSS to make the app appear as landscape.
 */
export function forceLandscapeMode() {
  if (!canSwitchOrientation()) {
    error(LogCategory.UI, 'Cannot force landscape mode on mobile')
    return false
  }
  
  info(LogCategory.UI, 'Forcing landscape mode')
  document.documentElement.classList.remove('force-portrait')
  document.documentElement.classList.add('force-landscape')
  document.documentElement.classList.remove('is-portrait')
  document.documentElement.classList.add('is-landscape')
  document.documentElement.setAttribute('data-orientation', 'landscape')
  
  // Trigger resize event to update layout
  window.dispatchEvent(new Event('resize'))
  
  return true
}

/**
 * Force portrait mode (works on all devices).
 * Uses CSS to make the app appear as portrait.
 */
export function forcePortraitMode() {
  info(LogCategory.UI, 'Forcing portrait mode')
  document.documentElement.classList.remove('force-landscape')
  document.documentElement.classList.add('force-portrait')
  document.documentElement.classList.remove('is-landscape')
  document.documentElement.classList.add('is-portrait')
  document.documentElement.setAttribute('data-orientation', 'portrait')
  
  // Trigger resize event to update layout
  window.dispatchEvent(new Event('resize'))
  
  return true
}

/**
 * Auto-detect screen orientation.
 */
export function autoDetectOrientation() {
  const deviceType = detectDeviceType()
  const isMobile = deviceType === DeviceType.PHONE || deviceType === DeviceType.TABLET
  
  info(LogCategory.UI, 'Auto-detecting orientation', { deviceType, isMobile })
  
  if (isMobile) {
    // Mobile devices always use portrait
    forcePortraitMode()
    return
  }
  
  // Desktop devices use actual screen orientation
  if (isLandscape()) {
    document.documentElement.classList.remove('force-portrait')
    document.documentElement.classList.remove('force-landscape')
    document.documentElement.classList.remove('is-portrait')
    document.documentElement.classList.add('is-landscape')
    document.documentElement.setAttribute('data-orientation', 'landscape')
  } else {
    document.documentElement.classList.remove('force-landscape')
    document.documentElement.classList.remove('force-portrait')
    document.documentElement.classList.remove('is-landscape')
    document.documentElement.classList.add('is-portrait')
    document.documentElement.setAttribute('data-orientation', 'portrait')
  }
  
  // Trigger resize event to update layout
  window.dispatchEvent(new Event('resize'))
}

/**
 * Toggle between landscape and portrait (desktop only).
 * @returns {boolean} True if switched successfully
 */
export function toggleOrientation() {
  if (!canSwitchOrientation()) {
    error(LogCategory.UI, 'Cannot toggle orientation on mobile devices')
    return false
  }
  
  const current = getScreenOrientation()
  const newOrientation = current === Orientation.LANDSCAPE ? Orientation.PORTRAIT : Orientation.LANDSCAPE
  
  info(LogCategory.UI, 'Toggling orientation', { from: current, to: newOrientation })
  setOrientationPreference(newOrientation)
  return true
}

/**
 * Get current display mode.
 * @returns {string} 'landscape' | 'portrait'
 */
export function getCurrentDisplayMode() {
  const deviceType = detectDeviceType()
  const isMobile = deviceType === DeviceType.PHONE || deviceType === DeviceType.TABLET
  
  if (isMobile) {
    return Orientation.PORTRAIT
  }
  
  // Desktop: check forced mode or actual orientation
  if (document.documentElement.classList.contains('force-landscape')) {
    return Orientation.LANDSCAPE
  }
  if (document.documentElement.classList.contains('force-portrait')) {
    return Orientation.PORTRAIT
  }
  
  return getScreenOrientation()
}

/**
 * Initialize orientation system.
 * Should be called on app startup.
 */
export function initOrientationSystem() {
  info(LogCategory.UI, 'Initializing orientation system')
  
  const deviceType = detectDeviceType()
  const isMobile = deviceType === DeviceType.PHONE || deviceType === DeviceType.TABLET
  
  if (isMobile) {
    warn(LogCategory.UI, 'Mobile device detected, forcing portrait mode')
    forcePortraitMode()
  } else {
    info(LogCategory.UI, 'Desktop device detected, using auto mode')
    autoDetectOrientation()
  }
  
  // Listen for screen orientation changes
  window.addEventListener('resize', () => {
    if (orientationPreference === 'auto') {
      autoDetectOrientation()
    }
  })
  
  // Listen for device orientation changes (mobile)
  if (window.matchMedia('(orientation: landscape)').matches) {
    // Screen is in landscape mode
    if (isMobile) {
      warn(LogCategory.UI, 'Mobile device in landscape, forcing portrait')
      forcePortraitMode()
    }
  }
  
  info(LogCategory.UI, 'Orientation system initialized', {
    deviceType,
    isMobile,
    orientationPreference
  })
}

export default {
  canSwitchOrientation,
  setOrientationPreference,
  getOrientationPreference,
  applyOrientationPreference,
  forceLandscapeMode,
  forcePortraitMode,
  autoDetectOrientation,
  toggleOrientation,
  getCurrentDisplayMode,
  initOrientationSystem
}
