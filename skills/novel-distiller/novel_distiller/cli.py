"""Novel Distiller CLI 统一入口.

用法:
    ws init "作品想法"                    # 创世蓝图
    ws distill-soul "角色名"             # 灵魂蒸馏
    ws distill-author "作者名"            # 作者蒸馏
    ws plot <scene_id>                   # 剧情推演
    ws write <chapter_num>               # 章节撰写
    ws check <chapter_num> --platform tomato   # 锚定自检
    ws darkthread <chapter_num>              # 暗线追踪
    ws status                            # 项目状态概览
"""

import os
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from novel_distiller import scaffold, soul_distill, author_distill, plot, write, anchor, darkthread

console = Console()


def _get_project_dir() -> Path:
    """获取当前项目根目录."""
    # 默认使用当前工作目录
    return Path.cwd()


@click.group()
@click.option("--project-dir", "-p", type=click.Path(), help="项目根目录(默认当前目录)")
@click.pass_context
def cli(ctx, project_dir):
    """Novel Distiller — 长篇小说创作方法论引擎."""
    ctx.ensure_object(dict)
    ctx.obj["project_dir"] = Path(project_dir) if project_dir else _get_project_dir()


@cli.command()
@click.argument("idea")
@click.option("--genre", "-g", default=None, help="类型提示(玄幻/科幻/都市等)")
@click.option("--length", "-l", type=click.Choice(["short", "medium", "long"], case_sensitive=False), default="medium", help="篇幅: short=短篇(8K-3万) medium=中篇(3-10万) long=长篇(10万+)")
@click.option("--platform", "-p", type=click.Choice(["generic", "tomato", "qidian", "zhihu"], case_sensitive=False), default="generic", help="目标平台")
@click.option("--gender", type=click.Choice(["male", "female", "unsure"], case_sensitive=False), default="unsure", help="受众定位: male=男频 female=女频 unsure=待定")
@click.option("--has-source-material/--no-source-material", default=False, help="是否有背景参考资料")
@click.option("--style-author", "-a", default=None, help="参考作者风格")
@click.option("--core-chars", "-c", type=int, default=3, help="核心角色数量(默认3)")
@click.pass_context
def init(ctx, idea, genre, length, platform, gender, has_source_material, style_author, core_chars):
    """创世蓝图: 从想法生成作品骨架."""
    project_dir = ctx.obj["project_dir"]
    console.print(f"[bold cyan]创世蓝图启动[/] -> {project_dir}")
    console.print(f"想法: {idea}")
    console.print(f"类型: {genre or '未指定'} | 篇幅: {length} | 平台: {platform} | 受众: {gender}")
    if style_author:
        console.print(f"参考作者: {style_author}")

    result = scaffold.run(
        project_dir=project_dir,
        idea=idea,
        genre=genre,
        length=length,
        platform=platform,
        gender=gender,
        has_source_material=has_source_material,
        style_author=style_author,
        core_chars_count=core_chars,
    )

    console.print("\n[bold green]骨架生成完成:[/]")
    display_map = {
        "work_intro": "作品简介",
        "worldview": "世界观设定",
        "protagonist": "主角设定",
        "scenes": "场景框架",
        "outline": "章节大纲",
        "author_soul": "作者灵魂方案",
        "darkthread_config": "暗线配置",
        "darkthread_prompt": "暗线优化提示",
    }
    for key, path in result.items():
        if key == "template":
            continue
        label = display_map.get(key, key)
        console.print(f"  - [cyan]{label}[/] -> {path}")

    if has_source_material:
        console.print("\n[yellow]提示:[/] 请将背景资料放入 references/source-materials/")
        console.print("[yellow]提示:[/] 如需非公开蒸馏素材，放入 references/private-materials/")

    console.print(f"\n下一步建议:")
    console.print(f"  1. 编辑 work_intro.md 完善卖点和对标作品")
    console.print(f"  2. 查看 dark-threads/config.yaml，确认暗线配置是否符合设定")
    console.print(f"  3. 运行 [bold]ws distill-soul[/] 或 [bold]ws distill-author[/] 开始蒸馏")
    if not style_author:
        recs = scaffold.recommend_souls(genre or "", "")
        if recs["authors"]:
            console.print(f"  4. 系统推荐作者: {', '.join(recs['authors'])} (供参考)")


