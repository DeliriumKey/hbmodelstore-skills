# 转债指数20日动量

## 计算口径

使用931078.CSI指数收盘价，20交易日动量为`(close[t] / close[t-20] - 1) × 100`。
动量以百分比表示。起止日间相隔20个交易日，需要21个有效收盘价；窗口行情不完整时不计算动量。
正值、负值分别表示过去20个交易日上涨、下跌。

## 应用场景

为“当前转债还能否配置”、权益替代、纯债增强提供与择时策略实验同口径的价格趋势。
结合市场折溢价与计划持有周期研究，20日是回看窗口，持有时间由后续信号和组合用途决定。

## 不适用场景

指数价格动量不等于估值动量，也不等于个券截面等权价格的变化。
价格趋势本身不确定配置比例，仓位还取决于组合目标和风险预算。

## 查询

当前状态用`get_convertible_index_momentum()`；需要与某一估值日对齐时传`model_date`。
返回值为百分数数值，2表示2%；`model_date`、`base_date`为动量窗口的实际结束日与起始日。
`missing_index_close`表示窗口行情未齐，结果为null，保留未知，不另造代理信号。
先看返回的实际日期和`status`，指定日期没有结果会报404，不自动换到其他日期。
需要历史比较时用`get_convertible_index_momentum_history(start=..., end=...)`；
默认最近三年，最多3660自然日。参数以MCP工具schema为准。

无MCP时可只读GET `/models/convertible-bond-premium/index-momentum`，
指定日期使用`?date=YYYY-MM-DD`；历史路径为`/index-momentum/history`，支持`start/end`。
连接沿用统一API origin，默认使用公网服务。本项是数据查询；与估值同图时复用
[市场估值面板组件的绘图单元](../../convertible-bond-qmc/references/market.md#估值与价格动量同图)，不另建面板组件。

收益与回撤证据通过文档MCP读取`/docs/models/convertible-bond-valuation/momentum-experiments`，
投资判断参考[市场估值与配置价值](../../convertible-bond-qmc/analysis/market-valuation.md)。
