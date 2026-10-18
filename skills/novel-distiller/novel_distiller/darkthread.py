"""暗线追踪与数值状态层 (Dark Thread & Numerical State)

暗线 (Dark Threads):
    追踪作品中的隐藏叙事线索，确保跨章节连续性。
    每条暗线包含: 名称、当前阶段、阶段进度、描述、关联事件。

数值状态 (Numerical State):
    维护角色/团队的数值化状态，确保跨章节一致:
    - merit_pool      : 功德池
    - tribulation_mark: 难印/印记
    - precepts        : 戒律/约束
    - realm_grade     : 境界/等级
    - character_states: 角色个体状态快照

配置文件:
    dark-threads/config.yaml — 定义追踪变量和规则

输出:
    - dark-threads/ch{NNN}_snapshot.md
"""

from pathlib import Path
from typing import Any, Optional

import yaml

from novel_distiller.utils import write_md, read_md

DEFAULT_CONFIG = """# 暗线追踪配置
# 定义需要跨章节追踪的数值状态和暗线变量

variables:
  - name: 功德值
    key: merit
    type: number
    initial: 0
    description: 主角累计功德

  - name: 难印
    key: tribulation
    type: number
    initial: 0
    description: 取经难数（目标81难）

  - name: 境界
    key: realm
    type: string
    initial: "太乙金仙"
    description: 主角当前境界

  - name: 紧箍咒激活次数
    key: headband_trigger
    type: number
    initial: 0
    description: 唐僧念紧箍咒累计次数

dark_threads:
  - name: 牛魔王态度转变
    key: niu_mowang_attitude
    stages:
      - "敌对"
      - "试探"
      - "合作"
      - "结盟"
    current_stage: 0
    description: 牛魔王对孙悟空的态度变化暗线

  - name: 火焰山封印之谜
    key: flame_mountain_seal
    stages:
      - "未知"
      - "发现符文"
      - "解读符文"
      - "解开封印"
    current_stage: 0
    description: 岩浆河底古老封印的揭秘进度

rules:
  - 每章必须至少有一条暗线有推进
  - 数值变化必须在 snapshot 中记录变化原因
  - 角色状态变化需与剧情一致
"""


def run(
    project_dir: Path,
    chapter_num: int,
    changes: Optional[dict[str, Any]] = None,
    event_description: Optional[str] = None,
) -> dict:
    """更新暗线追踪与数值状态，生成新快照。

    Args:
        chapter_num: 章节号
        changes: 数值变化字典，如 {"merit": 10, "tribulation": 1}
        event_description: 本章关键事件描述（用于记录变化原因）

    Returns:
        {"snapshot_md": Path, "state": dict, "status": "updated" | "initialized"}
    """
    dt_dir = project_dir / "dark-threads"
    dt_dir.mkdir(parents=True, exist_ok=True)

    # 1. 确保配置文件存在
    config_path = dt_dir / "config.yaml"
    if not config_path.exists():
        config_path.write_text(DEFAULT_CONFIG, encoding="utf-8")

    # 2. 读取配置
    config = _load_config(config_path)

    # 3. 加载上一章状态
    prev_state = _load_latest_state(dt_dir)

    # 4. 如果没有上一章状态，用初始值初始化
    if not prev_state:
        prev_state = _build_initial_state(config)

    # 5. 应用变化
    new_state = _apply_changes(prev_state, changes or {}, event_description or "")

    # 6. 生成并保存快照
    snapshot_md = dt_dir / f"ch{chapter_num:03d}_snapshot.md"
    snapshot_content = _render_snapshot(
        chapter_num=chapter_num,
        state=new_state,
        prev_state=prev_state,
        changes=changes or {},
        event_description=event_description or "",
        config=config,
    )
    write_md(snapshot_md, snapshot_content)

    return {
        "snapshot_md": snapshot_md,
        "state": new_state,
        "status": "initialized" if not prev_state else "updated",
    }


def get_current_state(project_dir: Path) -> dict[str, Any]:
    """获取当前最新的暗线状态（用于撰写下一章时参考）。"""
    dt_dir = project_dir / "dark-threads"
    return _load_latest_state(dt_dir) or {}


def get_latest_snapshot_path(project_dir: Path) -> Optional[Path]:
    """获取最新快照文件路径。"""
    dt_dir = project_dir / "dark-threads"
    if not dt_dir.exists():
        return None
    snapshots = sorted(dt_dir.glob("ch*_snapshot.md"))
    return snapshots[-1] if snapshots else None


