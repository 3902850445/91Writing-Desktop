"""章节撰写 (Chapter Writing)

输入:
    - 作者 SKILL.md (风格基线)
    - 场景推演报告 (scenes/{scene_id}/report.md)
    - 世界观约束 (worldviews/*.md)
    - 暗线状态 (dark-threads/*.md)
    - 章节大纲 (chapters/outline.md)

输出:
    - chapters/ch{NNN}.md
    - chapters/ch{NNN}_prompt.md (写作指令，供 Claude Agent 使用)

约束:
    - 符合作者风格 DNA
    - 世界观数值一致 (功德/难印/境界等)
    - 暗线推进符合预期
    - 章末留强钩子
"""

import re
from pathlib import Path
from typing import Optional

from novel_distiller.utils import write_md, read_md


def run(
    project_dir: Path,
    chapter_num: int,
    scene_id: Optional[str] = None,
    style_override: Optional[str] = None,
) -> dict:
    """撰写单章。

    工作流程:
        1. 检查所有前置素材是否齐备
        2. 组装写作 prompt（风格基线 + 场景报告 + 世界观 + 暗线 + 大纲）
        3. 生成 chapters/ch{NNN}_prompt.md 供 Claude Agent 使用
        4. 如果 chapters/ch{NNN}.md 已存在，返回当前字数统计

    Returns:
        {
            "chapter_md": Path,
            "prompt_md": Path,
            "word_count": int,
            "status": "ready" | "missing_prerequisites" | "exists",
            "missing": list[str],
        }
    """
    chapter_md = project_dir / "chapters" / f"ch{chapter_num:03d}.md"
    prompt_md = project_dir / "chapters" / f"ch{chapter_num:03d}_prompt.md"
    (project_dir / "chapters").mkdir(parents=True, exist_ok=True)

    # 1. 检查前置素材
    prerequisites = _check_prerequisites(project_dir, scene_id)
    if prerequisites["missing"]:
        return {
            "chapter_md": chapter_md,
            "prompt_md": prompt_md,
            "word_count": 0,
            "status": "missing_prerequisites",
            "missing": prerequisites["missing"],
        }

    # 2. 从大纲中提取本章信息
    chapter_info = _extract_chapter_info(prerequisites["outline"], chapter_num)

    # 3. 确定作者风格来源
    author_skill = style_override or prerequisites["author_skill"]

    # 4. 读取暗线最新快照
    darkthread = _load_latest_darkthread(project_dir)

    # 5. 组装写作 prompt
    prompt_content = _build_writing_prompt(
        chapter_num=chapter_num,
        chapter_info=chapter_info,
        author_skill=author_skill,
        scene_report=prerequisites.get("scene_report", ""),
        worldview=prerequisites.get("worldview", ""),
        darkthread=darkthread,
        scene_id=scene_id,
    )
    write_md(prompt_md, prompt_content)

    # 6. 如果章节已存在，统计字数
    if chapter_md.exists():
        content = read_md(chapter_md)
        word_count = _count_chinese_words(content)
        return {
            "chapter_md": chapter_md,
            "prompt_md": prompt_md,
            "word_count": word_count,
            "status": "exists",
            "missing": [],
        }

    # 7. 创建空章节文件（带头部提示）
    write_md(chapter_md, f"""<!--
写作指令见: {prompt_md.name}
由 Claude Agent 根据指令生成正文后替换此文件内容。
-->

# 第 {chapter_num} 章

（待撰写）
""")

    return {
        "chapter_md": chapter_md,
        "prompt_md": prompt_md,
        "word_count": 0,
        "status": "ready",
        "missing": [],
    }


def _check_prerequisites(project_dir: Path, scene_id: Optional[str]) -> dict:
    """检查撰写前置素材，返回已找到和缺失的素材。"""
    found = {}
    missing = []

    # 作者风格
    author_skill = _find_author_skill(project_dir)
    if author_skill:
        found["author_skill"] = author_skill
    else:
        missing.append("作者 SKILL.md (author_soul.md 或 souls/*/SKILL.md)")

    # 场景推演报告
    if scene_id:
        report_path = project_dir / "scenes" / scene_id / "report.md"
        if not report_path.exists():
            # 尝试 slugified 版本
            from novel_distiller.utils import slugify
            report_path = project_dir / "scenes" / slugify(scene_id) / "report.md"
        if report_path.exists():
            found["scene_report"] = read_md(report_path)
        else:
            missing.append(f"场景推演报告 (scenes/{scene_id}/report.md)")

    # 世界观
    worldview_dir = project_dir / "worldviews"
    worldview_files = list(worldview_dir.glob("*.md")) if worldview_dir.exists() else []
    if worldview_files:
        found["worldview"] = "\n\n".join(read_md(f) for f in worldview_files)
    else:
        missing.append("世界观设定 (worldviews/*.md)")

    # 暗线（非强制，但有则加载）
    darkthread_dir = project_dir / "dark-threads"
    if darkthread_dir.exists():
        dt_files = sorted(darkthread_dir.glob("*.md"))
        if dt_files:
            found["darkthread"] = read_md(dt_files[-1])

    # 大纲
    outline_path = project_dir / "chapters" / "outline.md"
    if outline_path.exists():
        found["outline"] = read_md(outline_path)
    else:
        missing.append("章节大纲 (chapters/outline.md)")

    return {"found": found, "missing": missing, **found}