@cli.command()
@click.argument("name")
@click.option("--source", "-s", default=None, help="角色出处/身份")
@click.option("--summary", default=None, help="已知背景简介")
@click.option("--type", "-t", type=click.Choice(["real", "fictional"], case_sensitive=False), default=None, help="角色类型: real=真人 fictional=虚构角色")
@click.option("--synthesize", is_flag=True, help="综合 6 probe 结果生成 SKILL.md")
@click.option("--validate", is_flag=True, help="验证已有的 SKILL.md")
@click.pass_context
def distill_soul(ctx, name, source, summary, type, synthesize, validate):
    """灵魂蒸馏: 为角色生成 SKILL.md.

    三阶段工作流:
        1. ws distill-soul "角色名"           -> 生成 6 个 probe prompt
        2. (Claude Agent 并行填充 research/)
        3. ws distill-soul "角色名" --synthesize -> 综合生成 SKILL.md
        4. ws distill-soul "角色名" --validate   -> 验证评分
    """
    project_dir = ctx.obj["project_dir"]
    console.print(f"[bold magenta]灵魂蒸馏[/] -> {name}")

    result = soul_distill.run(
        project_dir, name, source, summary,
        char_type=type, synthesize=synthesize, validate=validate
    )

    status = result.get("status", "unknown")

    if status == "prompts_ready":
        console.print(f"[green]Probe prompts 已生成[/] -> {result['research_dir']}")
        console.print("下一步: 用 Claude Agent 并行填充 6 个 research 文件，然后运行:")
        console.print(f"  [bold]ws distill-soul \"{name}\" --synthesize[/]")
        for probe_id in soul_distill.PROBE_IDS:
            console.print(f"  - {probe_id}_prompt.md -> {probe_id}.md")

    elif status == "missing_probes":
        console.print(f"[yellow]缺少 probe 结果:[/] {', '.join(result.get('missing', []))}")
        console.print("请先让 Claude Agent 填充上述 research 文件，再运行 --synthesize")

    elif status == "synthesized":
        console.print(f"[green]SKILL.md 已生成[/] -> {result['skill_md']}")
        console.print(f"状态: {status} | 建议运行 --validate 进行验证")

    elif status in ("pass", "validated"):
        score = result.get("validation", {}).get("overall", 0)
        color = "green" if score >= soul_distill.OVERALL_THRESHOLD else "yellow"
        console.print(f"[{color}]验证完成[/] -> 总分: {score}/10")
        if score < soul_distill.OVERALL_THRESHOLD:
            fixes = result.get("validation", {}).get("fix_suggestions", [])
            console.print("[yellow]未达门槛 (>=7)，修复建议:[/]")
            for f in fixes[:5]:
                console.print(f"  - {f}")

    elif status == "fail":
        console.print("[red]验证未通过[/]")
        for f in result.get("validation", {}).get("fix_suggestions", []):
            console.print(f"  - {f}")

    else:
        console.print(f"[yellow]状态: {status}[/]")

    if result.get("skill_md"):
        console.print(f"SKILL.md: {result['skill_md']}")


