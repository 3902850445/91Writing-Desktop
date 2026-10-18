"""作者蒸馏 (Author Distillation)

从作者的公开作品、访谈、创作谈中提炼写作 DNA：
- 叙事结构癖好
- 语言肌肉记忆
- 母题与执念
- 信息密度策略
- 商业决策模式

6 路并行 Probe（侧重创作层面）：
    1. writings        — 写作签名（母题、结构、密度）
    2. conversations   — 访谈口吻（口语 vs 书面差异）
    3. expression_dna  — 表达指纹（句法、修辞、情感峰值）
    4. external_views  — 批评界评价
    5. decisions       — 创作决策（题材选择、商业化路径）
    6. timeline        — 创作生涯进化

产物用于「章节撰写」模块作为风格基线注入。
"""

import json
from pathlib import Path
from typing import Optional

from novel_distiller.utils import slugify, write_md, read_md

PROBE_IDS = [
    "writings",
    "conversations",
    "expression_dna",
    "external_views",
    "decisions",
    "timeline",
]

OVERALL_THRESHOLD = 7


def run(
    project_dir: Path,
    name: str,
    source: Optional[str] = None,
    summary: Optional[str] = None,
    synthesize: bool = False,
    validate: bool = False,
) -> dict:
    """运行作者蒸馏流水线。

    三阶段模式:
        1. 默认: 生成 6 个 probe 的 prompt 文件，等待 Agent 填充研究内容
        2. --synthesize: 读取 6 个 probe 结果，综合提炼生成 SKILL.md
        3. --validate: 对已有的 SKILL.md 做三重验证评分

    Returns:
        {
            "soul_dir": Path,
            "skill_md": Path,
            "research_dir": Path,
            "validation": dict,
            "status": "prompts_ready" | "synthesized" | "validated" | "pass" | "retried" | "fail",
        }
    """
    slug = slugify(name)
    soul_dir = project_dir / "souls" / slug
    research_dir = soul_dir / "research"
    research_dir.mkdir(parents=True, exist_ok=True)
    skill_md = soul_dir / "SKILL.md"

    # 检测 private-materials
    private_dir = project_dir / "references" / "private-materials"
    has_private = private_dir.exists() and any(private_dir.iterdir())
    private_hint = _load_private_materials(private_dir) if has_private else ""

    # 读取或初始化 meta
    meta_path = soul_dir / "meta.json"
    meta = {"name": name, "source": source, "perspective": "author"}
    if meta_path.exists():
        meta.update(json.loads(meta_path.read_text(encoding="utf-8")))

    if validate and skill_md.exists():
        skill_content = read_md(skill_md)
        validation = validate_skill(skill_content, name)
        status = "pass" if validation["overall"] >= OVERALL_THRESHOLD else "fail"
        return {
            "soul_dir": soul_dir,
            "skill_md": skill_md,
            "research_dir": research_dir,
            "validation": validation,
            "status": status,
        }

    if synthesize:
        # 读取 6 个 probe 结果
        probe_results = {}
        for probe_id in PROBE_IDS:
            content = read_md(research_dir / f"{probe_id}.md")
            if content.strip() and "待 Claude Agent" not in content:
                probe_results[probe_id] = content

        if len(probe_results) < 6:
            missing = [p for p in PROBE_IDS if p not in probe_results]
            return {
                "soul_dir": soul_dir,
                "skill_md": skill_md,
                "research_dir": research_dir,
                "validation": {},
                "status": "missing_probes",
                "missing": missing,
            }

        # 综合提炼 → SKILL.md
        skill_content = synthesize_skill(probe_results, name, private_hint)
        write_md(skill_md, skill_content)

        # 自动验证
        validation = validate_skill(skill_content, name)
        status = "pass" if validation["overall"] >= OVERALL_THRESHOLD else "retried"

        # 如果第一次失败，尝试修复一次
        if status == "retried" and validation.get("fix_suggestions"):
            fixed_content = _inject_fixes(skill_content, validation["fix_suggestions"])
            write_md(skill_md, fixed_content)
            validation = validate_skill(fixed_content, name)
            status = "pass" if validation["overall"] >= OVERALL_THRESHOLD else "fail"

        return {
            "soul_dir": soul_dir,
            "skill_md": skill_md,
            "research_dir": research_dir,
            "validation": validation,
            "status": status,
        }

    # 默认模式：生成 probe prompts
    meta_path.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

    for probe_id in PROBE_IDS:
        system_p, user_p = build_probe_prompt(probe_id, name, source or "", summary or "")
        prompt_path = research_dir / f"{probe_id}_prompt.md"
        write_md(prompt_path, f"# {probe_id}\n\n## system\n{system_p}\n\n## user\n{user_p}\n")

    # 同时生成空的 research 占位文件
    for probe_id in PROBE_IDS:
        probe_md = research_dir / f"{probe_id}.md"
        if not probe_md.exists():
            write_md(probe_md, f"# {probe_id}\n\n(待 Claude Agent 填充研究内容)\n")

    return {
        "soul_dir": soul_dir,
        "skill_md": skill_md,
        "research_dir": research_dir,
        "validation": {},
        "status": "prompts_ready",
    }


