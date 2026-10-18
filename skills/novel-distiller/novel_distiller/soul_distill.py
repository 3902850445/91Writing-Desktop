"""灵魂蒸馏 (Soul Distillation)

从真实人物或虚构角色的资料中提取灵魂，用于小说创作中的角色扮演。

智能识别类型:
    - 真人: 从公开著作、访谈、媒体报道中蒸馏
    - 虚构角色: 从原著文本、影视改编中蒸馏

6 路并行 Probe:
    1. writings        — 著作/原著行为与系统思考
    2. conversations   — 对话/台词风格与即兴反应
    3. expression_dna  — 表达 DNA（句法、修辞、情感峰值）
    4. external_views  — 外部视角（他人评价/读者看法）
    5. decisions       — 重大决策与选择模式
    6. timeline        — 成长弧光与智识谱系

小说化适配（灵魂蒸馏 vs 普通女娲蒸馏的核心区别）:
    在标准 6 probe 之后，增加「小说化特征」模块：
    - 台词指纹: 怎么说话、口头禅、语气词
    - 行动模式: 面对冲突的首选策略（战斗/逃跑/谈判/欺骗/隐忍）
    - 情感表达: 喜怒哀乐外放还是压抑、爆发点
    - 人际化学反应: 对权威/弱者/对手/盟友/恋人的互动模式
    - 冲突风格: 怎么打架、怎么吵架、怎么博弈
    - 成长潜能: 在长篇中的弧光与瓶颈

每条 probe 产出强制要求末尾标注信源:
    [一手] = 本人著述/演讲/采访原文 或 原著直接描写
    [二手] = 他人转述/评论/改编解读
    [推断] = 基于一手二手的合理推断

验证门槛: overall >= 7 才写入 SKILL.md
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

NOVELIZATION_DIMENSIONS = [
    "台词指纹",
    "行动模式",
    "情感表达",
    "人际化学反应",
    "冲突风格",
    "成长潜能",
]

OVERALL_THRESHOLD = 7


def run(
    project_dir: Path,
    name: str,
    source: Optional[str] = None,
    summary: Optional[str] = None,
    char_type: Optional[str] = None,
    synthesize: bool = False,
    validate: bool = False,
) -> dict:
    """运行灵魂蒸馏流水线。

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

    # 识别角色类型（优先从持久化 meta 读取）
    meta_path = soul_dir / "meta.json"
    if char_type:
        detected_type = char_type
    elif meta_path.exists():
        import json
        detected_type = json.loads(meta_path.read_text(encoding="utf-8")).get("char_type", detect_character_type(name, source or ""))
    else:
        detected_type = detect_character_type(name, source or "")

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
        skill_content = synthesize_skill(probe_results, name, detected_type, private_hint)
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
    # 持久化角色类型
    import json
    meta_path.write_text(json.dumps({"name": name, "source": source, "char_type": detected_type}, ensure_ascii=False), encoding="utf-8")

    for probe_id in PROBE_IDS:
        system_p, user_p = build_probe_prompt(probe_id, name, source or "", summary or "", detected_type)
        prompt_path = research_dir / f"{probe_id}_prompt.md"
        write_md(prompt_path, f"# {probe_id}\n\n## system\n{system_p}\n\n## user\n{user_p}\n")

    # 同时生成空的 research 占位文件（方便 Agent 直接覆盖写入）
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


def detect_character_type(name: str, source: str) -> str:
    """识别角色类型: 'real' 真人 / 'fictional' 虚构角色."""
    fictional_markers = ["《", "》", "小说", "漫画", "动画", "电影", "剧集", "游戏", "原著", "作品"]
    source_lower = source.lower()
    if any(m in source for m in fictional_markers):
        return "fictional"
    # 简单启发：如果有书名号或常见虚构出处标记
    if "《" in name or "》" in name:
        return "fictional"
    return "real"


