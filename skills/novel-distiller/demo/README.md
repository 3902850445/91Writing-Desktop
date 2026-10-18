# Demo: 赛博西行纪

本目录是一个完整的 Novel Distiller 示例项目，展示了从 `ws init` 到 `ws status` 的全流程输出。

## 生成命令

```bash
ws init "赛博西行纪：金箍是脑机接口" \
  --genre "科幻" \
  --length short \
  --platform tomato \
  --gender male \
  --core-chars 3 \
  --style-author "刘慈欣"

ws distill-soul "孙悟空" --source "《西游记》"
ws distill-author "刘慈欣" --source "中国科幻作家"
```

## 项目结构

```
demo/
├── work_intro.md              # 作品简介
├── protagonist.md             # 3 位核心角色设定模板
├── author_soul.md             # 指定刘慈欣风格的方案
├── worldviews/
│   └── 赛博西行纪：金箍是脑机接口.md   # 科幻世界观框架
├── chapters/
│   └── outline.md             # 短篇大纲（15章模板）
├── scenes/
│   └── index.md               # 3-8 个核心场景框架
├── souls/
│   ├── 孙悟空/
│   │   ├── SKILL.md           # 角色灵魂（占位，待 Claude Agent 填充）
│   │   └── research/          # 6 probe 研究日志目录
│   └── 刘慈欣/
│       ├── SKILL.md           # 作者笔锋（占位）
│       └── research/          # 6 probe 研究日志目录
└── references/
    ├── source-materials/      # 背景资料（如有）
    └── private-materials/     # 非公开素材（如有）
```

## 下一步（完整工作流）

1. **完善骨架**: 编辑 `work_intro.md` 补充卖点和对标作品
2. **蒸馏灵魂**: 运行 `ws distill-soul` 为每个核心角色铸魂
3. **蒸馏作者**: 运行 `ws distill-author "刘慈欣"` 提取写作 DNA
4. **推演场景**: 运行 `ws plot 场景名` 进行多智能体剧情推演
5. **撰写章节**: 运行 `ws write 1 --scene 场景名` 撰写正文
6. **锚定自检**: 运行 `ws check 1 --platform tomato` 检查一致性

## 篇幅参数

本项目使用 **短篇** 模板：
- 字数：8,000–30,000 字
- 场景：3–8 个
- 章节：15–50 章
- 每章：2,000–4,000 字