@cli.command()
@click.argument("name")
@click.option("--source", "-s", default=None, help="作者出处/身份")
@click.option("--summary", default=None, help="已知背景简介")
@click.option("--synthesize", is_flag=True, help="综合 6 probe 结果生成 SKILL.md")
@click.option("--validate", is_flag=True, help="验证已有的 SKILL.md")
@click.pass_context
def distill_author(ctx, name, source, summary, synthesize, validate):
    """作者蒸馏: 为作者生成笔锋 SKILL.md.

    三阶段工作流:
        1. ws distill-author "作者名"           -> 生成 6 个 probe prompt
        2. (Claude Agent 并行填充 research/)
        3. ws distill-author "作者名" --synthesize -> 综合生成 SKILL.md
        4. ws distill-author "作者名" --validate   -> 验证评分
    """
    project_dir = ctx.obj["project_dir"]
    console.print(f"[bold magenta]作者蒸馏[/] -> {name}")

    result = author_distill.run(
        project_dir, name, source, summary,
        synthesize=synthesize, validate=validate
    )

    status = result.get("status", "unknown")

    if status == "prompts_ready":
        console.print(f"[green]Probe prompts 已生成[/] -> {result['research_dir']}")
        console.print("下一步: 用 Claude Agent 并行填充 6 个 research 文件，然后运行:")
        console.print(f"  [bold]ws distill-author \"{name}\" --synthesize[/]")
        for probe_id in author_distill.PROBE_IDS:
            console.print(f"  - {probe_id}_prompt.md -> {probe_id}.md")

    elif status == "missing_probes":
        console.print(f"[yellow]缺少 probe 结果:[/] {', '.join(result.get('missing', []))}")
        console.print("请先让 Claude Agent 填充上述 research 文件，再运行 --synthesize")

    elif status == "synthesized":
        console.print(f"[green]SKILL.md 已生成[/] -> {result['skill_md']}")
        console.print(f"状态: {status} | 建议运行 --validate 进行验证")

    elif status in ("pass", "validated"):
        score = result.get("validation", {}).get("overall", 0)
        color = "green" if score >= author_distill.OVERALL_THRESHOLD else "yellow"
        console.print(f"[{color}]验证完成[/] -> 总分: {score}/10")
        if score < author_distill.OVERALL_THRESHOLD:
            fixes = result.get("validation", {}).get("fix_suggestions", [])
            console.print("[yellow]未达门槛 (>=7)，修复建议:[/]")
            for f in fixes[:5]:
                console.print(f"  - {f}")

    elif status == "fail":
        console.print("[red]验证未通过[/]")
        for f in result.get("validation", {}).get("fix_suggestions", []):
            console.print(f"  - {f}")

    else:
        console.print(f"[yellow]状态: {status}[/]")

    if result.get("skill_md"):
        console.print(f"SKILL.md: {result['skill_md']}")


@cli.command("plot")
@click.argument("scene_id")
@click.option("--rounds", "-r", type=int, default=3, help="推演轮次(默认3，短篇推荐3/中篇5/长篇7)")
@click.option("--report", is_flag=True, help="从已有轮次综合生成推演报告")
@click.pass_context
def plot_cmd(ctx, scene_id, rounds, report):
    """剧情推演: 多智能体场景模拟.

    两阶段工作流:
        1. ws plot <场景ID> --rounds 5    -> 生成 manifest + round prompts
        2. (Claude Agent 串行执行每轮 ReACT)
        3. ws plot <场景ID> --report     -> 综合生成 report.md
    """
    project_dir = ctx.obj["project_dir"]

    if report:
        console.print(f"[bold blue]推演报告合成[/] -> 场景 {scene_id}")
        result = plot.run(project_dir, scene_id, round_count=rounds, report=True)
        status = result.get("status", "unknown")

        if status == "report_generated":
            console.print(f"[green]报告已生成[/] -> {result['report_md']}")
            console.print(f"综合轮数: {result['round_count']}")
            if result.get("surprises"):
                console.print(f"\n[bold]意外发现 ({len(result['surprises'])}):[/]")
                for s in result["surprises"][:5]:
                    console.print(f"  - {s}")
        else:
            console.print(f"[yellow]{result.get('message', '报告生成失败')}[/]")
        return

    console.print(f"[bold blue]剧情推演准备[/] -> 场景 {scene_id} | 轮次: {rounds}")
    result = plot.run(project_dir, scene_id, round_count=rounds)
    status = result.get("status", "unknown")

    if status == "prompts_ready":
        console.print(f"[green]推演准备完成[/]")
        console.print(f"  Manifest: {result['manifest']}")
        console.print(f"  操作指南: {result['guide']}")
        console.print(f"  Round prompts: {result['rounds_dir']}")
        console.print(f"\n下一步:")
        console.print(f"  1. 阅读 {result['guide']} 了解推演协议")
        console.print(f"  2. 用 Claude Agent 串行执行 {result['round_count']} 轮 ReACT")
        console.print(f"  3. 每轮结果保存到 rounds/round_NN.md")
        console.print(f"  4. 完成后运行: [bold]ws plot \"{scene_id}\" --report[/]")

    elif status == "missing_scene":
        console.print(f"[red]错误:[/] {result.get('message', '场景定义缺失')}")
        console.print(f"请先创建 scenes/{scene_id}.md 场景定义文件")

    else:
        console.print(f"[yellow]状态: {status}[/]")


