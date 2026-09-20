# 纯债基金时序多因子模型

`model_key`：`bond-fund-timeseries-factor`

本页只负责能力路由。公开状态、网页预览和 renderer 由根目录
[`capabilities.json`](../../capabilities.json) 统一登记；参数、返回和边界只在对应 Reference
维护。

普通查数调用能力清单中的 MCP 工具。下文 Reference 的 `--参数`、多基金封装和
`data.series` 属于本地文件脚本；MCP 按自身 schema 返回原始单基金 API 对象。
加权得分、完整 JSON 落盘与绘图仍用已有本地脚本，不从可能被截断的工具文本重建数据。

| 用户意图 | 能力 ID | Reference |
| --- | --- | --- |
| 搜索最近模型日在近两年内的基金 | `fund-resolution` | [基金搜索与主份额解析](../fund-reference/references/fund-search.md) |
| 枚举真实可用模型日 | `bond-fund-model-dates` | [全局可用模型日](./references/model-dates.md) |
| 查询修正久期截面 | `bond-fund-duration-cross-section` | [修正久期截面](./references/modified-duration-cross-section.md) |
| 查询单基久期、期限和利差暴露，或生成三图 | `bond-fund-duration-history` | [单基久期测算](./references/duration-history.md) |
| 查询报告披露久期 | `bond-fund-disclosed-duration-history` | [历史披露久期](./references/disclosed-duration-history.md) |
| 查询或绘制市场久期中位数与 IQR | `bond-fund-market-duration` | [市场久期跟踪](./references/modified-duration-median.md) |
| 查询或绘制单基 Alpha 历史 | `bond-fund-alpha-history` | [单基 Alpha 历史](./references/alpha-history.md) |
| 查询 Alpha 截面并派生组合得分 | `bond-fund-alpha-cross-section` | [Alpha 截面排行](./references/alpha-cross-section.md) |

字段语义集中在[公开字段字典](./references/fields.md)，不要从物理表名、内部诊断字段或生产任务
反推公开合约。

## 文字分析（按需读取）

仅在用户要求分析或解读时读取；纯查数与绘图不自动启动完整分析。

| 分析任务 | 入口 |
| --- | --- |
| 复盘久期变化、同类差异与整体风险定位 | [久期与风险暴露复盘](./analysis/duration-exposure-review.md) |

## 共同解释边界

- 修正久期和因子暴露是净值时序模型估计，不是逐券持仓、杠杆或现金流还原。
- Alpha 接口返回毛信号和原始排名；客户端混合权重只派生本次结果，不写回模型。
- 不提供 60 日独立重估 Alpha、扣费后信号或内部拟合诊断。`alpha_rank` 和
  `recent_state_rank` 是同分支、同久期组内的 0–1 百分位，数值越高排名越靠前。
- 空结果表示当前条件没有已发布数据，不表示久期、暴露或 Alpha 为零。
- 字段与计算说明直接读本模型 Reference；构建逻辑、验证和消融用文档 MCP 的
  `search_docs` → `get_doc`，具体参数见根 Skill 的“方法与更新”。
