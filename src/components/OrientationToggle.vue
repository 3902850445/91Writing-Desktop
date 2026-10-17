<template>
  <div v-if="showToggle" class="orientation-toggle" @click="handleToggle">
    <svg
      v-if="currentMode === 'portrait'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
    <svg
      v-else
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
    <span class="orientation-toggle__label">{{ currentMode === 'portrait' ? '竖屏' : '横屏' }}</span>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import {
  toggleOrientation,
  canSwitchOrientation,
  getCurrentDisplayMode,
  initOrientationSystem
} from '../utils/orientationControl.js'
import { info, warn, error, LogCategory } from '../utils/logger.js'

const showToggle = ref(false)
const currentMode = ref('portrait')

// Check if switching is allowed (desktop only)
function checkSwitchPermission() {
  const allowed = canSwitchOrientation()
  showToggle.value = allowed
  info(LogCategory.UI, 'Orientation toggle visibility check', { allowed })
}

// Update current mode display
function updateCurrentMode() {
  currentMode.value = getCurrentDisplayMode()
}

// Handle toggle click
function handleToggle() {
  if (!canSwitchOrientation()) {
    warn(LogCategory.UI, 'Cannot toggle orientation on mobile devices')
    return
  }
  
  info(LogCategory.UI, 'Toggle button clicked')
  const success = toggleOrientation()
  
  if (success) {
    updateCurrentMode()
    info(LogCategory.UI, 'Orientation toggled successfully')
  } else {
    error(LogCategory.UI, 'Failed to toggle orientation')
  }
}

// Listen for orientation changes
function handleOrientationChange() {
  updateCurrentMode()
}

onMounted(() => {
  info(LogCategory.UI, 'OrientationToggle mounted')
  checkSwitchPermission()
  updateCurrentMode()
  
  // Listen for orientation changes
  window.addEventListener('orientationchange', handleOrientationChange)
  window.addEventListener('resize', handleOrientationChange)
})

onUnmounted(() => {
  info(LogCategory.UI, 'OrientationToggle unmounted')
  window.removeEventListener('orientationchange', handleOrientationChange)
  window.removeEventListener('resize', handleOrientationChange)
})
</script>

<style scoped>
.orientation-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.05);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  color: #666;
  font-size: 12px;
  gap: 4px;
}

.orientation-toggle:hover {
  background: rgba(0, 0, 0, 0.1);
}

.orientation-toggle:active {
  background: rgba(0, 0, 0, 0.15);
}

.orientation-toggle svg {
  width: 16px;
  height: 16px;
}

.orientation-toggle__label {
  font-weight: 500;
}

/* Desktop-specific styling */
@media (min-width: 768px) {
  .orientation-toggle {
    padding: 10px 16px;
    font-size: 14px;
  }

  .orientation-toggle svg {
    width: 20px;
    height: 20px;
  }
}
</style>
