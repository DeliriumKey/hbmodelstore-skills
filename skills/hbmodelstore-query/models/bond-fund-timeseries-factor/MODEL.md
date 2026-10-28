# 纯债基金时序多因子模型

`model_key`：`bond-fund-timeseries-factor`。工具参数以 MCP schema 为准。

## 面板组件

每个 Reference 的前三节说明计算口径、应用场景和不适用场景，与网页共用；
后半段给出查询和同源绘图操作。按任务选一个入口，不要求读完所有面板组件。

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

## 分析指引

涉及解读、比较、原因解释或判断时，按问题读取对应分析指引。
分析指引负责分析步骤和表达，不重复面板组件定义；只查数据或绘图可以不读。

| 分析任务 | 入口 |
| --- | --- |
| 研究纯债基金市场的久期水平、配置调整与分类差异 | [市场久期与配置变化](./analysis/market-duration-review.md) |
| 认识一只基金、比较候选或筛选基金，结合风险定位与收益优势形成判断 | [基金收益质量与风险比较](./analysis/fund-review.md) |

两个入口按研究对象区分，随用户问题选择依据和面板组件；分析指引不是固定的对话轮次或报告模板。
因子名称标识构建所用代理曲线，解读按其代表的经济风险展开；对应关系见
[因子的投资含义](./references/fields.md#因子的投资含义)。

## 方法文档

构建逻辑用 `get_doc(path="/docs/models/bond-fund-timeseries-factor/construction")`，
验证和消融实验用 `get_doc(path="/docs/models/bond-fund-timeseries-factor/model-validation")`；
`next_line` 非空时按需续读。

同源 Markdown：[模型构建](https://api.delirium.com.cn/llms.mdx/docs/models/bond-fund-timeseries-factor/construction/content.md)、
[模型验证](https://api.delirium.com.cn/llms.mdx/docs/models/bond-fund-timeseries-factor/model-validation/content.md)。
