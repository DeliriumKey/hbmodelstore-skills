# 打新收益测算模型

消费沪深、北交所和 REITs 三张发行表，用本包脚本按账户规模计算并绘图。
不运行 Wind，不连接生产数据库，不依赖 hbdatahubx；已有完整三张表可离线复用。

北交所测算采用现金申购制度。市值配售改革的政策状态与适用说明见[组件口径](./references/query.md#计算口径)；讨论后续打新价值时，同时参考该制度变化。

涉及沪深或北交所结果的解读、比较、原因解释或判断时，读取对应分析指引；按问题选用，不要求完整复盘。

| 任务 | 读取位置 |
| --- | --- |
| 面板组件口径、适用场景、查询与交互绘图 | [打新收益测算面板组件](./references/query.md) |
| 读取结果文件、格式化与交付完整明细 | [结果文件与交付](./references/fields.md) |
| 沪深网下打新的收益变化、两市贡献与规模影响 | [沪深打新](./analysis/hs-return-review.md) |
| 打新底仓研究所需的沪深300、上证50等指数行情 | [底仓指数公开接口](./references/underlying-indices.md) |
| 北交所网上打新的收益与持续性；各市场共用的分析写法 | [收益回顾与可持续性](./analysis/return-review.md) |
| 从现有结果计算月度对比、辅助项目窗口与主要贡献项目 | [统计工具](./references/review.md) |
| 样本、公式、规模效应、统计口径与验证 | 文档 MCP 的[构建方法](https://api.delirium.com.cn/docs/models/new-issue-return/construction) |

面板组件说明由 Reference 与网页共用；收益解读按对应分析指引。需要深入查看模型推导、样本处理或验证时调用
`get_doc(path="/docs/models/new-issue-return/construction", max_lines=400)`，
按返回的标题行定位相关部分，`next_line` 非空时续读。
文档 MCP 不可用时，可读取[同页机器可读 Markdown](https://api.delirium.com.cn/llms.mdx/docs/models/new-issue-return/construction/content.md)。
离线计算不要求联网；需要离线解释方法时使用已有文档快照，说明其来源与日期。
