# Novel Distiller（小说蒸馏器）— 长篇小说创作方法论引擎

> 从「一个想法」到「一本书」的完整流水线。

## 是什么

Novel Distiller 是 **World Spirit (WS) 方法论** 的工程化实现，将长篇小说创作拆分为可重复、可验证、可迭代的流水线：

```
想法 → 创世蓝图 → 灵魂蒸馏 → 作者蒸馏 → 场景推演 → 章节撰写 → 锚定自检 → 成书
```

它解决 AI 写长篇小说的三大核心痛点：

| 痛点 | 解决方案 | 模块 |
|------|---------|------|
| **人物跳脱（OOC）** | 为每个角色生成思维操作系统 SKILL.md | 灵魂蒸馏 |
| **风格中途变味** | 提取参考作者的写作 DNA 作为风格基线 | 作者蒸馏 |
| **暗线写到后面就忘** | YAML 配置的数值状态层，跨章节自动锚定 | 暗线追踪 |
| **情节逻辑崩坏** | 多智能体推演先验证合理性，再撰写 | 剧情推演 |
| **平台审核踩雷** | 番茄/起点/知乎的叠加规则自动扫描 | 锚定自检 |

## 两种使用方式

### 方式一：Python CLI（推荐，全自动）

```bash
pip install -e .
ws init "赛博西行纪" --genre 科幻 --length short
ws distill-soul "孙悟空" --synthesize
ws plot 火焰山决战
ws write 3 --scene 火焰山决战
ws check 3 --platform tomato
```

### 方式二：Claude Code Skill（交互式）

在小说项目目录启动 Claude Code：

```bash
claude
```

然后使用 `/ws` 命令：

```
/ws init "赛博西行纪" --genre 科幻 --length short
/ws distill-soul "孙悟空" --source "《西游记》"
/ws plot 火焰山决战
/ws write 3 --scene 火焰山决战
/ws check 3 --platform tomato
```

> **核心设计**：Python CLI 负责文件管理和 prompt 组装，Claude Agent 负责所有需要 LLM 推理的任务（搜索/写作/评估）。你作为编排器，在两者之间调度。

## 快速开始

```bash
# 1. 安装
git clone https://github.com/yourname/novel-distiller.git
cd ws-harness
pip install -e .

# 2. 进入你的小说项目目录
cd /path/to/your-novel

# 3. 创世蓝图 — 从想法生成作品骨架
ws init "赛博西行纪" --genre 科幻 --length short --platform tomato

# 4. 蒸馏角色灵魂
ws distill-soul "孙悟空" --source "《西游记》" --type fictional

# 5. 蒸馏作者风格
ws distill-author "刘慈欣"

# 6. 剧情推演 — MiroFish 多智能体模拟
ws plot 火焰山决战 --rounds 3

# 7. 撰写章节
ws write 3 --scene 火焰山决战

# 8. 锚定自检
ws check 3 --platform tomato
```

完整文档见 [`docs/`](docs/) 目录。

## 核心模块

| 模块 | CLI 命令 | 作用 | 文档 |
|---|---|---|---|
| 创世蓝图 | `ws init` | 想法 → 作品骨架 + 暗线配置 | [docs/02-genesis.md](docs/02-genesis.md) |
| 灵魂蒸馏 | `ws distill-soul` | 6 路并行研究 → 角色 SKILL.md | [docs/03-soul-distill.md](docs/03-soul-distill.md) |
| 作者蒸馏 | `ws distill-author` | 6 路并行研究 → 作者笔锋 SKILL.md | [docs/04-author-distill.md](docs/04-author-distill.md) |
| 剧情推演 | `ws plot` | 多智能体 ReACT 场景模拟 | [docs/05-plot.md](docs/05-plot.md) |
| 章节撰写 | `ws write` | 风格注入 + 世界观约束 + 暗线推进 | [docs/06-write.md](docs/06-write.md) |
| 锚定自检 | `ws check` | 8 维评分 + 必过项 + 平台合规 | [docs/07-anchor-check.md](docs/07-anchor-check.md) |
| 暗线追踪 | `ws darkthread` | 数值状态 + 暗线进度快照 | [docs/08-darkthread.md](docs/08-darkthread.md) |

## 平台支持

锚定自检支持平台叠加规则：

| 平台 | 标识 | 核心规则 |
|------|------|---------|
| 通用 | `generic` | 叙事连续性 + 人物一致性 + 暗线无遗忘 |
| 番茄小说 | `tomato` | 正能量导向 / 无暴恐 / 章末钩子 / 节奏明快 |
| 起点中文网 | `qidian` | 升级感 / 打脸频率 / 期待感 / 章末钩子 |
| 知乎盐选 | `zhihu` | 悬念密度 / 反转 / 付费点 / 信息增量 |

## 独立 Skill 使用

如果你不想安装 Python 包，可以直接使用 [`skills/`](skills/) 目录下的独立 Skill 文件。每个 Skill 包含完整的 prompt 模板和工作流，可复制到 Claude Code 或其他支持 system prompt 的 AI 工具中使用。

| Skill | 文件 | 用途 |
|-------|------|------|
| 创世蓝图 | [skills/genesis-skill.md](skills/genesis-skill.md) | 从零生成作品骨架 |
| 灵魂蒸馏 | [skills/soul-distill-skill.md](skills/soul-distill-skill.md) | 提取角色思维操作系统 |
| 作者蒸馏 | [skills/author-distill-skill.md](skills/author-distill-skill.md) | 提取写作 DNA |
| 剧情推演 | [skills/plot-skill.md](skills/plot-skill.md) | 多智能体场景模拟 |
| 章节撰写 | [skills/write-skill.md](skills/write-skill.md) | 组装写作指令 |
| 锚定自检 | [skills/check-skill.md](skills/check-skill.md) | 8 维深度评估 |
| 暗线追踪 | [skills/darkthread-skill.md](skills/darkthread-skill.md) | 数值状态维护 |

## Demo 案例

见 [`demo/`](demo/) 目录，包含一个从零到第 3 章的完整案例：

- **作品**：赛博西行纪（西游记科幻改编，金箍 = 脑机接口）
- **角色**：孙悟空（灵魂蒸馏完成）
- **作者**：刘慈欣（作者蒸馏完成）
- **推演**：火焰山决战（3 轮 ReACT 推演报告）
- **章节**：第 1 章（战斗开场）+ 第 3 章（符文揭秘，深度评估 8.75/10）
- **暗线**：牛魔王态度变化、火焰山封印之谜

## 架构

```
novel-distiller/
├── novel_distiller/     # Python 核心包
│   ├── cli.py           # CLI 入口（Click）
│   ├── scaffold.py      # 创世蓝图
│   ├── soul_distill.py  # 灵魂蒸馏
│   ├── author_distill.py # 作者蒸馏
│   ├── plot.py          # 剧情推演
│   ├── write.py         # 章节撰写
│   ├── anchor.py        # 锚定自检
│   ├── darkthread.py    # 暗线追踪
│   ├── platform.py      # 平台规则
│   └── utils.py         # 工具函数
├── .claude/skills/ws/SKILL.md  # Claude Code Skill
├── skills/              # 独立 Skill 文件（无 Python 可用）
├── docs/                # 完整文档
└── demo/                # 完整案例
```

## 安装要求

- Python 3.10+
- Click + Rich（已包含在依赖中）
- Claude Code（用于 Agent 推理，可选）

```bash
pip install -e .
```

## 许可证

MIT
