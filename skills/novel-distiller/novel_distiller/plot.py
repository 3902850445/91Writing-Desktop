"""剧情推演 (Plot Simulation / Scene Playthrough)

多智能体场景模拟，让已蒸馏灵魂的角色在场景中自主互动，产生真实叙事。

协议:
    1. Graph 构建 — 角色关系图 + 环境设定 + 胜利条件
    2. Environment — 地形/天气/特殊规则 + 各角色当前状态
    3. Simulation — agents 自主决策，不作者干预
    4. ReACT Report — Report Agent: Thought→Action→Observation ≥3 轮
    5. Deep Interview (可选) — 追问意外发现

规则:
    - 不控制 agents，记录"意外发现"
    - 同一场景跑 2-3 轮，保留最优报告
    - 保留失败轮次作为素材
"""

import json
import re
from pathlib import Path
from typing import Optional

from novel_distiller.utils import slugify, write_md, read_md


def run(
    project_dir: Path,
    scene_id: str,
    round_count: int = 3,
    report: bool = False,
) -> dict:
    """运行剧情推演。

    两阶段模式:
        1. 默认: 读取场景定义 + 角色 SKILL，生成 manifest 和 round prompts
        2. --report: 读取所有 round 结果，综合生成 report.md

    Returns:
        {
            "report_md": Path,
            "rounds": list[dict],
            "surprises": list[str],
        }
    """
    scene_dir = project_dir / "scenes" / slugify(scene_id)
    scene_dir.mkdir(parents=True, exist_ok=True)
    scene_md = project_dir / "scenes" / f"{slugify(scene_id)}.md"

    if report:
        return _synthesize_report(project_dir, scene_id, scene_dir)

    # 阶段 1: 生成推演准备文件
    scene_content = read_md(scene_md)
    if not scene_content.strip():
        return {
            "status": "missing_scene",
            "message": f"场景定义文件不存在或为空: {scene_md}",
        }

    # 解析场景定义
    scene_info = _parse_scene_definition(scene_content)

    # 读取参与角色的 SKILL.md
    characters = _load_character_skills(project_dir, scene_info.get("characters", []))

    # 生成 manifest
    manifest_path = scene_dir / "manifest.md"
    write_md(manifest_path, _build_manifest(scene_id, scene_info, characters))

    # 生成每轮 prompt
    rounds_dir = scene_dir / "rounds"
    rounds_dir.mkdir(exist_ok=True)

    for i in range(1, round_count + 1):
        prompt_path = rounds_dir / f"round_{i:02d}_prompt.md"
        write_md(prompt_path, _build_round_prompt(i, scene_info, characters, round_count))
        # 同时生成空的 round 占位文件
        round_md = rounds_dir / f"round_{i:02d}.md"
        if not round_md.exists():
            write_md(round_md, f"# Round {i}\n\n(待 Claude Agent 填充推演内容)\n")

    # 生成 simulation_guide.md（给 Claude Agent 的完整操作指南）
    guide_path = scene_dir / "simulation_guide.md"
    write_md(guide_path, _build_simulation_guide(scene_id, scene_info, characters, round_count))

    return {
        "status": "prompts_ready",
        "scene_dir": scene_dir,
        "manifest": manifest_path,
        "rounds_dir": rounds_dir,
        "guide": guide_path,
        "round_count": round_count,
        "characters": list(characters.keys()),
    }


def recommend_rounds(length_code: str) -> int:
    """根据篇幅推荐推演轮数."""
    return {"short": 3, "medium": 5, "long": 7}.get(length_code, 3)


def _parse_scene_definition(content: str) -> dict:
    """从场景 markdown 中解析关键信息."""
    info = {
        "title": "",
        "setting": "",
        "characters": [],
        "objectives": "",
        "initial_situation": "",
        "rules": "",
    }

    # 提取标题
    title_match = re.search(r"#\s*(.+)", content)
    if title_match:
        info["title"] = title_match.group(1).strip()

    # 提取各章节
    sections = re.split(r"\n##\s+", content)
    for section in sections:
        section = section.strip()
        if section.startswith("环境设定") or section.startswith("设定"):
            info["setting"] = _extract_section_body(section)
        elif section.startswith("参与角色") or section.startswith("角色"):
            info["characters"] = _extract_characters(section)
        elif section.startswith("场景目标") or section.startswith("目标"):
            info["objectives"] = _extract_section_body(section)
        elif section.startswith("初始局势") or section.startswith("局势"):
            info["initial_situation"] = _extract_section_body(section)
        elif section.startswith("规则") or section.startswith("特殊规则"):
            info["rules"] = _extract_section_body(section)

    return info


