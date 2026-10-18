"""锚定自检 (Narrative Anchor / Consistency Engine)

解决 AI 写长篇小说时的核心漂移问题:
    - 人物性格跳脱 (OOC)
    - 暗线到下个场景就忘
    - 世界观数值前后矛盾
    - 情节逻辑不自洽
    - 风格中途变味

基础检查清单 (所有平台通用):
    1. 世界观一致性 — 内部规则不自相矛盾
    2. 人物性格一致性 — 角色行为符合 SKILL.md
    3. 暗线连续性 — 暗线推进合理，无遗忘
    4. 情节逻辑合理性 — 因果通顺，无硬伤
    5. 叙事连贯性 — 时间/地点/关系不矛盾
    6. 风格一致性 — 符合作者灵魂方案 DNA
    7. 版权安全 — 不与参考原作一致，无侵权风险
    8. 数值一致性 — 功德/等级/物品数量前后一致

8 维评分 (每项 0-10, 权重可调):
    - 世界观合规     12%
    - 结构完整       12%
    - 角色刻画       12%
    - 情节逻辑       12%
    - 爽点/情感      12%
    - 语言风格       12%
    - 推演输入完整   14%
    - 推演-正文一致  14%

必过项 (任一失败则整章不通过):
    - 世界观与章节划分合规
    - 人物无 OOC
    - 暗线无遗忘
    - 版权安全

平台叠加规则 (可选):
    --platform tomato   : 番茄小说红线 (正能量/无暴恐/无抄袭)
    --platform qidian  : 起点爽文节奏 (升级感/打脸频率/章末钩子)
    --platform zhihu   : 知乎盐选节奏 (悬念密度/反转/付费点)
"""

import re
from pathlib import Path
from typing import Optional

from novel_distiller.utils import write_md, read_md
from novel_distiller import platform as platform_module

DIMENSIONS = [
    ("世界观合规", 0.12),
    ("结构完整", 0.12),
    ("角色刻画", 0.12),
    ("情节逻辑", 0.12),
    ("爽点情感", 0.12),
    ("语言风格", 0.12),
    ("推演输入完整", 0.14),
    ("推演-正文一致", 0.14),
]

PASS_THRESHOLD = 8.0

MUST_PASS_ITEMS = [
    "世界观与章节划分合规",
    "人物无 OOC",
    "暗线无遗忘",
    "版权安全",
]


def run(
    project_dir: Path,
    chapter_num: int,
    platform: str = "generic",
    auto_rewrite: bool = False,
) -> dict:
    """运行锚定自检。

    工作流程:
        1. 检查章节文件是否存在
        2. 读取相关素材（推演报告、角色 SKILL、世界观、暗线）
        3. 生成自检 prompt（供 Claude Agent 评估使用）
        4. 基础规则检查（字数、文件存在性等）
        5. 生成 report.md 模板

    Returns:
        {
            "report_md": Path,
            "check_prompt_md": Path,
            "total_score": float,
            "is_passed": bool,
            "dimension_scores": dict,
            "must_pass_results": dict,
            "fix_suggestions": list[str],
            "status": "checked" | "missing_chapter" | "missing_materials",
        }
    """
    chapter_md = project_dir / "chapters" / f"ch{chapter_num:03d}.md"
    report_md = project_dir / "chapters" / f"ch{chapter_num:03d}.report.md"
    check_prompt_md = project_dir / "chapters" / f"ch{chapter_num:03d}_check_prompt.md"

    # 1. 检查章节文件
    if not chapter_md.exists():
        return {
            "report_md": report_md,
            "check_prompt_md": check_prompt_md,
            "total_score": 0.0,
            "is_passed": False,
            "dimension_scores": {},
            "must_pass_results": {},
            "fix_suggestions": ["章节文件不存在"],
            "status": "missing_chapter",
        }

    chapter_content = read_md(chapter_md)
    if not chapter_content.strip() or "待撰写" in chapter_content:
        return {
            "report_md": report_md,
            "check_prompt_md": check_prompt_md,
            "total_score": 0.0,
            "is_passed": False,
            "dimension_scores": {},
            "must_pass_results": {},
            "fix_suggestions": ["章节内容为空或尚未撰写"],
            "status": "missing_chapter",
        }

    # 2. 读取相关素材
    materials = _load_check_materials(project_dir, chapter_num)

    # 3. 基础规则检查
    basic_checks = _run_basic_checks(chapter_content, materials, platform)

    # 4. 生成自检 prompt（供 Claude Agent 使用）
    check_prompt = _build_check_prompt(
        chapter_num=chapter_num,
        chapter_content=chapter_content,
        materials=materials,
        platform=platform,
        basic_checks=basic_checks,
    )
    write_md(check_prompt_md, check_prompt)

    # 5. 生成 report.md（含基础评分 + Agent 评估模板）
    report_content = _build_report(
        chapter_num=chapter_num,
        chapter_content=chapter_content,
        materials=materials,
        platform=platform,
        basic_checks=basic_checks,
    )
    write_md(report_md, report_content)

    # 6. 判断是否通过（基础检查 + 占位评分）
    total_score = basic_checks.get("score", 5.0)
    must_pass_all = all(basic_checks["must_pass"].values())
    is_passed = total_score >= PASS_THRESHOLD and must_pass_all

    return {
        "report_md": report_md,
        "check_prompt_md": check_prompt_md,
        "total_score": total_score,
        "is_passed": is_passed,
        "dimension_scores": basic_checks.get("dimension_scores", {}),
        "must_pass_results": basic_checks["must_pass"],
        "fix_suggestions": basic_checks.get("fix_suggestions", []),
        "status": "checked",
    }


