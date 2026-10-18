"""共享工具函数."""

import re
from pathlib import Path


def slugify(name: str, fallback_id: int = 0) -> str:
    """将中文/混合名称转换为 ASCII slug.

    示例:
        slugify("唐家三少") -> "tangjiasanshao"
        slugify("鲁迅") -> "lu-xun"
        slugify("!!!") -> "soul-0"
    """
    # 简单策略: 保留 ASCII 字母数字和空格，其余移除
    ascii_only = re.sub(r"[^\w\s-]", "", name, flags=re.UNICODE)
    ascii_only = ascii_only.strip().lower()
    ascii_only = re.sub(r"[\s_]+", "-", ascii_only)
    if not ascii_only:
        return f"soul-{fallback_id}"
    return ascii_only


def write_md(path: Path, content: str) -> None:
    """安全写入 markdown 文件，自动创建父目录."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def read_md(path: Path) -> str:
    """读取 markdown 文件，不存在时返回空字符串."""
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def ensure_dirs(project_dir: Path) -> None:
    """确保项目骨架目录存在."""
    for sub in (
        "souls",
        "scenes",
        "chapters",
        "dark-threads",
        "worldviews",
        "references",
        "references/source-materials",
        "references/private-materials",
    ):
        (project_dir / sub).mkdir(parents=True, exist_ok=True)