def render_state_for_prompt(project_dir: Path) -> str:
    """将当前暗线状态渲染为适合注入写作 prompt 的文本。"""
    state = get_current_state(project_dir)
    if not state:
        return "（暗线追踪未初始化）"

    lines = ["## 当前暗线状态（必须在下一章中体现或推进）"]

    # 数值状态
    if "variables" in state:
        lines.append("\n### 数值状态")
        for key, value in state["variables"].items():
            lines.append(f"- **{key}**: {value}")

    # 暗线进度
    if "dark_threads" in state:
        lines.append("\n### 暗线进度")
        for key, thread in state["dark_threads"].items():
            stage = thread.get("stage", "?")
            total = thread.get("total_stages", "?")
            desc = thread.get("description", "")
            lines.append(f"- **{key}**: 阶段 {stage}/{total} — {desc}")

    # 上次变化
    if "last_changes" in state and state["last_changes"]:
        lines.append("\n### 上次变化")
        for key, change in state["last_changes"].items():
            lines.append(f"- {key}: {change}")

    # 规则提醒
    lines.append("\n### 暗线规则")
    lines.append("- 每章必须至少有一条暗线有推进")
    lines.append("- 数值变化必须与剧情一致并记录原因")
    lines.append("- 角色状态变化需符合 SKILL.md 设定")

    return "\n".join(lines)


def _load_config(config_path: Path) -> dict:
    """读取暗线配置文件。"""
    if not config_path.exists():
        return {}
    try:
        return yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}


def _build_initial_state(config: dict) -> dict:
    """从配置构建初始状态。"""
    state = {"variables": {}, "dark_threads": {}, "last_changes": {}}

    for var in config.get("variables", []):
        key = var.get("key", var.get("name", ""))
        if key:
            state["variables"][key] = var.get("initial", 0)

    for thread in config.get("dark_threads", []):
        key = thread.get("key", thread.get("name", ""))
        if key:
            state["dark_threads"][key] = {
                "stage": thread.get("current_stage", 0),
                "total_stages": len(thread.get("stages", [])),
                "description": thread.get("description", ""),
            }

    return state


def _load_latest_state(dt_dir: Path) -> Optional[dict[str, Any]]:
    """从最新快照加载状态。"""
    snapshot = get_latest_snapshot_path(dt_dir.parent if "dark-threads" in str(dt_dir) else dt_dir)
    if not snapshot:
        return None

    content = read_md(snapshot)
    return _parse_snapshot(content)


def _parse_snapshot(content: str) -> dict[str, Any]:
    """从快照 markdown 解析状态。简单启发式解析。"""
    state = {"variables": {}, "dark_threads": {}, "last_changes": {}}

    current_section = None
    for line in content.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue

        if "数值状态" in stripped and stripped.startswith("#"):
            current_section = "variables"
            continue
        elif "暗线进度" in stripped and stripped.startswith("#"):
            current_section = "dark_threads"
            continue
        elif ("上次变化" in stripped or "变化明细" in stripped) and stripped.startswith("#"):
            current_section = "last_changes"
            continue

        # 处理列表项
        if stripped.startswith("-") or stripped.startswith("*"):
            text = stripped[1:].strip()
            if current_section == "variables" and ":" in text:
                key, val = text.split(":", 1)
                key = key.strip().strip("*")
                val = val.strip()
                try:
                    val = int(val)
                except ValueError:
                    try:
                        val = float(val)
                    except ValueError:
                        pass
                state["variables"][key] = val
            elif current_section == "dark_threads":
                if "阶段" in text:
                    parts = text.split("阶段")
                    if len(parts) >= 2:
                        key = parts[0].strip().strip("-*")
                        stage_part = parts[1].split("—")[0].strip()
                        state["dark_threads"][key] = {
                            "stage": stage_part,
                            "description": text,
                        }
            elif current_section == "last_changes" and ":" in text:
                key, val = text.split(":", 1)
                state["last_changes"][key.strip()] = val.strip()
            continue

        # 处理表格行
        if stripped.startswith("|") and current_section in ("variables", "dark_threads"):
            # 去掉开头的 |，如果有结尾的 | 也去掉
            line_body = stripped[1:]
            if line_body.endswith("|"):
                line_body = line_body[:-1]
            cells = [c.strip() for c in line_body.split("|")]
            if len(cells) >= 2 and cells[0] not in ("变量", "暗线", "------", "", "-", "key"):
                key = cells[0]
                val = cells[1]
                if current_section == "variables":
                    # 尝试解析数字
                    try:
                        val = int(val)
                    except ValueError:
                        try:
                            val = float(val)
                        except ValueError:
                            pass
                    state["variables"][key] = val
                elif current_section == "dark_threads":
                    # stage/total 格式如 "0/4"
                    stage_part = val.split("/")[0] if "/" in val else val
                    total_part = val.split("/")[1] if "/" in val else "?"
                    desc = cells[3] if len(cells) > 3 else ""
                    state["dark_threads"][key] = {
                        "stage": stage_part,
                        "total_stages": total_part,
                        "description": desc,
                    }
            continue

    return state