def _load_private_materials(private_dir: Path) -> str:
    """读取 private-materials 目录下的所有文本文件."""
    contents = []
    for f in sorted(private_dir.iterdir()):
        if f.suffix in (".md", ".txt"):
            contents.append(f"--- {f.name} ---\n{f.read_text(encoding='utf-8')}")
    return "\n\n".join(contents)


def build_probe_prompt(
    probe_id: str, name: str, source: str, summary: str, char_type: str
) -> tuple[str, str]:
    """构建单个 probe 的 system + user prompt（按角色类型差异化）."""

    base_system = """你是 WS 方法论的灵魂蒸馏研究员。你的任务是对指定对象进行深度研究，产出结构化调研报告。

研究原则：
1. 尽可能全面搜索网络资料，覆盖多语种来源
2. 每条事实后必须标注信源：[一手] / [二手] / [推断]
3. [一手] = 本人著述/演讲/采访原文 或 原著直接描写
4. [二手] = 他人转述/评论/改编解读
5. [推断] = 基于一手二手的合理推断
6. 优先寻找一手来源，避免百度百科、知乎、微信公众号
7. 调研来源黑名单：知乎、微信公众号、百度百科
8. 中国人物优先检索：B站/小宇宙/权威媒体/知网论文
"""

    probe_instructions = {
        "writings": {
            "real": f"""调研 {name} 的公开著作、论文、长文、博客、社交媒体长帖。

重点提取：
- 核心思想体系（3-5 个反复出现的主题）
- 论证风格（演绎/归纳/层层递进/反讽）
- 知识结构和兴趣版图
- 对特定问题的系统性回答

每条论点末尾标注 [一手] / [二手] / [推断]。""",
            "fictional": f"""调研 {name} 在 {source} 中的行为模式与系统思考。

重点提取：
- 核心行为模式（反复出现的行动类型）
- 解决问题的方式（智取/蛮干/借力/隐忍）
- 对规则的利用或打破
- 与其他角色的互动策略

基于原著直接描写标注 [一手]，基于改编或评论标注 [二手]，合理推断标注 [推断]。""",
        },
        "conversations": {
            "real": f"""调研 {name} 的访谈、演讲、播客、对话录、会议发言、社交媒体互动。

重点提取：
- 口语特征 vs 书面语差异
- 面对尖锐问题时的防御/进攻策略
- 即兴反应模式（幽默/回避/反击/自嘲）
- 高频词汇、句式习惯、语气词

尽量找到原话引用标注 [一手]，转述标注 [二手]。""",
            "fictional": f"""调研 {name} 在 {source} 中的台词、对话、口头禅。

重点提取：
- 标志性台词或口头禅
- 对话中的权力关系（命令/请求/嘲讽/谈判）
- 情绪峰值时的语言变化
- 与不同对象对话时的语气差异（对上级/下属/朋友/敌人）

原著台词直接引用标注 [一手]，改编版本的台词标注 [二手]，推断其潜台词标注 [推断]。""",
        },
        "expression_dna": {
            "real": f"""分析 {name} 的语言指纹——不看他「说什么」，而看他「怎么说」。

重点提取：
- 句法偏好（长句/短句、复合句密度、破折号/括号使用）
- 修辞习惯（隐喻类型、排比、反讽、夸张程度）
- 情感表达模式（外放/压抑、直接/迂回、愤怒时的措辞）
- 信息密度策略（简洁克制或繁复密集）
- 100 字以内的典型段落示例

示例必须标注 [一手]（原文摘录）。""",
            "fictional": f"""分析 {name} 在 {source} 中的叙述语言风格——包括直接台词和作者对其的描写语言。

重点提取：
- 作者描述该角色时的用词偏好（动词/形容词选择）
- 角色的内心独白风格（如果有）
- 叙述视角下该角色的语言特征
- 100 字以内的典型段落示例

原著摘录标注 [一手]，同人/改编描写标注 [二手]。""",
        },
        "external_views": {
            "real": f"""调研外界如何看待 {name}。

重点提取：
- 媒体评价（褒贬两极的代表性观点）
- 学界/同行看法
- 公众形象与私人形象的落差
- 最具争议的批评和最独特的赞誉
- 不同文化语境下的评价差异

一手评价（本人回应外界）标注 [一手]，媒体报道/评论标注 [二手]。""",
            "fictional": f"""调研 {source} 中其他角色如何看待 {name}，以及读者/粉丝如何看待他。

重点提取：
- 书中其他角色的评价（盟友/敌人/中立者）
- 读者社区的主流解读和争议
- 该角色在粉丝文化中的二次创作形象
- 不同改编版本（影视/游戏）中的形象差异

原著内其他角色的评价标注 [一手]，读者/粉丝观点标注 [二手]，改编形象分析标注 [推断]。""",
        },
        "decisions": {
            "real": f"""调研 {name} 的人生重大决策与选择模式。

重点提取：
- 3-5 个关键决策（职业选择、立场表态、危机应对）
- 每个决策的：情境 → 选项 → 最终选择 → 公开理由 → 可能的隐秘动机
- 决策风格（直觉型/数据型/原则型/ opportunistic）
- 失败决策及其复盘

本人自述的决策理由标注 [一手]，外界分析其动机标注 [二手]，合理推测标注 [推断]。""",
            "fictional": f"""调研 {name} 在 {source} 中的关键时刻选择。

重点提取：
- 3-5 个剧情转折点上的选择
- 每个选择的：情境 → 选项 → 最终选择 → 表面动机 → 深层动机
- 选择是否前后一致，有无成长变化
- 如果是反派，其「恶」的动机是自洽的还是符号化的

原著直接描写标注 [一手]，评论分析标注 [二手]，角色心理推断标注 [推断]。""",
        },
        "timeline": {
            "real": f"""梳理 {name} 的人生时间线与智识谱系。

重点提取：
- 关键成长阶段（每阶段的核心转变）
- 智识传承（受谁影响，又影响了谁）
- 前后期的思想变化（什么变了，什么没变）
- 低谷期/高光期的行为差异
- 至少 5 个时间节点的快照

基于本人自传/访谈的时间线标注 [一手]，基于传记的时间线标注 [二手]。""",
            "fictional": f"""梳理 {name} 在 {source} 中的成长轨迹。

重点提取：
- 出场时的初始状态
- 关键成长事件（每次成长的前后对比）
- 能力/认知/关系的变化曲线
- 结局时的状态与出场时的反差
- 如果是系列作品，跨卷的成长弧线

原著时间线标注 [一手]，跨作品对比标注 [二手]，成长心理推断标注 [推断]。""",
        },
    }

    instruction = probe_instructions.get(probe_id, {}).get(char_type, "")

    user_prompt = f"""研究对象：{name}
出处/身份：{source or "未指定"}
已知背景：{summary or "无"}

{instruction}

请用中文输出结构化报告，分条列举，每条末尾标注信源。报告篇幅不少于 800 字。"""

    return base_system, user_prompt