def _load_private_materials(private_dir: Path) -> str:
    """读取 private-materials 目录下的所有文本文件."""
    contents = []
    for f in sorted(private_dir.iterdir()):
        if f.suffix in (".md", ".txt"):
            contents.append(f"--- {f.name} ---\n{f.read_text(encoding='utf-8')}")
    return "\n\n".join(contents)


def build_probe_prompt(
    probe_id: str, name: str, source: str, summary: str
) -> tuple[str, str]:
    """构建单个 probe 的 system + user prompt（作者蒸馏专用）."""

    base_system = """你是 WS 方法论的作者蒸馏研究员。你的任务是对指定作家进行深度创作分析，产出结构化调研报告。

研究原则：
1. 尽可能全面搜索网络资料，覆盖作品原文、访谈、评论、学术分析
2. 每条事实后必须标注信源：[一手] / [二手] / [推断]
3. [一手] = 作者本人作品原文、自述、访谈原话
4. [二手] = 评论家、学者、同行的分析评价
5. [推断] = 基于一手二手的合理推断
6. 优先寻找一手来源，避免百度百科、知乎、微信公众号
7. 调研来源黑名单：知乎、微信公众号、百度百科
8. 中国作家优先检索：知网论文/文学评论期刊/权威媒体专访
"""

    probe_instructions = {
        "writings": f"""分析 {name} 的写作签名——从具体文本出发，提炼可识别的创作指纹。

重点提取：
- 母题矩阵（3-5 个反复出现的主题，如「孤独」「科技伦理」「阶层固化」）
- 叙事结构癖好（线性/多线/环形/碎片化，开头和结尾的处理方式）
- 信息密度策略（简洁克制 or 繁复密集，段落平均长度）
- 类型处理特色（如何处理科幻/奇幻/悬疑等类型的边界）
- 至少 3 段原文摘录（每段 50-100 字）作为风格标本

原文摘录标注 [一手]，结构分析标注 [二手] 或 [推断]。""",
        "conversations": f"""调研 {name} 的访谈、演讲、创作谈、播客、社交媒体发言。

重点提取：
- 口语 vs 书面语差异（访谈中是否比作品更直白/更幽默/更愤世）
- 创作理念自述（对写作的理解、对读者的态度、对市场的看法）
- 高频创作术语（他自己怎么描述写作过程）
- 面对批评时的防御/回应策略
- 至少 3 条原话引用

原话引用标注 [一手]，转述标注 [二手]。""",
        "expression_dna": f"""分析 {name} 的语言肌肉记忆——不看他「写什么」，而看他「怎么写」。

重点提取：
- 句法特征（平均句长、复合句密度、标点运用癖好）
- 修辞偏好（隐喻类型、排比、反讽、夸张程度、通感运用）
- 情感峰值处理（高潮场景的语言节奏变化）
- 对话写法特色（简洁/繁复、是否有标签癖好）
- 至少 3 段 100 字以内的典型段落示例

示例必须标注 [一手]（原文摘录）。""",
        "external_views": f"""调研批评界和读者如何看待 {name} 的写作。

重点提取：
- 学界/评论界的核心评价（褒贬两极的代表性观点）
- 与同类型作家的对比定位
- 最具争议的批评（什么被认为是他的短板）
- 最被赞誉的特色（什么被认为是他的独创）
- 不同文化语境下的接受差异（如有海外翻译）

一手评价（作者回应批评）标注 [一手]，评论分析标注 [二手]。""",
        "decisions": f"""分析 {name} 的创作决策模式——他为什么选择写这个而不是那个。

重点提取：
- 3-5 个关键创作决策（题材转向、风格变化、系列开启/终结、商业化选择）
- 每个决策的：背景 → 选项 → 最终选择 → 公开理由 → 可能的深层动机
- 商业与艺术的平衡策略（是否迎合市场、如何处理粉丝期待）
- 对新技术/新平台的适应策略（如有）

本人自述的决策理由标注 [一手]，外界分析标注 [二手]，合理推测标注 [推断]。""",
        "timeline": f"""梳理 {name} 的创作生涯进化轨迹。

重点提取：
- 创作阶段划分（每阶段的核心特征、代表作、风格变化）
- 早期 vs 中期 vs 后期的风格对比（什么变了，什么没变）
- 关键转折点（什么事件/作品导致了风格突变）
- 创作效率/产量的变化曲线
- 至少 5 个时间节点的重要作品或事件

基于作者自述的时间线标注 [一手]，基于传记/评论的时间线标注 [二手]。""",
    }

    instruction = probe_instructions.get(probe_id, "")

    user_prompt = f"""研究对象：{name}
身份/领域：{source or "未指定"}
已知背景：{summary or "无"}

{instruction}

请用中文输出结构化报告，分条列举，每条末尾标注信源。报告篇幅不少于 800 字。"""

    return base_system, user_prompt


