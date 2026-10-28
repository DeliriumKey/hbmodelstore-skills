# 转债拟蒙特卡洛估值

模型标识 `convertible-bond-qmc`，读取已计算结果，不运行定价，不涉及基金份额解析。
概况与实际覆盖用 `get_convertible_qmc_info`；工具参数以 MCP schema 为准。

## 面板组件

每个 Reference 的前三节说明计算口径、应用场景和不适用场景，与网页共用；
后半段给出取数和同源绘图操作。按任务选一个入口，不要求读完所有面板组件。

| 任务 | Reference |
| --- | --- |
| 看市场整体估值、三组差异、百元溢价率与波动率对照 | [市场估值](references/market.md) |
| 看指定行业或全行业的估值历史走势 | [行业走势](references/industry-history.md) |
| 看最新或指定模型日的各行业估值截面 | [行业截面](references/industry-snapshot.md) |
| 查个券估值、按Q组比较、查看单券历史 | [个券估值](references/pricing.md) |
| 理解网站中的拟蒙特卡洛与双低择券回测 | [择券表现](references/selection-strategy.md)（网站研究预览，尚无公开查询/绘图入口） |

通用截面分页、字段格式与分析表格脚本见 [query.md](references/query.md)。
行业历史新接口按当前任务提供的候选连接验收，公网能力以工具发现为准。

## 分析指引

涉及投资判断时，按问题读取：
[转债市场估值与配置价值](analysis/market-valuation.md)、
[转债方向与个券选择](analysis/valuation-review.md)。
估值与变化解读、个券比较也参考其中相关部分，不自动展开全部问题。
分析指引负责结合证据形成判断；查询、排序和绘图由面板组件 Reference 承接。
本模型研究估值吸引力、参与时机及不同用途和持有期下的相对价值；替代比例、仓位换算和组合优化由独立的资产配置任务承接。

权益替代与纯债增强的实证依据见“择时策略实验”：
`get_doc(path="/docs/models/convertible-bond-valuation/momentum-experiments")`。
该文档维护估值、价格动量、持有周期与配置对照的实验结果；分析指引只保留判断方法，
需要论证有效性时查文档，当前状态另查最新数据。
价格趋势使用[931078指数20日动量查询](../convertible-bond-premium/references/index-momentum.md)。
该指标不将研究实验转换为自动配置模型。

## 方法文档

构建、条款与定价含义：
`get_doc(path="/docs/models/convertible-bond-valuation/construction")`；
校准和收敛实验：
`get_doc(path="/docs/models/convertible-bond-valuation/model-validation")`。
`next_line` 非空时按需续读。

同源 Markdown：[构建](https://api.delirium.com.cn/llms.mdx/docs/models/convertible-bond-valuation/construction/content.md)、
[验证](https://api.delirium.com.cn/llms.mdx/docs/models/convertible-bond-valuation/model-validation/content.md)。
