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
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/query.py" \
  alpha-cross-section --date 2026-08-24 --sample-type rate \
  --duration-bucket 3 --alpha-weight 0.75
```

## 返回

服务端返回毛 Alpha、60 日残差状态、隐含麦考利久期、久期组和原始排名。显式传权重时，脚本
增加 `derived_score_weights` 与 `combined_score`；相同得分排序时用基金代码稳定打破并列。

## 可视化

默认生成交互 HTML 并优先在当前 Agent Harness 的侧边栏打开，保留权重、排序和分页操作；
不支持预览时提供 HTML 文件或链接，不默认输出静态图片。

```bash
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/visualize.py" \
  alpha-cross-section --date 2026-08-24 --sample-type rate \
  --duration-bucket 3 --alpha-weight 0.75 --output alpha-ranking.html
```

HTML 提供网页预览同口径的五档权重、数值列排序和分页表，核心评分与格式化逻辑复用
`assets/alpha-cross-section-renderer.mjs`。

## 边界

- 客户端组合得分不是数据库正式得分，也不改变服务端结果。
- 不传 `sample-type` 或 `duration-bucket` 是合法的完整截面查询，不得强制用户先选分支。
- 空 `rows` 表示当前日期或筛选条件没有已发布结果，不表示 Alpha 为零。

## 排名口径

久期组是在同一基金分支内按隐含久期形成的五个比较组，用于把久期相近的基金放在一起计算相对排名。日期控件只列出Alpha当前真实可查询的模型日，不根据交易日历推算。

接口返回240日长期Alpha排名与60日近期状态排名，不直接返回混合得分。预览在客户端按统一权重合成组合得分，默认使用75%长期Alpha排名和25%近期状态排名；滑块支持100/0、75/25、50/50、25/75和0/100五档，不改变接口原始结果。

## 利差暴露同组分位（本地开发，待部署）

截面新增240日模型的政金债、二级资本债、高评级普通信用债、AA＋普通信用债利差暴露，
以及各自的 `*_percentile`。字段见[字段字典](./fields.md)。
分位按同日、同分支、同久期组的各因子非空样本分别计算，并列使用平均名次；
不随客户端排序、分页或混合得分权重改变。空因子不参与排名，不能视为零暴露。
这些是长期风险暴露的相对位置，不用于替代30日久期模型的暴露排名。