def _load_check_materials(project_dir: Path, chapter_num: int) -> dict:
    """加载自检所需的全部素材。"""
    materials = {
        "outline": "",
        "scene_report": "",
        "character_skills": {},
        "worldview": "",
        "darkthread": "",
        "author_skill": "",
        "prev_chapter": "",
    }

    # 大纲
    outline_path = project_dir / "chapters" / "outline.md"
    if outline_path.exists():
        materials["outline"] = read_md(outline_path)

    # 世界观
    worldview_dir = project_dir / "worldviews"
    if worldview_dir.exists():
        materials["worldview"] = "\n\n".join(
            read_md(f) for f in worldview_dir.glob("*.md")
        )

    # 暗线
    dt_dir = project_dir / "dark-threads"
    if dt_dir.exists():
        dt_files = sorted(dt_dir.glob("ch*_snapshot.md"))
        if dt_files:
            materials["darkthread"] = read_md(dt_files[-1])
            # 同时加载解析后的状态
            from novel_distiller import darkthread as dt_module
            materials["darkthread_state"] = dt_module.get_current_state(project_dir)

    # 作者风格
    author_soul_path = project_dir / "author_soul.md"
    if author_soul_path.exists():
        materials["author_skill"] = read_md(author_soul_path)

    # 前一章（用于连续性检查）
    if chapter_num > 1:
        prev_path = project_dir / "chapters" / f"ch{chapter_num - 1:03d}.md"
        if prev_path.exists():
            materials["prev_chapter"] = read_md(prev_path)

    # 尝试从大纲或写作指令中提取场景 ID，然后加载场景报告
    scene_id = _extract_scene_id_from_outline(materials["outline"], chapter_num)
    if not scene_id:
        scene_id = _extract_scene_id_from_prompt(project_dir, chapter_num)
    # fallback：如果只有一个场景有 report.md，直接用它
    if not scene_id:
        scenes_dir = project_dir / "scenes"
        if scenes_dir.exists():
            candidates = [
                d.name for d in scenes_dir.iterdir()
                if d.is_dir() and (d / "report.md").exists()
            ]
            if len(candidates) == 1:
                scene_id = candidates[0]
    if scene_id:
        report_path = project_dir / "scenes" / scene_id / "report.md"
        if not report_path.exists():
            from novel_distiller.utils import slugify
            report_path = project_dir / "scenes" / slugify(scene_id) / "report.md"
        if report_path.exists():
            materials["scene_report"] = read_md(report_path)

    # 加载所有角色 SKILL.md
    souls_dir = project_dir / "souls"
    if souls_dir.exists():
        for soul_subdir in souls_dir.iterdir():
            if soul_subdir.is_dir():
                skill_path = soul_subdir / "SKILL.md"
                if skill_path.exists():
                    content = read_md(skill_path)
                    # 排除 author-perspective
                    if "author-perspective" not in content:
                        materials["character_skills"][soul_subdir.name] = content

    return materials