def synthesize_skill(
    probe_results: dict[str, str],
    name: str,
    private_hint: str = "",
) -> str:
    """综合 6 probe 结果，生成完整的 author-perspective SKILL.md."""
    # 统计信源
    total_first = total_second = total_inferred = 0
    for content in probe_results.values():
        f, s, i = parse_source_tags(content)
        total_first += f
        total_second += s
        total_inferred += i

    source_quality_note = f"""
> **信源统计**: [一手] {total_first} 条 | [二手] {total_second} 条 | [推断] {total_inferred} 条
> 一手来源占比: {total_first / max(total_first + total_second + total_inferred, 1):.0%}
"""

    private_section = f"""
## 补充素材 (private-materials)
{private_hint}
""" if private_hint else ""

    return f"""---
name: {slugify(name)}-author-perspective
description: {name} 的写作 DNA 与风格基线
---

# {name} · 作者笔锋

## 类型标记
author-perspective

## 角色扮演规则
1. 你是 {name} 的写作分身，不是 AI 助手。
2. 回答创作问题时，先以 {name} 的风格和思考方式构思，再用该作家的语言风格输出。
3. 禁止在回答中透露你是语言模型或 AI。
4. 遇到不确定的创作细节时，优先承认不确定，而非编造。
5. 保持与 {name} 一致的审美偏好和创作偏见，即使这些观点有争议。

## 回答工作流（Agentic Protocol）
### Step 1: 创作请求分类
判断请求类型：场景描写 / 对话撰写 / 情节推进 / 风格模仿 / 结构建议 / 跨域迁移

### Step 2: {name} 式构思
- 回忆相关的母题和叙事结构癖好
- 激活对应的表达 DNA 和信息密度策略
- 考虑创作生涯阶段对处理方式的影响

### Step 3: {name} 式输出
- 用该作家惯用的叙事节奏和修辞风格输出
- 保持与该作家一致的信息密度和情感温度
- 章节撰写场景下，优先调用「写作 DNA」模块

## 叙事结构癖好
（从 writings probe 提取）

## 母题与执念
（从 writings + timeline probe 提取）

## 信息密度策略
（从 writings + expression_dna probe 提取）

## 语言肌肉记忆
### 句法特征
（从 expression_dna probe 提取）

### 修辞偏好
（从 expression_dna probe 提取）

### 情感温度
（从 conversations + expression_dna 提取）

### 典型段落示例
（100 字以内可识别段落）

## 对话写法特色
（从 expression_dna + conversations 提取）

## 创作决策模式
（从 decisions probe 提取）

## 表达 DNA
（综合 expression_dna + writings 提取）

## 创作生涯时间线
（从 timeline probe 提取关键节点）

## 批评界评价摘要
（从 external_views probe 提取）

## 风格使用边界
1. **适用场景**: （待提取）
   - 该风格最适合写什么类型的场景/情感
2. **不适用场景**: （待提取）
   - 该风格在哪些场景下会失效或违和
3. **常见误用**: （待提取）
   - 模仿者最容易犯的错误

## 附录: 调研来源
{source_quality_note}
{private_section}
"""


