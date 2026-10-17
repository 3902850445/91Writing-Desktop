<template>
  <div
    class="m-writer"
    :class="{
      'is-reading': prefs.readingMode,
      [`paper-${prefs.writerPaper || 'default'}`]: true
    }"
  >
    <header class="m-writer__top">
      <button type="button" class="m-icon-btn" aria-label="返回" @click="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button type="button" class="m-icon-btn" aria-label="章节" @click="drawerOpen = true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      </button>
      <div class="m-writer__title">
        <h2>{{ novel?.title || '写作' }}</h2>
        <span
          >{{ chapter?.title || '未选章节' }} · {{ wordCount }} 字
          <template v-if="chapterGoal"> / {{ chapterGoal }}</template>
          <template v-if="prefs.showSessionStats"> · 本次 {{ sessionDeltaLabel }}</template></span
        >
      </div>
      <button type="button" class="m-icon-btn" aria-label="更多" @click="showMore = true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </button>
      <button
        type="button"
        class="m-icon-btn"
        :disabled="saving || !dirty"
        aria-label="保存"
        @click="saveNow()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
      </button>
    </header>

    <div v-if="!novel" class="m-empty" style="flex: 1">
      <div class="m-empty__icon">⚠️</div>
      <h3>找不到作品</h3>
      <button type="button" class="m-btn m-btn--primary" @click="$router.replace('/')">回书架</button>
    </div>

    <template v-else>
      <div class="m-writer__editor-wrap">
        <textarea
          ref="editorEl"
          :value="draft"
          class="m-writer__textarea"
          :placeholder="isStreaming ? 'AI 生成中…' : '开始写作，或选中文字后点润色/扩写…'"
          :readonly="isStreaming"
          spellcheck="false"
          @beforeinput="onBeforeInput"
          @compositionstart="onCompositionStart"
          @compositionend="onCompositionEnd"
          @input="onEditorInput"
          @select="captureSelection"
          @keyup="captureSelection"
          @mouseup="captureSelection"
          @touchend="captureSelection"
        />
        <div v-if="streamPreview && (aiMode === 'polish' || aiMode === 'expand' || aiMode === 'sel-polish' || aiMode === 'sel-expand')" class="m-writer__stream">
          {{ streamPreview }}
        </div>
      </div>

      <div class="m-writer__toolbar">
        <div v-if="chapterGoal" class="m-writer__goal">
          <div class="m-progress" style="margin: 0">
            <div class="m-progress__bar" :style="{ width: chapterGoalPct + '%' }" />
          </div>
          <span class="m-muted" style="font-size: 0.72rem"
            >本章目标 {{ wordCount }}/{{ chapterGoal }}（{{ chapterGoalPct }}% · {{ chapterGoalSource }}）</span
          >
        </div>
        <div
          v-if="dailyGoal && prefs.showSessionStats"
          class="m-writer__goal m-writer__goal--daily"
          role="button"
          tabindex="0"
          @click="$router.push('/goals')"
          @keydown.enter.prevent="$router.push('/goals')"
        >
          <div class="m-progress" style="margin: 0">
            <div
              class="m-progress__bar m-progress__bar--daily"
              :style="{ width: dailyGoal.pct + '%' }"
            />
          </div>
          <span class="m-muted" style="font-size: 0.72rem">
            今日 {{ dailyGoal.progress }}/{{ dailyGoal.target }} 字（{{ dailyGoal.pct }}%
            <template v-if="sessionDelta > 0"> · 本段 +{{ sessionDelta }}</template>
            <template v-if="weekRemainHint"> · {{ weekRemainHint }}</template>）
          </span>
        </div>
        <div class="m-writer__status">
          <span>{{ saveHint }}</span>
          <span v-if="isStreaming" style="color: var(--accent-2)">
            生成中 {{ streamWords }} 字 · 可停止
          </span>
          <span v-else-if="hasSelection" style="color: var(--accent-2)">已选 {{ selectionLen }} 字</span>
          <span v-else-if="!isConfigured" style="color: var(--warning)">未配置 API</span>
          <span v-else-if="useContext" style="color: var(--success)">已带设定</span>
          <span v-if="pomodoroLabel" style="color: var(--accent-2)">⏱ {{ pomodoroLabel }}</span>
          <span v-if="prefs.showSessionStats && !isStreaming" class="m-muted">
            {{ sessionElapsedLabel }}
          </span>
          <button
            v-if="openTodoCount && !isStreaming"
            type="button"
            class="m-writer__todo-chip"
            @click="openTodos"
          >
            待办 {{ openTodoCount }}
          </button>
        </div>
        <div class="m-writer__tools">
          <button
            v-if="isStreaming"
            type="button"
            class="m-btn m-btn--danger m-btn--sm"
            @click="stopStream"
          >
            停止
          </button>
          <template v-else>
            <button type="button" class="m-btn m-btn--primary m-btn--sm" @click="runAi('continue')">
              AI 续写
            </button>
            <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="runAi('polish')">
              {{ hasSelection ? '润色选区' : '润色' }}
            </button>
            <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="runAi('expand')">
              {{ hasSelection ? '扩写选区' : '扩写' }}
            </button>
            <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="openFind">
              查找
            </button>
            <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="openBookSearch">
              全书
            </button>
            <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="openPromptPick">
              提示词
            </button>
            <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="openInsertChar">
              角色
            </button>
            <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="openInspiration">
              灵感
            </button>
            <button
              type="button"
              class="m-btn m-btn--ghost m-btn--sm"
              :disabled="!undoStack.length"
              @click="undoLast"
            >
              撤销
            </button>
            <button
              type="button"
              class="m-btn m-btn--ghost m-btn--sm"
              :disabled="!redoStack.length"
              @click="redoLast"
            >
              重做
            </button>
            <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="openPromptSheet">
              自定义
            </button>
            <button
              type="button"
              class="m-btn m-btn--ghost m-btn--sm"
              :disabled="!canPrevChapter"
              @click="goAdjacentChapter(-1)"
            >
              上章
            </button>
            <button
              type="button"
              class="m-btn m-btn--ghost m-btn--sm"
              :disabled="!canNextChapter"
              @click="goAdjacentChapter(1)"
            >
              下章
            </button>
          </template>
        </div>
      </div>
    </template>

    <!-- chapter drawer -->
    <div class="m-drawer-mask" :class="{ 'is-open': drawerOpen }" @click="drawerOpen = false" />
    <aside class="m-drawer" :class="{ 'is-open': drawerOpen }">
      <div class="m-drawer__head">
        <h3>章节</h3>
        <button type="button" class="m-btn m-btn--primary m-btn--sm" @click="addNewChapter">+ 新章</button>
        <button
          type="button"
          class="m-btn m-btn--ghost m-btn--sm"
          title="新建下章并用 AI 开写"
          @click="newChapterAndContinue"
        >
          AI开写
        </button>
        <button type="button" class="m-icon-btn" @click="drawerOpen = false">✕</button>
      </div>
      <div class="m-drawer__filter">
        <input
          v-model="chapterFilter"
          class="m-input"
          type="search"
          placeholder="筛选章节标题…"
          enterkeyhint="search"
        />
      </div>
      <div class="m-drawer__list">
        <div
          v-for="row in filteredChapterRows"
          :key="row.c.id"
          class="m-chapter-item"
          :class="{ 'is-active': String(row.c.id) === String(chapterId) }"
        >
          <button
            type="button"
            class="m-chapter-item__main"
            @click="selectChapter(row.c.id)"
            @contextmenu.prevent="openChapterQuick(row.c, row.i)"
            @touchstart.passive="onChapterTouchStart(row.c, row.i, $event)"
            @touchend.passive="onChapterTouchEnd"
            @touchmove.passive="onChapterTouchEnd"
          >
            <div class="m-chapter-item__title">
              <span
                class="m-chapter-dot"
                :class="{ 'is-empty': !(row.c.wordCount || 0) }"
                aria-hidden="true"
              />
              {{ row.i + 1 }}. {{ row.c.title }}
            </div>
            <div class="m-chapter-item__meta">
              {{ row.c.wordCount || 0 }} 字
              <template v-if="row.c.wordGoal">
                · 目标 {{ row.c.wordGoal }}
                <span
                  v-if="(row.c.wordCount || 0) >= row.c.wordGoal"
                  style="color: var(--success)"
                >✓</span>
              </template>
              <template v-if="(row.c.todos || []).some((x) => !x.done)">
                · 待办 {{ (row.c.todos || []).filter((x) => !x.done).length }}
              </template>
            </div>
          </button>
          <div class="m-chapter-item__ops">
            <button type="button" class="m-chip-btn" :disabled="row.i === 0" @click="moveCh(row.c.id, 'up')">
              ↑
            </button>
            <button
              type="button"
              class="m-chip-btn"
              :disabled="row.i === chapters.length - 1"
              @click="moveCh(row.c.id, 'down')"
            >
              ↓
            </button>
            <button type="button" class="m-chip-btn" @click="renameChapter(row.c)">✎</button>
            <button
              v-if="isChapterEmpty(row.c)"
              type="button"
              class="m-chip-btn m-chip-btn--ai"
              :disabled="isStreaming || batchRunning || fillingChapterId === row.c.id"
              title="AI 填写本章"
              @click.stop="aiFillChapter(row.c)"
            >
              {{ fillingChapterId === row.c.id ? '…' : 'AI' }}
            </button>
          </div>
        </div>
        <div v-if="!filteredChapterRows.length" class="m-empty" style="padding: 24px 8px">
          <p>{{ chapters.length ? '无匹配章节' : '暂无章节' }}</p>
        </div>
      </div>
      <div style="padding: 10px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px">
        <button type="button" class="m-btn m-btn--ghost m-btn--block m-btn--sm" @click="exportChapter">
          导出本章
        </button>
        <button type="button" class="m-btn m-btn--ghost m-btn--block m-btn--sm" @click="exportBook">
          导出全书
        </button>
        <button
          type="button"
          class="m-btn m-btn--danger m-btn--block m-btn--sm"
          :disabled="!chapterId"
          @click="removeChapter"
        >
          删除当前章节
        </button>
      </div>
    </aside>

    <!-- more menu -->
    <div v-if="showMore" class="m-sheet-mask" @click.self="showMore = false">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">作品与设定</h2>
        <div class="m-list-actions">
          <button type="button" class="m-action-row" @click="openNovelEdit">编辑作品信息</button>
          <button type="button" class="m-action-row" @click="goExtras">世界观 / 角色 / 语料 / 事件</button>
          <button type="button" class="m-action-row" @click="toggleContext">
            AI 引用设定：{{ useContext ? '开' : '关' }}
          </button>
          <button type="button" class="m-action-row" @click="toggleReading">
            阅读模式：{{ prefs.readingMode ? '开' : '关' }}
          </button>
          <button type="button" class="m-action-row" @click="openFind">查找 / 替换</button>
          <button type="button" class="m-action-row" @click="openBookSearch">全书搜索</button>
          <button type="button" class="m-action-row" @click="takeSnapshot">保存章节快照</button>
          <button type="button" class="m-action-row" @click="openSnapshots">恢复 / 对比快照…</button>
          <button type="button" class="m-action-row" @click="generateChapterSummary">
            {{ summarizing ? '摘要生成中…' : '生成本章摘要' }}
          </button>
          <button type="button" class="m-action-row" @click="openOutlineImport">大纲导入章节</button>
          <button type="button" class="m-action-row" @click="newChapterAndContinue">
            新建下章并 AI 开写
          </button>
          <button type="button" class="m-action-row" @click="openInspiration">灵感骰子</button>
          <button type="button" class="m-action-row" @click="openChat">AI 对话助手</button>
          <button type="button" class="m-action-row" @click="openBatchGen">批量生成空章</button>
          <button type="button" class="m-action-row" @click="runConsistency">一致性检查</button>
          <button type="button" class="m-action-row" @click="exportChapter">导出本章 TXT</button>
          <button type="button" class="m-action-row" @click="exportBook">导出全书 TXT</button>
          <button type="button" class="m-action-row" @click="exportBookMd">导出全书 Markdown</button>
          <button type="button" class="m-action-row" @click="exportBookEpub">导出全书 EPUB</button>
          <button type="button" class="m-action-row" @click="openChapterMeta">章节设置（标题 / 目标 / 备注）</button>
          <button type="button" class="m-action-row" @click="openTodos">
            本章待办{{ openTodoCount ? `（${openTodoCount}）` : '' }}
          </button>
          <button type="button" class="m-action-row" @click="openBookTodos">
            全书待办看板{{ bookOpenTodoCount ? `（${bookOpenTodoCount}）` : '' }}
          </button>
          <button type="button" class="m-action-row" @click="togglePomodoro">
            专注计时：{{ prefs.pomodoroMinutes ? prefs.pomodoroMinutes + ' 分钟' : '关' }}
          </button>
          <div v-if="profiles.length" class="m-field" style="padding: 8px 12px">
            <label>模型档案</label>
            <select class="m-select" :value="activeProfileId" @change="onProfileChange($event.target.value)">
              <option value="">当前设置</option>
              <option v-for="p in profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
        </div>
        <button type="button" class="m-btn m-btn--ghost m-btn--block" style="margin-top: 12px" @click="showMore = false">
          关闭
        </button>
      </div>
    </div>

    <!-- novel edit -->
    <div v-if="showNovelEdit" class="m-sheet-mask" @click.self="showNovelEdit = false">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">作品信息</h2>
        <div class="m-field">
          <label>标题</label>
          <input v-model="novelForm.title" class="m-input" maxlength="80" />
        </div>
        <div class="m-field">
          <label>作者</label>
          <input v-model="novelForm.author" class="m-input" maxlength="40" />
        </div>
        <div class="m-field">
          <label>类型</label>
          <select v-model="novelForm.genre" class="m-select">
            <option v-for="g in genreOptions" :key="g.code" :value="g.code">{{ g.name }}</option>
          </select>
        </div>
        <div class="m-field">
          <label>状态</label>
          <select v-model="novelForm.status" class="m-select">
            <option value="writing">创作中</option>
            <option value="paused">已暂停</option>
            <option value="completed">已完成</option>
          </select>
        </div>
        <div class="m-field">
          <label>简介</label>
          <textarea v-model="novelForm.description" class="m-textarea" rows="3" />
        </div>
        <div class="m-btn-row">
          <button type="button" class="m-btn m-btn--ghost" @click="showNovelEdit = false">取消</button>
          <button type="button" class="m-btn m-btn--primary" @click="saveNovelInfo">保存</button>
        </div>
      </div>
    </div>

    <!-- custom prompt -->
    <div v-if="showPrompt" class="m-sheet-mask" @click.self="showPrompt = false">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">自定义 AI 指令</h2>
        <div class="m-field">
          <textarea v-model="customPrompt" class="m-textarea" rows="4" placeholder="描述你希望 AI 做什么…" />
        </div>
        <div class="m-btn-row">
          <button type="button" class="m-btn m-btn--ghost" @click="showPrompt = false">取消</button>
          <button type="button" class="m-btn m-btn--primary" :disabled="!customPrompt.trim()" @click="runCustom">
            开始生成
          </button>
        </div>
      </div>
    </div>

    <!-- prompt library pick -->
    <div v-if="showPromptPick" class="m-sheet-mask" @click.self="showPromptPick = false">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">选用提示词</h2>
        <div class="m-field">
          <select v-model="promptCat" class="m-select">
            <option v-for="c in PROMPT_CATEGORIES" :key="c.key" :value="c.key">
              {{ c.icon }} {{ c.name }}
            </option>
          </select>
        </div>
        <div class="m-list" style="max-height: 40vh; overflow: auto">
          <button
            v-for="p in filteredPrompts"
            :key="p.id"
            type="button"
            class="m-novel-card"
            style="margin-bottom: 8px"
            @click="usePrompt(p)"
          >
            <div class="m-novel-card__title">{{ p.title }}</div>
            <p class="m-novel-card__desc">{{ p.description || p.content?.slice(0, 80) }}</p>
          </button>
          <div v-if="!filteredPrompts.length" class="m-muted" style="padding: 12px">暂无提示词</div>
        </div>
        <button type="button" class="m-btn m-btn--ghost m-btn--block" @click="$router.push('/prompts')">
          管理提示词库
        </button>
      </div>
    </div>

    <!-- chapter rename + word goal -->
    <div v-if="showMeta" class="m-sheet-mask" @click.self="showMeta = false">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">章节设置</h2>
        <div class="m-field">
          <label>标题</label>
          <input v-model="metaTitle" class="m-input" maxlength="80" />
        </div>
        <div class="m-field">
          <label>本章字数目标（0 = 用全局设置 {{ prefs.chapterWordGoal || 0 }}）</label>
          <input
            v-model.number="metaWordGoal"
            class="m-input"
            type="number"
            min="0"
            step="100"
            placeholder="如 2000"
          />
          <div class="m-chips" style="margin-top: 8px; flex-wrap: wrap">
            <button
              v-for="g in [0, 1000, 2000, 3000, 5000]"
              :key="g"
              type="button"
              class="m-chip"
              :class="{ 'is-active': Number(metaWordGoal) === g }"
              @click="metaWordGoal = g"
            >
              {{ g === 0 ? '跟随全局' : g + ' 字' }}
            </button>
          </div>
        </div>
        <div class="m-field">
          <label>章节备注</label>
          <textarea
            v-model="metaNotes"
            class="m-textarea"
            rows="3"
            placeholder="伏笔、情绪、要写的场景…"
          />
        </div>
        <div class="m-btn-row">
          <button type="button" class="m-btn m-btn--ghost" @click="showMeta = false">取消</button>
          <button type="button" class="m-btn m-btn--primary" @click="saveMeta">保存</button>
        </div>
        <button
          type="button"
          class="m-btn m-btn--ghost m-btn--block"
          style="margin-top: 10px"
          @click="openTodosFromMeta"
        >
          管理本章待办（{{ openTodoCount }} 未完成）
        </button>
      </div>
    </div>

    <!-- snapshots -->
    <div v-if="showSnapshots" class="m-sheet-mask" @click.self="showSnapshots = false">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">章节快照</h2>
        <div v-if="!chapterSnapshots.length" class="m-muted" style="padding: 12px">暂无快照</div>
        <div v-for="s in chapterSnapshots" :key="s.id" class="m-card" style="margin-bottom: 8px">
          <div class="m-row-between">
            <strong style="font-size: 0.9rem">{{ s.chapterTitle || '章节' }}</strong>
            <span class="m-muted" style="font-size: 0.75rem">{{ formatSnapTime(s.createdAt) }}</span>
          </div>
          <p class="m-muted" style="font-size: 0.8rem; margin: 6px 0">{{ s.wordCount }} 字 · {{ (s.content || '').slice(0, 60) }}…</p>
          <div class="m-btn-row">
            <button type="button" class="m-btn m-btn--primary m-btn--sm" @click="restoreSnapshot(s)">恢复</button>
            <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="compareSnapshot(s)">对比</button>
            <button type="button" class="m-btn m-btn--danger m-btn--sm" @click="deleteSnapshot(s)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- snapshot diff -->
    <div v-if="showDiff" class="m-sheet-mask" @click.self="showDiff = false">
      <div class="m-sheet m-sheet--tall">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">快照对比</h2>
        <p class="m-hint">
          相对当前草稿 · 删 {{ diffStats.del }} 行 · 增 {{ diffStats.add }} 行
        </p>
        <div class="m-diff">
          <div
            v-for="(row, idx) in diffRows"
            :key="idx"
            class="m-diff__line"
            :class="'is-' + row.type"
          >
            <span class="m-diff__mark">{{ row.type === 'add' ? '+' : row.type === 'del' ? '−' : ' ' }}</span>
            <span>{{ row.text || ' ' }}</span>
          </div>
        </div>
        <div class="m-btn-row" style="margin-top: 12px">
          <button type="button" class="m-btn m-btn--ghost" @click="showDiff = false">关闭</button>
          <button
            v-if="diffSnapshot"
            type="button"
            class="m-btn m-btn--primary"
            @click="restoreSnapshot(diffSnapshot)"
          >
            恢复此快照
          </button>
        </div>
      </div>
    </div>

    <!-- find / replace -->
    <div v-if="showFind" class="m-sheet-mask" @click.self="closeFind">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">查找 / 替换</h2>
        <div class="m-field">
          <label>查找</label>
          <input
            ref="findInputEl"
            v-model="findQuery"
            class="m-input"
            type="search"
            enterkeyhint="search"
            placeholder="输入要查找的内容"
            @keydown.enter.prevent="findStep(1)"
          />
        </div>
        <div class="m-field">
          <label>替换为</label>
          <input v-model="replaceWith" class="m-input" placeholder="替换内容（可空）" />
        </div>
        <label class="m-hint" style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px">
          <input v-model="findCase" type="checkbox" /> 区分大小写
        </label>
        <p class="m-hint" style="margin-bottom: 10px">
          {{ findQuery.trim() ? `本章约 ${findMatchCount} 处` : '在当前章节正文中查找' }}
        </p>
        <div class="m-btn-row" style="flex-wrap: wrap">
          <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="findStep(-1)">上一个</button>
          <button type="button" class="m-btn m-btn--primary m-btn--sm" @click="findStep(1)">下一个</button>
          <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="replaceCurrent">替换</button>
          <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="replaceAllInChapter">全部替换</button>
        </div>
        <button type="button" class="m-btn m-btn--ghost m-btn--block" style="margin-top: 12px" @click="closeFind">
          关闭
        </button>
      </div>
    </div>

    <!-- book search -->
    <div v-if="showBookSearch" class="m-sheet-mask" @click.self="closeBookSearch">
      <div class="m-sheet m-sheet--tall">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">全书搜索</h2>
        <div class="m-field">
          <input
            ref="bookSearchInputEl"
            v-model="bookQuery"
            class="m-input"
            type="search"
            enterkeyhint="search"
            placeholder="搜索书名内所有章节…"
            @keydown.enter.prevent="runBookSearch"
          />
        </div>
        <label class="m-hint" style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px">
          <input v-model="bookCase" type="checkbox" /> 区分大小写
        </label>
        <button
          type="button"
          class="m-btn m-btn--primary m-btn--block"
          :disabled="bookSearching || !bookQuery.trim()"
          @click="runBookSearch"
        >
          {{ bookSearching ? `搜索中 ${Math.round(bookProgress * 100)}%` : '搜索' }}
        </button>
        <div class="m-search-results">
          <button
            v-for="(hit, idx) in bookResults"
            :key="idx + '-' + hit.chapterId + '-' + hit.start"
            type="button"
            class="m-search-hit"
            @click="jumpToSearchHit(hit)"
          >
            <div class="m-search-hit__title">
              第{{ hit.chapterIndex + 1 }}章 {{ hit.chapterTitle }}
              <span v-if="hit.inTitle" class="m-chip is-active" style="margin-left: 6px">标题</span>
            </div>
            <div class="m-search-hit__snip">{{ hit.snippet }}</div>
          </button>
          <p
            v-if="!bookSearching && bookSearched && !bookResults.length"
            class="m-muted"
            style="padding: 12px"
          >
            无结果
          </p>
        </div>
        <button type="button" class="m-btn m-btn--ghost m-btn--block" style="margin-top: 8px" @click="closeBookSearch">
          关闭
        </button>
      </div>
    </div>

    <!-- AI chat -->
    <div v-if="showChat" class="m-sheet-mask" @click.self="closeChat">
      <div class="m-sheet m-sheet--tall">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">AI 对话</h2>
        <div class="m-chat-log">
          <div
            v-for="m in chatMessages"
            :key="m.id"
            class="m-chat-bubble"
            :class="m.role === 'user' ? 'is-user' : 'is-ai'"
          >
            {{ m.content }}
            <button
              v-if="m.role === 'assistant'"
              type="button"
              class="m-btn m-btn--ghost m-btn--sm"
              style="margin-top: 6px"
              @click="insertText(m.content)"
            >
              插入正文
            </button>
          </div>
          <p v-if="chatStream" class="m-chat-bubble is-ai">{{ chatStream }}</p>
        </div>
        <div class="m-field">
          <textarea v-model="chatInput" class="m-textarea" rows="2" placeholder="问设定、要续写思路…" />
        </div>
        <div class="m-btn-row">
          <button type="button" class="m-btn m-btn--ghost" @click="clearChat">清空</button>
          <button type="button" class="m-btn m-btn--primary" :disabled="chatBusy || !chatInput.trim()" @click="sendChat">
            {{ chatBusy ? '…' : '发送' }}
          </button>
        </div>
      </div>
    </div>

    <!-- batch gen -->
    <div v-if="showBatch" class="m-sheet-mask" @click.self="!batchRunning && (showBatch = false)">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">批量生成空章</h2>
        <p class="m-hint">将按顺序为字数 &lt; 50 的章节流式生成正文（可停止）。</p>
        <p class="m-muted" style="font-size: 0.85rem">待生成：{{ emptyChapterTargets.length }} 章</p>
        <p v-if="batchStatus" class="m-hint">{{ batchStatus }}</p>
        <div class="m-btn-row">
          <button v-if="batchRunning" type="button" class="m-btn m-btn--danger" @click="stopBatch">停止</button>
          <button
            v-else
            type="button"
            class="m-btn m-btn--primary"
            :disabled="!emptyChapterTargets.length"
            @click="runBatchGen"
          >
            开始
          </button>
          <button type="button" class="m-btn m-btn--ghost" :disabled="batchRunning" @click="showBatch = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- consistency -->
    <div v-if="showIssues" class="m-sheet-mask" @click.self="showIssues = false">
      <div class="m-sheet m-sheet--tall">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">一致性检查</h2>
        <div v-if="!issues.length" class="m-muted" style="padding: 12px">未发现问题 🎉</div>
        <button
          v-for="(iss, i) in issues"
          :key="i"
          type="button"
          class="m-search-hit"
          style="margin-bottom: 8px"
          @click="jumpIssue(iss)"
        >
          <div class="m-search-hit__title">{{ iss.severity }} · {{ iss.type }}</div>
          <div class="m-search-hit__snip">{{ iss.message }}</div>
        </button>
        <button type="button" class="m-btn m-btn--ghost m-btn--block" @click="showIssues = false">关闭</button>
      </div>
    </div>

    <!-- chapter summary preview -->
    <div v-if="showSummary" class="m-sheet-mask" @click.self="showSummary = false">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">本章摘要</h2>
        <div class="m-card" style="white-space: pre-wrap; font-size: 0.92rem; line-height: 1.65">
          {{ summaryText || '（空）' }}
        </div>
        <button type="button" class="m-btn m-btn--ghost m-btn--block" style="margin-top: 12px" @click="showSummary = false">
          关闭
        </button>
      </div>
    </div>

    <!-- outline import -->
    <div v-if="showOutline" class="m-sheet-mask" @click.self="showOutline = false">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">大纲导入章节</h2>
        <p class="m-hint">粘贴含 ### 标题 的大纲，将解析为多章（可追加或替换）</p>
        <div class="m-field">
          <textarea v-model="outlineText" class="m-textarea" rows="8" placeholder="### 第一章 标题\n要点…" />
        </div>
        <label class="m-hint" style="display: flex; gap: 8px; align-items: center; margin-bottom: 12px">
          <input v-model="outlineReplace" type="checkbox" /> 替换现有章节（危险）
        </label>
        <div class="m-btn-row">
          <button type="button" class="m-btn m-btn--ghost" @click="showOutline = false">取消</button>
          <button type="button" class="m-btn m-btn--primary" :disabled="!outlineText.trim()" @click="importOutline">
            导入
          </button>
        </div>
      </div>
    </div>




    <!-- book-wide todos board -->
    <div v-if="showBookTodos" class="m-sheet-mask" @click.self="showBookTodos = false">
      <div class="m-sheet m-sheet--tall">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">全书待办</h2>
        <div class="m-segment" style="margin-bottom: 10px">
          <button type="button" :class="{ 'is-active': bookTodoFilter === 'open' }" @click="bookTodoFilter = 'open'">
            未完成 {{ bookOpenTodoCount }}
          </button>
          <button type="button" :class="{ 'is-active': bookTodoFilter === 'all' }" @click="bookTodoFilter = 'all'">
            全部
          </button>
          <button type="button" :class="{ 'is-active': bookTodoFilter === 'done' }" @click="bookTodoFilter = 'done'">
            已完成
          </button>
        </div>
        <div v-if="!bookTodoRows.length" class="m-muted" style="padding: 12px">没有匹配的待办</div>
        <div v-for="row in bookTodoRows" :key="row.key" class="m-book-todo">
          <button type="button" class="m-book-todo__jump" @click="jumpToChapterTodo(row)">
            <div class="m-book-todo__ch">第{{ row.chapterIndex + 1 }}章 · {{ row.chapterTitle }}</div>
            <div class="m-book-todo__text" :class="{ 'is-done': row.done }">
              {{ row.done ? '✓' : '○' }} {{ row.text }}
            </div>
          </button>
          <button type="button" class="m-chip-btn" @click="toggleBookTodo(row)">
            {{ row.done ? '撤' : '完' }}
          </button>
        </div>
        <div class="m-btn-row" style="margin-top: 12px; flex-wrap: wrap">
          <button
            type="button"
            class="m-btn m-btn--primary m-btn--sm"
            :disabled="!bookTodoRows.length"
            @click="exportBookTodos('open')"
          >
            导出未完成
          </button>
          <button
            type="button"
            class="m-btn m-btn--ghost m-btn--sm"
            :disabled="!bookOpenTodoCount && bookTodoFilter !== 'all'"
            @click="exportBookTodos('all')"
          >
            导出全部
          </button>
          <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="showBookTodos = false">
            关闭
          </button>
        </div>
      </div>
    </div>


    <!-- chapter quick actions (long-press) -->
    <div v-if="chapterQuick" class="m-sheet-mask" @click.self="chapterQuick = null">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">{{ chapterQuick.title || '章节' }}</h2>
        <p class="m-hint">第{{ chapterQuick.index + 1 }}章 · {{ chapterQuick.wordCount || 0 }} 字</p>
        <div class="m-list-actions">
          <button type="button" class="m-action-row" @click="quickSelectChapter">打开本章</button>
          <button type="button" class="m-action-row" @click="quickRename">章节设置</button>
          <button type="button" class="m-action-row" @click="quickTodos">本章待办</button>
          <button
            type="button"
            class="m-action-row"
            :disabled="!(chapterQuick.todos && chapterQuick.todos.length)"
            @click="quickInsertOutline"
          >
            插入待办提纲
          </button>
          <button
            v-if="isChapterEmpty(chapterQuick)"
            type="button"
            class="m-action-row"
            :disabled="isStreaming || batchRunning"
            @click="quickAiFill"
          >
            AI 填章
          </button>
          <button type="button" class="m-action-row" @click="quickExport">导出本章 TXT</button>
        </div>
        <button type="button" class="m-btn m-btn--ghost m-btn--block" style="margin-top: 10px" @click="chapterQuick = null">
          关闭
        </button>
      </div>
    </div>

    <!-- chapter todos -->
    <div v-if="showTodos" class="m-sheet-mask" @click.self="showTodos = false">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">本章待办</h2>
        <p class="m-hint">{{ chapter?.title || '当前章节' }} · 勾选跟踪伏笔与要写的点</p>
        <div class="m-field" style="display: flex; gap: 8px">
          <input
            v-model="todoDraft"
            class="m-input"
            style="flex: 1"
            placeholder="添加待办，回车确认"
            @keydown.enter.prevent="addTodo"
          />
          <button type="button" class="m-btn m-btn--primary m-btn--sm" @click="addTodo">添加</button>
        </div>
        <div v-if="!chapterTodos.length" class="m-muted" style="padding: 12px 0">暂无待办</div>
        <div v-for="t in chapterTodos" :key="t.id" class="m-todo-row">
          <label class="m-todo-row__main">
            <input type="checkbox" :checked="t.done" @change="toggleTodo(t.id)" />
            <span :class="{ 'is-done': t.done }">{{ t.text }}</span>
          </label>
          <button type="button" class="m-chip-btn" @click="removeTodo(t.id)">✕</button>
        </div>
        <div class="m-btn-row" style="margin-top: 12px; flex-wrap: wrap">
          <button
            type="button"
            class="m-btn m-btn--primary m-btn--sm"
            :disabled="!chapterTodos.length"
            @click="insertTodosAsOutline(false)"
          >
            插入提纲
          </button>
          <button
            type="button"
            class="m-btn m-btn--ghost m-btn--sm"
            :disabled="!openTodoCount"
            @click="insertTodosAsOutline(true)"
          >
            仅未完成
          </button>
          <button
            type="button"
            class="m-btn m-btn--ghost m-btn--sm"
            :disabled="!chapterTodos.some((x) => x.done)"
            @click="clearDoneTodos"
          >
            清除已完成
          </button>
          <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="showTodos = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- inspiration dice -->
    <div v-if="showInspiration" class="m-sheet-mask" @click.self="showInspiration = false">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">灵感骰子</h2>
        <p class="m-hint">离线可用 · 随机冲突 / 反转 / 感官 / 对白 / 钩子</p>
        <div class="m-chips" style="flex-wrap: wrap; margin-bottom: 10px">
          <button
            type="button"
            class="m-chip"
            :class="{ 'is-active': inspCat === 'all' }"
            @click="inspCat = 'all'"
          >
            全部
          </button>
          <button
            v-for="c in inspCategories"
            :key="c.key"
            type="button"
            class="m-chip"
            :class="{ 'is-active': inspCat === c.key }"
            @click="inspCat = c.key"
          >
            {{ c.icon }} {{ c.name }}
          </button>
        </div>
        <button type="button" class="m-btn m-btn--primary m-btn--block" @click="rollInsp">
          🎲 再掷一次
        </button>
        <div v-if="inspCurrent" class="m-card" style="margin-top: 12px">
          <div class="m-muted" style="font-size: 0.75rem; margin-bottom: 4px">
            {{ inspCurrent.icon }} {{ inspCurrent.categoryName }}
          </div>
          <div style="font-size: 0.95rem; line-height: 1.55">{{ inspCurrent.text }}</div>
          <div class="m-btn-row" style="margin-top: 10px; flex-wrap: wrap">
            <button type="button" class="m-btn m-btn--primary m-btn--sm" @click="insertInspiration">
              插入正文
            </button>
            <button
              type="button"
              class="m-btn m-btn--ghost m-btn--sm"
              :disabled="isStreaming || !isConfigured"
              @click="expandInspiration"
            >
              AI 扩写场景
            </button>
            <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="copyInspiration">
              复制
            </button>
          </div>
        </div>
        <div v-if="inspHistory.length" class="m-section-title" style="margin-top: 14px">本局历史</div>
        <button
          v-for="(h, i) in inspHistory"
          :key="i"
          type="button"
          class="m-search-hit"
          style="margin-bottom: 6px"
          @click="inspCurrent = h"
        >
          <div class="m-search-hit__title">{{ h.icon }} {{ h.categoryName }}</div>
          <div class="m-search-hit__snip">{{ h.text }}</div>
        </button>
        <button type="button" class="m-btn m-btn--ghost m-btn--block" style="margin-top: 8px" @click="showInspiration = false">
          关闭
        </button>
      </div>
    </div>

    <!-- insert character name -->
    <div v-if="showInsertChar" class="m-sheet-mask" @click.self="showInsertChar = false">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">插入角色名</h2>
        <div v-if="!charNames.length" class="m-muted" style="padding: 12px">
          暂无角色，请先在设定面板添加
        </div>
        <div class="m-chips" style="flex-wrap: wrap">
          <button
            v-for="name in charNames"
            :key="name"
            type="button"
            class="m-chip is-active"
            @click="insertText(name)"
          >
            {{ name }}
          </button>
        </div>
        <button type="button" class="m-btn m-btn--ghost m-btn--block" style="margin-top: 12px" @click="goExtras">
          管理设定
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNovels } from '../../composables/useNovels.js'
import { useApiConfig } from '../../composables/useApiConfig.js'
import { usePrompts, PROMPT_CATEGORIES } from '../../composables/usePrompts.js'
import { useGenres } from '../../composables/useGenres.js'
import { useGoals } from '../../composables/useGoals.js'
import { useNovelExtras } from '../../composables/useNovelExtras.js'
import { useSnapshots, parseOutlineToChapters } from '../../composables/useSnapshots.js'
import { usePrefs } from '../../composables/usePrefs.js'
import { useNovelSearch } from '../../composables/useNovelSearch.js'
import { useChapterSummary } from '../../composables/useChapterSummary.js'
import {
  loadEditorPos,
  saveEditorPos,
  restoreEditorPos,
  readPosFromEditor
} from '../../composables/useEditorPos.js'
import { useChat } from '../../composables/useChat.js'
import { useModelProfiles } from '../../composables/useModelProfiles.js'
import { useAchievements } from '../../composables/useAchievements.js'
import { useReadingResume } from '../../composables/useReadingResume.js'
import {
  rollInspiration,
  rollInspirationSet,
  formatInspirationNote,
  buildExpandPrompt,
  listInspirationCategories
} from '../../utils/inspirationDice.js'
import { checkNovelConsistency } from '../../composables/useConsistency.js'
import apiService from '../../services/api.js'
import toast from '../../services/toast.js'
import { downloadText, downloadBinary } from '../../utils/download.js'
import { novelToMarkdown, novelToEpub, safeName } from '../../utils/exportFormats.js'
import { keepScreenOn, haptic } from '../../utils/bridge.js'
import {
  findNext,
  findPrev,
  countMatches,
  replaceAll as replaceAllText,
  replaceOne
} from '../../utils/textFind.js'
import { diffLines, diffStats as calcDiffStats } from '../../utils/textDiff.js'