def _apply_changes(
    state: dict, changes: dict[str, Any], event_description: str
) -> dict:
    """应用变化到状态。"""
    import copy
    new_state = {
        "variables": dict(state.get("variables", {})),
        "dark_threads": {k: copy.deepcopy(v) for k, v in state.get("dark_threads", {}).items()},
        "last_changes": {},
    }

    for key, value in changes.items():
        if key in new_state["variables"]:
            old_val = new_state["variables"][key]
            if isinstance(value, (int, float)) and isinstance(old_val, (int, float)):
                new_state["variables"][key] = old_val + value
                new_state["last_changes"][key] = f"{old_val} -> {new_state['variables'][key]} (+{value})"
            else:
                new_state["variables"][key] = value
                new_state["last_changes"][key] = f"{old_val} -> {value}"
        elif key in new_state["dark_threads"]:
            if isinstance(value, int):
                old_stage = new_state["dark_threads"][key].get("stage", 0)
                if isinstance(old_stage, int):
                    new_state["dark_threads"][key]["stage"] = old_stage + value
                else:
                    new_state["dark_threads"][key]["stage"] = value
                new_state["last_changes"][key] = f"阶段推进 +{value}"
            else:
                new_state["dark_threads"][key]["description"] = str(value)
                new_state["last_changes"][key] = str(value)
        else:
            # 未知 key，作为变量添加
            new_state["variables"][key] = value
            new_state["last_changes"][key] = f"新增: {value}"

    if event_description:
        new_state["last_event"] = event_description

    return new_state


def _render_snapshot(
    chapter_num: int,
    state: dict,
    prev_state: dict,
    changes: dict[str, Any],
    event_description: str,
    config: dict,
) -> str:
    """渲染快照为 markdown。"""

    # 数值状态表格
    var_lines = []
    for key, value in state.get("variables", {}).items():
        prev_val = prev_state.get("variables", {}).get(key, "—")
        change_marker = ""
        if key in changes:
            change_marker = f" (变化: {changes[key]})"
        var_lines.append(f"| {key} | {value} | {prev_val} |{change_marker}")

    var_table = "\n".join(var_lines) if var_lines else "（无数值状态）"

    # 暗线进度
    thread_lines = []
    for key, thread in state.get("dark_threads", {}).items():
        prev_thread = prev_state.get("dark_threads", {}).get(key, {})
        prev_stage = prev_thread.get("stage", "—")
        curr_stage = thread.get("stage", "?")
        total = thread.get("total_stages", "?")
        desc = thread.get("description", "")
        moved = " ← 推进" if curr_stage != prev_stage else ""
        stage_display = f"{curr_stage}/{total}{moved}"
        thread_lines.append(f"| {key} | {stage_display} | {prev_stage}/{total} | {desc}")

    thread_table = "\n".join(thread_lines) if thread_lines else "（无暗线追踪）"

    # 变化说明
    change_lines = []
    for key, desc in state.get("last_changes", {}).items():
        change_lines.append(f"- **{key}**: {desc}")

    changes_section = "\n".join(change_lines) if change_lines else "（无变化）"

    return f"""# 暗线快照: 第 {chapter_num} 章后

## 数值状态

| 变量 | 当前值 | 上一章值 |
|------|--------|----------|
{var_table}

## 暗线进度

| 暗线 | 当前阶段 | 上一章阶段 |
|------|----------|------------|
{thread_table}

## 本章关键事件
{event_description or "（未记录）"}

## 变化明细
{changes_section}

## 暗线连续性提醒
- 下一章必须至少推进一条暗线
- 数值变化必须与剧情一致
- 角色状态变化需符合 SKILL.md 设定
"""
