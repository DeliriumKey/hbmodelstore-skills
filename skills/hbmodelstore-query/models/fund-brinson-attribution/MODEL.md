# 含权基金 Brinson 归因模型

`model_key`：`fund-brinson-attribution`

## 模型简介

以初始基金代码为实体，使用期初完整披露持仓复盘随后半年的基金收益，覆盖 A股、港股、转债和纯债，
分解资产配置、行业配置、选择及残差，并提供行业与证券明细。
模型基准是复合基准；持仓归因采用静态持有假设，不还原期内逐笔交易。
公开结果为通过质量检查的独立半年期，跨期贡献由客户端另行链接计算。

## 查询、计算与绘图

按任务读取对应 Reference；字段含义和层级关系见[字段映射](./references/fields.md)。

| 任务 | 能力 ID | 入口 |
| --- | --- | --- |
| 查询半年期历史与可用区间 | `fund-brinson-history` | [历史汇总](./references/history.md) |
| 展开单期资产、行业、股票与转债明细 | `fund-brinson-period-detail` | [单期明细](./references/period.md) |
| 查询实际、拟合、行业匹配与复合基准净值 | `fund-brinson-nav-comparison` | [净值对比](./references/nav-comparison.md) |
| 跨期取数、归因汇总与离线复算 | `fund-brinson-analysis` | [跨期计算](./references/multi-period.md) |
| 生成单期交互网页 | `fund-brinson-history` | [可视化](./references/visualization.md) |
| 生成跨期交互网页 | `fund-brinson-analysis` | [可视化](./references/visualization.md) |

## 文字分析

仅在用户要求分析或文字解读时读取；查询、计算和绘图不自动启动完整分析。

| 研究问题 | 入口 |
| --- | --- |
| 复盘收益来源、阶段演变，以及行业、选择与主动调仓的贡献 | [收益来源复盘](./analysis/return-source-review.md) |
