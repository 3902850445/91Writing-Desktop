"""平台规则加载器 (Platform Rules)

支持平台:
    - generic : 通用规则（默认）
    - tomato  : 番茄小说
    - qidian  : 起点中文网
    - zhihu   : 知乎盐选

通用规则 (所有平台都要检查):
    - 版权安全: 不与参考原作一致，无直接抄袭
    - 人物一致性: 无 OOC
    - 世界观一致性: 内部规则不自相矛盾
    - 暗线连续性: 暗线推进合理，无遗忘
    - 数值一致性: 关键数值前后一致
"""

from pathlib import Path
from typing import Optional

# 通用规则（所有平台）
GENERIC_RULES = [
    "版权安全: 不与参考原作一致，无直接抄袭",
    "人物一致性: 角色行为符合 SKILL.md",
    "世界观一致性: 内部规则不自相矛盾",
    "暗线连续性: 暗线推进合理，无遗忘",
    "数值一致性: 关键数值前后一致",
]

# 番茄小说详细规则
TOMATO_RULES = {
    "name": "番茄小说",
    "description": "番茄小说网文平台审核与节奏规则",
    "must_avoid": [
        "暴恐：禁止详细描写恐怖主义行为、爆炸装置制作、极端暴力",
        "血腥：禁止过度血腥描写（如碎尸、酷刑细节、大量器官描写）",
        "色情：禁止直接性行为描写、露骨性暗示、性虐待",
        "政治敏感：禁止影射现实政治人物、攻击现行体制、煽动性内容",
        "迷信：禁止详细描写封建迷信仪式（可写奇幻设定，但不可宣扬现实迷信）",
        "毒品：禁止美化吸毒、详细描写制毒过程",
        "自杀：禁止详细描写自杀方法、美化自杀",
        "校园暴力：禁止美化校园霸凌、详细描写欺凌过程",
    ],
    "must_have": [
        "正能量导向：主角整体形象积极向上，即便受挫最终也要向上",
        "章末钩子：每章结尾必须有继续阅读动力（悬念/危机/反转/期待）",
        "节奏明快：每 1000 字至少一个小爽点或信息增量",
        "冲突清晰：每章至少一个明确的冲突或矛盾",
    ],
    "checklist": [
        "主角是否做了明显违背公序良俗的事且未受惩罚？",
        "是否有详细暴力/血腥描写？",
        "是否有现实政治影射？",
        "章末是否留了钩子？",
        "本章是否有明确冲突？",
    ],
    "rhythm": {
        "min_words_per_chapter": 2000,
        "max_words_per_chapter": 5000,
        "ideal_chapter_length": "2000-4000 字",
        "beat_frequency": "每 1000 字一个小节奏点",
        "hook_requirement": "章末必须有强钩子",
        "update_recommendation": "日更 4000+ 字为佳",
    },
    "scoring_weights": {
        "正能量": 0.20,
        "节奏": 0.20,
        "钩子": 0.15,
        "冲突": 0.15,
        "安全": 0.30,
    },
}

# 起点中文网详细规则
QIDIAN_RULES = {
    "name": "起点中文网",
    "description": "起点爽文节奏与升级规则",
    "must_avoid": [
        "虐主过度：主角连续被压制不超过 3 章",
        "节奏拖沓：连续 2 章无实质推进",
        "信息重复：同一设定反复解释",
        "太监预警：长期不更新或烂尾",
    ],
    "must_have": [
        "升级感：主角能力/地位/资源每 3-5 章有明显提升",
        "打脸频率：antagonist 每 5-10 章被压制一次",
        "章末强钩子：每章结尾必须有强悬念或期待",
        "爽点节奏：压抑与释放比例约 3:7，爽点密度高于虐点",
        "信息增量：每章至少一个新设定、新角色或新冲突",
        "期待感：让读者对下一章有明确期待",
    ],
    "checklist": [
        "主角本章是否有收获（能力/信息/盟友）？",
        "是否有 antagonist 被压制或打脸？",
        "章末钩子强度是否足够？",
        "本章是否有新设定/新角色/新冲突？",
        "压抑是否过度（连续虐主几章）？",
    ],
    "rhythm": {
        "min_words_per_chapter": 3000,
        "max_words_per_chapter": 5000,
        "ideal_chapter_length": "3000-5000 字",
        "upgrade_cycle": "3-5 章一次能力提升",
        "face_slap_cycle": "5-10 章一次打脸",
        "oppression_limit": "连续压抑不超过 3 章",
        "update_recommendation": "日更 6000+ 字，稳定更新",
    },
    "scoring_weights": {
        "升级感": 0.20,
        "打脸": 0.15,
        "节奏": 0.20,
        "钩子": 0.15,
        "信息增量": 0.15,
        "期待感": 0.15,
    },
}

