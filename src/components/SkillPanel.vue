<template>
  <div class="skill-panel">
    <header class="skill-panel__header">
      <h3>写作技能</h3>
      <button type="button" class="skill-panel__close" aria-label="关闭" @click="$emit('close')">✕</button>
    </header>

    <div class="skill-panel__body">
      <p class="skill-panel__hint">
        选择技能后，AI 助手将自动应用对应的写作方法论。
      </p>

      <!-- 自动匹配结果 -->
      <div v-if="autoMatch" class="skill-panel__auto">
        <span class="skill-panel__auto-label">自动匹配</span>
        <div class="skill-panel__auto-result">
          <span class="skill-panel__auto-name">{{ autoMatch.skill.name }}</span>
          <span class="skill-panel__auto-desc">{{ autoMatch.skill.description.slice(0, 80) }}…</span>
        </div>
      </div>

      <!-- 技能列表 -->
      <div class="skill-panel__list">
        <div
          v-for="skill in skills"
          :key="skill.id"
          class="skill-card"
          :class="{ 'skill-card--active': activeSkillId === skill.id }"
          @click="selectSkill(skill.id)"
        >
          <div class="skill-card__header">
            <span class="skill-card__name">{{ skill.name }}</span>
            <span v-if="activeSkillId === skill.id" class="skill-card__badge">使用中</span>
          </div>
          <p class="skill-card__desc">{{ skill.description }}</p>
          <div class="skill-card__triggers">
            <span v-for="t in skill.triggers.slice(0, 4)" :key="t" class="skill-card__trigger">{{ t }}</span>
          </div>
        </div>
      </div>
    </div>

    <footer class="skill-panel__footer">
      <label class="skill-panel__auto-toggle">
        <input
          type="checkbox"
          :checked="autoTriggerEnabled"
          @change="toggleAutoTrigger"
        />
        <span>自动选择（根据输入内容智能匹配）</span>
      </label>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { SKILLS, matchSkill, setActiveSkills } from '../composables/useSkillRegistry.js'

const props = defineProps({
  /** 当前用户输入，用于自动匹配 */
  inputText: { type: String, default: '' }
})

const emit = defineEmits(['close', 'select'])

const skills = SKILLS
const activeSkillId = ref(null)
const autoTriggerEnabled = ref(true)
const autoMatch = computed(() => matchSkill(props.inputText))

onMounted(() => {
  // 默认选中第一个 skill
  if (!activeSkillId.value && skills.length > 0) {
    activeSkillId.value = skills[0].id
  }
})

function selectSkill(id) {
  activeSkillId.value = id
  emit('select', id)
}

function toggleAutoTrigger(e) {
  autoTriggerEnabled.value = e.target.checked
  if (autoTriggerEnabled.value) {
    // 自动模式下，根据输入匹配
    if (autoMatch.value) {
      activeSkillId.value = autoMatch.value.skill.id
    }
  } else {
    // 手动模式下，保存当前选择
    setActiveSkills([activeSkillId.value])
  }
}
</script>

<style scoped>
.skill-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 88%;
  max-width: 400px;
  z-index: 103;
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border-left: 1px solid var(--border);
  box-shadow: -16px 0 48px rgba(0, 0, 0, 0.3);
}

.skill-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(14px + var(--safe-top)) 16px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
}

.skill-panel__header h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  background: linear-gradient(105deg, var(--text) 0%, var(--accent) 70%, var(--accent-2) 120%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.skill-panel__close {
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
  font-size: 1rem;
}

.skill-panel__close:hover {
  background: var(--accent-soft);
  color: var(--accent);
}

.skill-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.skill-panel__hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0 0 12px;
}

.skill-panel__auto {
  padding: 10px 12px;
  background: var(--accent-soft);
  border-radius: 10px;
  margin-bottom: 12px;
}

.skill-panel__auto-label {
  font-size: 0.7rem;
  color: var(--accent);
  font-weight: 600;
  display: block;
  margin-bottom: 4px;
}

.skill-panel__auto-result {
  display: flex;
  align-items: center;
  gap: 8px;
}

.skill-panel__auto-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
}

.skill-panel__auto-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-panel__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skill-card {
  padding: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s;
}

.skill-card:hover {
  border-color: var(--border-strong);
}

.skill-card--active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.skill-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.skill-card__name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
}

.skill-card__badge {
  font-size: 0.65rem;
  padding: 2px 8px;
  background: var(--accent);
  color: #fff;
  border-radius: 10px;
}

.skill-card__desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0 0 8px;
}

.skill-card__triggers {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.skill-card__trigger {
  font-size: 0.65rem;
  padding: 2px 6px;
  background: var(--bg-soft);
  color: var(--text-muted);
  border-radius: 6px;
}

.skill-panel__footer {
  padding: 12px 16px calc(12px + var(--safe-bottom));
  border-top: 1px solid var(--border);
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
}

.skill-panel__auto-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  cursor: pointer;
}
</style>