const route = useRoute()
const router = useRouter()
const {
  load,
  getById,
  updateNovel,
  updateChapter,
  addChapter,
  deleteChapter,
  moveChapter,
  exportNovelText,
  exportChapterText,
  importChaptersFromOutline,
  countWords
} = useNovels()
const { isConfigured, applyToService } = useApiConfig()
const { byCategory, bumpUsage, applyTemplate, load: loadPrompts } = usePrompts()
const { options: genreOptions } = useGenres()
const { recordWords, todayBanner, weekStats, load: loadGoals } = useGoals()
const { prefs, toggleReadingMode, setPomodoroMinutes } = usePrefs()
const contextChars = computed(() => Number(prefs.value.contextChars) || 2500)

const novelId = computed(() => route.params.id)
const extras = useNovelExtras(novelId)
const snaps = useSnapshots(novelId)
const chapterSummaries = useChapterSummary(novelId)
const {
  results: bookResults,
  searching: bookSearching,
  progress: bookProgress,
  search: searchBook,
  cancel: cancelBookSearch
} = useNovelSearch()
const chat = useChat(novelId)
const {
  profiles,
  activeId: activeProfileId,
  activate: activateProfile,
  load: loadProfiles
} = useModelProfiles()
const { unlock } = useAchievements()
const { touchResume, getResume } = useReadingResume()
const chatMessages = chat.messages
const chatBusy = chat.busy