def _extract_section_body(section: str) -> str:
    """提取 markdown 章节的主体内容（去掉标题行）."""
    lines = section.split("\n")
    # 去掉第一行标题
    body_lines = []
    for line in lines[1:]:
        stripped = line.strip()
        if stripped:
            body_lines.append(stripped)
    return "\n".join(body_lines)


def _extract_characters(section: str) -> list[dict]:
    """从角色章节提取角色列表."""
    chars = []
    lines = section.split("\n")
    for line in lines:
        line = line.strip()
        if line.startswith("-") or line.startswith("*"):
            # 格式: - 角色名 (soul_slug) — 状态描述
            text = line[1:].strip()
            name = text.split("(")[0].strip() if "(" in text else text.split("—")[0].strip()
            slug = ""
            slug_match = re.search(r"\(([^)]+)\)", text)
            if slug_match:
                slug = slug_match.group(1).strip()
            status = ""
            if "—" in text:
                status = text.split("—", 1)[1].strip()
            chars.append({"name": name, "slug": slug or slugify(name), "status": status})
    return chars


def _load_character_skills(project_dir: Path, characters: list[dict]) -> dict[str, str]:
    """读取每个参与角色的 SKILL.md."""
    skills = {}
    for char in characters:
        slug = char.get("slug") or slugify(char["name"])
        skill_path = project_dir / "souls" / slug / "SKILL.md"
        if skill_path.exists():
            skills[char["name"]] = read_md(skill_path)
        else:
            skills[char["name"]] = f"(未找到 SKILL.md: {skill_path})"
    return skills


def _build_manifest(scene_id: str, scene_info: dict, characters: dict[str, str]) -> str:
    """生成场景推演 manifest."""
    char_sections = "\n\n".join(
        f"### {name}\n```\n{content[:500]}...\n```"
        for name, content in characters.items()
    )

    return f"""# 场景推演 Manifest: {scene_info.get('title', scene_id)}

## 场景定义
{scene_info.get('setting', '(待填充)')}

## 参与角色 ({len(characters)})
{char_sections}

## 场景目标
{scene_info.get('objectives', '(待填充)')}

## 初始局势
{scene_info.get('initial_situation', '(待填充)')}

## 特殊规则
{scene_info.get('rules', '(无)')}
"""


def _build_round_prompt(round_num: int, scene_info: dict, characters: dict[str, str], total_rounds: int) -> str:
    """生成单轮 ReACT prompt."""
    char_names = ", ".join(characters.keys())

    return f"""# Round {round_num} / {total_rounds} — ReACT 推演

## 本轮任务
按照 ReACT 协议，让每个角色依次进行 Thought -> Action。

## 串行执行顺序
角色按以下顺序行动（后动者能看到先动者的 Action）：
{chr(10).join(f"{i+1}. {name}" for i, name in enumerate(characters.keys()))}

## 每个角色的 ReACT 格式
```
### Thought: {char_names.split(", ")[0] if char_names else "角色名"}
[角色在此情境下的内心活动、策略思考、情绪状态]

### Action: {char_names.split(", ")[0] if char_names else "角色名"}
[角色采取的具体行动，包括语言、动作、决策]
```

## 本轮结束后
生成 Observation（环境/其他角色的反应），更新场景状态。

## 输出格式
请用中文输出完整的 Round {round_num} 推演内容，保存到 round_{round_num:02d}.md。
"""


