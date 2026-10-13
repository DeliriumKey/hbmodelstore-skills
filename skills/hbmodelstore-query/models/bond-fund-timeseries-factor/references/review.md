# 分析表格

`review.py` 读取完整 MCP 导出、API JSON 或 `query.py` 的单基／多基结果，直接输出 Markdown，
不重新取数、不要求另存统计 JSON。未指定日期时取每只基金的最新有效日；比较同日时显式指定日期。

```bash
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/review.py" duration --input history.json --dates 2025-12-31 2026-06-30
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/review.py" alpha --input alpha.json
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/review.py" exposure --model alpha --input alpha.json
```

`--codes` 可从完整截面选择基金；不传则展示输入中的基金，不重新选样或排序评分。
每格一个数值，代码与名称分列，百分比直接带 `%`，正文解释比较结果。