const novel = ref(null)
const chapterId = ref(null)
const draft = ref('')
const dirty = ref(false)
const saving = ref(false)
const saveHint = ref('已保存')
const drawerOpen = ref(false)
const showPrompt = ref(false)
const showPromptPick = ref(false)
const showMeta = ref(false)
const showTodos = ref(false)
const chapterQuick = ref(null)
const fillingChapterId = ref(null)
let chapterLongPressTimer = null
const showBookTodos = ref(false)
const bookTodoFilter = ref('open')
const todoDraft = ref('')
const metaNotes = ref('')
const showMore = ref(false)
const showNovelEdit = ref(false)
const showSnapshots = ref(false)
const showOutline = ref(false)
const showInsertChar = ref(false)
const showInspiration = ref(false)
const inspCat = ref('all')
const inspCurrent = ref(null)
const inspHistory = ref([])
const inspCategories = listInspirationCategories()
const showFind = ref(false)
const showBookSearch = ref(false)
const showDiff = ref(false)
const showSummary = ref(false)
const showChat = ref(false)
const showBatch = ref(false)
const showIssues = ref(false)
const chatInput = ref('')
const chatStream = ref('')
const batchRunning = ref(false)
const batchStatus = ref('')
const issues = ref([])
let batchAbort = null
let chatAbort = null
const outlineText = ref('')
const outlineReplace = ref(false)
const customPrompt = ref('')
const metaTitle = ref('')
const metaWordGoal = ref(0)
/** toast once when chapter goal reached this session */
let goalReachedNotified = false
const isStreaming = ref(false)
const streamPreview = ref('')
const aiMode = ref('continue')
const editorEl = ref(null)
const findInputEl = ref(null)
const bookSearchInputEl = ref(null)
const useContext = ref(true)
const promptCat = ref('all')
const selStart = ref(0)
const selEnd = ref(0)
const undoStack = ref([])
const redoStack = ref([])
const chapterFilter = ref('')
const findQuery = ref('')
const replaceWith = ref('')
const findCase = ref(false)
const findCursor = ref(0)
const bookQuery = ref('')
const bookCase = ref(false)
const bookSearched = ref(false)
const diffRows = ref([])
const diffSnapshot = ref(null)
const summaryText = ref('')
const summarizing = ref(false)
const sessionStartWords = ref(0)
const sessionStartedAt = ref(Date.now())
const sessionTick = ref(0)
const pomodoroLeft = ref(0)
const novelForm = reactive({
  title: '',
  author: '',
  genre: 'fantasy',
  status: 'writing',
  description: ''
})

