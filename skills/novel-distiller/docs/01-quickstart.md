# 快速开始指南

## 前提条件

- Python 3.10+
- 已安装 `ws-harness`：`pip install -e .`
- （可选）Claude Code，用于 Agent 推理

## 完整工作流（5 分钟上手）

### 第 1 步：创世蓝图

```bash
cd /path/to/your-novel-project
ws init "你的想法" --genre 类型 --length short|medium|long --platform tomato|qidian|zhihu
```

这会生成：
- `work_intro.md` — 作品简介
- `worldviews/` — 世界观设定（需后续填充）
- `chapters/outline.md` — 章节大纲
- `dark-threads/config.yaml` — 暗线初始配置
- `author_soul.md` — 作者灵魂方案

### 第 2 步：灵魂蒸馏（角色）

```bash
# 生成研究 prompts
ws distill-soul "角色名" --source "出处" --type real|fictional

# 用 Claude Agent 填充 6 个 research 文件后，合成 SKILL.md
ws distill-soul "角色名" --synthesize

# 验证
ws distill-soul "角色名" --validate
```

### 第 3 步：作者蒸馏（风格）

```bash
ws distill-author "作者名" --synthesize
```

### 第 4 步：剧情推演

```bash
# 先生成场景定义文件 scenes/场景名.md
# 然后运行推演准备
ws plot 场景名 --rounds 3

# 用 Claude Agent 串行执行每轮 ReACT，保存到 rounds/round_NN.md
# 最后生成报告
ws plot 场景名 --report
```

### 第 5 步：撰写章节

```bash
ws write 1 --scene 场景名

# 这会生成 chapters/ch001_prompt.md（写作指令）
# 用 Claude Agent 根据指令撰写正文，保存到 chapters/ch001.md
```

### 第 6 步：锚定自检

```bash
ws check 1 --platform tomato

# 生成 chapters/ch001_check_prompt.md（评估指令）
# 用 Claude Agent 做深度评估，将 JSON 评分填入 ch001.report.md
```

### 第 7 步：暗线追踪

```bash
ws darkthread 1 --set merit=10 --event "本章关键事件描述"

# 生成 dark-threads/ch001_snapshot.md
```

## 项目状态查看

```bash
ws status
```

显示 souls 数量、scenes 数量、chapters 数量。

## 常见问题

**Q：没有 Claude Code 可以用吗？**
A：可以。Python CLI 负责文件管理和 prompt 组装，你可以手动将生成的 prompt 文件复制到任何 AI 工具中使用。见 `skills/` 目录的独立 Skill 文件。

**Q：可以写现实人物吗？**
A：可以。`--type real` 会从公开著作、访谈、媒体报道中蒸馏。`--type fictional` 会从原著文本中蒸馏。

**Q：暗线配置怎么设计？**
A：`ws init` 会根据 `--genre` 自动生成初始配置。你可以在 `dark-threads/config.yaml` 中自定义变量和暗线。