# 知乎盐选详细规则
ZHIHU_RULES = {
    "name": "知乎盐选",
    "description": "知乎盐选专栏节奏与付费设计规则",
    "must_avoid": [
        "节奏拖沓：前 500 字无信息增量",
        "付费点错误：在无关紧要处切断",
        "反转突兀：无铺垫的硬反转",
        "悬念过浅：读者能提前猜到结局",
    ],
    "must_have": [
        "开头强钩子：前 100 字必须有信息增量或悬念",
        "悬念密度：每 500 字至少一个悬念点",
        "反转设置：每 2000 字至少一个小反转",
        "付费点设计：在章节关键悬念处切断，引导付费",
        "信息差利用：利用读者与角色的信息不对等制造张力",
        "结尾钩子：免费部分结尾必须卡在关键处",
    ],
    "checklist": [
        "前 100 字是否有强钩子？",
        "每 500 字是否有悬念点？",
        "本章是否有反转？",
        "免费部分是否卡在关键悬念处？",
        "读者是否无法猜到下一步？",
    ],
    "rhythm": {
        "min_words_per_chapter": 3000,
        "max_words_per_chapter": 8000,
        "ideal_chapter_length": "3000-6000 字",
        "hook_in_first_100_chars": True,
        "suspense_density": "每 500 字一个悬念",
        "twist_frequency": "每 2000 字一个反转",
        "paywall_position": "在关键悬念处切断",
        "update_recommendation": "每周 2-3 更，单篇独立成章",
    },
    "scoring_weights": {
        "开头钩子": 0.20,
        "悬念密度": 0.20,
        "反转": 0.15,
        "付费点": 0.20,
        "信息差": 0.15,
        "节奏": 0.10,
    },
}

PLATFORMS = {
    "generic": {
        "name": "通用",
        "rules": GENERIC_RULES,
    },
    "tomato": TOMATO_RULES,
    "qidian": QIDIAN_RULES,
    "zhihu": ZHIHU_RULES,
}


def load_rules(platform: str = "generic") -> dict:
    """加载平台规则。

    Returns:
        {
            "base": list[str],           # 通用规则
            "platform": dict,            # 平台详细规则
            "platform_name": str,
        }
    """
    base = GENERIC_RULES.copy()
    if platform == "generic" or platform not in PLATFORMS:
        return {"base": base, "platform": {}, "platform_name": "通用"}
    return {
        "base": base,
        "platform": PLATFORMS[platform],
        "platform_name": PLATFORMS[platform]["name"],
    }


def get_platform_checklist(platform: str) -> list[str]:
    """获取指定平台的自检清单。"""
    if platform not in PLATFORMS or platform == "generic":
        return []
    return PLATFORMS[platform].get("checklist", [])


def get_rhythm_requirements(platform: str) -> dict:
    """获取指定平台的节奏要求。"""
    if platform not in PLATFORMS or platform == "generic":
        return {}
    return PLATFORMS[platform].get("rhythm", {})


def get_scoring_weights(platform: str) -> dict[str, float]:
    """获取指定平台的评分权重。"""
    if platform not in PLATFORMS or platform == "generic":
        return {}
    return PLATFORMS[platform].get("scoring_weights", {})


def check_content_safety(content: str, platform: str) -> list[str]:
    """基于规则对内容进行基础安全扫描，返回违规项列表。

    注意：这是初筛，不能替代人工审核或 LLM 深度评估。
    """
    violations = []
    if platform not in PLATFORMS or platform == "generic":
        return violations

    must_avoid = PLATFORMS[platform].get("must_avoid", [])
    # 简单的关键词匹配（实际应使用更精确的检测）
    violent_terms = {
        "tomato": ["碎尸", "酷刑", "制毒", "自杀方法", "详细描写爆炸"],
        "qidian": [],
        "zhihu": [],
    }

    for term in violent_terms.get(platform, []):
        if term in content:
            violations.append(f"检测到敏感词: '{term}'")

    return violations