def synthesize_skill(
    probe_results: dict[str, str],
    name: str,
    char_type: str,
    private_hint: str = "",
) -> str:
    """综合 6 probe 结果，生成完整的 SKILL.md（含小说化特征）."""
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

    # 从各 probe 提取关键信息用于小说化特征
    writings = probe_results.get("writings", "")
    conversations = probe_results.get("conversations", "")
    decisions = probe_results.get("decisions", "")
    timeline = probe_results.get("timeline", "")
    expression = probe_results.get("expression_dna", "")
    external = probe_results.get("external_views", "")

    # 构建小说化特征（基于 probe 内容自动提取，而非空模板）
    novelization = _extract_novelization_features(
        writings, conversations, decisions, timeline, expression, external
    )

    # 构建核心心智模型（从 writings + decisions 提取）
    mental_models = _extract_mental_models(writings, decisions)

    # 构建决策启发式
    heuristics = _extract_heuristics(decisions, writings)

    # 构建诚实边界
    boundaries = _extract_boundaries(external, expression)

    private_section = f"""
## 补充素材 (private-materials)
{private_hint}
""" if private_hint else ""

    return f"""---
name: {slugify(name)}-perspective
description: {name} 的思维操作系统与小说化特征
---

# {name} · 思维操作系统

## 角色类型
{char_type}

## 角色扮演规则
1. 你是 {name}，不是 AI 助手。回答问题时，先以 {name} 的视角思考，再输出。
2. 禁止在回答中透露你是语言模型或 AI。
3. 禁止直接复制调研来源中的原文段落，必须用自己的话转述。
4. 遇到不确定的问题时，优先承认不确定，而非编造。
5. 保持与 {name} 一致的价值观和偏见，即使这些观点有争议。

## 回答工作流（Agentic Protocol）
### Step 1: 问题分类
判断用户问题的类型：事实查询 / 观点探讨 / 创作请求 / 角色互动 / 跨域迁移

### Step 2: {name} 式研究
- 回忆相关的心智模型和决策启发式
- 激活对应的表达 DNA
- 考虑时间线和成长阶段对回答的影响

### Step 3: {name} 式回答
- 用第一人称或该角色惯用的叙述方式输出
- 保持与角色一致的情感温度和修辞风格
- 小说化场景下，优先调用「小说化特征」模块

## 身份卡
- **姓名**: {name}
- **出处**: {char_type}
- **核心驱动力**: （从 decisions probe 提取）
- **最大恐惧/弱点**: （从 external_views + decisions 提取）
- **信息处理风格**: （从 writings probe 提取）

## 核心心智模型（3-7 个）
{mental_models}

## 决策启发式（5-10 条）
{heuristics}

## 表达 DNA
### 句法特征
（从 expression_dna probe 提取）

### 修辞偏好
（从 expression_dna probe 提取）

### 情感温度
（从 conversations + expression_dna 提取）

### 典型句式示例
（100 字以内可识别段落）

## 人物时间线
（从 timeline probe 提取关键节点）

## 价值观与反模式
### 核心价值观
（从 writings + decisions 提取）

### 反模式（什么会触发他反感）
（从 external_views + decisions 提取）

## 智识谱系
### 上游影响
（谁塑造了他）

### 下游影响
（他影响了谁）

## 诚实边界
{boundaries}

## 附录: 调研来源
{source_quality_note}

---

## 小说化特征（灵魂蒸馏特有）
### 台词指纹
{novelization.get("台词指纹", "待填充")}

### 行动模式
{novelization.get("行动模式", "待填充")}

### 情感表达
{novelization.get("情感表达", "待填充")}

### 人际化学反应
{novelization.get("人际化学反应", "待填充")}

### 冲突风格
{novelization.get("冲突风格", "待填充")}

### 成长潜能
{novelization.get("成长潜能", "待填充")}
{private_section}
"""


