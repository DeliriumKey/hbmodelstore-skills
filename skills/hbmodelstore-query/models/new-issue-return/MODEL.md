# 打新收益测算模型

消费沪深、北交所和 REITs 三张发行表，用本包脚本按账户规模计算并绘图。
不运行 Wind，不连接生产数据库，不依赖 hbdatahubx；已有完整三张表可离线复用。

涉及沪深或北交所结果的解读、比较、原因解释或判断时，读取对应 analysis；按问题选用，不要求完整复盘。

| 任务 | 读取位置 |
| --- | --- |
| 查询、完整导出、离线计算与交互绘图 | [使用方法](./references/query.md) |
| 读取结果文件、格式化与交付完整明细 | [结果文件与交付](./references/fields.md) |
| 沪深网下打新的收益变化、两市贡献与规模影响 | [沪深打新](./analysis/hs-return-review.md) |
| 北交所网上打新的收益与持续性；各市场共用的分析写法 | [收益回顾与可持续性](./analysis/return-review.md) |
| 从现有结果计算月度对比、辅助项目窗口与主要贡献项目 | [统计工具](./references/review.md) |
| 样本、公式、规模效应、统计口径与验证 | 文档 MCP 的[构建方法](https://api.delirium.com.cn/docs/models/new-issue-return/construction) |

模型知识统一维护在文档站，Skill 不另存一份说明。需要解释方法或核对口径时调用
`get_doc(path="/docs/models/new-issue-return/construction", max_lines=400)`，
按返回的标题行定位相关部分，`next_line` 非空时续读。
文档 MCP 不可用时，可读取[同页机器可读 Markdown](https://api.delirium.com.cn/llms.mdx/docs/models/new-issue-return/construction/content.md)。
离线计算不要求联网；需要离线解释方法时使用已有文档快照，说明其来源与日期。
