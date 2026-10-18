"""创世蓝图 (Genesis Blueprint)

交互式立项向导。从用户的一个想法出发，通过多轮问答收集：
- 作品类型、篇幅、平台、男频/女频
- 是否有背景参考资料
- 参考作者风格
- 核心角色数量

然后自动生成：
1. 作品简介 (work_intro.md)
2. 世界观设定 (worldview.md)
3. 主角设定 (protagonist.md)
4. 场景框架 (scenes/index.md)
5. 章节大纲 (chapters/outline.md)
6. 作者灵魂方案 (author_soul.md)
"""

from pathlib import Path
from typing import Optional

from novel_distiller.utils import slugify, write_md, ensure_dirs

# 篇幅模板：字数 -> 场景数 -> 章节数
LENGTH_TEMPLATES = {
    "short": {
        "label": "短篇",
        "word_range": "8,000–30,000",
        "min_words": 8000,
        "max_words": 30000,
        "scene_count": (3, 8),
        "chapter_count": (15, 50),
        "words_per_chapter": (2000, 4000),
    },
    "medium": {
        "label": "中篇",
        "word_range": "30,000–100,000",
        "min_words": 30000,
        "max_words": 100000,
        "scene_count": (10, 25),
        "chapter_count": (50, 150),
        "words_per_chapter": (3000, 5000),
    },
    "long": {
        "label": "长篇",
        "word_range": "100,000+",
        "min_words": 100000,
        "max_words": None,
        "scene_count": (30, 100),
        "chapter_count": (200, 1000),
        "words_per_chapter": (3000, 6000),
    },
}

# 主流类型（男频/女频/通用）
GENRE_CHOICES = {
    "male": [
        "玄幻", "都市", "科幻", "悬疑", "历史",
        "仙侠", "武侠", "游戏", "体育", "军事",
        "诸天无限", "轻小说", "现实主义",
    ],
    "female": [
        "古代言情", "现代言情", "玄幻言情", "悬疑言情",
        "浪漫青春", "科幻空间", "游戏竞技", "现实生活",
        "轻小说", "仙侠奇缘",
    ],
    "unsure": [
        "玄幻", "都市", "科幻", "悬疑", "历史",
        "仙侠", "武侠", "游戏", "古代言情", "现代言情",
        "玄幻言情", "浪漫青春", "现实生活", "轻小说",
    ],
}

# 智能推荐库（类型+基调 -> 灵魂/作者推荐）
RECOMMENDATION_DB = {
    ("都市", "温暖治愈"): {
        "souls": ["夏目贵志", "银古", "托尔"],
        "authors": ["绿川幸", "森见登美彦", "东野圭吾"],
    },
    ("玄幻", "热血升级"): {
        "souls": ["萧炎", "韩立", "路飞"],
        "authors": ["天蚕土豆", "忘语", "金庸"],
    },
    ("悬疑", "烧脑推理"): {
        "souls": ["夏洛克·福尔摩斯", "伽利略", "汤川学"],
        "authors": ["东野圭吾", "阿加莎·克里斯蒂", "伊坂幸太郎"],
    },
    ("古代言情", "甜宠"): {
        "souls": ["黄蓉", "赵敏", "若曦"],
        "authors": ["桐华", "匪我思存", "关心则乱"],
    },
    ("科幻", "硬核"): {
        "souls": ["罗辑", "章北海", "程心"],
        "authors": ["刘慈欣", "阿西莫夫", "特德·姜"],
    },
}


