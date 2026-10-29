# 含权基金时序多因子模型

模型标识 `equity-fund-timeseries-factor`，读取 252 日显式回归的已计算结果；与纯债基金的
240 日 Alpha 分开。概况与实际覆盖使用 `get_equity_factor_info`，工具参数以 MCP schema 为准。

## 面板组件与绘图单元

每个 Reference 的前三节说明计算口径、应用场景和不适用场景，与网页共用；
后半段给出取数和同源绘图操作。按任务选择入口，不要求读完全部面板组件。

| 任务 | Reference |
| --- | --- |
| 比较市场、规模、价值、动量、信用债及转债因子的近期表现和历史走势 | [市场因子表现](references/factor-returns.md) |
| 在完整同类中定位风格，比较日频因子暴露、同类中位数与分位数 | [风格与因子暴露](references/style-map.md) |
| 查询单基金 Alpha、252日收益及 Alpha 同类区间与分位数 | [Alpha 与收益表现](references/fund-history.md) |
| 查询共同模型日的同类 Alpha 与暴露截面 | [Alpha 截面](references/cross-section.md) |
| 查看单只基金的完整同类风格位置、表现摘要与暴露近邻 | [同类风格与相似基金比较](references/peer-comparison.md) |
| 将指定基金或已选相似基金的日频年化 Alpha 放在一张图里比较（2–11只） | [多基金 Alpha 比较绘图单元](references/multi-fund-history.md) |

公共身份解析、结果保存、分页与分析表格命令见 [查询辅助](references/query.md)；
离线结果的格式和交付检查见 [结果字段](references/fields.md)。

## 分析指引

涉及解读、比较、原因解释或判断时，按问题读取：
[Alpha 与基金表现解读](analysis/fund-review.md)、
[风格、暴露与同期市场环境](analysis/exposure-review.md)、
[同类与多基金比较](analysis/cross-section.md)。
分析指引负责分析步骤、判断规则和表达，不重复面板组件定义；只查数据或绘图可以不读。

## 方法文档

构建、因子、样本与字段含义：
`get_doc(path="/docs/models/equity-fund-timeseries-factor/construction")`；验证实验：
`get_doc(path="/docs/models/equity-fund-timeseries-factor/model-validation")`。
`next_line` 非空时按需续读。

同源 Markdown：[构建](https://api.delirium.com.cn/llms.mdx/docs/models/equity-fund-timeseries-factor/construction/content.md)、
[验证](https://api.delirium.com.cn/llms.mdx/docs/models/equity-fund-timeseries-factor/model-validation/content.md)。