let abortController = null
let saveTimer = null
let streamBuffer = ''
let lastSavedWords = 0
/** If save requested while another save runs, re-run after */
let saveAgain = false
/** Serialize saves that must finish before chapter switch */
let saveChain = Promise.resolve()
/** Prefer durable flush on leave / explicit save */
let savePreferFlush = false
/** Cap silent auto-retries after save failure */
let saveFailRetries = 0
let saveRetryTimer = null
/** When polishing/expanding selection: { start, end, original } */
let selectionOp = null
/** rAF throttle for stream UI updates (avoid re-render every token on WebView) */
let streamRaf = 0
let pendingStreamUi = null
let sessionTimer = null
let pomodoroTimer = null
let posSaveTimer = null
let skipNextPosRestore = false
let lastUndoPushAt = 0
/** Snapshot of draft before current typing burst */
let draftBeforeBurst = ''
let typingBurstActive = false
let isComposing = false
let burstIdleTimer = null

const chapters = computed(() => novel.value?.chapterList || [])
const chapter = computed(
  () => chapters.value.find((c) => String(c.id) === String(chapterId.value)) || null
)
const wordCount = computed(() => countWords(draft.value))
const filteredPrompts = computed(() => byCategory(promptCat.value))
const chapterSnapshots = computed(() =>
  snaps.list.value.filter((s) => String(s.chapterId) === String(chapterId.value))
)
const hasSelection = computed(() => selEnd.value > selStart.value)
const selectionLen = computed(() => Math.max(0, selEnd.value - selStart.value))
const streamWords = computed(() => countWords(streamBuffer || streamPreview.value || ''))
const charNames = computed(() =>
  (extras.characters.value || [])
    .map((c) => c.name || c.title)
    .filter(Boolean)
)
const emptyChapterTargets = computed(() =>
  chapters.value.filter((c) => (c.wordCount || countWords(c.content)) < 50)
)
const chapterIndex = computed(() =>
  chapters.value.findIndex((c) => String(c.id) === String(chapterId.value))
)
const canPrevChapter = computed(() => chapterIndex.value > 0)
const canNextChapter = computed(
  () => chapterIndex.value >= 0 && chapterIndex.value < chapters.value.length - 1
)
const filteredChapterRows = computed(() => {
  const q = chapterFilter.value.trim().toLowerCase()
  return chapters.value
    .map((c, i) => ({ c, i }))
    .filter((row) => !q || String(row.c.title || '').toLowerCase().includes(q))
})
const findMatchCount = computed(() =>
  countMatches(draft.value, findQuery.value, { caseSensitive: findCase.value })
)
const diffStats = computed(() => calcDiffStats(diffRows.value))
const sessionDelta = computed(() => Math.max(0, wordCount.value - sessionStartWords.value))
const sessionDeltaLabel = computed(() => {
  const d = sessionDelta.value
  return d > 0 ? `+${d}` : `${d}`
})
const sessionElapsedLabel = computed(() => {
  void sessionTick.value
  const sec = Math.max(0, Math.floor((Date.now() - sessionStartedAt.value) / 1000))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `已写 ${m}:${String(s).padStart(2, '0')}`
})
const pomodoroLabel = computed(() => {
  void sessionTick.value
  if (!pomodoroLeft.value) return ''
  const m = Math.floor(pomodoroLeft.value / 60)
  const s = pomodoroLeft.value % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

function captureSelection() {
  const el = editorEl.value
  if (!el || isStreaming.value) return
  selStart.value = el.selectionStart ?? 0
  selEnd.value = el.selectionEnd ?? 0
  scheduleSavePos()
}

function pushUndo(snapshot, force = false) {
  const text = snapshot != null ? String(snapshot) : draft.value
  const now = Date.now()
  // Merge rapid forced pushes of same burst
  if (
    !force &&
    undoStack.value.length &&
    now - lastUndoPushAt < 1000 &&
    undoStack.value[undoStack.value.length - 1] === text
  ) {
    lastUndoPushAt = now
    return
  }
  if (undoStack.value[undoStack.value.length - 1] === text) return
  undoStack.value.push(text)
  if (undoStack.value.length > 40) undoStack.value.shift()
  redoStack.value = []
  lastUndoPushAt = now
}

function undoLast() {
  if (!undoStack.value.length || isStreaming.value) return
  redoStack.value.push(draft.value)
  if (redoStack.value.length > 30) redoStack.value.shift()
  draft.value = undoStack.value.pop()
  dirty.value = true
  scheduleSave()
  toast.info('已撤销')
  haptic()
}

function redoLast() {
  if (!redoStack.value.length || isStreaming.value) return
  undoStack.value.push(draft.value)
  if (undoStack.value.length > 30) undoStack.value.shift()
  draft.value = redoStack.value.pop()
  dirty.value = true
  scheduleSave()
  toast.info('已重做')
  haptic()
}

function openInsertChar() {
  extras.loadAll()
  showInsertChar.value = true
}

function openInspiration() {
  showMore.value = false
  showInspiration.value = true
  if (!inspCurrent.value) rollInsp()
  haptic()
}

function rollInsp() {
  const item = rollInspiration(inspCat.value)
  inspCurrent.value = item
  inspHistory.value = [item, ...inspHistory.value.filter((x) => x.text !== item.text)].slice(0, 8)
  unlock('inspiration_1')
  haptic()
}

function insertInspiration() {
  if (!inspCurrent.value) return
  insertText('\n' + formatInspirationNote(inspCurrent.value) + '\n')
  showInspiration.value = false
}

function copyInspiration() {
  if (!inspCurrent.value) return
  const text = formatInspirationNote(inspCurrent.value)
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    toast.success('已复制灵感')
  } catch {
    toast.error('复制失败')
  }
}

async function expandInspiration() {
  if (!inspCurrent.value) return
  if (!isConfigured.value) {
    toast.warning('请先配置 API')
    router.push('/settings')
    return
  }
  if (isStreaming.value) return
  showInspiration.value = false
  applyToService()
  const prompt = buildExpandPrompt(
    inspCurrent.value,
    novel.value?.title,
    chapter.value?.title,
    draft.value
  )
  pushUndo(draft.value, true)
  // append expanded scene
  await streamGenerate(
    prompt + '\n\n请直接输出场景正文（将追加到当前章节末尾）：',
    'continue'
  )
}



function insertText(text) {
  const el = editorEl.value
  const t = String(text || '')
  if (!t) return
  pushUndo(draft.value, true)
  const start = el ? el.selectionStart : draft.value.length
  const end = el ? el.selectionEnd : start
  draft.value = draft.value.slice(0, start) + t + draft.value.slice(end)
  dirty.value = true
  scheduleSave()
  showInsertChar.value = false
  toast.success(`已插入「${t}」`)
  requestAnimationFrame(() => {
    if (!el) return
    const pos = start + t.length
    el.focus()
    el.setSelectionRange(pos, pos)
  })
}

function prevChapterSummary() {
  if (!prefs.value.includePrevChapter) return ''
  const list = chapters.value
  const idx = list.findIndex((c) => String(c.id) === String(chapterId.value))
  if (idx <= 0) return ''
  const prev = list[idx - 1]
  const body = String(prev?.content || '')
    .replace(/<[^>]*>/g, '')
    .trim()
  if (!body) return ''

  // Prefer cached AI summary when fresh
  if (prefs.value.preferChapterSummary) {
    const cached = chapterSummaries.get(prev.id)
    if (cached?.text && chapterSummaries.isFresh(prev.id, body)) {
      return `【上一章《${prev.title || ''}》摘要】\n${cached.text}\n`
    }
  }
  const snippet = body.length > 600 ? body.slice(-600) : body
  return `【上一章《${prev.title || ''}》摘要片段】\n${snippet}\n`
}

function persistCurrentPos() {
  if (!novelId.value || !chapterId.value) return
  const pos = readPosFromEditor(editorEl.value)
  if (pos) saveEditorPos(novelId.value, chapterId.value, pos)
}

function scheduleSavePos() {
  if (posSaveTimer) clearTimeout(posSaveTimer)
  posSaveTimer = setTimeout(() => {
    posSaveTimer = null
    persistCurrentPos()
  }, 400)
}

function refreshNovel() {
  novel.value = getById(novelId.value)
  if (!novel.value) return
  extras.loadAll()
  chapterSummaries.load()
  snaps.load()
  const list = novel.value.chapterList || []
  if (!list.length) {
    chapterId.value = null
    draft.value = ''
    return
  }
  // Prefer last resume chapter for this novel (from bookshelf「继续写作」)
  if (!chapterId.value || !list.some((c) => String(c.id) === String(chapterId.value))) {
    const r = getResume()
    if (
      r &&
      String(r.novelId) === String(novelId.value) &&
      r.chapterId &&
      list.some((c) => String(c.id) === String(r.chapterId))
    ) {
      chapterId.value = r.chapterId
    } else {
      chapterId.value = list[0].id
    }
  }
  loadChapterDraft()
}

function loadChapterDraft() {
  const c = chapter.value
  draft.value = c?.content || ''
  lastSavedWords = countWords(draft.value)
  dirty.value = false
  saveHint.value = '已保存'
  undoStack.value = []
  redoStack.value = []
  draftBeforeBurst = draft.value
  typingBurstActive = false
  goalReachedNotified = false
  // Remember for bookshelf「继续写作」
  if (novel.value && chapterId.value) {
    touchResume({
      novelId: novelId.value,
      chapterId: chapterId.value,
      title: novel.value.title,
      chapterTitle: c?.title || ''
    })
  }
  if (skipNextPosRestore) {
    skipNextPosRestore = false
    return
  }
  const pos = loadEditorPos(novelId.value, chapterId.value)
  if (pos) {
    nextTick(() => restoreEditorPos(editorEl.value, pos))
  }
}

function armTypingBurst() {
  if (!typingBurstActive && !isStreaming.value) {
    draftBeforeBurst = draft.value
    typingBurstActive = true
  }
}

function onBeforeInput() {
  // Capture pre-edit text once per typing burst (before value changes)
  armTypingBurst()
}

function onCompositionStart() {
  isComposing = true
  armTypingBurst()
}

function onCompositionEnd(e) {
  isComposing = false
  // Commit final composed text
  onEditorInput(e)
}

/** Controlled editor input — reliable undo + IME-safe */
function onEditorInput(e) {
  if (isStreaming.value) return
  // During IME composition, keep DOM free; commit on compositionend
  if (isComposing) return
  const next = e?.target?.value
  if (typeof next !== 'string') return
  armTypingBurst()
  if (typingBurstActive && draftBeforeBurst !== next) {
    if (undoStack.value[undoStack.value.length - 1] !== draftBeforeBurst) {
      pushUndo(draftBeforeBurst, true)
    }
  }
  draft.value = next
  dirty.value = true
  saveHint.value = '编辑中…'
  scheduleSave()
  scheduleSavePos()
  checkChapterGoalReached()
}

/** End typing burst after idle — independent of autosave so undo merge is not cut mid-sentence. */
function scheduleBurstEnd() {
  if (burstIdleTimer) clearTimeout(burstIdleTimer)
  burstIdleTimer = setTimeout(() => {
    burstIdleTimer = null
    typingBurstActive = false
    draftBeforeBurst = draft.value
  }, 1400)
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  const delay = Number(prefs.value.autosaveMs) || 800
  saveTimer = setTimeout(() => {
    // Do NOT reset typing burst here — autosave must not fragment undo history
    void saveNow(true)
  }, delay)
  scheduleBurstEnd()
}

/** Per-chapter goal overrides global prefs.chapterWordGoal */
const chapterGoal = computed(() => {
  const per = Number(chapter.value?.wordGoal) || 0
  if (per > 0) return per
  return Number(prefs.value.chapterWordGoal) || 0
})
const chapterGoalPct = computed(() => {
  if (!chapterGoal.value) return 0
  return Math.min(100, Math.round((wordCount.value / chapterGoal.value) * 100))
})
const chapterGoalSource = computed(() =>
  Number(chapter.value?.wordGoal) > 0 ? '本章' : '全局'
)
const chapterTodos = computed(() => chapter.value?.todos || [])
const openTodoCount = computed(
  () => chapterTodos.value.filter((t) => !t.done).length
)
/** Reactive daily goal strip — re-reads banner after recordWords mutates goals */
const dailyGoalTick = ref(0)
const dailyGoal = computed(() => {
  void dailyGoalTick.value
  return todayBanner()
})
const weekRemainHint = computed(() => {
  void dailyGoalTick.value
  const w = weekStats(7)
  if (!w.weekTarget) return ''
  const left = Math.max(0, w.weekTarget - w.total)
  if (left <= 0) return '本周目标已达成'
  return `本周还差 ${left} 字`
})

/**
 * Save current chapter. Concurrent calls coalesce: in-flight save finishes,
 * then one more run if draft/chapter still dirty (never drop the latest text).
 */
async function saveNow(silent = false, opts = {}) {
  if (!novel.value || !chapterId.value) return
  if (opts.flush) savePreferFlush = true
  if (saving.value) {
    saveAgain = true
    return saveChain
  }
  // No-op when clean and not forcing flush of pending IDB
  if (!dirty.value && !opts.flush && silent) return

  saving.value = true
  const run = (async () => {
    try {
      // loop once more if edits arrived mid-save
      // eslint-disable-next-line no-constant-condition
      while (true) {
        saveAgain = false
        const wantFlush = savePreferFlush
        // consume flush flag after scheduling this pass (leave paths set it)
        savePreferFlush = false
        const contentSnap = draft.value
        const chapterSnap = chapterId.value
        const novelSnap = novelId.value
        if (!novelSnap || !chapterSnap) break

        const wc = countWords(contentSnap)
        // Skip disk write if content unchanged vs last successful save (same chapter)
        const chapterObj = getById(novelSnap)?.chapterList?.find(
          (c) => String(c.id) === String(chapterSnap)
        )
        const unchanged =
          chapterObj &&
          chapterObj.content === contentSnap &&
          (chapterObj.wordCount || 0) === wc

        if (!unchanged) {
          await updateChapter(
            novelSnap,
            chapterSnap,
            {
              content: contentSnap,
              wordCount: wc
            },
            { backup: false, flush: wantFlush }
          )
        } else if (wantFlush) {
          // Still force IDB flush of pending novels key when leaving
          const { flushStorage } = await import('../../services/storage.js')
          await flushStorage()
        }

        // Word delta only counts if still on same chapter after await
        if (String(chapterId.value) === String(chapterSnap)) {
          const delta = wc - lastSavedWords
          if (delta > 0) {
            try {
              await recordWords(delta)
              dailyGoalTick.value++
              checkDailyGoalReached()
            } catch {
              /* ignore */
            }
          }
          lastSavedWords = wc
          checkChapterGoalReached()
        }

        novel.value = getById(novelId.value)
        saveFailRetries = 0

        if (
          draft.value === contentSnap &&
          String(chapterId.value) === String(chapterSnap)
        ) {
          dirty.value = false
          saveHint.value =
            '已保存 ' +
            new Date().toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })
          if (!silent) toast.success('已保存')
        } else {
          // User typed or switched; if still same chapter and dirty, queue another pass
          if (String(chapterId.value) === String(chapterSnap) && dirty.value) {
            saveAgain = true
            saveHint.value = '有新编辑…'
          }
        }

        if (!saveAgain) break
        // microtask yield before re-snapshot
        await Promise.resolve()
      }
    } catch (e) {
      dirty.value = true
      const raw = e?.message ? String(e.message) : ''
      const isQuota = /存储空间不足|quota/i.test(raw)
      saveHint.value = isQuota ? '空间不足' : '保存失败'
      const msg = raw ? `保存失败：${raw}` : '保存失败'
      // Auto-retry at most twice for silent autosave (not for hard quota failures)
      if (silent && !isQuota && saveFailRetries < 2) {
        saveFailRetries++
        toast.error(`${msg}（重试 ${saveFailRetries}/2）`)
        if (saveRetryTimer) clearTimeout(saveRetryTimer)
        saveRetryTimer = setTimeout(() => {
          saveRetryTimer = null
          if (dirty.value && !saving.value) void saveNow(true, { flush: true })
        }, 1500)
      } else if (isQuota) {
        toast.error(msg)
        // Offer cleanup path once
        if (!silent || saveFailRetries >= 2) {
          setTimeout(() => {
            if (confirm('存储空间不足。是否打开备份页清理回收站 / 导出数据？')) {
              router.push('/backup')
            }
          }, 300)
        }
      } else {
        toast.error(msg)
      }
    } finally {
      saving.value = false
    }
  })()
  saveChain = run.catch(() => {})
  return run
}

