# 纯债基金时序多因子模型

`model_key`：`bond-fund-timeseries-factor`

本页只负责能力路由。公开状态、网页预览和 renderer 由根目录
[`capabilities.json`](../../capabilities.json) 统一登记；参数、返回和边界只在对应 Reference
维护。

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

## 共同解释边界

- 修正久期和因子暴露是净值时序模型估计，不是逐券持仓、杠杆或现金流还原。
- Alpha 接口返回毛信号和原始排名；客户端混合权重只派生本次结果，不写回模型。
- 空结果表示当前条件没有已发布数据，不表示久期、暴露或 Alpha 为零。
- 构建逻辑、版本、验证和消融问题必须通过根 Skill 的 `model-docs` 工作流读取网页最新内容。
