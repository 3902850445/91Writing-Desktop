<template>
  <div class="global-assistant">
    <!-- 悬浮按钮 -->
    <button
      type="button"
      class="ga-fab"
      :class="{ 'ga-fab--open': open }"
      :aria-label="modelTested ? 'AI 助手' : 'AI 助手（未测试）'"
      @click="toggleOpen"
    >
      <span v-if="!modelTested" class="ga-fab__badge">!</span>
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
          <div class="ga-header__actions">
            <button
              v-if="activeSkillId"
              type="button"
              class="ga-skill-badge"
              @click="showSkillPanel = true"
            >
              {{ getSkillName(activeSkillId) }}
            </button>
            <button
              type="button"
              class="ga-icon-btn"
              aria-label="选择技能"
              @click="showSkillPanel = true"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </button>
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
          </div>
        </header>

        <!-- 模型测试状态 -->
        <div v-if="!modelTested" class="ga-test-bar">
          <div class="ga-test-bar__info">
            <span class="ga-test-bar__icon">⚠</span>
            <span>模型未测试，请先验证 API 连接</span>
          </div>
          <button
            type="button"
            class="ga-btn ga-btn--primary ga-btn--sm"
            :disabled="modelTestLoading"
            @click="onTestModel"
          >
            {{ modelTestLoading ? '测试中…' : '测试连接' }}
          </button>
        </div>
        <div v-else-if="modelTestError" class="ga-test-bar ga-test-bar--error">
          <span class="ga-test-bar__icon">✕</span>
          <span>{{ modelTestError }}</span>
          <button type="button" class="ga-btn ga-btn--ghost ga-btn--sm" @click="onTestModel">重试</button>
        </div>
        <div v-else class="ga-test-bar ga-test-bar--ok">
          <span class="ga-test-bar__icon">✓</span>
          <span>模型连接正常</span>
        </div>

        <!-- 快捷指令 -->
        <div class="ga-quick">
          <button
            v-for="action in quickActions"
            :key="action.label"
            type="button"
            class="ga-chip"
            :disabled="busy || !modelTested"
            @click="sendQuick(action.label)"
          >
            {{ action.label }}
          </button>
        </div>

        <!-- 文件加载区 -->
        <div class="ga-files">
          <div class="ga-files__header">
            <span class="ga-files__label">已加载文件（{{ loadedFiles.length }}）</span>
            <label class="ga-files__add">
              <input
                ref="fileInputRef"
                type="file"
                multiple
                accept=".md,.txt,.docx,.markdown"
                style="display: none"
                @change="onFileSelect"
              />
              <span>+ 添加文件</span>
            </label>
          </div>
          <div v-if="loadedFiles.length === 0" class="ga-files__empty">
            支持 .md / .txt / .docx，作为 AI 对话参考素材
          </div>
          <div v-else class="ga-files__list">
            <div v-for="f in loadedFiles" :key="f.id" class="ga-file-item">
              <span class="ga-file-item__name">{{ f.name }}</span>
              <span class="ga-file-item__size">{{ formatSize(f.size) }}</span>
              <button
                type="button"
                class="ga-file-item__remove"
                aria-label="移除文件"
                @click="removeFile(f.id)"
              >✕</button>
            </div>
          </div>
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

        <!-- 待审核设定提案 -->
        <div v-if="pendingSettings.filter(p => p.status === 'pending').length > 0" class="ga-proposals">
          <div class="ga-proposals__title">待审核设定修改</div>
          <div
            v-for="p in pendingSettings.filter(item => item.status === 'pending')"
            :key="p.id"
            class="ga-proposal"
          >
            <div class="ga-proposal__instruction">{{ p.instruction }}</div>
            <details class="ga-proposal__detail">
              <summary>修改对比</summary>
              <div class="ga-proposal__compare">
                <div class="ga-proposal__col">
                  <span class="ga-proposal__label">当前</span>
                  <pre>{{ JSON.stringify(p.currentSettings, null, 2) }}</pre>
                </div>
                <div class="ga-proposal__col">
                  <span class="ga-proposal__label">提议</span>
                  <pre>{{ JSON.stringify(p.proposedSettings, null, 2) }}</pre>
                </div>
              </div>
            </details>
            <div class="ga-proposal__actions">
              <button
                type="button"
                class="ga-btn ga-btn--primary ga-btn--sm"
                @click="approveProposal(p.id)"
              >通过</button>
              <button
                type="button"
                class="ga-btn ga-btn--danger ga-btn--sm"
                @click="rejectProposal(p.id)"
              >拒绝</button>
            </div>
          </div>
        </div>

        <!-- 输入区 -->
        <footer class="ga-input-area">
          <textarea
            v-model="inputText"
            class="ga-input"
            rows="1"
            :placeholder="modelTested ? '输入问题…' : '请先测试模型连接'"
            :disabled="!modelTested"
            @keydown.enter.exact.prevent="onEnter"
          />
          <button
            type="button"
            class="ga-send-btn"
            :disabled="!inputText.trim() || busy || !modelTested"
            @click="onEnter"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </footer>

        <!-- 设定修改快捷入口 -->
        <div v-if="currentNovel && modelTested" class="ga-settings-bar">
          <button
            type="button"
            class="ga-btn ga-btn--ghost ga-btn--sm"
            :disabled="busy"
            @click="onProposeSettings"
          >
            AI 修改全局设定
          </button>
        </div>
      </div>
    </Transition>

    <!-- 遮罩 -->
    <Transition name="ga-fade">
      <div v-if="open" class="ga-mask" @click="setOpen(false)" />
    </Transition>

    <!-- Skill 选择面板 -->
    <Transition name="ga-slide">
      <SkillPanel
        v-if="showSkillPanel"
        :input-text="inputText"
        @close="showSkillPanel = false"
        @select="onSkillSelect"
      />
    </Transition>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import { useGlobalChat } from '../composables/useGlobalChat.js'