/** Flush pending autosave + await disk write before leaving chapter */
async function flushSaveBeforeLeave() {
  // Commit unfinished IME composition into draft before save/leave
  if (isComposing && editorEl.value) {
    isComposing = false
    const next = editorEl.value.value
    if (typeof next === 'string' && next !== draft.value) {
      armTypingBurst()
      if (typingBurstActive && draftBeforeBurst !== next) {
        if (undoStack.value[undoStack.value.length - 1] !== draftBeforeBurst) {
          pushUndo(draftBeforeBurst, true)
        }
      }
      draft.value = next
      dirty.value = true
    }
  }
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (dirty.value || saving.value) {
    await saveNow(true, { flush: true })
  }
}

async function selectChapter(id) {
  if (String(id) === String(chapterId.value)) {
    drawerOpen.value = false
    return
  }
  persistCurrentPos()
  await flushSaveBeforeLeave()
  chapterId.value = id
  loadChapterDraft()
  drawerOpen.value = false
  streamPreview.value = ''
}

async function goAdjacentChapter(dir) {
  const idx = chapterIndex.value
  if (idx < 0) return
  const next = chapters.value[idx + dir]
  if (!next) return
  await flushSaveBeforeLeave()
  persistCurrentPos()
  chapterId.value = next.id
  loadChapterDraft()
  haptic()
}

async function addNewChapter() {
  const n = (chapters.value.length || 0) + 1
  try {
    if (dirty.value) await saveNow(true)
    const c = await addChapter(novelId.value, `第${n}章`)
    novel.value = getById(novelId.value)
    if (c) {
      chapterId.value = c.id
      loadChapterDraft()
    }
    toast.success('已添加章节')
  } catch {
    toast.error('添加失败')
  }
}

/**
 * Create next chapter and stream an opening continuing from current chapter.
 */
async function newChapterAndContinue() {
  showMore.value = false
  if (isStreaming.value) return
  if (!isConfigured.value) {
    toast.warning('请先配置 API')
    router.push('/settings')
    return
  }
  if (!novel.value) return

  try {
    await flushSaveBeforeLeave()

    const prevTitle = chapter.value?.title || '上一章'
    const prevTail = String(draft.value || '')
      .replace(/<[^>]*>/g, '')
      .slice(-900)
    let prevSummary = ''
    try {
      chapterSummaries.load()
      const cached = chapterSummaries.get(chapterId.value)
      if (cached?.text && chapterSummaries.isFresh(chapterId.value, draft.value)) {
        prevSummary = cached.text
      }
    } catch {
      /* ignore */
    }

    const n = (chapters.value.length || 0) + 1
    const inheritGoal = Number(chapter.value?.wordGoal) || 0
    const c = await addChapter(novelId.value, `第${n}章`)
    novel.value = getById(novelId.value)
    if (!c) {
      toast.error('创建章节失败')
      return
    }
    if (inheritGoal > 0) {
      await updateChapter(
        novelId.value,
        c.id,
        { wordGoal: inheritGoal },
        { backup: false, flush: false }
      )
      novel.value = getById(novelId.value)
    }

    chapterId.value = c.id
    loadChapterDraft()
    drawerOpen.value = false

    applyToService()
    const ctxExtra = useContext.value ? contextBlock() : ''
    const prompt = `你是一位网络小说作者。请撰写新章节的开篇正文：
1. 只输出正文，不要标题、不要解释、不要「第${n}章」字样
2. 自然承接上一章《${prevTitle}》的情节与文风
3. 约 400～700 字，留下继续写的空间
作品：《${novel.value?.title || ''}》
${ctxExtra}
${prevSummary ? `【上一章摘要】\n${prevSummary}\n` : ''}
【上一章末尾】
${prevTail || '（开篇）'}

请开始新一章正文：`

    pushUndo(draft.value, true)
    toast.info('正在为新章生成开篇…')
    await streamGenerate(prompt, 'continue')
    unlock('ai_use')
  } catch (e) {
    if (e?.name !== 'AbortError') {
      toast.error(e?.message || '新章开写失败')
    }
  }
}

async function removeChapter() {
  if (!chapterId.value || !confirm('确定删除当前章节？')) return
  await deleteChapter(novelId.value, chapterId.value)
  novel.value = getById(novelId.value)
  chapterId.value = null
  refreshNovel()
  toast.success('已删除')
}

async function moveCh(id, dir) {
  if (dirty.value) await saveNow(true)
  await moveChapter(novelId.value, id, dir)
  novel.value = getById(novelId.value)
}

function renameChapter(c) {
  chapterId.value = c.id
  loadChapterDraft()
  openChapterMeta()
}

function openChapterQuick(c, index) {
  if (!c) return
  chapterQuick.value = {
    id: c.id,
    title: c.title,
    index,
    wordCount: c.wordCount || 0,
    content: c.content,
    notes: c.notes,
    todos: c.todos,
    wordGoal: c.wordGoal
  }
  haptic()
}

function onChapterTouchStart(c, index, ev) {
  if (chapterLongPressTimer) clearTimeout(chapterLongPressTimer)
  chapterLongPressTimer = setTimeout(() => {
    chapterLongPressTimer = null
    openChapterQuick(c, index)
  }, 480)
}

function onChapterTouchEnd() {
  if (chapterLongPressTimer) {
    clearTimeout(chapterLongPressTimer)
    chapterLongPressTimer = null
  }
}

async function quickSelectChapter() {
  const c = chapterQuick.value
  chapterQuick.value = null
  if (c) await selectChapter(c.id)
}

function quickRename() {
  const c = chapterQuick.value
  chapterQuick.value = null
  if (!c) return
  renameChapter(c)
}

function quickTodos() {
  const c = chapterQuick.value
  chapterQuick.value = null
  if (!c) return
  // switch chapter then open todos
  Promise.resolve().then(async () => {
    if (String(c.id) !== String(chapterId.value)) {
      await selectChapter(c.id)
    }
    openTodos()
  })
}

function quickInsertOutline() {
  const c = chapterQuick.value
  chapterQuick.value = null
  if (!c) return
  Promise.resolve().then(async () => {
    if (String(c.id) !== String(chapterId.value)) {
      await selectChapter(c.id)
    }
    insertTodosAsOutline(false)
  })
}

function quickAiFill() {
  const c = chapterQuick.value
  chapterQuick.value = null
  if (c) aiFillChapter(c)
}

function quickExport() {
  const c = chapterQuick.value
  chapterQuick.value = null
  if (!c) return
  Promise.resolve().then(async () => {
    if (String(c.id) !== String(chapterId.value)) {
      await selectChapter(c.id)
    }
    exportChapter()
  })
}



function openChapterMeta() {
  metaTitle.value = chapter.value?.title || ''
  metaWordGoal.value = Number(chapter.value?.wordGoal) || 0
  metaNotes.value = chapter.value?.notes || ''
  showMeta.value = true
  showMore.value = false
}

async function saveMeta() {
  const t = metaTitle.value.trim()
  if (!t || !chapterId.value) return
  const wg = Math.max(0, Math.min(50000, Number(metaWordGoal.value) || 0))
  await updateChapter(
    novelId.value,
    chapterId.value,
    { title: t, wordGoal: wg, notes: metaNotes.value || '' },
    { backup: true, flush: true }
  )
  novel.value = getById(novelId.value)
  showMeta.value = false
  toast.success(wg ? `已保存 · 目标 ${wg} 字` : '已保存章节设置')
}

function openTodos() {
  showMore.value = false
  showMeta.value = false
  showTodos.value = true
  todoDraft.value = ''
}

