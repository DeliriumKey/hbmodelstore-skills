# 基金Brinson归因

`model_key`：`fund-brinson-attribution`

| 用户意图 | 能力 ID | Reference |
| --- | --- | --- |
| 查询单基半年期归因历史 | `fund-brinson-history` | [历史汇总](./references/history.md) |
| 展开单期市场、行业和个股明细 | `fund-brinson-period-detail` | [单期明细](./references/period.md) |
| 查询基金与复合基准净值曲线 | `fund-brinson-nav-comparison` | [净值对比](./references/nav-comparison.md) |

模型以初始基金代码为实体，使用期初完整持仓解释接下来半年的真实基金收益。
只有`passed`结果进入公开稳定视图。字段解释见[公开字段](./references/fields.md)。