def _build_simulation_guide(scene_id: str, scene_info: dict, characters: dict[str, str], round_count: int) -> str:
    """生成给 Claude Agent 的完整操作指南."""
    char_list = "\n".join(f"- **{name}**: 加载 souls/{slugify(name)}/SKILL.md 作为思维操作系统" for name in characters.keys())

    return f"""# 剧情推演操作指南

## 场景
{scene_info.get('title', scene_id)}

## 参与角色
{char_list}

## 推演协议

### 1. 加载角色灵魂
每个角色 Agent 必须以其 SKILL.md 作为系统提示，严格保持角色性格一致性。

### 2. 串行执行规则
- 每轮按固定顺序让角色依次行动
- 后动者能看到先动者的 Thought + Action
- 不允许角色预知未来或读取其他角色的内心（除非有读心设定）

### 3. ReACT 格式
每个角色的每轮输出必须包含：
```
### Thought: [角色名]
...

### Action: [角色名]
...
```

### 4. Observation 规则
所有角色行动完毕后，生成 Observation：
- 环境对行动的反馈
- 未预料到的连锁反应
- 场景状态变化（地形/天气/物品/角色状态）

### 5. 意外发现记录
如果推演过程中出现令人意外的剧情走向（角色做出出乎意料的选择、产生新的冲突、揭示隐藏信息），请单独记录在 surprises 列表中。

## 轮次设置
总轮数: {round_count}
推荐轮数: 短篇=3 中篇=5 长篇=7

## 输出要求
- 每轮结果保存到 scenes/{slugify(scene_id)}/rounds/round_NN.md
- 所有轮次完成后，运行 `ws plot "{scene_id}" --report` 生成报告
"""


def _synthesize_report(project_dir: Path, scene_id: str, scene_dir: Path) -> dict:
    """综合所有 round 结果，生成 report.md."""
    rounds_dir = scene_dir / "rounds"
    if not rounds_dir.exists():
        return {
            "status": "missing_rounds",
            "message": f"未找到推演轮次: {rounds_dir}",
        }

    # 读取所有 round
    rounds = []
    for round_file in sorted(rounds_dir.glob("round_*.md")):
        if "_prompt" in round_file.name:
            continue
        content = read_md(round_file)
        if content.strip() and "待 Claude Agent" not in content:
            rounds.append({"file": round_file.name, "content": content})

    if not rounds:
        return {
            "status": "missing_rounds",
            "message": "未找到有效的推演轮次，请先运行推演或手动填充 round 文件",
        }

    # 提取意外发现（简单规则：查找关键词）
    surprises = []
    all_content = "\n".join(r["content"] for r in rounds)
    surprise_keywords = ["意外", "没想到", "出乎意料", "竟然", "突然", "不料", "没想到"]
    lines = all_content.split("\n")
    for line in lines:
        if any(kw in line for kw in surprise_keywords) and len(line) > 10:
            surprises.append(line.strip("- *#").strip())

    # 去重并限制数量
    surprises = list(dict.fromkeys(surprises))[:10]

    # 生成报告
    report_content = _build_report(scene_id, rounds, surprises)
    report_md = scene_dir / "report.md"
    write_md(report_md, report_content)

    return {
        "status": "report_generated",
        "report_md": report_md,
        "round_count": len(rounds),
        "surprises": surprises,
    }


def _build_report(scene_id: str, rounds: list[dict], surprises: list[str]) -> str:
    """构建 report.md 内容."""
    rounds_summary = "\n\n".join(
        f"## {r['file']}\n{r['content'][:800]}..." for r in rounds
    )

    surprises_section = "\n".join(f"- {s}" for s in surprises) if surprises else "（未发现显著意外）"

    return f"""# 剧情推演报告: {scene_id}

## 推演概览
- **总轮数**: {len(rounds)}
- **推演方式**: 串行 ReACT（Thought -> Action -> Observation）
- **角色行为约束**: 以各自 SKILL.md 为思维操作系统

## 分轮摘要
{rounds_summary}

## 意外发现
{surprises_section}

## 叙事评估
### 情节逻辑一致性
（待评估）

### 角色行为一致性
（待评估：各角色是否符合 SKILL.md 设定）

### 冲突升级曲线
（待评估）

## 可用素材
- 可直接用于章节撰写的对话片段:
- 可直接用于章节撰写的动作描写:
- 需要调整才能使用的情节转折:

## 建议
1. （基于推演结果给出撰写建议）
2. （指出哪些角色需要进一步蒸馏以提升推演质量）
3. （推荐下一章节应推进的场景）
"""