function openTodosFromMeta() {
  showMeta.value = false
  showTodos.value = true
  todoDraft.value = ''
}

function todoUid() {
  return `td_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

async function persistTodos(list) {
  if (!chapterId.value) return
  await updateChapter(
    novelId.value,
    chapterId.value,
    { todos: list },
    { backup: false, flush: false }
  )
  novel.value = getById(novelId.value)
}

async function addTodo() {
  const text = todoDraft.value.trim()
  if (!text || !chapterId.value) return
  const list = [...chapterTodos.value, { id: todoUid(), text, done: false }]
  todoDraft.value = ''
  await persistTodos(list)
  unlock('todo_1')
  haptic()
}

async function toggleTodo(id) {
  const list = chapterTodos.value.map((t) =>
    String(t.id) === String(id) ? { ...t, done: !t.done } : t
  )
  await persistTodos(list)
  if (list.every((t) => t.done) && list.length) {
    toast.success('本章待办已全部完成')
    haptic()
  }
}

async function removeTodo(id) {
  await persistTodos(chapterTodos.value.filter((t) => String(t.id) !== String(id)))
}

async function clearDoneTodos() {
  const left = chapterTodos.value.filter((t) => !t.done)
  await persistTodos(left)
  toast.success('已清除完成项')
}

function formatTodosOutline(onlyOpen = false) {
  const list = onlyOpen
    ? chapterTodos.value.filter((t) => !t.done)
    : chapterTodos.value
  if (!list.length) return ''
  const title = chapter.value?.title || '本章'
  const lines = [`【${title} · 写作提纲】`]
  list.forEach((t, i) => {
    const mark = t.done ? '✓' : '○'
    lines.push(`${i + 1}. ${mark} ${t.text}`)
  })
  if (chapter.value?.notes) {
    lines.push('')
    lines.push(`备注：${chapter.value.notes}`)
  }
  return lines.join('\n')
}


function openBookTodos() {
  showMore.value = false
  showTodos.value = false
  showBookTodos.value = true
  bookTodoFilter.value = 'open'
}

function exportBookTodos(mode = 'open') {
  const rows = []
  ;(chapters.value || []).forEach((c, chapterIndex) => {
    ;(c.todos || []).forEach((todo) => {
      if (mode === 'open' && todo.done) return
      if (mode === 'done' && !todo.done) return
      rows.push({
        chapterIndex,
        chapterTitle: c.title || `第${chapterIndex + 1}章`,
        text: todo.text,
        done: !!todo.done,
        notes: c.notes || ''
      })
    })
  })
  if (!rows.length) {
    toast.info(mode === 'open' ? '没有未完成待办' : '没有待办')
    return
  }
  const title = novel.value?.title || '未命名'
  const lines = [
    `# 《${title}》待办清单`,
    '',
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    `筛选：${mode === 'open' ? '未完成' : mode === 'done' ? '已完成' : '全部'} · 共 ${rows.length} 项`,
    ''
  ]
  let lastCh = null
  for (const r of rows) {
    const chKey = r.chapterIndex
    if (chKey !== lastCh) {
      lines.push(`## 第${r.chapterIndex + 1}章 ${r.chapterTitle}`)
      if (r.notes) lines.push(`> 备注：${r.notes.replace(/\n/g, ' ')}`)
      lines.push('')
      lastCh = chKey
    }
    lines.push(`- [${r.done ? 'x' : ' '}] ${r.text}`)
  }
  lines.push('')
  downloadText(
    `${safeName(title)}-todos.md`,
    lines.join('\n'),
    'text/markdown;charset=utf-8'
  )
  toast.success(`已导出 ${rows.length} 条待办`)
  haptic()
}



async function jumpToChapterTodo(row) {
  showBookTodos.value = false
  if (!row?.chapterId) return
  if (String(row.chapterId) !== String(chapterId.value)) {
    await flushSaveBeforeLeave()
    persistCurrentPos()
    chapterId.value = row.chapterId
    loadChapterDraft()
  }
  // open chapter todos focused
  showTodos.value = true
  toast.info(`已定位：${row.chapterTitle}`)
  haptic()
}

async function toggleBookTodo(row) {
  if (!row?.chapterId || !row?.todoId) return
  const novel = getById(novelId.value)
  const ch = (novel?.chapterList || []).find((c) => String(c.id) === String(row.chapterId))
  if (!ch) return
  const list = (ch.todos || []).map((t) =>
    String(t.id) === String(row.todoId) ? { ...t, done: !t.done } : t
  )
  await updateChapter(
    novelId.value,
    row.chapterId,
    { todos: list },
    { backup: false, flush: false }
  )
  novel.value = getById(novelId.value)
  haptic()
}

function insertTodosAsOutline(onlyOpen = false) {
  const text = formatTodosOutline(onlyOpen)
  if (!text) {
    toast.info(onlyOpen ? '没有未完成的待办' : '暂无待办')
    return
  }
  // Insert at cursor as a block
  insertText((draft.value && !draft.value.endsWith('\n') ? '\n\n' : '') + text + '\n\n')
  showTodos.value = false
  toast.success(onlyOpen ? '已插入未完成提纲' : '已插入提纲')
  haptic()
}


function checkChapterGoalReached() {
  const goal = chapterGoal.value
  if (!goal || goalReachedNotified) return
  if (wordCount.value >= goal) {
    goalReachedNotified = true
    toast.success(`🎉 本章目标达成（${goal} 字）`)
    haptic()
  }
}

let dailyGoalNotified = false
function checkDailyGoalReached() {
  const g = todayBanner()
  if (!g || dailyGoalNotified) return
  if ((g.progress || 0) >= (g.target || 0) && g.target > 0) {
    dailyGoalNotified = true
    toast.success(`🔥 今日目标达成（${g.target} 字）`)
    haptic()
  }
}

function openNovelEdit() {
  showMore.value = false
  Object.assign(novelForm, {
    title: novel.value?.title || '',
    author: novel.value?.author || '',
    genre: novel.value?.genre || 'fantasy',
    status: novel.value?.status || 'writing',
    description: novel.value?.description || ''
  })
  showNovelEdit.value = true
}

async function saveNovelInfo() {
  await updateNovel(novelId.value, {
    title: novelForm.title.trim() || '未命名',
    author: novelForm.author.trim(),
    genre: novelForm.genre,
    status: novelForm.status,
    description: novelForm.description
  })
  novel.value = getById(novelId.value)
  showNovelEdit.value = false
  toast.success('作品信息已保存')
}

function goExtras() {
  showMore.value = false
  router.push(`/extras/${novelId.value}`)
}

function toggleContext() {
  useContext.value = !useContext.value
  toast.info(useContext.value ? 'AI 将引用角色/世界观等设定' : '已关闭设定引用')
}

function toggleReading() {
  toggleReadingMode()
  showMore.value = false
  toast.info(prefs.value.readingMode ? '阅读模式已开' : '阅读模式已关')
}

async function takeSnapshot() {
  showMore.value = false
  if (dirty.value) await saveNow(true)
  await snaps.addSnapshot({
    chapterId: chapterId.value,
    chapterTitle: chapter.value?.title,
    content: draft.value,
    note: 'manual'
  })
  toast.success('快照已保存')
}

function openSnapshots() {
  showMore.value = false
  snaps.load()
  showSnapshots.value = true
}

function formatSnapTime(t) {
  try {
    return new Date(t).toLocaleString('zh-CN')
  } catch {
    return ''
  }
}

async function restoreSnapshot(s) {
  if (!confirm('用快照覆盖当前章节正文？')) return
  pushUndo(draft.value, true)
  draft.value = s.content || ''
  dirty.value = true
  await saveNow(true)
  showSnapshots.value = false
  showDiff.value = false
  toast.success('已恢复快照')
}

function compareSnapshot(s) {
  diffSnapshot.value = s
  diffRows.value = diffLines(s.content || '', draft.value)
  showDiff.value = true
  showSnapshots.value = false
}

async function deleteSnapshot(s) {
  await snaps.removeSnapshot(s.id)
  snaps.load()
  toast.success('已删除快照')
}

function openOutlineImport() {
  showMore.value = false
  outlineText.value = ''
  outlineReplace.value = false
  showOutline.value = true
}

async function importOutline() {
  const stubs = parseOutlineToChapters(outlineText.value)
  if (!stubs.length) {
    toast.warning('未能解析出章节')
    return
  }
  if (outlineReplace.value && !confirm(`将替换为 ${stubs.length} 章，确定？`)) return
  if (dirty.value) await saveNow(true)
  await importChaptersFromOutline(novelId.value, stubs, { replace: outlineReplace.value })
  novel.value = getById(novelId.value)
  chapterId.value = null
  refreshNovel()
  showOutline.value = false
  toast.success(`已导入 ${stubs.length} 章`)
}

function exportChapter() {
  if (!chapter.value) return
  const ch = { ...chapter.value, content: draft.value }
  let text = exportChapterText(novel.value, ch)
  // Append notes & todos as appendix for practical handoff
  const appendix = []
  if (ch.notes) appendix.push('【备注】\n' + ch.notes)
  if (Array.isArray(ch.todos) && ch.todos.length) {
    appendix.push(
      '【待办】\n' +
        ch.todos.map((t, i) => `${i + 1}. [${t.done ? 'x' : ' '}] ${t.text}`).join('\n')
    )
  }
  if (appendix.length) text = text + '\n\n' + '-'.repeat(24) + '\n' + appendix.join('\n\n')
  downloadText(`${novel.value.title}-${chapter.value.title}.txt`, text)
  toast.success('已导出本章')
  showMore.value = false
}

async function exportBook() {
  await flushSaveBeforeLeave()
  const n = getById(novelId.value)
  downloadText(`${safeName(n?.title)}.txt`, exportNovelText(n))
  unlock('export_1')
  toast.success('已导出全书')
  showMore.value = false
}

async function exportBookMd() {
  await flushSaveBeforeLeave()
  const n = getById(novelId.value)
  downloadText(`${safeName(n?.title)}.md`, novelToMarkdown(n), 'text/markdown;charset=utf-8')
  unlock('export_1')
  toast.success('已导出 Markdown')
  showMore.value = false
}

async function exportBookEpub() {
  await flushSaveBeforeLeave()
  const n = getById(novelId.value)
  try {
    const bytes = novelToEpub(n)
    downloadBinary(`${safeName(n?.title)}.epub`, bytes, 'application/epub+zip')
    unlock('export_1')
    toast.success('已导出 EPUB')
  } catch (e) {
    toast.error(e?.message || 'EPUB 导出失败')
  }
  showMore.value = false
}

function openChat() {
  showMore.value = false
  chat.load()
  showChat.value = true
}

function closeChat() {
  if (chatAbort) chatAbort.abort()
  showChat.value = false
  chatStream.value = ''
}

async function sendChat() {
  if (!isConfigured.value) {
    toast.warning('请先配置 API')
    router.push('/settings')
    return
  }
  const text = chatInput.value.trim()
  if (!text) return
  chatInput.value = ''
  applyToService()
  chatAbort = new AbortController()
  chatStream.value = ''
  const extra = `当前作品《${novel.value?.title || ''}》章节「${chapter.value?.title || ''}」。\n正文末尾：\n${draft.value.slice(-800)}\n${extras.buildContextSummary?.() || ''}`
  try {
    await chat.send(text, {
      systemExtra: extra,
      signal: chatAbort.signal,
      onChunk: (f) => {
        chatStream.value = f
      }
    })
    chatStream.value = ''
    unlock('ai_use')
  } catch (e) {
    if (e?.name !== 'AbortError') toast.error(e?.message || '对话失败')
  }
}

async function clearChat() {
  await chat.clear()
  chatStream.value = ''
}

function openBatchGen() {
  showMore.value = false
  batchStatus.value = ''
  showBatch.value = true
}

function stopBatch() {
  if (batchAbort) batchAbort.abort()
}

async function runBatchGen() {
  if (!isConfigured.value) {
    toast.warning('请先配置 API')
    router.push('/settings')
    return
  }
  const targets = emptyChapterTargets.value.slice()
  if (!targets.length) return
  batchRunning.value = true
  applyToService()
  keepScreenOn(true)
  batchAbort = new AbortController()
  try {
    for (let i = 0; i < targets.length; i++) {
      if (batchAbort.signal.aborted) break
      const c = targets[i]
      batchStatus.value = `生成 ${i + 1}/${targets.length} · ${c.title}`
      const prev =
        i > 0
          ? String(targets[i - 1].content || '').slice(-400)
          : draft.value.slice(-400)
      const prompt = `请为小说《${novel.value?.title || ''}》撰写章节正文。\n章节标题：${c.title}\n要求：约 600～1000 字，只输出正文。\n${prev ? '上文参考：\n' + prev : ''}`
      let full = ''
      try {
        full = await apiService.generateTextStream(
          prompt,
          { type: 'batch', signal: batchAbort.signal },
          (_c, f) => {
            full = f
          }
        )
      } catch (e) {
        if (e?.name === 'AbortError' || e?.message === 'GENERATION_ABORTED') {
          full = e.partial || full
        } else {
          toast.error(`${c.title} 失败：` + (e.message || e))
          continue
        }
      }
      if (full) {
        await updateChapter(novelId.value, c.id, { content: full, wordCount: countWords(full) })
        novel.value = getById(novelId.value)
      }
      if (batchAbort.signal.aborted) break
    }
    unlock('ai_use')
    toast.success(batchAbort.signal.aborted ? '已停止批量生成' : '批量生成完成')
  } finally {
    batchRunning.value = false
    keepScreenOn(false)
    batchAbort = null
    batchStatus.value = ''
    novel.value = getById(novelId.value)
  }
}