def _extract_scene_id_from_outline(outline: str, chapter_num: int) -> Optional[str]:
    """从大纲中尝试提取章节关联的场景 ID。"""
    lines = outline.split("\n")
    for line in lines:
        if f"第 {chapter_num} 章" in line or f"| {chapter_num} " in line or f"第{chapter_num}章" in line:
            # 尝试匹配 "场景:XXX" 或 "scene:XXX"
            match = re.search(r"场景[：:]\s*(.+?)(?:\||$)", line)
            if match:
                return match.group(1).strip()
            # 尝试在括号内找场景名
            match = re.search(r"[（(](.+?场景.+?)[)）]", line)
            if match:
                return match.group(1).strip()
    return None


def _extract_scene_id_from_prompt(project_dir: Path, chapter_num: int) -> Optional[str]:
    """从写作指令中尝试提取章节关联的场景 ID。"""
    prompt_path = project_dir / "chapters" / f"ch{chapter_num:03d}_prompt.md"
    if prompt_path.exists():
        content = read_md(prompt_path)
        match = re.search(r"关联场景[：:]\s*(.+?)(?:\n|$)", content)
        if match:
            return match.group(1).strip()
    return None


def _run_basic_checks(chapter_content: str, materials: dict, platform: str) -> dict:
    """运行可自动化的基础规则检查。"""
    fix_suggestions = []
    must_pass = {item: True for item in MUST_PASS_ITEMS}
    dimension_scores = {name: 5.0 for name, _ in DIMENSIONS}

    # 字数检查
    word_count = _count_chinese_words(chapter_content)
    if word_count < 1000:
        fix_suggestions.append(f"字数不足：当前 {word_count} 字，建议至少 2000 字")
        dimension_scores["结构完整"] = 3.0

    # 章末钩子检查：最后 150 字是否有悬念标点或悬念关键词
    last_150 = chapter_content[-150:]
    hook_punctuations = "？?!！…"
    hook_keywords = ["倒计时", "警告", "危机", "危险", "陷阱", "悬念", "未知", "秘密", "真相",
                     "反转", "意外", "没想到", "竟然", "难道", "究竟", "是谁", "牢门",
                     "囚徒", "敲响", "信号", "未授权", "未解", "阴谋", "暗算", "潜伏"]
    has_hook_punc = any(c in last_150 for c in hook_punctuations)
    has_hook_kw = any(kw in last_150 for kw in hook_keywords)
    if not has_hook_punc and not has_hook_kw:
        fix_suggestions.append("章末缺少强钩子（建议以悬念、危机或反转结尾）")
        dimension_scores["爽点情感"] = 4.0

    # 角色一致性检查（简单启发：检查角色名是否出现）
    char_names = list(materials["character_skills"].keys())
    mentioned_chars = [name for name in char_names if name in chapter_content]
    if len(mentioned_chars) < len(char_names) and len(char_names) > 0:
        missing_chars = set(char_names) - set(mentioned_chars)
        fix_suggestions.append(f"角色可能遗漏：{', '.join(missing_chars)} 未在本章出现")

    # 世界观关键词检查
    worldview = materials.get("worldview", "")
    # 提取世界观中的关键词（如境界名称、道具名等）
    key_terms = re.findall(r"[【\[]?([^【\[\n]{2,6}?)\]?[】\]]?[（/]", worldview)
    key_terms = [t for t in key_terms if len(t) >= 2]
    for term in key_terms[:5]:
        if term in chapter_content:
            # 有世界观术语出现，加分
            dimension_scores["世界观合规"] = min(dimension_scores["世界观合规"] + 1, 10)
            break

    # 暗线连续性检查
    dt_state = materials.get("darkthread_state", {})
    dark_threads = dt_state.get("dark_threads", {})
    if dark_threads:
        mentioned = False
        for key, thread in dark_threads.items():
            # 检查暗线 slug 或描述关键词是否出现在正文中
            desc = thread.get("description", "")
            # 从描述中提取中文关键词（2-4字）
            keywords = re.findall(r"[一-鿿]{2,4}", desc)
            if key in chapter_content:
                mentioned = True
                break
            for kw in keywords:
                if kw in chapter_content:
                    mentioned = True
                    break
            if mentioned:
                break

        if not mentioned:
            must_pass["暗线无遗忘"] = False
            fix_suggestions.append("暗线可能遗忘：本章未提及任何活跃暗线，请确认是否有推进")
            dimension_scores["情节逻辑"] = min(dimension_scores["情节逻辑"], 5.0)
        else:
            dimension_scores["情节逻辑"] = min(dimension_scores["情节逻辑"] + 1, 10)

    # 推演一致性检查
    scene_report = materials.get("scene_report", "")
    if scene_report:
        # 检查场景报告中的关键事件是否在正文中有体现
        report_events = re.findall(r"Action[：:]\s*(.+?)(?:\n|$)", scene_report)
        matched_events = 0
        for event in report_events[:3]:
            # 提取动作关键词
            keywords = re.findall(r"[一-鿿]{2,4}", event)
            for kw in keywords[:3]:
                if kw in chapter_content:
                    matched_events += 1
                    break
        if matched_events == 0 and report_events:
            fix_suggestions.append("正文可能与场景推演报告不一致，请检查情节是否偏离")
            dimension_scores["推演-正文一致"] = 3.0
        else:
            dimension_scores["推演-正文一致"] = min(7.0 + matched_events, 10)
    else:
        dimension_scores["推演输入完整"] = 3.0
        fix_suggestions.append("缺少场景推演报告，无法验证推演-正文一致性")

    # 平台规则检查
    platform_rules = platform_module.load_rules(platform)
    if platform != "generic":
        # 基础安全扫描
        violations = platform_module.check_content_safety(chapter_content, platform)
        for v in violations:
            must_pass["版权安全"] = False
            fix_suggestions.append(v)

        # 节奏要求检查
        rhythm = platform_module.get_rhythm_requirements(platform)
        if rhythm:
            min_words = rhythm.get("min_words_per_chapter", 0)
            if word_count < min_words:
                fix_suggestions.append(
                    f"{platform_rules['platform_name']}节奏要求："
                    f"本章 {word_count} 字低于最低要求 {min_words} 字"
                )
                dimension_scores["结构完整"] = min(dimension_scores["结构完整"], 4.0)

        # 番茄额外检查
        if platform == "tomato":
            violent_terms = ["杀死", "屠杀", "血流成河", "碎尸", "酷刑"]
            for term in violent_terms:
                if term in chapter_content:
                    must_pass["版权安全"] = False
                    fix_suggestions.append(f"番茄平台红线：检测到 '{term}'，请弱化暴力描写")
                    break

    # 计算总分
    total_score = sum(score * weight for (name, weight), score in zip(DIMENSIONS, dimension_scores.values()))

    # 如果字数严重不足，直接不通过
    if word_count < 500:
        total_score = min(total_score, 4.0)
        must_pass["世界观与章节划分合规"] = False

    return {
        "score": round(total_score, 1),
        "word_count": word_count,
        "must_pass": must_pass,
        "dimension_scores": dimension_scores,
        "fix_suggestions": fix_suggestions,
    }


