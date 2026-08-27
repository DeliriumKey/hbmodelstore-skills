# 市场久期跟踪

## 功能

按基金二级分类、持仓资产类型或交叉分类查询修正久期 Q25、中位数、Q75、IQR 和报告期披露
中位数，并生成与网页预览同源的交互图。

## 典型请求

- “画利率债基金过去五年的市场久期中位数和 IQR。”
- “比较中长期纯债与短期纯债的市场久期。”
- “查询中长期纯债信用债基金最近十年的历史。”

## 输入与默认值

- `--breakdown`：`sample-type`（默认）、`fund-invest-type` 或
  `sample-type-and-fund-type`。
- `--start`、`--end`：均省略时查询截至当天最近五年；最长十年。

```bash
python3 skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/query.py \
  median --breakdown sample-type --start 2025-01-01 --end 2025-12-31
```

## 返回

每个 `series` 直接在对应基金集合上计算等权分位数，不对子组统计再次平均。日频 `points` 包含
Q25、中位数、Q75、IQR 与 `fund_count`；`disclosed_points` 包含半年报和年报披露中位数。
分类使用每个模型日当时生效的报告期信息，不用未来信息回填。

## 可视化

```bash
python3 skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/visualize.py \
  market-duration --series rate --output market-rate.html
```

`--series` 支持 `rate`、`credit`、`long-term`、`short-term`、`long-term-rate`、
`long-term-credit`、`short-term-credit`。脚本自动选择对应 breakdown，并复用
`assets/market-duration-renderer.mjs`。

## 边界

- 比较不同日期或分组时同时查看 `fund_count`；缺失基金不以零参与。
- IQR 只描述同组基金久期的截面分散程度，不直接解释为观点分歧、拥挤或预测信号。
