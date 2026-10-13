# 分析表格

对 `analyze.py` 的结果离线生成 Markdown，不重取数据、不另存统计 JSON：

```bash
python3 "$SKILL_DIR/models/fund-brinson-attribution/scripts/review.py" summary --input analysis.json
python3 "$SKILL_DIR/models/fund-brinson-attribution/scripts/review.py" periods --input analysis.json
python3 "$SKILL_DIR/models/fund-brinson-attribution/scripts/review.py" industries --input analysis.json --segment 0 --limit 5
python3 "$SKILL_DIR/models/fund-brinson-attribution/scripts/review.py" securities --input analysis.json --segment 0 --limit 5
```

`summary` 按连续区间汇总，`periods` 保留逐期贡献；行业和持仓各列主要正负来源，
`--limit` 是每个方向的数量。`--segment` 选择结果中的连续区间，从0计数。
阶段专题先按该阶段重新运行 `analyze.py --input 原始快照 --start ... --end ...`，再出表。
表格按问题选择，不默认全部展示；代码、名称、行业标准分列，百分比直接带 `%`。