def _build_check_prompt(
    chapter_num: int,
    chapter_content: str,
    materials: dict,
    platform: str,
    basic_checks: dict,
) -> str:
    """生成供 Claude Agent 进行深度评估的 prompt。"""

    char_skills_summary = "\n\n".join(
        f"### {name}\n```\n{content[:800]}...\n```"
        for name, content in materials.get("character_skills", {}).items()
    )

    platform_section = ""
    if platform != "generic":
        platform_data = platform_module.load_rules(platform)
        rules_list = platform_data.get("platform", {}).get("must_have", [])
        rules = "\n".join(f"- {r}" for r in rules_list)
        platform_section = f"""
## 平台叠加规则 ({platform})
{rules}
"""

    return f"""# 第 {chapter_num} 章 锚定自检评估指令

## 待评估章节正文
```
{chapter_content[:3000]}
```

## 8 维评分标准（每项 0-10 分）

| 维度 | 权重 | 评分要点 |
|------|------|----------|
| 世界观合规 | 12% | 内部规则不自相矛盾，数值一致 |
| 结构完整 | 12% | 开头有钩子，中间有递进，结尾有悬念 |
| 角色刻画 | 12% | 行为符合 SKILL.md，无 OOC |
| 情节逻辑 | 12% | 因果通顺，无硬伤 |
| 爽点情感 | 12% | 情绪节奏合理，有释放点 |
| 语言风格 | 12% | 符合作者风格 DNA |
| 推演输入完整 | 14% | 使用了场景推演报告的内容 |
| 推演-正文一致 | 14% | 正文与推演报告无偏离 |

## 必过项（任一失败则整章不通过）
- [ ] 世界观与章节划分合规
- [ ] 人物无 OOC
- [ ] 暗线无遗忘
- [ ] 版权安全

## 参考素材

### 角色 SKILL.md
{char_skills_summary}

### 世界观约束
```
{materials.get("worldview", "")[:1000]}
```

### 场景推演报告
```
{materials.get("scene_report", "")[:1500]}
```
{platform_section}

## 评估要求
1. 对 8 个维度分别打分（0-10），并给出打分理由
2. 检查 4 个必过项，标记通过/失败
3. 列出具体的 fix_suggestions（如有）
4. 如果涉及角色 OOC，请引用 SKILL.md 中的具体条款说明偏差
5. 如果涉及世界观矛盾，请指出矛盾点

## 输出格式
```json
{{
  "dimension_scores": {{
    "世界观合规": 0,
    "结构完整": 0,
    "角色刻画": 0,
    "情节逻辑": 0,
    "爽点情感": 0,
    "语言风格": 0,
    "推演输入完整": 0,
    "推演-正文一致": 0
  }},
  "must_pass": {{
    "世界观与章节划分合规": true,
    "人物无 OOC": true,
    "暗线无遗忘": true,
    "版权安全": true
  }},
  "overall": 0.0,
  "fix_suggestions": ["..."]
}}
```

## 基础检查已完成的初筛结果
- 字数: {basic_checks['word_count']}
- 初筛总分: {basic_checks['score']}
- 初筛修复建议: {basic_checks['fix_suggestions']}
"""


