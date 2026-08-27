# 基金搜索与主份额解析

## 功能

按名称或份额代码搜索候选，把 A/C 等具体份额映射到模型使用的 `initial_fund_code`。只有随后
要查询具体模型时，才确认该初始份额的最近模型日在近两年内。

## 典型请求

- “永赢诚益C 对应哪个主份额？”
- “用 005952.OF 查这个模型。”
- “搜索易方达信用债，并确认哪些基金可以查询久期或 Alpha。”

## 输入与默认值

- 名称或模糊代码：先搜索，默认返回 10 条，单次最多 20 条。
- 精确份额代码：可省略 `.OF`，解析接口返回初始基金代码。
- 名称命中多个初始基金时必须让用户确认，不按相似度自动选择。

```bash
python3 skills/hbmodelstore-query/scripts/client.py search-funds \
  --query 永赢诚益 --limit 10

python3 skills/hbmodelstore-query/scripts/client.py resolve-fund \
  --fund-code 005952.OF

python3 skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/query.py \
  search-funds --query 永赢诚益 --limit 10 --offset 0
```

## 返回

全市场搜索返回具体份额的 `fund_code`、`fund_name` 和 `initial_fund_code`。搜索结果已有非空
`initial_fund_code` 时直接使用，不再重复调用解析接口。目标模型的 `search-funds` 只返回最近
模型日在近两年内的初始份额，并提供 `has_more` 与 `next_offset` 进行有界翻页。

## 可视化

本能力不生成图表；它是所有单基查询和网页基金输入框的前置解析层。

## 边界

- `initial_fund_code=null` 时不得猜测主份额。
- 全市场搜索命中不等于模型当前可查询；准备发起目标模型查询时必须再做该模型的基金搜索。
- 用户只问主份额映射或尚未指定目标模型时，不额外调用目标模型接口。
- 空搜索结果表示当前参考数据没有命中，不证明代码一定不存在。
