# 功能支持

机器可读的唯一能力清单是 Skill 根目录的
[`capabilities.json`](../../../capabilities.json)。本页只给 Agent 一份快速分流表，不重复维护状态。

| 能力 | 数据命令 | 同款网页结果 |
| --- | --- | --- |
| 当前可查询基金搜索 | `query.py search-funds` | 基金输入候选 |
| 全局可用模型日 | `query.py model-dates` | Alpha 截面日期控件 |
| 修正久期截面 | `query.py cross-section` | 无 |
| 单基修正久期与因子暴露 | `query.py history` | `visualize.py all` |
| 报告披露久期 | `query.py disclosed-history` | 叠加在单基久期图 |
| 市场久期中位数与 IQR | `query.py median` | `visualize.py market-duration` |
| 单基 Alpha 历史 | `query.py alpha-history` | `visualize.py alpha-history`，也可读取现成 JSON |
| Alpha 截面排行 | `query.py alpha-cross-section` | `visualize.py alpha-cross-section` |

未登记为 `published` 的能力不得调用公网。当前不公开 60 日独立重估 Alpha、交易成本调整分数、
其他拟合诊断、任务状态和收益异动结果。不得用任意 SQL、全表下载或绕过分页上限替代缺失能力。