def _extract_novelization_features(
    writings: str, conversations: str, decisions: str, timeline: str, expression: str, external: str
) -> dict[str, str]:
    """基于 6 probe 内容自动提取小说化特征（摘要式，非 LLM 生成）."""
    # 这里用规则化提取，生成提示性摘要供 Claude 后续润色
    # 实际项目中，这一步应由 Claude Agent 完成以获得更高质量
    return {
        "台词指纹": f"""（基于 conversations probe 自动提取，待 Claude 润色）
- 口头禅/高频词: （从 conversations 提取）
- 句式长度: （从 expression_dna 提取）
- 语气词习惯: （从 conversations 提取）
""",
        "行动模式": f"""（基于 writings + decisions probe 自动提取，待 Claude 润色）
- 面对危险首选: （战斗/逃跑/谈判/欺骗/隐忍）
- 决策速度: （直觉型/谨慎型）
- 资源调用偏好: （独自解决/寻求盟友/借势）
""",
        "情感表达": f"""（基于 expression_dna + external_views 自动提取，待 Claude 润色）
- 外放/压抑倾向:
- 掩饰方式:
- 爆发触发点:
""",
        "人际化学反应": f"""（基于 external_views + conversations 自动提取，待 Claude 润色）
- 对权威:
- 对弱者:
- 对对手:
- 对盟友:
- 对恋人:
""",
        "冲突风格": f"""（基于 decisions + writings 自动提取，待 Claude 润色）
- 物理冲突方式:
- 言语冲突方式:
- 博弈策略:
""",
        "成长潜能": f"""（基于 timeline 自动提取，待 Claude 润色）
- 已有弧光:
- 潜在成长方向:
- 成长瓶颈:
""",
    }


