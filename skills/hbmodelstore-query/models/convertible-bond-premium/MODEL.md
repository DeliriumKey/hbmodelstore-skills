# 百元溢价率

模型标识 `convertible-bond-premium`，属于转债估值板块，不涉及基金份额解析。

- 计算口径、应用场景、不适用场景与查询绘图：[百元溢价率面板组件](references/premium.md)。
- 结果文件的字段格式：[fields.md](references/fields.md)。
- 当前转债趋势及与择时实验同口径的输入：[931078指数20日动量](references/index-momentum.md)（数据查询，无独立图表）。
- 需要解读历史位置与走势时，读[市场估值分析](../convertible-bond-qmc/analysis/market-valuation.md)中的相关部分；不因此补查全部拟蒙特卡洛数据。

构建与拟合方法用 `get_doc(path="/docs/models/convertible-bond-valuation/construction")`，
筛选和回归结构实验用 `get_doc(path="/docs/models/convertible-bond-valuation/model-validation")`。
`next_line` 非空时按需续读。
同源 Markdown：[构建](https://api.delirium.com.cn/llms.mdx/docs/models/convertible-bond-valuation/construction/content.md)、
[验证](https://api.delirium.com.cn/llms.mdx/docs/models/convertible-bond-valuation/model-validation/content.md)。
