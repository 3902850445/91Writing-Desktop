# 架构与扩展说明

## 模块依赖关系

```
cli.py
├── scaffold.py      (init)
├── soul_distill.py  (distill-soul)
├── author_distill.py (distill-author)
├── plot.py          (plot)
├── write.py         (write)
├── anchor.py        (check)
├── darkthread.py    (darkthread)
└── platform.py      (check 时调用)
```

## 数据流

```
用户输入 (CLI 或 Skill)
    ↓
cli.py 解析参数
    ↓
调用对应模块
    ↓
生成文件 + prompt
    ↓
Claude Agent 执行 LLM 任务
    ↓
保存结果到文件系统
    ↓
返回状态给用户
```

## 文件系统约定

```
project-dir/
├── work_intro.md              # 作品简介
├── author_soul.md             # 作者灵魂方案
├── protagonist.md             # 主角设定
├── worldviews/                # 世界观设定
│   └── *.md
├── chapters/                  # 章节
│   ├── outline.md             # 章节大纲
│   ├── ch001.md               # 第 1 章正文
│   ├── ch001_prompt.md        # 第 1 章写作指令
│   ├── ch001.report.md        # 第 1 章自检报告
│   └── ch001_check_prompt.md  # 第 1 章评估指令
├── scenes/                    # 场景
│   ├── 场景名.md              # 场景定义
│   └── 场景名/                # 推演产物
│       ├── manifest.md
│       ├── simulation_guide.md
│       ├── report.md
│       └── rounds/
│           ├── round_01.md
│           └── ...
├── souls/                     # 角色灵魂
│   └── 角色名/
│       ├── meta.json
│       ├── SKILL.md           # 思维操作系统
│       └── research/          # 研究素材
│           ├── writings.md
│           ├── conversations.md
│           ├── expression_dna.md
│           ├── external_views.md
│           ├── decisions.md
│           └── timeline.md
├── dark-threads/              # 暗线追踪
│   ├── config.yaml            # 暗线配置
│   ├── config_prompt.md       # 优化提示
│   └── ch001_snapshot.md      # 每章快照
└── references/                # 参考资料
    ├── source-materials/      # 公开素材
    └── private-materials/     # 非公开素材
```

## 扩展点

### 添加新的平台规则

编辑 `novel_distiller/platform.py`，在 `PLATFORM_RULES` 中添加新的平台配置。

### 添加新的暗线模板

编辑 `novel_distiller/scaffold.py`，在 `DARKTHREAD_TEMPLATES` 中添加新的 genre 模板。

### 自定义评分维度

编辑 `novel_distiller/anchor.py`，修改 `DIMENSIONS` 列表和 `_run_basic_checks` 函数。

### 添加新的 CLI 命令

编辑 `novel_distiller/cli.py`，使用 Click 添加新的命令，然后在对应的模块中实现逻辑。

## 测试

```bash
# 运行示例
cd demo
python -m novel_distiller.cli init "测试" --genre 科幻 --length short
python -m novel_distiller.cli status
```

## 贡献指南

1. Fork 仓库
2. 创建 feature 分支
3. 提交 PR
4. 确保所有基础检查通过

## 设计哲学

- **文件即状态**：所有状态都保存在文件系统中，不需要数据库
- **Prompt 即接口**：模块之间通过生成 prompt 文件来协作
- **缺素材不撰写**：前置素材不齐时，模块拒绝执行而非凑合产出
- **不通过不保存**：自检未通过时，不覆盖已有文件