def _find_author_skill(project_dir: Path) -> Optional[str]:
    """查找作者 SKILL.md 内容。优先 author_soul.md，其次 souls/ 下的 author-perspective。"""
    # 1. 优先读取 author_soul.md
    author_soul_path = project_dir / "author_soul.md"
    if author_soul_path.exists():
        content = read_md(author_soul_path)
        # 如果 author_soul.md 指定了具体作者，尝试加载其 SKILL.md
        for line in content.split("\n"):
            if "**" in line and "指定风格" in content:
                # 提取作者名
                match = re.search(r"\*\*(.+?)\*\*", line)
                if match:
                    author_name = match.group(1).strip()
                    from novel_distiller.utils import slugify
                    skill_path = project_dir / "souls" / slugify(author_name) / "SKILL.md"
                    if skill_path.exists():
                        return read_md(skill_path)
        return content

    # 2. 查找 souls/ 下标记为 author-perspective 的 SKILL.md
    souls_dir = project_dir / "souls"
    if souls_dir.exists():
        for soul_subdir in souls_dir.iterdir():
            if soul_subdir.is_dir():
                skill_path = soul_subdir / "SKILL.md"
                if skill_path.exists():
                    content = read_md(skill_path)
                    if "author-perspective" in content:
                        return content

    return None


def _extract_chapter_info(outline: str, chapter_num: int) -> dict:
    """从大纲中提取指定章节的信息。"""
    info = {
        "title": "",
        "summary": "",
        "hook": "",
        "word_target": "",
    }

    # 尝试在 markdown 表格中匹配
    lines = outline.split("\n")
    for line in lines:
        # 匹配 "| 第 N 章 | ... |" 或 "| N | ... |"
        if f"第 {chapter_num} 章" in line or f"| {chapter_num} " in line:
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 4:
                info["title"] = parts[2] if len(parts) > 2 else ""
                info["summary"] = parts[3] if len(parts) > 3 else ""
                info["hook"] = parts[4] if len(parts) > 4 else ""
                info["word_target"] = parts[5] if len(parts) > 5 else ""
            break

    return info


def _load_latest_darkthread(project_dir: Path) -> str:
    """读取最新的暗线快照。"""
    dt_dir = project_dir / "dark-threads"
    if not dt_dir.exists():
        return ""
    files = sorted(dt_dir.glob("ch*_snapshot.md"))
    if not files:
        return ""
    return read_md(files[-1])


def _build_writing_prompt(
    chapter_num: int,
    chapter_info: dict,
    author_skill: str,
    scene_report: str,
    worldview: str,
    darkthread: str,
    scene_id: Optional[str],
) -> str:
    """组装完整的写作 prompt。"""

    darkthread_section = f"""
## 暗线状态（必须在此章推进）
{darkthread}
""" if darkthread else ""

    scene_section = f"""
## 场景推演报告
{scene_report[:2000]}

> 注：正文必须与推演报告中的情节一致，不得擅自更改角色决策。
""" if scene_report else ""

    return f"""# 第 {chapter_num} 章 写作指令

## 章节信息
- **章号**: 第 {chapter_num} 章
- **标题**: {chapter_info.get('title', '待确定')}
- **内容简述**: {chapter_info.get('summary', '见大纲')}
- **钩子/爽点**: {chapter_info.get('hook', '见大纲')}
- **预计字数**: {chapter_info.get('word_target', '3000-5000 字')}
- **关联场景**: {scene_id or '见大纲'}

## 作者风格基线（必须严格遵守）
```
{author_skill[:3000]}
```

## 世界观约束（不得违反）
```
{worldview[:2000]}
```
{darkthread_section}
{scene_section}

## 写作要求

### 结构
1. **开头**：强钩子，必须在 200 字内抓住读者
2. **发展**：情节递进，每 500 字至少一个小转折或信息增量
3. **高潮**：本章核心冲突的爆发点
4. **结尾**：章末留强钩子（悬念/危机/反转），让读者必须点下一章

### 风格
- 严格符合作者风格基线中的「表达 DNA」和「叙事结构癖好」
- 对话符合各角色 SKILL.md 中的「台词指纹」
- 信息密度与作者一致，不要擅自改变

### 一致性
- 世界观数值必须与设定一致（如有功德/境界/物品数量等）
- 角色行为必须符合各自的 SKILL.md，禁止 OOC
- 暗线必须在此章有推进，不能遗忘
- 情节必须与场景推演报告一致

### 版权安全
- 不与参考原作一致
- 无直接抄袭风险
- 角色名、地名、设定如有借鉴必须二次创作

## 输出格式
- 输出纯正文，不要加章节标题（标题已在文件中）
- 用 Markdown 格式，段落间空一行
- 对话用中文引号「」，不使用英文引号
- 字数严格控制在预计范围内

## 自检清单（写完后对照检查）
- [ ] 开头 200 字有强钩子
- [ ] 角色行为符合 SKILL.md
- [ ] 世界观数值无矛盾
- [ ] 暗线有推进
- [ ] 章末有强钩子
- [ ] 字数达标
- [ ] 风格与作者基线一致
"""


def _count_chinese_words(text: str) -> int:
    """统计中文字数（中文字符 + 英文单词近似）。"""
    # 中文字符
    chinese_chars = len(re.findall(r"[一-鿿]", text))
    # 英文单词（粗略）
    english_words = len(re.findall(r"[a-zA-Z]+", text))
    return chinese_chars + english_words