@cli.command("write")
@click.argument("chapter_num", type=int)
@click.option("--scene", "-s", default=None, help="关联场景 ID")
@click.option("--style", default=None, help="写作风格覆盖")
@click.pass_context
def write_cmd(ctx, chapter_num, scene, style):
    """章节撰写: 组装写作 prompt，缺素材不撰写."""
    project_dir = ctx.obj["project_dir"]
    console.print(f"[bold yellow]撰写第 {chapter_num} 章[/]")
    result = write.run(project_dir, chapter_num, scene_id=scene, style_override=style)
    status = result.get("status", "unknown")

    if status == "missing_prerequisites":
        console.print("[red]前置素材不齐，拒绝撰写:[/]")
        for item in result.get("missing", []):
            console.print(f"  - [red]缺少:[/] {item}")
        console.print("\n[yellow]请先完成以下步骤:[/]")
        console.print("  1. ws init -> 生成作品骨架")
        console.print("  2. ws distill-soul / distill-author -> 蒸馏角色和作者")
        console.print("  3. ws plot -> 完成场景推演")
        console.print("  4. 编辑 chapters/outline.md 完善大纲")

    elif status == "exists":
        console.print(f"[green]章节已存在[/] -> {result['chapter_md']}")
        console.print(f"当前字数: {result['word_count']} 字")
        console.print(f"写作指令: {result['prompt_md']}")

    elif status == "ready":
        console.print(f"[green]写作指令已生成[/] -> {result['prompt_md']}")
        console.print(f"章节文件: {result['chapter_md']}")
        console.print("\n下一步:")
        console.print(f"  1. 阅读写作指令 ({result['prompt_md'].name})")
        console.print(f"  2. 用 Claude Agent 根据指令生成正文")
        console.print(f"  3. 保存到 {result['chapter_md'].name}")
        console.print(f"  4. 运行 [bold]ws check {chapter_num}[/] 进行锚定自检")

    else:
        console.print(f"[yellow]状态: {status}[/]")


@cli.command()
@click.argument("chapter_num", type=int)
@click.option("--platform", "-p", type=click.Choice(["generic", "tomato", "qidian", "zhihu"], case_sensitive=False), default="generic", help="平台规则: generic / tomato / qidian / zhihu")
@click.option("--rewrite/--no-rewrite", default=False, help="不通过时自动重写")
@click.pass_context
def check(ctx, chapter_num, platform, rewrite):
    """锚定自检: 叙事连续性 + 人物一致性 + 平台合规."""
    project_dir = ctx.obj["project_dir"]
    console.print(f"[bold green]锚定自检[/] -> 第 {chapter_num} 章 | 平台: {platform}")
    result = anchor.run(project_dir, chapter_num, platform, auto_rewrite=rewrite)
    status = result.get("status", "unknown")

    if status == "missing_chapter":
        console.print("[red]自检失败:[/] 章节文件不存在或内容为空")
        console.print(f"请先运行 [bold]ws write {chapter_num}[/] 生成章节")
        return

    score = result.get("total_score", 0)
    passed = result.get("is_passed", False)
    color = "green" if passed else "red"
    must_pass = result.get("must_pass_results", {})

    console.print(f"[{color}]初筛完成[/] -> 总分: {score}/10 | 状态: {'通过' if passed else '未通过'}")

    # 显示必过项
    console.print("\n[bold]必过项检查:[/]")
    for item, ok in must_pass.items():
        item_color = "green" if ok else "red"
        console.print(f"  [{item_color}]{'通过' if ok else '未通过'}[/] {item}")

    console.print(f"\n报告: {result['report_md']}")
    console.print(f"评估指令: {result['check_prompt_md']}")

    if not passed and result.get("fix_suggestions"):
        console.print("\n[bold yellow]修复建议:[/]")
        for s in result["fix_suggestions"][:5]:
            console.print(f"  - {s}")

    if not passed:
        console.print("\n[yellow]提示:[/]")
        console.print("  1. 根据修复建议修改章节")
        console.print("  2. 或使用评估指令请 Claude Agent 进行深度评估")
        console.print(f"  3. 修改后重新运行 [bold]ws check {chapter_num} --platform {platform}[/]")


