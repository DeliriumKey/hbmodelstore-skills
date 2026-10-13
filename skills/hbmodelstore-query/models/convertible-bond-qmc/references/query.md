# 个券查询与导出

先查 `get_convertible_qmc_dates`；默认最新完整截面，指定日期不回退。
截面默认20行、最多500行，`offset` 接续分页；按名称/代码 `q` 搜索，
`bond_type` 为 `cb`/`eb`。代码保留 `.SH`/`.SZ`；裸码有歧义时使用完整代码。
单券历史默认一年，`start`/`end` 最大3660自然日。

字段与定价解释按 [模型入口](../MODEL.md) 读取构建文档的“结果解读”，参数以 MCP schema 为准。
价格单位为每100元面值的元数值；`*_pct` 直接加 `%`，`*_rate` 乘100后显示百分比。
已公告强赎券的路径比例显示“—”，不与模拟概率混用。

截面和个券历史含 `underlying_code`（正股／换股标的）、`maturity_date`（到期日），
以及 `industry_standard`、`industry_code`、`industry_name`、`industry_as_of_date`。
行业为对应模型日的申万一级分类；尚未补映射的日期返回空值，不用最新分类倒填。

生成截面网页时，使用 `limit=500`，沿用同一日期和筛选参数接续 `offset`，直到取得 `total` 条。
保留原响应对象，将各页 `rows` 按顺序合并并设 `offset=0`，保存为 `cross-section.json`；
随后运行 MODEL.md 中的 `visualize.py`。完整 MCP 导出直接使用，不从聊天中截断的表格拼接。

## 分析表格

需要在文字分析中插表时，用 `scripts/review.py` 直接生成 Markdown；不自行重拼列名或单元格。
读取已有完整查询结果即可，不要求另存派生统计 JSON。默认输出到终端，也可加 `--output table.md`。
展示范围按[分析说明](../analysis/valuation-review.md#表达方式)选择，下面是可选命令，不是必须逐一执行的流程。

```bash
python3 "$SKILL_DIR/models/convertible-bond-qmc/scripts/review.py" groups --input market.json
python3 "$SKILL_DIR/models/convertible-bond-qmc/scripts/review.py" industries --input cross-section.json --min-count 3 --limit 8
python3 "$SKILL_DIR/models/convertible-bond-qmc/scripts/review.py" bonds --input cross-section.json --limit 10
```

需要区间、历史或指定代表券时：

```bash
python3 "$SKILL_DIR/models/convertible-bond-qmc/scripts/review.py" intervals --input cross-section.json
python3 "$SKILL_DIR/models/convertible-bond-qmc/scripts/review.py" history --input bond-a-history.json bond-b-history.json
python3 "$SKILL_DIR/models/convertible-bond-qmc/scripts/review.py" bonds --input cross-section.json --codes 110095.SH 123216.SZ
```

- `intervals` 分别输出市价、平价区间；分界可用 `--price-breaks`、`--parity-breaks` 调整，默认见 `--help`。
- `industries` 按未舍入的价差中位数升序；`--min-count` 选择最低券数，`--limit 0` 展示全部。
- `bonds` 按未舍入的理论溢价率升序；`--codes` 可选代表券，不必只展示排名靠前的券。
- `history` 是单独的精简历史表；占比覆盖输入实际区间，近60模型日均值不足60条时留空。
  单券历史的截止日应与截面一致。
- `groups` 接收分组历史或绘图用的 `market.json`；原样使用服务端相对历史值，按分析规则计算估值动量。
  可用 `--as-of YYYY-MM-DD` 查看截至该日的结果，表中保留实际模型日。

只插入回答当前问题需要的表格，正文解释结论；表头和单元格不加粗，不再向数值单元格附加天数、券数或说明。
溢价率、相对历史与估值动量直接在数值后显示 `%`，表头不写“百分点”；不改变返回数值的尺度。
这些是分析摘要表；完整可搜索、排序的网页表仍使用 `visualize.py`，网页也可保留自己的摘要表。