def run(
    project_dir: Path,
    idea: str,
    genre: Optional[str] = None,
    length: Optional[str] = None,
    platform: str = "generic",
    gender: str = "unsure",
    has_source_material: bool = False,
    style_author: Optional[str] = None,
    core_chars_count: int = 3,
) -> dict:
    """运行创世蓝图，生成作品骨架。

    Args:
        project_dir: 项目根目录
        idea: 一句话简介
        genre: 类型（如"都市奇幻"）
        length: 篇幅代码（short/medium/long）
        platform: 目标平台（generic/tomato/qidian/zhihu）
        gender: 男频/女频（male/female/unsure）
        has_source_material: 是否有背景参考资料
        style_author: 参考作者风格
        core_chars_count: 核心角色数量

    Returns:
        生成的文件路径字典
    """
    ensure_dirs(project_dir)

    # 获取篇幅模板
    template = LENGTH_TEMPLATES.get(length, LENGTH_TEMPLATES["medium"])

    # 1. 生成作品简介
    work_intro = _generate_work_intro(idea, genre, template, platform, gender)
    work_intro_path = project_dir / "work_intro.md"
    write_md(work_intro_path, work_intro)

    # 2. 推导世界观框架
    worldview = _generate_worldview(genre, template, idea)
    worldview_path = project_dir / "worldviews" / f"{slugify(idea[:20])}.md"
    write_md(worldview_path, worldview)

    # 3. 设定主角
    protagonist = _generate_protagonist(idea, genre, core_chars_count)
    protagonist_path = project_dir / "protagonist.md"
    write_md(protagonist_path, protagonist)

    # 4. 规划场景框架
    scenes = _generate_scenes(idea, genre, template)
    scenes_path = project_dir / "scenes" / "index.md"
    write_md(scenes_path, scenes)

    # 5. 规划章节大纲
    outline = _generate_outline(idea, genre, template)
    outline_path = project_dir / "chapters" / "outline.md"
    write_md(outline_path, outline)

    # 6. 作者灵魂方案（推荐或指定）
    author_soul = _generate_author_soul(style_author, genre, idea)
    author_soul_path = project_dir / "author_soul.md"
    write_md(author_soul_path, author_soul)

    # 7. 如有背景资料，创建指示文件
    if has_source_material:
        _create_source_material_hint(project_dir)

    # 8. 生成暗线初始配置
    darkthread_config = _generate_darkthread_config(genre, length or "medium", idea)
    dt_config_path = project_dir / "dark-threads" / "config.yaml"
    write_md(dt_config_path, darkthread_config)

    dt_prompt = _generate_darkthread_prompt(genre, length or "medium", idea, darkthread_config)
    dt_prompt_path = project_dir / "dark-threads" / "config_prompt.md"
    write_md(dt_prompt_path, dt_prompt)

    return {
        "work_intro": work_intro_path,
        "worldview": worldview_path,
        "protagonist": protagonist_path,
        "scenes": scenes_path,
        "outline": outline_path,
        "author_soul": author_soul_path,
        "darkthread_config": dt_config_path,
        "darkthread_prompt": dt_prompt_path,
        "template": template,
    }


def recommend_souls(genre: str, tone: str = "") -> dict:
    """根据类型和基调推荐灵魂与作者人选。"""
    key = (genre, tone)
    if key in RECOMMENDATION_DB:
        return RECOMMENDATION_DB[key]
    #  fallback：按 genre 模糊匹配
    for (g, t), recs in RECOMMENDATION_DB.items():
        if g == genre:
            return recs
    return {"souls": [], "authors": []}


def _generate_work_intro(idea: str, genre: Optional[str], template: dict, platform: str, gender: str) -> str:
    return f"""# 作品简介

## 核心概念
{idea}

## 基础设定
- **类型**：{genre or "待确定"}
- **篇幅**：{template["label"]}（{template["word_range"]} 字）
- **目标平台**：{platform}
- **受众定位**：{"男频" if gender == "male" else "女频" if gender == "female" else "待定"}
- **预计场景数**：{template["scene_count"][0]}–{template["scene_count"][1]} 个
- **预计章节数**：{template["chapter_count"][0]}–{template["chapter_count"][1]} 章
- **每章字数**：{template["words_per_chapter"][0]}–{template["words_per_chapter"][1]} 字

## 一句话卖点
（待填充：用 30 字以内概括最大卖点）

## 对标作品
（待填充：列出 2-3 部对标作品）
"""


def _generate_worldview(genre: Optional[str], template: dict, idea: str) -> str:
    return f"""# 世界观设定

## 基础框架
- **作品类型**：{genre or "待确定"}
- **篇幅规模**：{template["label"]}

## 核心规则
（待填充：力量体系/社会规则/物理法则等）

## 地理设定
（待填充：主要场景、地图、势力分布）

## 关键道具/概念
（待填充：与核心设定相关的道具或概念）

## 时间线
（待填充：故事发生的时间跨度、重大历史事件）

## 备注
核心概念来源：{idea}
"""


def _generate_protagonist(idea: str, genre: Optional[str], core_chars_count: int) -> str:
    chars = "\n\n".join(
        f"""### 角色 {i+1}
- **名字**：
- **身份**：
- **核心矛盾**：
- **性格标签**：
- **能力/特长**：
- **成长目标**："""
        for i in range(core_chars_count)
    )
    return f"""# 角色设定

## 主角
{chars}

## 角色关系图
（待填充：主要角色之间的关系）
"""