import { getSkillById } from '../composables/useSkillRegistry.js'
import SkillPanel from './SkillPanel.vue'

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
  setOpen,
  testModel,
  modelTested,
  modelTestError,
  modelTestLoading,
  loadedFiles,
  loadFiles,
  removeFile,
  pendingSettings,
  proposeSettingsChange,
  approveProposal,
  rejectProposal,
  activeSkillId
} = useGlobalChat()

const inputText = ref('')
const msgListRef = ref(null)
const fileInputRef = ref(null)
const showSkillPanel = ref(false)

function getSkillName(id) {
  const skill = getSkillById(id)
  return skill ? skill.name : ''
}

function onSkillSelect(id) {
  showSkillPanel.value = false
}

function renderContent(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

function formatSize(bytes) {
  if (!bytes) return '0B'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

async function onTestModel() {
  const result = await testModel()
  if (result.success) {
    // 测试成功后自动发一条欢迎消息
    await send('模型连接测试成功！现在可以开始对话了。')
  }
}

async function onEnter() {
  const text = inputText.value.trim()
  if (!text || busy.value || !modelTested.value) return
  inputText.value = ''
  try {
    await send(text)
    await scrollToBottom()
  } catch (e) {
    console.error('全局助手发送失败:', e)
  }
}

async function onFileSelect(e) {
  const files = Array.from(e.target.files || [])
  if (files.length === 0) return
  const result = await loadFiles(files)
  if (result.success) {
    // 清空 input 以便重复选择同名文件
    e.target.value = ''
  }
}

async function onProposeSettings() {
  const instruction = '请分析当前小说的设定，提出可以丰富世界观和角色设定的建议，以 JSON 格式输出修改后的全局设定。'
  const result = await proposeSettingsChange(instruction)
  if (result.success) {
    // 滚动到提案区域
    await nextTick()
    scrollToBottom()
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

watch(
  () => messages.value.length,
  () => scrollToBottom()
)

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

.ga-fab__badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--danger);
  color: #fff;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  border: 2px solid var(--bg);
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

.ga-header__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.ga-skill-badge {
  padding: 3px 10px;
  border: 1px solid var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
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

/* 模型测试状态条 */
.ga-test-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 16px;
  font-size: 0.8rem;
  border-bottom: 1px solid var(--border);
}

.ga-test-bar__info {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--warning);
}

.ga-test-bar--ok {
  color: var(--success);
}

.ga-test-bar--error {
  color: var(--danger);
}

.ga-test-bar__icon {
  font-weight: 700;
}

/* 通用按钮 */
.ga-btn {
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 6px 12px;
  transition: opacity 0.18s, transform 0.12s;
}

.ga-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ga-btn--sm {
  padding: 4px 10px;
  font-size: 0.75rem;
}

.ga-btn--primary {
  background: var(--grad-primary);
  color: #fff;
}

.ga-btn--ghost {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
}

.ga-btn--danger {
  background: var(--danger);
  color: #fff;
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

/* 文件加载区 */
.ga-files {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
}

.ga-files__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.ga-files__label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.ga-files__add {
  font-size: 0.75rem;
  color: var(--accent);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.ga-files__empty {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
  padding: 4px 0;
}

.ga-files__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ga-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: var(--bg-card);
  border-radius: 8px;
  font-size: 0.75rem;
}

.ga-file-item__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
}

.ga-file-item__size {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.ga-file-item__remove {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 4px;
  font-size: 0.7rem;
}

.ga-file-item__remove:hover {
  background: var(--danger);
  color: #fff;
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

/* 设定提案 */
.ga-proposals {
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  max-height: 200px;
  overflow-y: auto;
}

.ga-proposals__title {
  font-size: 0.75rem;
  color: var(--warning);
  margin-bottom: 8px;
  font-weight: 600;
}

.ga-proposal {
  padding: 8px 10px;
  background: var(--bg-card);
  border-radius: 10px;
  margin-bottom: 8px;
  border: 1px solid var(--border);
}

.ga-proposal__instruction {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.ga-proposal__detail {
  font-size: 0.75rem;
}

.ga-proposal__detail summary {
  cursor: pointer;
  color: var(--accent);
  margin-bottom: 4px;
}

.ga-proposal__compare {
  display: flex;
  gap: 8px;
}

.ga-proposal__col {
  flex: 1;
}

.ga-proposal__label {
  font-size: 0.7rem;
  color: var(--text-muted);
  display: block;
  margin-bottom: 2px;
}

.ga-proposal__col pre {
  font-size: 0.7rem;
  overflow-x: auto;
  max-height: 120px;
  padding: 4px;
  background: var(--bg-elevated);
  border-radius: 6px;
  color: var(--text-muted);
  margin: 0;
}

.ga-proposal__actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

/* 设定修改快捷入口 */
.ga-settings-bar {
  padding: 8px 16px;
  border-top: 1px solid var(--border);
  text-align: center;
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

.ga-input:disabled {
  opacity: 0.5;
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
