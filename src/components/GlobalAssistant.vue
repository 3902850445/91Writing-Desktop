<template>
  <div class="global-assistant">
    <!-- 悬浮按钮 -->
    <button
      type="button"
      class="ga-fab"
      :class="{ 'ga-fab--open': open }"
      aria-label="AI 助手"
      @click="toggleOpen"
    >
      <svg v-if="!open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2a3 3 0 0 1 3 3v1h1a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3h-1v1a3 3 0 0 1-3 3v0a3 3 0 0 1-3-3v-1H8a3 3 0 0 1-3-3v0a3 3 0 0 1 3-3h1V5a3 3 0 0 1 3-3z" />
        <circle cx="12" cy="12" r="2" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>

    <!-- 侧边抽屉 -->
    <Transition name="ga-slide">
      <div v-if="open" class="ga-drawer" role="dialog" aria-label="AI 对话">
        <header class="ga-header">
          <div class="ga-header__title">
            <h3>AI 助手</h3>
            <span v-if="currentNovel" class="ga-header__novel">
              《{{ currentNovel.title }}》
            </span>
            <span v-else class="ga-header__novel ga-header__novel--muted">
              全局对话
            </span>
          </div>
          <button
            type="button"
            class="ga-icon-btn"
            aria-label="清空对话"
            @click="clearChat"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            </svg>
          </button>
        </header>

        <!-- 快捷指令 -->
        <div class="ga-quick">
          <button
            v-for="action in quickActions"
            :key="action.label"
            type="button"
            class="ga-chip"
            :disabled="busy"
            @click="sendQuick(action.label)"
          >
            {{ action.label }}
          </button>
        </div>

        <!-- 消息列表 -->
        <div ref="msgListRef" class="ga-messages">
          <div v-if="messages.length === 0" class="ga-empty">
            <p>你好！我是你的 AI 写作助手。</p>
            <p v-if="currentNovel">
              当前关联小说《{{ currentNovel.title }}》，我可以帮你续写、润色、分析角色。
            </p>
            <p v-else>
              在写作页打开时，我会自动关联当前小说上下文。
            </p>
            <p class="ga-empty__hint">试试上方快捷指令，或直接输入问题。</p>
          </div>

          <div
            v-for="msg in messages"
            :key="msg.id"
            class="ga-msg"
            :class="msg.role === 'user' ? 'ga-msg--user' : 'ga-msg--ai'"
          >
            <div class="ga-msg__role">
              {{ msg.role === 'user' ? '我' : 'AI' }}
            </div>
            <div class="ga-msg__content" v-html="renderContent(msg.content)" />
          </div>

          <div v-if="busy" class="ga-msg ga-msg--ai ga-msg--busy">
            <div class="ga-msg__role">AI</div>
            <div class="ga-msg__content">
              <span class="ga-dot" />
              <span class="ga-dot" />
              <span class="ga-dot" />
            </div>
          </div>
        </div>

        <!-- 输入区 -->
        <footer class="ga-input-area">
          <textarea
            v-model="inputText"
            class="ga-input"
            rows="1"
            placeholder="输入问题…"
            @keydown.enter.exact.prevent="onEnter"
          />
          <button
            type="button"
            class="ga-send-btn"
            :disabled="!inputText.trim() || busy"
            @click="onEnter"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </footer>
      </div>
    </Transition>

    <!-- 遮罩 -->
    <Transition name="ga-fade">
      <div v-if="open" class="ga-mask" @click="setOpen(false)" />
    </Transition>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import { useGlobalChat } from '../composables/useGlobalChat.js'

const {
  messages,
  busy,
  open,
  currentNovel,
  quickActions,
  send,
  sendQuick,
  clear,
  toggleOpen,
  setOpen
} = useGlobalChat()

const inputText = ref('')
const msgListRef = ref(null)

