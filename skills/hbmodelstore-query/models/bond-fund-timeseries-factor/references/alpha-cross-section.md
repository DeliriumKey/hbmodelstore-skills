# Alpha 截面排行

## 功能

查询指定真实模型日或最新模型日的 Alpha 截面，可按基金分支和久期五分位组筛选，并按用户
指定的 240 日/60 日权重派生组合得分、排序和分页表。

## 典型请求

- “看最新模型日利率债基金 Q3 的 Alpha 排名。”
- “240 日和 60 日按 75/25 打分，给我完整排行。”
- “把 2026-08-24 信用债基金 Q5 结果做成交互 HTML。”

## 输入与默认值

- `--date`：可省略；省略时查询最新模型日。需要列日期时先用 `model-dates`。
- `--sample-type`：可选 `rate` 或 `credit`；不传时返回两个分支。
- `--duration-bucket`：可选 1 至 5；不传时返回全部久期组。
- `--alpha-weight`：可选 0 至 1；近期状态权重自动取 `1 - alpha_weight`。

```bash
python3 skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/query.py \
  alpha-cross-section --date 2026-08-24 --sample-type rate \
  --duration-bucket 3 --alpha-weight 0.75
```

## 返回

服务端返回毛 Alpha、60 日残差状态、隐含麦考利久期、久期组和原始排名。显式传权重时，脚本
增加 `derived_score_weights` 与 `combined_score`；相同得分排序时用基金代码稳定打破并列。

## 可视化

```bash
python3 skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/visualize.py \
  alpha-cross-section --date 2026-08-24 --sample-type rate \
  --duration-bucket 3 --alpha-weight 0.75 --output alpha-ranking.html
```

HTML 提供网页预览同口径的五档权重、数值列排序和分页表，核心评分与格式化逻辑复用
`assets/alpha-cross-section-renderer.mjs`。

## 边界

- 客户端组合得分不是数据库正式得分，也不改变服务端结果。
- 不传 `sample-type` 或 `duration-bucket` 是合法的完整截面查询，不得强制用户先选分支。
- 空 `rows` 表示当前日期或筛选条件没有已发布结果，不表示 Alpha 为零。
