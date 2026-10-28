# 含权基金 Brinson 归因模型

`model_key`：`fund-brinson-attribution`

## 方法文档

方法说明用 `get_doc(path="/docs/models/fund-brinson-attribution/construction")`。
文档工具不可用时读取同源 [模型构建 Markdown](https://api.delirium.com.cn/llms.mdx/docs/models/fund-brinson-attribution/construction/content.md)。

## 面板组件

每个面板组件 Reference 的前三节说明计算口径、应用场景和不适用场景，与网页共用；
后半段给出查询和同源绘图操作。按任务选一个入口，不要求读完全部文件。
字段使用与层级关系见[结果字段](./references/fields.md)。

| 任务 | 能力 ID | 入口 |
| --- | --- | --- |
| 查询并绘制一个已发布半年期的完整归因 | `fund-brinson-history` | [单期收益归因](./references/history.md) |
| 展开单期资产、行业、股票与转债明细 | `fund-brinson-period-detail` | [单期归因明细](./references/period.md) |
| 查询单期实际、拟合、行业匹配与复合基准净值 | `fund-brinson-nav-comparison` | [单期净值对比](./references/nav-comparison.md) |
| 查询并绘制连续半年期的累计归因 | `fund-brinson-analysis` | [跨期收益归因](./references/multi-period.md) |

## 分析指引

涉及结果解读、比较、原因解释或判断时，读取对应分析指引；按问题选用，不要求完整复盘。

| 研究问题 | 入口 |
| --- | --- |
| 复盘收益来源、阶段演变，以及行业、选择与主动调仓的贡献 | [收益来源复盘](./analysis/return-source-review.md) |

分析指引负责比较步骤、判断与表达，不重复面板组件定义。只查数据或绘图时无需读取。

已有分析快照的下钻通过[分析表格与离线下钻](./references/review.md)：按贡献来源展开各期，
追踪行业与个股的权重和贡献，或比较指定股票与其余持仓。沿用 `review.py`，无需重复取数或自写聚合脚本。