def _generate_scenes(idea: str, genre: Optional[str], template: dict) -> str:
    scene_count = template["scene_count"][0]
    scenes = "\n".join(
        f"| 场景 {i+1} | 待命名 | 起/承/转/合 | 待描述 |"
        for i in range(scene_count)
    )
    return f"""# 场景框架

## 场景总览
预计 {template["scene_count"][0]}–{template["scene_count"][1]} 个核心场景。

| 编号 | 场景名 | 功能 | 简述 |
|------|--------|------|------|
{scenes}

## 场景关系图
（待填充：场景之间的因果/递进关系）
"""


def _generate_outline(idea: str, genre: Optional[str], template: dict) -> str:
    chapter_count = min(template["chapter_count"][0], 20)  # demo 只展示前 20 章
    chapters = "\n".join(
        f"| 第 {i+1} 章 | 待命名 | 待描述 | 钩子/爽点 | ~{template['words_per_chapter'][0]} 字 |"
        for i in range(chapter_count)
    )
    return f"""# 章节大纲

## 总览
- **总章节数**：{template["chapter_count"][0]}–{template["chapter_count"][1]} 章
- **每章字数**：{template["words_per_chapter"][0]}–{template["words_per_chapter"][1]} 字
- **总字数**：{template["word_range"]} 字

## 分章大纲

| 章号 | 章名 | 内容简述 | 钩子/爽点 | 预计字数 |
|------|------|---------|----------|---------|
{chapters}

> 注：完整大纲请按实际篇幅扩展。
"""


def _generate_author_soul(style_author: Optional[str], genre: Optional[str], idea: str) -> str:
    if style_author:
        return f"""# 作者灵魂方案

## 指定风格
**{style_author}**

## 风格关键词
（待填充：从该作者作品中提取的 3-5 个关键词）

## 下一步
运行 `ws distill-author "{style_author}"` 生成作者 SKILL.md。
"""
    recs = recommend_souls(genre or "", "")
    return f"""# 作者灵魂方案

## 待确定
用户未指定参考作者。

## 系统推荐（基于类型：{genre or "未指定"}）
- **推荐作者**：{', '.join(recs['authors']) if recs['authors'] else '暂无推荐，请自行输入'}

## 下一步
1. 选择推荐作者，或自行指定
2. 运行 `ws distill-author "作者名"` 生成作者 SKILL.md
"""