@cli.command("darkthread")
@click.argument("chapter_num", type=int)
@click.option("--set", "changes", multiple=True, help="设置变量，如 merit=10")
@click.option("--event", default="", help="本章关键事件描述")
@click.option("--show", is_flag=True, help="仅显示当前暗线状态")
@click.pass_context
def darkthread_cmd(ctx, chapter_num, changes, event, show):
    """暗线追踪: 更新数值状态与暗线进度."""
    project_dir = ctx.obj["project_dir"]

    if show:
        state = darkthread.get_current_state(project_dir)
        if not state:
            console.print("[yellow]暗线追踪未初始化[/]")
            console.print("运行一次 ws darkthread 1 --set merit=0 初始化")
            return
        console.print(darkthread.render_state_for_prompt(project_dir))
        return

    # 解析 changes
    changes_dict = {}
    for item in changes:
        if "=" in item:
            key, val = item.split("=", 1)
            # 尝试解析为数字
            try:
                val = int(val)
            except ValueError:
                try:
                    val = float(val)
                except ValueError:
                    pass
            changes_dict[key] = val

    result = darkthread.run(
        project_dir=project_dir,
        chapter_num=chapter_num,
        changes=changes_dict,
        event_description=event or f"第 {chapter_num} 章结束",
    )

    console.print(f"[bold cyan]暗线快照[/] -> 第 {chapter_num} 章")
    console.print(f"状态: {result['status']}")
    console.print(f"文件: {result['snapshot_md']}")

    if result["state"]:
        console.print("\n[bold]当前数值状态:[/]")
        for key, value in result["state"].get("variables", {}).items():
            console.print(f"  {key}: {value}")
        console.print("\n[bold]暗线进度:[/]")
        for key, thread in result["state"].get("dark_threads", {}).items():
            stage = thread.get("stage", "?")
            total = thread.get("total_stages", "?")
            console.print(f"  {key}: 阶段 {stage}/{total}")


@cli.command()
@click.pass_context
def status(ctx):
    """项目状态概览."""
    project_dir = ctx.obj["project_dir"]
    table = Table(title="WS 项目状态")
    table.add_column("维度", style="cyan")
    table.add_column("数量", style="magenta")
    table.add_column("最近更新", style="green")

    souls_dir = project_dir / "souls"
    scenes_dir = project_dir / "scenes"
    chapters_dir = project_dir / "chapters"

    soul_count = len([d for d in (souls_dir.iterdir() if souls_dir.exists() else []) if d.is_dir()])
    scene_count = len(list(scenes_dir.glob("*.md"))) if scenes_dir.exists() else 0
    chapter_count = len(list(chapters_dir.glob("ch*.md"))) if chapters_dir.exists() else 0

    table.add_row(" souls", str(soul_count), "—")
    table.add_row(" scenes", str(scene_count), "—")
    table.add_row(" chapters", str(chapter_count), "—")

    console.print(table)


def main():
    cli()


if __name__ == "__main__":
    main()