function isChapterEmpty(c) {
  if (!c) return true
  return (c.wordCount || 0) < 50 && !String(c.content || '').trim()
}

/**
 * Fill a single empty chapter with AI, using previous chapter context.
 */
async function aiFillChapter(target) {
  if (!target?.id || isStreaming.value || batchRunning.value || fillingChapterId.value) return
  if (!isConfigured.value) {
    toast.warning('请先配置 API')
    router.push('/settings')
    return
  }
  if (!isChapterEmpty(target)) {
    toast.info('该章已有正文')
    return
  }

  // Save current work first if editing another chapter
  try {
    await flushSaveBeforeLeave()
  } catch {
    /* continue */
  }

  const list = chapters.value
  const idx = list.findIndex((c) => String(c.id) === String(target.id))
  let prevTail = ''
  let prevTitle = ''
  if (idx > 0) {
    const prev = list[idx - 1]
    prevTitle = prev?.title || ''
    prevTail = String(prev?.content || '').replace(/<[^>]*>/g, '').slice(-800)
  } else if (String(chapterId.value) === String(target.id)) {
    prevTail = draft.value.slice(-400)
  }

  // Include chapter notes / open todos as writing hints
  const notes = String(target.notes || '').trim()
  const todos = (target.todos || []).filter((x) => !x.done).map((x) => x.text).slice(0, 6)
  const goal = Number(target.wordGoal) || Number(prefs.value.chapterWordGoal) || 800
  const wordsHint = Math.min(1200, Math.max(500, goal || 800))

  applyToService()
  fillingChapterId.value = target.id
  keepScreenOn(true)
  const fillAbort = new AbortController()
  // allow stop via main stop if we set abortController
  abortController = fillAbort
  isStreaming.value = true
  aiMode.value = 'fill'
  saveHint.value = `AI 填章：${target.title || ''}…`

  const prompt = `你是一位网络小说作者。请撰写章节正文：
1. 只输出正文，不要章节标题，不要解释
2. 约 ${wordsHint} 字，文风连贯
3. 若有上一章内容，请自然承接
作品：《${novel.value?.title || ''}》
章节标题：${target.title || '未命名'}
${prevTitle ? `上一章：《${prevTitle}》` : ''}
${notes ? `【本章备注】\n${notes}\n` : ''}
${todos.length ? `【本章待办/要点】\n- ${todos.join('\n- ')}\n` : ''}
${useContext.value ? contextBlock() : ''}
${prevTail ? `【上文末尾】\n${prevTail}\n` : ''}
请输出本章正文：`

  let full = ''
  try {
    full = await apiService.generateTextStream(
      prompt,
      { type: 'fill-chapter', signal: fillAbort.signal },
      (_c, f) => {
        full = f
        // If user is viewing this chapter, live-update draft
        if (String(chapterId.value) === String(target.id)) {
          draft.value = f
          dirty.value = true
          saveHint.value = `生成中 ${countWords(f)} 字…`
        } else {
          saveHint.value = `填章中 ${countWords(f)} 字 · ${target.title || ''}`
        }
      }
    )
  } catch (e) {
    if (e?.name === 'AbortError' || e?.message === 'GENERATION_ABORTED') {
      full = e.partial || full
      toast.info('已停止填章')
    } else {
      toast.error(e?.message || '填章失败')
      full = full || ''
    }
  } finally {
    isStreaming.value = false
    abortController = null
    fillingChapterId.value = null
    keepScreenOn(false)
  }

  if (full) {
    const wc = countWords(full)
    await updateChapter(
      novelId.value,
      target.id,
      { content: full, wordCount: wc },
      { backup: false, flush: true }
    )
    novel.value = getById(novelId.value)
    if (String(chapterId.value) === String(target.id)) {
      draft.value = full
      lastSavedWords = wc
      dirty.value = false
      saveHint.value = '已保存'
    }
    unlock('ai_use')
    unlock('fill_1')
    toast.success(`「${target.title || '章节'}」已生成 · ${wc} 字`)
    haptic()
  } else {
    saveHint.value = '已保存'
  }
}

function runConsistency() {
  showMore.value = false
  extras.loadAll()
  issues.value = checkNovelConsistency(novel.value, {
    characters: extras.characters.value
  })
  showIssues.value = true
}

async function jumpIssue(iss) {
  showIssues.value = false
  if (!iss?.chapterId) return
  if (String(iss.chapterId) !== String(chapterId.value)) {
    if (dirty.value) await saveNow(true)
    persistCurrentPos()
    chapterId.value = iss.chapterId
    loadChapterDraft()
  }
}

async function onProfileChange(id) {
  if (!id) return
  const ok = await activateProfile(id)
  toast.info(ok ? '已切换模型档案' : '切换失败')
}

function openPromptSheet() {
  if (!isConfigured.value) {
    toast.warning('请先配置 API')
    router.push('/settings')
    return
  }
  customPrompt.value = ''
  showPrompt.value = true
}

function openPromptPick() {
  loadPrompts()
  showPromptPick.value = true
}

function contextBlock() {
  if (!useContext.value) return ''
  const s = extras.buildContextSummary()
  return s ? `\n\n${s}\n` : ''
}

function buildPrompt(mode, extra = '', targetText = '') {
  const title = novel.value?.title || ''
  const genre = novel.value?.genre || ''
  const chapterTitle = chapter.value?.title || ''
  const body = draft.value || ''
  const n = contextChars.value
  const tail = body.slice(-n)
  const ctx = contextBlock()
  const prev = prevChapterSummary()

  if (mode === 'continue') {
    return `你是一位网络小说作者。请根据上下文续写正文：
1. 只输出续写正文，无标题无解释
2. 保持人称与文风
3. 约 400～800 字
${ctx}
作品：《${title}》 类型：${genre}
章节：${chapterTitle}
${prev}
【上文】
${tail || '（开篇）'}

请续写：`
  }
  if (mode === 'polish' || mode === 'sel-polish') {
    const sel = targetText || body.slice(-Math.min(n, 2000)) || body
    return `请润色以下正文，保持原意与人称，只输出润色结果：\n\n【原文】\n${sel}`
  }
  if (mode === 'expand' || mode === 'sel-expand') {
    const sel = targetText || body.slice(-Math.min(n, 1500)) || body
    return `请扩写以下片段（约 2 倍篇幅、更细腻），只输出正文：\n\n【原文】\n${sel}`
  }
  if (mode === 'template') {
    return extra
  }
  return `你是一位网络小说作者。作品：《${title}》，章节：${chapterTitle}。
${ctx}${prev}
用户指令：${extra}

【正文末尾】
${tail || '（空）'}

请按指令输出正文（不要解释）：`
}

async function runAi(mode) {
  if (!isConfigured.value) {
    toast.warning('请先配置 API')
    router.push('/settings')
    return
  }
  if (isStreaming.value) return
  captureSelection()
  if (dirty.value) await saveNow(true)
  applyToService()

  selectionOp = null
  let type = mode
  let target = ''
  if ((mode === 'polish' || mode === 'expand') && hasSelection.value) {
    target = draft.value.slice(selStart.value, selEnd.value)
    selectionOp = {
      start: selStart.value,
      end: selEnd.value,
      original: target
    }
    type = mode === 'polish' ? 'sel-polish' : 'sel-expand'
  }
  pushUndo(draft.value, true)
  await streamGenerate(buildPrompt(type, '', target), type)
}

async function runCustom() {
  const p = customPrompt.value.trim()
  if (!p) return
  showPrompt.value = false
  if (dirty.value) await saveNow(true)
  applyToService()
  await streamGenerate(buildPrompt('custom', p), 'custom')
}

async function usePrompt(p) {
  showPromptPick.value = false
  if (!isConfigured.value) {
    toast.warning('请先配置 API')
    router.push('/settings')
    return
  }
  await bumpUsage(p.id)
  const n = contextChars.value
  const filled = applyTemplate(p.content, {
    context: draft.value.slice(-n),
    original: hasSelection.value
      ? draft.value.slice(selStart.value, selEnd.value)
      : draft.value.slice(-Math.min(n, 2000)),
    title: novel.value?.title,
    genre: novel.value?.genre,
    description: novel.value?.description,
    chapter: chapter.value?.title
  })
  if (dirty.value) await saveNow(true)
  applyToService()
  pushUndo(draft.value, true)
  const mode = p.category === 'polish' ? 'polish' : 'template'
  selectionOp = null
  await streamGenerate(
    mode === 'polish'
      ? buildPrompt('polish', '', hasSelection.value ? draft.value.slice(selStart.value, selEnd.value) : '')
      : buildPrompt('template', filled + contextBlock()),
    mode === 'polish' ? (hasSelection.value ? 'sel-polish' : 'polish') : 'custom'
  )
}

function applyGenerated(type, before, full) {
  if (!full) return
  if (type === 'sel-polish' || type === 'sel-expand') {
    if (selectionOp) {
      draft.value =
        before.slice(0, selectionOp.start) + full + before.slice(selectionOp.end)
    } else {
      draft.value = full
    }
    dirty.value = true
    return
  }
  if (type === 'polish' || type === 'expand') {
    const n = Math.min(contextChars.value, type === 'expand' ? 1500 : 2000)
    draft.value = before.length > n ? before.slice(0, -n) + full : full
    dirty.value = true
    return
  }
  // append modes already live-updated; ensure final
  draft.value = before + full
  dirty.value = true
}

function flushStreamUi() {
  streamRaf = 0
  const job = pendingStreamUi
  pendingStreamUi = null
  if (!job) return
  const { full, isAppend, before } = job
  streamPreview.value = full
  if (isAppend) draft.value = before + full
  dirty.value = true
  // Word count every paint frame is enough; avoid counting on every SSE chunk
  saveHint.value = `生成中 ${countWords(full)} 字…`
  const el = editorEl.value
  if (el) el.scrollTop = el.scrollHeight
}

function scheduleStreamUi(full, isAppend, before) {
  pendingStreamUi = { full, isAppend, before }
  if (streamRaf) return
  streamRaf = requestAnimationFrame(flushStreamUi)
}

function cancelStreamUi() {
  if (streamRaf) {
    cancelAnimationFrame(streamRaf)
    streamRaf = 0
  }
  pendingStreamUi = null
}

async function streamGenerate(prompt, type) {
  isStreaming.value = true
  keepScreenOn(true)
  aiMode.value = type
  streamPreview.value = ''
  streamBuffer = ''
  cancelStreamUi()
  abortController = new AbortController()
  const isAppend = type === 'continue' || type === 'custom' || type === 'template'
  const before = draft.value

  try {
    await apiService.generateTextStream(
      prompt,
      { type: type || 'generation', signal: abortController.signal },
      (_chunk, full) => {
        streamBuffer = full
        // Coalesce DOM/Vue updates to ~1 per frame — critical on Android WebView
        scheduleStreamUi(full, isAppend, before)
      }
    )

    // Apply any pending frame before finalizing
    if (pendingStreamUi) flushStreamUi()

    if (!isAppend) applyGenerated(type, before, streamBuffer)
    else if (streamBuffer) draft.value = before + streamBuffer

    streamPreview.value = ''
    selectionOp = null
    await saveNow(true)
    unlock('ai_use')
    toast.success(`生成完成 · ${countWords(streamBuffer)} 字`)
  } catch (e) {
    if (pendingStreamUi) flushStreamUi()
    if (e?.name === 'AbortError' || e?.message === 'GENERATION_ABORTED') {
      const partial = e.partial || streamBuffer
      if (partial) {
        if (isAppend) draft.value = before + partial
        else applyGenerated(type, before, partial)
        dirty.value = true
      }
      await saveNow(true)
      toast.info(`已停止 · 保留 ${countWords(partial)} 字`)
    } else {
      console.error(e)
      if (streamBuffer && isAppend) await saveNow(true)
      toast.error(e?.message || '生成失败')
    }
  } finally {
    cancelStreamUi()
    isStreaming.value = false
    keepScreenOn(false)
    abortController = null
    streamPreview.value = ''
    selectionOp = null
  }
}

function stopStream() {
  if (abortController) {
    abortController.abort()
  }
}