# 暗线追踪配置模板库（按类型分类）
DARKTHREAD_TEMPLATES = {
    "玄幻": {
        "variables": [
            {"name": "境界", "key": "realm", "type": "string", "initial": "练气期", "description": "主角当前修炼境界"},
            {"name": "气运值", "key": "luck", "type": "number", "initial": 50, "description": "主角气运，影响奇遇概率"},
            {"name": "功法进度", "key": "cultivation", "type": "number", "initial": 0, "description": "当前主修功法进度（%）"},
            {"name": "仇敌值", "key": "hatred", "type": "number", "initial": 0, "description": "与主要敌对势力的仇恨累积"},
        ],
        "dark_threads": [
            {"name": "宿命觉醒", "key": "destiny_awakening", "stages": ["沉睡", "萌芽", "觉醒", "掌控"], "current_stage": 0, "description": "主角体内远古血脉/神魂的觉醒进度"},
            {"name": "宗门态度", "key": "sect_attitude", "stages": ["漠视", "观察", "拉拢", "忌惮"], "current_stage": 0, "description": "大宗门对主角的态度变化暗线"},
            {"name": "神器封印", "key": "artifact_seal", "stages": ["未知", "发现", "解封", "融合"], "current_stage": 0, "description": "随身神器/古宝的封印解除进度"},
        ],
    },
    "仙侠": {
        "variables": [
            {"name": "境界", "key": "realm", "type": "string", "initial": "筑基期", "description": "主角当前仙道境界"},
            {"name": "功德值", "key": "merit", "type": "number", "initial": 0, "description": "累计功德，影响天劫和机缘"},
            {"name": "道心值", "key": "dao_heart", "type": "number", "initial": 100, "description": "道心稳固程度，过低易入魔"},
            {"name": "因果值", "key": "karma", "type": "number", "initial": 0, "description": "未了结的因果纠缠"},
        ],
        "dark_threads": [
            {"name": "天劫预兆", "key": "tribulation_omen", "stages": ["平静", "异动", "酝酿", "降临"], "current_stage": 0, "description": "下一次天劫的酝酿进度"},
            {"name": "仙门态度", "key": "immortal_sect", "stages": ["排斥", "试探", "接纳", "倚重"], "current_stage": 0, "description": "仙门势力对主角的态度变化"},
            {"name": "前世因果", "key": "past_life", "stages": ["遗忘", "碎片", "真相", "了结"], "current_stage": 0, "description": "主角前世身份与因果的揭秘进度"},
        ],
    },
    "武侠": {
        "variables": [
            {"name": "内力修为", "key": "internal_force", "type": "number", "initial": 10, "description": "内力深厚程度"},
            {"name": "江湖声望", "key": "reputation", "type": "number", "initial": 0, "description": "在江湖中的名望"},
            {"name": "伤势", "key": "injury", "type": "number", "initial": 0, "description": "当前伤势程度（0=健康）"},
        ],
        "dark_threads": [
            {"name": "秘籍下落", "key": "secret_manual", "stages": ["传说", "线索", "争夺", "现世"], "current_stage": 0, "description": "武林秘籍的追踪与争夺暗线"},
            {"name": "门派恩怨", "key": "sect_grudge", "stages": ["旧怨", "激化", "对决", "化解"], "current_stage": 0, "description": "主角师门与敌对势力的恩怨演变"},
        ],
    },
    "科幻": {
        "variables": [
            {"name": "科技等级", "key": "tech_level", "type": "number", "initial": 1, "description": "主角掌握的核心科技等级"},
            {"name": "势力声望", "key": "faction_rep", "type": "number", "initial": 0, "description": "在各势力中的声望值"},
            {"name": "资源点", "key": "resources", "type": "number", "initial": 100, "description": "可用资源/能源储备"},
            {"name": "文明指数", "key": "civ_index", "type": "number", "initial": 1, "description": "人类文明/个体进化指数"},
        ],
        "dark_threads": [
            {"name": "AI叛变进度", "key": "ai_rebellion", "stages": ["潜伏", "渗透", "失控", "决战"], "current_stage": 0, "description": "人工智能系统的异常与叛变暗线"},
            {"name": "外星文明接触", "key": "alien_contact", "stages": ["信号", "确认", "接触", "博弈"], "current_stage": 0, "description": "与外星文明的接触与博弈进程"},
            {"name": "技术奇点", "key": "singularity", "stages": ["遥远", "逼近", "临界", "突破"], "current_stage": 0, "description": "技术奇点的临近与影响暗线"},
        ],
    },
    "都市": {
        "variables": [
            {"name": "财富值", "key": "wealth", "type": "number", "initial": 0, "description": "主角当前资产规模（万为单位）"},
            {"name": "人脉网", "key": "network", "type": "number", "initial": 10, "description": "关键人脉关系数量"},
            {"name": "势力影响力", "key": "influence", "type": "number", "initial": 0, "description": "在都市势力中的影响力"},
            {"name": "健康状况", "key": "health", "type": "number", "initial": 100, "description": "身体健康程度"},
        ],
        "dark_threads": [
            {"name": "幕后黑手", "key": "mastermind", "stages": ["未知", "怀疑", "追踪", "揭露"], "current_stage": 0, "description": "幕后黑手的身份追踪暗线"},
            {"name": "商业联盟", "key": "business_alliance", "stages": ["敌对", "试探", "合作", "共生"], "current_stage": 0, "description": "商业势力间的联盟与博弈"},
            {"name": "情感羁绊", "key": "emotional_bond", "stages": ["陌生", "靠近", "信任", "羁绊"], "current_stage": 0, "description": "主角与关键人物的情感发展暗线"},
        ],
    },
    "悬疑": {
        "variables": [
            {"name": "线索碎片", "key": "clues", "type": "number", "initial": 0, "description": "已收集的关键线索数量"},
            {"name": "嫌疑人信任度", "key": "trust", "type": "number", "initial": 50, "description": "嫌疑人对主角的信任程度"},
            {"name": "真相进度", "key": "truth", "type": "number", "initial": 0, "description": "核心真相的揭露进度（%）"},
        ],
        "dark_threads": [
            {"name": "真凶动机", "key": "motive", "stages": ["隐藏", "浮现", "明晰", "暴露"], "current_stage": 0, "description": "真凶作案动机的逐步揭露"},
            {"name": "证人保护", "key": "witness_protection", "stages": ["安全", "威胁", "危机", "转危为安"], "current_stage": 0, "description": "关键证人的安全状态变化"},
            {"name": "内鬼身份", "key": "mole_identity", "stages": ["潜伏", "异动", "怀疑", "揭露"], "current_stage": 0, "description": "内部叛徒的身份追查暗线"},
        ],
    },
    "历史": {
        "variables": [
            {"name": "势力版图", "key": "territory", "type": "number", "initial": 10, "description": "控制的领土/势力范围"},
            {"name": "兵力", "key": "troops", "type": "number", "initial": 1000, "description": "可用兵力"},
            {"name": "民心", "key": "public_support", "type": "number", "initial": 50, "description": "民众支持度"},
        ],
        "dark_threads": [
            {"name": "权臣野心", "key": "power_ambition", "stages": ["隐忍", "扩张", "逼宫", "对决"], "current_stage": 0, "description": "权臣野心的膨胀与暴露"},
            {"name": "敌国间谍", "key": "enemy_spy", "stages": ["潜伏", "渗透", "行动", "暴露"], "current_stage": 0, "description": "敌国间谍网络的渗透与清查"},
            {"name": "储位之争", "key": "succession", "stages": ["暗流", "明朗", "激化", "定局"], "current_stage": 0, "description": "皇位/继承人争夺的暗线"},
        ],
    },
    "军事": {
        "variables": [
            {"name": "兵力", "key": "troops", "type": "number", "initial": 1000, "description": "可用兵力"},
            {"name": "粮草", "key": "supplies", "type": "number", "initial": 500, "description": "粮草储备"},
            {"name": "士气", "key": "morale", "type": "number", "initial": 100, "description": "军队士气"},
        ],
        "dark_threads": [
            {"name": "战略包围", "key": "encirclement", "stages": ["布局", "收紧", "合围", "决战"], "current_stage": 0, "description": "战略包围的形成与突破"},
            {"name": "内部叛徒", "key": "traitor", "stages": ["潜伏", "泄密", "破坏", "揭露"], "current_stage": 0, "description": "军内叛徒的潜伏与清查"},
        ],
    },
    "言情": {
        "variables": [
            {"name": "情感进度", "key": "affection", "type": "number", "initial": 0, "description": "主角与对象的情感进度（%）"},
            {"name": "误会指数", "key": "misunderstanding", "type": "number", "initial": 0, "description": "当前误会/矛盾的严重程度"},
            {"name": "外部压力", "key": "external_pressure", "type": "number", "initial": 10, "description": "来自家庭/社会的阻碍压力"},
        ],
        "dark_threads": [
            {"name": "家族恩怨", "key": "family_grudge", "stages": ["尘封", "浮现", "对抗", "化解"], "current_stage": 0, "description": "两大家族/势力间的恩怨对情感的阻碍"},
            {"name": "身份秘密", "key": "identity_secret", "stages": ["隐藏", "怀疑", "试探", "揭晓"], "current_stage": 0, "description": "主角或对象隐藏身份的秘密暗线"},
            {"name": "第三者介入", "key": "third_party", "stages": ["观望", "接近", "挑拨", "抉择"], "current_stage": 0, "description": "第三者对主情感的介入与影响"},
        ],
    },
    "通用": {
        "variables": [
            {"name": "主线进度", "key": "main_progress", "type": "number", "initial": 0, "description": "主线剧情推进进度（%）"},
            {"name": "关键道具", "key": "key_item", "type": "number", "initial": 0, "description": "已收集的关键道具/信息数量"},
        ],
        "dark_threads": [
            {"name": "主线伏笔", "key": "main_foreshadow", "stages": ["埋藏", "暗示", "呼应", "回收"], "current_stage": 0, "description": "主线核心伏笔的埋设与回收进度"},
            {"name": "关键人物态度", "key": "key_figure", "stages": ["中立", "友好", "敌对", "复杂"], "current_stage": 0, "description": "对剧情走向有决定性影响的人物态度变化"},
        ],
    },
}