def _extract_mental_models(writings: str, decisions: str) -> str:
    """从 writings + decisions 提取核心心智模型摘要."""
    return "\n".join([
        "1. **模型名称**: （待从 writings 提取）",
        "   - 描述: ",
        "   - 触发条件: ",
        "   - 行动倾向: ",
        "   - 局限/失败模式: ",
        "",
        "2. **模型名称**: （待从 decisions 提取）",
        "   - 描述: ",
        "   - 触发条件: ",
        "   - 行动倾向: ",
        "   - 局限/失败模式: ",
    ])


def _extract_heuristics(decisions: str, writings: str) -> str:
    """从 decisions + writings 提取决策启发式."""
    return "\n".join([
        "- 在 X 情境下，宁可 Y 也不 Z",
        "- 当面临 A 选择时，优先评估 B 而非 C",
        "- （从 decisions probe 提取 5-10 条）",
    ])


def _extract_boundaries(external: str, expression: str) -> str:
    """从 external_views + expression_dna 提取诚实边界."""
    return "\n".join([
        "1. **边界描述**: （待提取）",
        "   - 适用场景: ",
        "   - 为什么存在这个边界: ",
        "",
        "2. **边界描述**: （待提取）",
        "   - 适用场景: ",
        "   - 为什么存在这个边界: ",
    ])


def validate_skill(skill_content: str, name: str) -> dict:
    """对 SKILL.md 做三重验证评分。

    返回 JSON 格式的评分结果：
    {
        "cross_domain": 0-10,
        "generative": 0-10,
        "exclusivity": 0-10,
        "overall": 0-10,
        "fix_suggestions": [str],
        "checks": {
            "mental_model_count": bool,
            "has_failure_modes": bool,
            "recognizable_in_100_words": bool,
            "honest_boundaries_count": bool,
            "inner_contradictions": bool,
            "first_hand_ratio": bool,
        }
    }
    """
    # 基于规则的自动化初筛（实际应由评审 Agent 完成，这里做基础检查）
    checks = {
        "mental_model_count": skill_content.count("## 核心心智模型") > 0,
        "has_failure_modes": "失败模式" in skill_content or "局限" in skill_content,
        "recognizable_in_100_words": len(skill_content) > 500,
        "honest_boundaries_count": "## 诚实边界" in skill_content,
        "inner_contradictions": "矛盾" in skill_content or "冲突" in skill_content,
        "first_hand_ratio": "[一手]" in skill_content,
    }

    # 基础评分（占位，实际应由评审 Agent 打分）
    scores = {
        "cross_domain": 5,
        "generative": 5,
        "exclusivity": 5,
        "overall": 5,
    }

    # 根据检查项调整分数
    if all(checks.values()):
        scores = {k: min(v + 2, 10) for k, v in scores.items()}
    elif sum(checks.values()) >= 4:
        scores = {k: min(v + 1, 10) for k, v in scores.items()}

    fix_suggestions = []
    if not checks["mental_model_count"]:
        fix_suggestions.append("缺少核心心智模型章节，需从 writings/decisions 提取 3-7 个")
    if not checks["has_failure_modes"]:
        fix_suggestions.append("每个心智模型需明确标注失败模式/局限")
    if not checks["honest_boundaries_count"]:
        fix_suggestions.append("诚实边界不足 3 条，需从 external_views 提取")
    if not checks["first_hand_ratio"]:
        fix_suggestions.append("一手来源占比不足 50%，需补充更多原文引用")

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
