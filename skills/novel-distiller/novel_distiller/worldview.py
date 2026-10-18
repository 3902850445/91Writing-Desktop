"""世界观提取与维护 (Worldview Extraction)

从 raw_text 或用户输入中提取并维护世界观设定:
    - 力量体系 / 等级制度
    - 世界规则 / 物理或魔法约束
    - 势力地图 / 组织关系
    - 时间线 / 重大历史事件
    - 关键道具 / 物品规则

输出: worldviews/{slug}.md
"""

from pathlib import Path
from typing import Optional

from novel_distiller.utils import write_md


def run(
    project_dir: Path,
    source_text: Optional[str] = None,
    source_file: Optional[Path] = None,
) -> dict:
    """提取世界观。

    Returns:
        {"worldview_md": Path}
    """
    # TODO:
    # 1. 读取 source_text 或 source_file
    # 2. 由 Claude 按模板提取世界观要素
    # 3. 保存到 worldviews/
    return {}