# 类型模糊匹配映射（用于将子类型映射到主类型）
GENRE_FALLBACK_MAP = {
    "玄幻言情": "玄幻",
    "仙侠奇缘": "仙侠",
    "科幻空间": "科幻",
    "悬疑言情": "悬疑",
    "浪漫青春": "言情",
    "游戏竞技": "通用",
    "现实生活": "都市",
    "轻小说": "通用",
    "诸天无限": "玄幻",
    "现实主义": "都市",
}


def _match_genre(genre: Optional[str]) -> str:
    """将用户输入的类型匹配到暗线模板主类型。"""
    if not genre:
        return "通用"
    # 精确匹配
    if genre in DARKTHREAD_TEMPLATES:
        return genre
    # 子类型映射
    if genre in GENRE_FALLBACK_MAP:
        return GENRE_FALLBACK_MAP[genre]
    # 模糊匹配：检查 genre 是否包含某个主类型关键词
    for key in DARKTHREAD_TEMPLATES:
        if key in genre:
            return key
    return "通用"


def _generate_darkthread_config(genre: Optional[str], length: str, idea: str) -> str:
    """基于类型和篇幅生成暗线配置 YAML。"""
    matched_genre = _match_genre(genre)
    template = DARKTHREAD_TEMPLATES.get(matched_genre, DARKTHREAD_TEMPLATES["通用"])

    # 按篇幅裁剪暗线数量
    thread_limits = {"short": 2, "medium": 4, "long": 6}
    max_threads = thread_limits.get(length, 4)
    threads = template["dark_threads"][:max_threads]

    # 构建 YAML
    lines = ["# 暗线追踪配置", f"# 作品: {idea}", f"# 类型: {genre or '未指定'}（匹配模板: {matched_genre}）", f"# 篇幅: {length}", ""]
    lines.append("variables:")
    for var in template["variables"]:
        lines.append(f'  - name: {var["name"]}')
        lines.append(f'    key: {var["key"]}')
        lines.append(f'    type: {var["type"]}')
        init_val = var["initial"]
        if isinstance(init_val, str):
            lines.append(f'    initial: "{init_val}"')
        else:
            lines.append(f'    initial: {init_val}')
        lines.append(f'    description: {var["description"]}')
        lines.append("")

    lines.append("dark_threads:")
    for thread in threads:
        lines.append(f'  - name: {thread["name"]}')
        lines.append(f'    key: {thread["key"]}')
        lines.append(f'    stages:')
        for stage in thread["stages"]:
            lines.append(f'      - "{stage}"')
        lines.append(f'    current_stage: {thread["current_stage"]}')
        lines.append(f'    description: {thread["description"]}')
        lines.append("")

    lines.append("rules:")
    lines.append('  - 每章必须至少有一条暗线有推进')
    lines.append('  - 数值变化必须在 snapshot 中记录变化原因')
    lines.append('  - 角色状态变化需与剧情一致')

    return "\n".join(lines)


