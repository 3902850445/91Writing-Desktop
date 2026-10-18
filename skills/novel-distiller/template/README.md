# Novel Distiller 项目模板

这是一个空的项目骨架，用于了解 `ws init` 生成的目录结构。

## 使用方法

在项目根目录运行：

```bash
ws init "你的作品想法"
```

即可自动生成以下结构（并填充内容模板）。

## 目录结构

```
.
├── work_intro.md              # 作品简介
├── protagonist.md             # 主角设定
├── author_soul.md             # 作者灵魂方案
├── worldviews/
│   └── {slug}.md              # 世界观设定
├── chapters/
│   └── outline.md             # 章节大纲
├── scenes/
│   └── index.md               # 场景框架
├── dark-threads/              # 暗线追踪快照
├── souls/
│   └── {slug}/
│       ├── SKILL.md           # 角色灵魂
│       └── research/          # 6 probe 研究日志
├── references/
│   ├── source-materials/      # 背景参考资料
│   └── private-materials/     # 非公开蒸馏素材
└── .claude/
    └── skills/
        └── ws/
            └── SKILL.md       # Claude Code Skill 入口
```

## 下一步

1. 编辑 `work_intro.md` 完善卖点和对标作品
2. 运行 `ws distill-soul "角色名"` 开始角色蒸馏
3. 运行 `ws distill-author "作者名"` 开始作者蒸馏
4. 运行 `ws plot <场景ID>` 进行剧情推演
5. 运行 `ws write <章节号>` 撰写章节
6. 运行 `ws check <章节号>` 锚定自检