function renderContent(text) {
  // 简单换行处理
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

async function onEnter() {
  const text = inputText.value.trim()
  if (!text || busy.value) return
  inputText.value = ''
  try {
    await send(text)
    await scrollToBottom()
  } catch (e) {
    console.error('全局助手发送失败:', e)
  }
}

function clearChat() {
  if (!messages.value.length) return
  if (confirm('清空所有对话记录？')) {
    clear()
  }
}

async function scrollToBottom() {
  await nextTick()
  const el = msgListRef.value
  if (el) el.scrollTop = el.scrollHeight
}

// 新消息时自动滚到底
watch(
  () => messages.value.length,
  () => scrollToBottom()
)

// 抽屉打开时滚到底
watch(open, (v) => {
  if (v) scrollToBottom()
})
</script>

<style scoped>
.global-assistant {
  position: fixed;
  z-index: 100;
  pointer-events: none;
}

/* 悬浮按钮 */
.ga-fab {
  position: fixed;
  right: 18px;
  bottom: calc(78px + var(--safe-bottom));
  z-index: 101;
  width: 54px;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--grad-primary);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(124, 58, 237, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s, box-shadow 0.2s;
  pointer-events: auto;
}

.ga-fab:hover {
  transform: scale(1.06);
  box-shadow: 0 12px 32px rgba(124, 58, 237, 0.5);
}

.ga-fab:active {
  transform: scale(0.95);
}

.ga-fab svg {
  width: 26px;
  height: 26px;
}

.ga-fab--open {
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  color: var(--text);
}

/* 侧边抽屉 */
.ga-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 88%;
  max-width: 400px;
  z-index: 102;
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border-left: 1px solid var(--border);
  box-shadow: -16px 0 48px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
}

.ga-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(14px + var(--safe-top)) 16px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.ga-header__title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.ga-header__title h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  background: linear-gradient(105deg, var(--text) 0%, var(--accent) 70%, var(--accent-2) 120%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.ga-header__novel {
  font-size: 0.75rem;
  color: var(--accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ga-header__novel--muted {
  color: var(--text-muted);
}

.ga-icon-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.18s, color 0.18s;
  flex-shrink: 0;
}

.ga-icon-btn:hover {
  background: var(--accent-soft);
  color: var(--accent);
}

.ga-icon-btn svg {
  width: 18px;
  height: 18px;
}

/* 快捷指令 */
.ga-quick {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  overflow-x: auto;
  border-bottom: 1px solid var(--border);
  -webkit-overflow-scrolling: touch;
}

.ga-chip {
  flex-shrink: 0;
  padding: 6px 14px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  border-radius: 20px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.18s, color 0.18s, border-color 0.18s;
}

.ga-chip:hover:not(:disabled) {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--border-strong);
}

.ga-chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 消息列表 */
.ga-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  -webkit-overflow-scrolling: touch;
}

.ga-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
}

.ga-empty p {
  margin: 0 0 8px;
  font-size: 0.9rem;
  line-height: 1.6;
}

.ga-empty__hint {
  margin-top: 16px !important;
  font-size: 0.8rem !important;
  color: var(--accent);
}

.ga-msg {
  margin-bottom: 14px;
  animation: ga-msg-in 0.25s ease;
}

@keyframes ga-msg-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.ga-msg__role {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-bottom: 4px;
  font-weight: 600;
}

.ga-msg--user .ga-msg__role {
  text-align: right;
}

.ga-msg__content {
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 0.9rem;
  line-height: 1.6;
  word-break: break-word;
}

.ga-msg--ai .ga-msg__content {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text);
  border-top-left-radius: 4px;
}

.ga-msg--user .ga-msg__content {
  background: var(--accent-soft);
  color: var(--text);
  border-top-right-radius: 4px;
}

.ga-msg--busy .ga-msg__content {
  display: flex;
  gap: 4px;
  align-items: center;
}

.ga-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: ga-bounce 1.2s infinite ease-in-out;
}

.ga-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.ga-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes ga-bounce {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 输入区 */
.ga-input-area {
  display: flex;
  gap: 8px;
  padding: 12px 16px calc(12px + var(--safe-bottom));
  border-top: 1px solid var(--border);
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.ga-input {
  flex: 1;
  min-height: 38px;
  max-height: 100px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text);
  border-radius: 10px;
  font-size: 0.9rem;
  font-family: var(--font);
  resize: none;
  outline: none;
  transition: border-color 0.18s;
}

.ga-input:focus {
  border-color: var(--accent);
}

.ga-send-btn {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 10px;
  background: var(--grad-primary);
  color: #fff;
  cursor: pointer;
  transition: transform 0.12s, opacity 0.18s;
  flex-shrink: 0;
}

.ga-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ga-send-btn:not(:disabled):active {
  transform: scale(0.92);
}

.ga-send-btn svg {
  width: 20px;
  height: 20px;
}

/* 遮罩 */
.ga-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.4);
  pointer-events: auto;
}

/* 过渡 */
.ga-slide-enter-active,
.ga-slide-leave-active {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.ga-slide-enter-from,
.ga-slide-leave-to {
  transform: translateX(100%);
}

.ga-fade-enter-active,
.ga-fade-leave-active {
  transition: opacity 0.28s ease;
}

.ga-fade-enter-from,
.ga-fade-leave-to {
  opacity: 0;
}
</style>