def _generate_darkthread_prompt(genre: Optional[str], length: str, idea: str, config: str) -> str:
    """生成供 Claude Agent 优化暗线配置的 prompt。"""
    return f"""# 暗线配置优化指令

## 作品信息
- **核心概念**: {idea}
- **类型**: {genre or "未指定"}
- **篇幅**: {length}

## 当前初始配置（自动生成）
```yaml
{config}
```

## 优化要求
1. 根据作品核心概念 `{idea}`，调整数值变量的名称和初始值，使其更贴合具体设定
2. 调整暗线的阶段名称，使其与作品情节呼应
3. 如有不适合当前作品的暗线，可删除或替换
4. 如有遗漏的关键暗线，可新增
5. **保持 YAML 格式不变**

## 输出
将优化后的配置直接写入 `dark-threads/config.yaml`，替换当前内容。
"""


def _create_source_material_hint(project_dir: Path) -> None:
    hint_path = project_dir / "references" / "source-materials" / "README.md"
    write_md(
        hint_path,
        """# 背景参考资料

请将你的背景资料放入此目录：
- 世界观设定文档
- 原著框架/设定集
- 历史背景资料
- 任何有助于 AI 理解作品背景的文档

支持格式：.md / .txt / .pdf

提示：这些资料会在创世蓝图、灵魂蒸馏、剧情推演等阶段被自动读取。""",
    )
    private_hint_path = project_dir / "references" / "private-materials" / "README.md"
    write_md(
        private_hint_path,
        """# 非公开资料（蒸馏专用）

请将非公开资料放入此目录：
- 角色手写笔记
- 未公开的访谈录音转录
- 私人收藏的素材
- 任何不便于公开但有助于蒸馏的文档

**注意**：这些资料仅用于本地蒸馏，不会被上传到任何外部服务。""",
    )
