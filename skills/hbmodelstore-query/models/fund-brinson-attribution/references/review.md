# 分析表格与离线下钻

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

## 按问题下钻

以下命令直接读取 `analysis.json`，旧快照也可使用。默认返回 Markdown，附加 `--format json`
获得完整结构化结果。`--segment` 指定一个连续区间，默认 0；子区间仍先用原始快照离线复算。

### 某项贡献在哪些阶段发生

```bash
python3 "$SKILL_DIR/models/fund-brinson-attribution/scripts/review.py" effect \
  --input analysis.json --effect fit_residual
```

默认研究主动调仓，也可传 `benchmark_bridge`、`security_selection_effect` 等归因字段。
返回各期实际收益、静态持仓收益、调仓与桥接，以及所选来源的单期贡献和对所选总区间的链接贡献；
摘要列出正负期数和绝对贡献最大的期间。占净贡献比例以区间净贡献为分母，正负抵消时可能超过100%，
净贡献为零时为空；JSON 另给占绝对贡献合计的比例。调仓期数来自 `fit_residual` 本身。

### 行业或股票的权重与贡献如何变化

```bash
python3 "$SKILL_DIR/models/fund-brinson-attribution/scripts/review.py" history \
  --input analysis.json --codes 688146.SH 603950.SH
python3 "$SKILL_DIR/models/fund-brinson-attribution/scripts/review.py" history \
  --input analysis.json --kind industry --industry 电子 --standard SW2021
```

股票使用精确代码，返回各期披露权重、归因权重、股票与行业收益、收益差、单期及链接选股贡献。
行业可用精确名称或代码，返回净值权重、市场内组合与基准权重、收益和配置／选择贡献。
`--market A_SHARE` 为默认，港股用 `--market HK`；同名行业跨分类标准时用 `--standard` 明确选择。
历史沿用每期分类。无记录、未纳入归因、分类不覆盖分别标记，数值为空；已有的真实零保留。

### 指定股票之外还有多少贡献

```bash
python3 "$SKILL_DIR/models/fund-brinson-attribution/scripts/review.py" groups \
  --input analysis.json --codes 688146.SH 603950.SH 301526.SZ
```

在选定市场中，将已纳入归因的股票分为所选组与其余组，并列出全部股票供核对。
逐期返回归因权重、正负选股贡献和合计；区间汇总使用同一组链接系数，两组合计等于该市场全体股票贡献。
每期静态股票篮子收益和同权重行业篮子收益，分别以该组归因权重归一；零权重或权重缺失时归一收益为空。
归一收益只描述该期股票篮子，区间摘要只汇总链接贡献与平均权重。未纳入归因的记录另存于 JSON 的
`excluded_records`，不混入所选或其余组。