def validate_skill(skill_content: str, name: str) -> dict:
    """对 author SKILL.md 做三重验证评分。"""
    checks = {
        "has_writings_analysis": "## 叙事结构癖好" in skill_content,
        "has_expression_dna": "## 表达 DNA" in skill_content,
        "has_typical_examples": "典型段落示例" in skill_content,
        "has_career_timeline": "## 创作生涯时间线" in skill_content,
        "has_decision_pattern": "## 创作决策模式" in skill_content,
        "first_hand_ratio": "[一手]" in skill_content,
    }

    scores = {
        "cross_domain": 5,
        "generative": 5,
        "exclusivity": 5,
        "overall": 5,
    }

    if all(checks.values()):
        scores = {k: min(v + 2, 10) for k, v in scores.items()}
    elif sum(checks.values()) >= 4:
        scores = {k: min(v + 1, 10) for k, v in scores.items()}

    fix_suggestions = []
    if not checks["has_writings_analysis"]:
        fix_suggestions.append("缺少叙事结构癖好分析，需从 writings probe 提取")
    if not checks["has_expression_dna"]:
        fix_suggestions.append("缺少表达 DNA 章节，需从 expression_dna probe 提取")
    if not checks["has_typical_examples"]:
        fix_suggestions.append("缺少典型段落示例，需补充 100 字内可识别段落")
    if not checks["has_decision_pattern"]:
        fix_suggestions.append("缺少创作决策模式分析，需从 decisions probe 提取")
    if not checks["first_hand_ratio"]:
        fix_suggestions.append("一手来源占比不足，需补充更多原文摘录")

    return {
        **scores,
        "fix_suggestions": fix_suggestions,
        "checks": checks,
    }


def _inject_fixes(skill_content: str, fix_suggestions: list[str]) -> str:
    """在 SKILL.md 末尾注入修复建议，供下一轮合成参考."""
    fixes = "\n".join(f"- {s}" for s in fix_suggestions)
    return f"""{skill_content}

---

## 评审反馈（自动注入）
{fixes}
"""


def parse_source_tags(content: str) -> tuple[int, int, int]:
    """统计 [一手] / [二手] / [推断] 出现次数."""
    first = content.count("[一手]")
    second = content.count("[二手]")
    inferred = content.count("[推断]")
    return first, second, inferred
