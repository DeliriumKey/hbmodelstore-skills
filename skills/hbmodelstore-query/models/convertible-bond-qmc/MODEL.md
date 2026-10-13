# 转债拟蒙特卡洛定价与市场估值

模型标识 `convertible-bond-qmc`。使用 `get_convertible_qmc_info` 了解概况与实际覆盖日期。
不涉及基金份额解析。

构建、条款与结果含义用 `get_doc(path="/docs/models/convertible-bond-valuation/construction")`；
校准和收敛实验用 `get_doc(path="/docs/models/convertible-bond-valuation/model-validation")`。
按返回的章节定位，`next_line` 非空时续读。同源正文：[构建](https://api.delirium.com.cn/llms.mdx/docs/models/convertible-bond-valuation/construction/content.md)、[验证](https://api.delirium.com.cn/llms.mdx/docs/models/convertible-bond-valuation/model-validation/content.md)。

| 任务 | MCP 工具 |
| --- | --- |
| 模型概况与覆盖 | `get_convertible_qmc_info` |
| 可用模型日及券数 | `get_convertible_qmc_dates` |
| 单券理论价格历史 | `get_convertible_qmc_history` |
| 同日截面、搜索、排序与分页 | `get_convertible_qmc_cross_section` |
| 市场理论溢价率历史 | `get_convertible_qmc_market_history` |
| 低、中、高组理论溢价率历史 | `get_convertible_qmc_market_groups_history` |
| 指数期权校准的短期、长期波动率 | `get_convertible_qmc_market_volatility_history` |

涉及结果解读、比较、原因解释或判断时，读取对应 analysis；按问题选用，不要求完整复盘。
查询与字段见 [query.md](references/query.md)；涉及行业、个券或区间的估值解读时读
[行业与个券比较](analysis/valuation-review.md)，行业比较使用截面返回的正股行业映射。
本 Skill 读取已计算结果，不运行定价。

完整截面导出为 `cross-section.json` 后可离线生成交互网页：

```bash
python3 "$SKILL_DIR/models/convertible-bond-qmc/scripts/visualize.py" \
  --input cross-section.json --output pricing.html
```

与网页共用 renderer。优先在 Agent Harness 的侧边栏打开，20行分页、搜索与排序。
只导出了某一页时不会将它当成完整市场样本。

市场估值与波动率的查询、导出和绘图见 [market.md](references/market.md)；
涉及市场整体及高、中、低价组的估值水平与变化解读时读 [市场估值分析](analysis/market-valuation.md)。
市场估值与行业／个券比较是两个独立场景；需要图表时分别使用市场网页和个券网页，按当前问题决定是否组合。

## 成稿标题

总标题写明市场或个券与分析主题。章节使用固定主题名“市场估值”“行业比较”“重点个券”；专项区间比较使用“区间比较”。
以固定主题为前缀；本节有明确、重要的发现时，优先写成“主题：简短判断”，让标题直接提示发现，补充须有本节证据支持。
仅作背景介绍或结论复杂、不宜简短概括时，只保留主题；各节可混用两种形式，不为整齐而全部加或全部不加。
所有标题不加章节序号。措辞正式、简短，不用口语化比喻、口号、夸张判断或堆满细节的长句。
只固定主题名称，不固定段落、表格或篇幅；专项问题只保留相关章节，内容重复时合并到最贴切的主题，不凑齐栏目。
只问整体估值等简单问题时，沿用对应 analysis 的一段式回答，不为统一形式强行分节。
