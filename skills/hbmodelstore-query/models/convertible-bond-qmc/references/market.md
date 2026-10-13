# 市场估值与波动率

普通查数直接使用 MCP：

- `get_convertible_qmc_market_history`：可选日期、券种、平价上下限及转股溢价率上限；参数以 MCP 工具定义为准。不传样本筛选条件时返回全部有效券的聚合。
- `get_convertible_qmc_market_groups_history`：同样的筛选参数，返回每日低、中、高三组的理论溢价率、相对历史值与券数。
- `get_convertible_qmc_market_volatility_history(start=..., end=...)`：中证1000股指期权校准时序。
- `get_convertible_premium_history(start=..., end=...)`：同区间的百元溢价率对照。

QMC 查询默认最近3660个自然日，指定区间也不超过这一上限。均返回 `rows`，以 `model_date` 对齐。
市场预览默认不指定起止日期，读取可用历史；百元溢价率与波动率按市场结果的首末日期查询。
市场分析将可转债与可交债合并，不传 `bond_type`，不分别生成券种曲线。与网页一致，统一使用 `parity_min=70, parity_max=130, conversion_premium_max=85`，筛选后逐券等权。

字段含义与市场汇总公式按 [模型入口](../MODEL.md) 读取构建文档的“结果解读”。
溢价率、波动率都是百分数数值，例如 `25` 显示为 `25%`，不再乘100。

## 分组分析取数

使用 `get_convertible_qmc_market_groups_history`，传入与整体市场相同的日期和筛选条件。
日度分组由服务端计算，不逐日下载截面，也不依赖本地预制数据。需要下钻组内个券时，
再用 `get_convertible_qmc_cross_section` 读取完整截面。

对纯债价值为正且数值有效的样本，按 `conversion_value / pure_bond_value` 升序排列，
相同值按 `bond_code` 排序，依次等分为低、中、高三组。不能整除时，余数依次分给低、中组；
每组计算 `100 × (market_price / theoretical_price − 1)` 的等权均值。
缺纯债价值的券仅从分组中排除；不足三只不作三组比较。分组计算不改变原整体曲线。

比较历史分组时，每个日期都用当日完整截面重分，不能将最新成员倒套历史。
没有完整分组历史时只给当前分组判断，不从整体均值或截图推算分组动量。
相对历史比较直接使用 API 的 `low_relative_pp`、`mid_relative_pp`、`high_relative_pp`，单位为百分点。
服务端先扣当日三组简单均值，再扣此前252个模型日的自身均值，不含当日；历史不足或缺值时为空。
查询短区间也会自动补足此前计算窗口，客户端不再减均值。`low_pct`、`mid_pct`、`high_pct` 保留原始值。

## 导出与绘图

将四个完整 MCP 对象分别保存在 `market`、`groups`、`premium`、`volatility` 键下，形成 `market.json`。
有快照时直接复用；需要一次性落盘可用标准库脚本：

```bash
python3 "$SKILL_DIR/models/convertible-bond-qmc/scripts/query_market.py" \
  --output market.json
python3 "$SKILL_DIR/models/convertible-bond-qmc/scripts/visualize_market.py" \
  --input market.json --output market.html
```

默认取全部可用历史，只有用户指定查询区间时才加 `--start` / `--end`；市场脚本不提供券种切换。
脚本默认带上述样本筛选，可用 `--parity-min`、`--parity-max`、`--conversion-premium-max` 改阈值，或用 `--all-samples` 取消全部样本筛选；可转债与可交债始终适用相同规则。三个溢价率及价差始终使用同一券池；百元溢价率对照与指数期权波动率不随这些筛选变化。
网页使用同源 renderer：依次展示理论溢价率、分组理论溢价率、百元溢价率、短期与长期波动率，四图光标与区间联动。分组图默认“相对历史”，可切换“原始值”；相对历史只画零线，不套用绝对估值阈值。整体理论溢价率以无文字的灰色虚线标记 ±3% 观察分界；低于 −3% 用浅绿底色，高于 +3% 用浅红底色，低于 −5% 或高于 +5% 时底色加深。百元溢价率图同步这些日期分档。
默认显示“全部”，近一年、近三年只切换展示范围，不在取数时截短历史。
默认在 Agent Harness 侧边栏打开 HTML。缺失日期留空，不前填。