def _build_report(
    chapter_num: int,
    chapter_content: str,
    materials: dict,
    platform: str,
    basic_checks: dict,
) -> str:
    """生成 report.md 内容。"""

    dim_table = "\n".join(
        f"| {name} | {basic_checks['dimension_scores'].get(name, '-')} / 10 | {int(weight * 100)}% |"
        for name, weight in DIMENSIONS
    )

    must_pass_table = "\n".join(
        f"| {item} | {'通过' if passed else '未通过'} |"
        for item, passed in basic_checks["must_pass"].items()
    )

    fixes = "\n".join(f"- {f}" for f in basic_checks["fix_suggestions"]) or "（初筛未发现明显问题）"

    platform_section = ""
    if platform != "generic":
        platform_data = platform_module.load_rules(platform)
        rules_list = platform_data.get("platform", {}).get("must_have", [])
        rules = "\n".join(f"- {r}" for r in rules_list)
        platform_section = f"""
## 平台规则检查 ({platform})
{rules}
"""

    return f"""# 第 {chapter_num} 章 锚定自检报告

## 基础信息
- **字数**: {basic_checks['word_count']}
- **平台**: {platform}
- **状态**: {'通过' if basic_checks['score'] >= PASS_THRESHOLD else '待改进'}

## 8 维评分

| 维度 | 得分 | 权重 |
|------|------|------|
{dim_table}

**初筛加权总分**: {basic_checks['score']} / 10
**通过门槛**: {PASS_THRESHOLD}

## 必过项检查

| 项目 | 状态 |
|------|------|
{must_pass_table}

## 修复建议（初筛）
{fixes}

## 深度评估（待 Claude Agent 完成）

请使用以下文件进行深度评估：
- 评估指令: `ch{chapter_num:03d}_check_prompt.md`

评估完成后，请将 JSON 结果填入下方：

```json
{{
  "dimension_scores": {{}},
  "must_pass": {{}},
  "overall": 0.0,
  "fix_suggestions": []
}}
```
{platform_section}

## 素材完整性检查

- [ ] 章节正文 (chapters/ch{chapter_num:03d}.md)
- [ ] 场景推演报告
- [ ] 角色 SKILL.md
- [ ] 世界观设定
- [ ] 暗线状态
- [ ] 作者风格基线
"""


def _count_chinese_words(text: str) -> int:
    """统计中文字数。"""
    chinese_chars = len(re.findall(r"[一-鿿]", text))
    english_words = len(re.findall(r"[a-zA-Z]+", text))
    return chinese_chars + english_words