function showSessionSummary() {
  if (!prefs.value.showSessionStats) return
  const delta = Math.max(0, wordCount.value - sessionStartWords.value)
  const sec = Math.max(0, Math.floor((Date.now() - sessionStartedAt.value) / 1000))
  if (delta < 30 && sec < 60) return // skip tiny sessions
  const m = Math.floor(sec / 60)
  const s = sec % 60
  const time = m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`
  const parts = [`本段写作 +${delta} 字 · ${time}`]
  const g = todayBanner()
  if (g?.target) {
    const left = Math.max(0, g.target - (g.progress || 0))
    parts.push(left ? `今日还差 ${left} 字` : '今日目标已达成')
  }
  const w = weekStats(7)
  if (w.weekTarget) {
    const left = Math.max(0, w.weekTarget - w.total)
    parts.push(left ? `本周还差 ${left} 字` : '本周目标已达成')
  }
  toast.success(parts.join(' · '))
}

async function goBack() {
  persistCurrentPos()
  await flushSaveBeforeLeave()
  showSessionSummary()
  router.push('/')
}

/* ---------- find / replace ---------- */
function openFind() {
  showMore.value = false
  showFind.value = true
  findCursor.value = editorEl.value?.selectionStart ?? 0
  nextTick(() => findInputEl.value?.focus())
}

function closeFind() {
  showFind.value = false
}

function selectInEditor(start, end) {
  const el = editorEl.value
  if (!el) return
  nextTick(() => {
    try {
      el.focus()
      el.setSelectionRange(start, end)
      // approximate scroll into view
      const ratio = start / Math.max(1, el.value.length)
      el.scrollTop = Math.max(0, ratio * el.scrollHeight - el.clientHeight / 3)
      selStart.value = start
      selEnd.value = end
      findCursor.value = end
    } catch {
      /* ignore */
    }
  })
}

function findStep(dir) {
  const q = findQuery.value
  if (!q) {
    toast.info('请输入查找内容')
    return
  }
  const opts = { caseSensitive: findCase.value }
  const from =
    dir > 0
      ? Math.max(findCursor.value, editorEl.value?.selectionEnd ?? 0)
      : Math.min(findCursor.value, editorEl.value?.selectionStart ?? 0)
  let m = dir > 0 ? findNext(draft.value, q, from, opts) : findPrev(draft.value, q, from, opts)
  if (!m) {
    // wrap
    m =
      dir > 0
        ? findNext(draft.value, q, 0, opts)
        : findPrev(draft.value, q, draft.value.length, opts)
  }
  if (!m) {
    toast.info('未找到')
    return
  }
  selectInEditor(m.start, m.end)
  haptic()
}

function replaceCurrent() {
  const q = findQuery.value
  if (!q) return
  const opts = { caseSensitive: findCase.value }
  const from = editorEl.value?.selectionStart ?? findCursor.value ?? 0
  // If current selection is already a match, replace it; else find next
  const sel = draft.value.slice(selStart.value, selEnd.value)
  const selMatch =
    findCase.value ? sel === q : sel.toLowerCase() === q.toLowerCase()
  let result
  if (selMatch && selEnd.value > selStart.value) {
    result = {
      text:
        draft.value.slice(0, selStart.value) +
        replaceWith.value +
        draft.value.slice(selEnd.value),
      start: selStart.value,
      end: selStart.value + replaceWith.value.length
    }
  } else {
    result = replaceOne(draft.value, q, replaceWith.value, from, opts)
  }
  if (!result) {
    toast.info('未找到可替换项')
    return
  }
  pushUndo(draft.value, true)
  draft.value = result.text
  dirty.value = true
  scheduleSave()
  selectInEditor(result.start, result.end)
  findCursor.value = result.end
  haptic()
}

function replaceAllInChapter() {
  const q = findQuery.value
  if (!q) return
  const { text, count } = replaceAllText(draft.value, q, replaceWith.value, {
    caseSensitive: findCase.value
  })
  if (!count) {
    toast.info('未找到')
    return
  }
  if (!confirm(`将替换本章 ${count} 处，确定？`)) return
  pushUndo(draft.value, true)
  draft.value = text
  dirty.value = true
  scheduleSave()
  toast.success(`已替换 ${count} 处`)
  haptic()
}

/* ---------- book search ---------- */
function openBookSearch() {
  showMore.value = false
  showBookSearch.value = true
  bookSearched.value = false
  nextTick(() => bookSearchInputEl.value?.focus())
}

function closeBookSearch() {
  cancelBookSearch()
  showBookSearch.value = false
}

async function runBookSearch() {
  const q = bookQuery.value.trim()
  if (!q) return
  // Ensure current draft is visible to search
  const list = chapters.value.map((c) =>
    String(c.id) === String(chapterId.value)
      ? { ...c, content: draft.value }
      : c
  )
  bookSearched.value = true
  const hits = await searchBook(list, q, { caseSensitive: bookCase.value })
  if (!hits.length) toast.info('无结果')
}

async function jumpToSearchHit(hit) {
  showBookSearch.value = false
  if (String(hit.chapterId) !== String(chapterId.value)) {
    if (dirty.value) await saveNow(true)
    persistCurrentPos()
    skipNextPosRestore = true
    chapterId.value = hit.chapterId
    loadChapterDraft()
  }
  await nextTick()
  if (hit.inTitle) {
    toast.info(`已定位到「${hit.chapterTitle}」`)
    return
  }
  selectInEditor(hit.start, hit.end)
  haptic()
}

/* ---------- chapter summary ---------- */
async function generateChapterSummary() {
  showMore.value = false
  if (!isConfigured.value) {
    toast.warning('请先配置 API')
    router.push('/settings')
    return
  }
  if (!chapterId.value) return
  if (summarizing.value) return
  if (dirty.value) await saveNow(true)
  const content = draft.value
  if (chapterSummaries.isFresh(chapterId.value, content)) {
    summaryText.value = chapterSummaries.get(chapterId.value)?.text || ''
    showSummary.value = true
    toast.info('摘要仍是最新，已展示缓存')
    return
  }
  if (!content.trim()) {
    toast.warning('正文为空')
    return
  }
  summarizing.value = true
  applyToService()
  keepScreenOn(true)
  try {
    const prompt = chapterSummaries.buildSummaryPrompt(chapter.value?.title, content)
    const text = await apiService.generateTextStream(prompt, {
      type: 'summary',
      maxTokens: 600
    })
    await chapterSummaries.set(chapterId.value, text, content)
    summaryText.value = (text || '').trim()
    showSummary.value = true
    toast.success('摘要已保存')
  } catch (e) {
    toast.error(e?.message || '摘要失败')
  } finally {
    summarizing.value = false
    keepScreenOn(false)
  }
}

/* ---------- pomodoro / session ---------- */
function startSessionClock() {
  sessionStartedAt.value = Date.now()
  sessionStartWords.value = countWords(draft.value)
  if (sessionTimer) clearInterval(sessionTimer)
  sessionTimer = setInterval(() => {
    sessionTick.value++
  }, 1000)
}

function stopSessionClock() {
  if (sessionTimer) {
    clearInterval(sessionTimer)
    sessionTimer = null
  }
  if (pomodoroTimer) {
    clearInterval(pomodoroTimer)
    pomodoroTimer = null
  }
  pomodoroLeft.value = 0
}

function startPomodoro(minutes) {
  const m = Number(minutes) || 0
  if (!m) {
    if (pomodoroTimer) clearInterval(pomodoroTimer)
    pomodoroTimer = null
    pomodoroLeft.value = 0
    return
  }
  pomodoroLeft.value = m * 60
  if (pomodoroTimer) clearInterval(pomodoroTimer)
  pomodoroTimer = setInterval(() => {
    if (pomodoroLeft.value <= 1) {
      pomodoroLeft.value = 0
      clearInterval(pomodoroTimer)
      pomodoroTimer = null
      toast.success('专注时间到，休息一下吧')
      haptic()
      return
    }
    pomodoroLeft.value--
    sessionTick.value++
  }, 1000)
}

function togglePomodoro() {
  showMore.value = false
  const cycle = [0, 25, 45, 15]
  const cur = prefs.value.pomodoroMinutes || 0
  const idx = cycle.indexOf(cur)
  const next = cycle[(idx + 1) % cycle.length]
  setPomodoroMinutes(next)
  startPomodoro(next)
  toast.info(next ? `专注 ${next} 分钟` : '已关闭专注计时')
}

function onKeydown(e) {
  // Esc closes topmost overlay
  if (e.key === 'Escape') {
    if (showFind.value) {
      closeFind()
      e.preventDefault()
    } else if (showBookSearch.value) {
      closeBookSearch()
      e.preventDefault()
    } else if (showDiff.value) {
      showDiff.value = false
      e.preventDefault()
    } else if (showSummary.value) {
      showSummary.value = false
      e.preventDefault()
    } else if (showMore.value) {
      showMore.value = false
      e.preventDefault()
    } else if (drawerOpen.value) {
      drawerOpen.value = false
      e.preventDefault()
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault()
    openFind()
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    saveNow(false)
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    undoLast()
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    redoLast()
  }
}

watch(novelId, async () => {
  persistCurrentPos()
  await flushSaveBeforeLeave()
  await load()
  refreshNovel()
  startSessionClock()
  startPomodoro(prefs.value.pomodoroMinutes || 0)
})

function onVisibility() {
  if (document.visibilityState === 'hidden') {
    if (burstIdleTimer) clearTimeout(burstIdleTimer)
    typingBurstActive = false
    draftBeforeBurst = draft.value
    persistCurrentPos()
    void flushSaveBeforeLeave()
  }
}

async function consumeAutofillQuery() {
  const q = route.query || {}
  const wantChapter = q.chapter != null ? String(q.chapter) : ''
  const wantFill = String(q.autofill || '') === '1'
  if (!wantChapter && !wantFill) return
  try {
    router.replace({ path: route.path, query: {} })
  } catch {
    /* ignore */
  }
  if (wantChapter && String(chapterId.value) !== wantChapter) {
    const exists = (chapters.value || []).some((c) => String(c.id) === wantChapter)
    if (exists) {
      chapterId.value = wantChapter
      loadChapterDraft()
    }
  }
  await nextTick()
  if (!wantFill) return
  const ch = chapter.value
  if (ch && isChapterEmpty(ch) && isConfigured.value && !isStreaming.value) {
    toast.info('正在 AI 填章…')
    await aiFillChapter(ch)
  } else if (ch && !isChapterEmpty(ch)) {
    toast.info('该章已有正文')
  } else if (!isConfigured.value) {
    toast.warning('请先配置 API 后再填章')
  }
}

onMounted(async () => {
  await load()
  loadGoals()
  loadPrompts()
  loadProfiles()
  chapterSummaries.load()
  chat.load()
  refreshNovel()
  startSessionClock()
  startPomodoro(prefs.value.pomodoroMinutes || 0)
  // Don't re-toast if already met today
  const g = todayBanner()
  if (g && g.target > 0 && (g.progress || 0) >= g.target) dailyGoalNotified = true
  dailyGoalTick.value++
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('visibilitychange', onVisibility)
  // Deep-link from Stats empty-chapter list
  setTimeout(() => {
    consumeAutofillQuery().catch(() => {})
  }, 120)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('visibilitychange', onVisibility)
  if (saveTimer) clearTimeout(saveTimer)
  if (burstIdleTimer) clearTimeout(burstIdleTimer)
  if (saveRetryTimer) clearTimeout(saveRetryTimer)
  if (chapterLongPressTimer) clearTimeout(chapterLongPressTimer)
  if (posSaveTimer) clearTimeout(posSaveTimer)
  stopSessionClock()
  cancelStreamUi()
  cancelBookSearch()
  if (abortController) {
    try { abortController.abort() } catch { /* ignore */ }
    abortController = null
  }
  if (chatAbort) {
    try { chatAbort.abort() } catch { /* ignore */ }
    chatAbort = null
  }
  if (batchAbort) {
    try { batchAbort.abort() } catch { /* ignore */ }
    batchAbort = null
  }
  keepScreenOn(false)
  persistCurrentPos()
  void flushSaveBeforeLeave()
  try {
    delete window.__writing91ConsumeBack
  } catch {
    /* ignore */
  }
})

/** Android back key: close overlays before leaving writer */
function consumeBack() {
  if (chapterQuick.value) {
    chapterQuick.value = null
    return true
  }
  if (showBookTodos.value) {
    showBookTodos.value = false
    return true
  }
  if (showTodos.value) {
    showTodos.value = false
    return true
  }
  if (showInspiration.value) {
    showInspiration.value = false
    return true
  }
  if (showFind.value) {
    closeFind()
    return true
  }
  if (showBookSearch.value) {
    closeBookSearch()
    return true
  }
  if (showChat.value) {
    closeChat()
    return true
  }
  if (showBatch.value && !batchRunning.value) {
    showBatch.value = false
    return true
  }
  if (showIssues.value) {
    showIssues.value = false
    return true
  }
  if (showDiff.value) {
    showDiff.value = false
    return true
  }
  if (showSummary.value) {
    showSummary.value = false
    return true
  }
  if (showSnapshots.value) {
    showSnapshots.value = false
    return true
  }
  if (showPrompt.value || showPromptPick.value || showMeta.value || showNovelEdit.value || showOutline.value || showInsertChar.value || showInspiration.value) {
    showPrompt.value = false
    showPromptPick.value = false
    showMeta.value = false
    showNovelEdit.value = false
    showOutline.value = false
    showInsertChar.value = false
    showInspiration.value = false
    return true
  }
  if (showMore.value) {
    showMore.value = false
    return true
  }
  if (drawerOpen.value) {
    drawerOpen.value = false
    return true
  }
  return false
}

// expose for native bridge back handler
if (typeof window !== 'undefined') {
  window.__writing91ConsumeBack = consumeBack
}
</script>
