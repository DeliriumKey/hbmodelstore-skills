# 百元溢价率

模型标识：`convertible-bond-premium`。属于转债估值板块，不涉及基金代码或份额解析。
模型构建与指标解释用 `get_doc(path="/docs/models/convertible-bond-valuation/construction")`，
筛选和回归结构实验用 `get_doc(path="/docs/models/convertible-bond-valuation/model-validation")`。
`next_line` 非空时续读。同源正文：[构建](https://api.delirium.com.cn/llms.mdx/docs/models/convertible-bond-valuation/construction/content.md)、[验证](https://api.delirium.com.cn/llms.mdx/docs/models/convertible-bond-valuation/model-validation/content.md)。

| 任务 | MCP 工具 | 说明 |
| --- | --- | --- |
| 模型介绍与用途 | `get_convertible_premium_info` | 返回定义、方法、用途、边界与真实可查询区间 |
| 历史估值变化 | `get_convertible_premium_history` | 默认最近三年，可指定 start/end，单次最多3660自然日 |
| 单日拟合情况 | `get_convertible_premium_curve` | model_date 可省略，返回最新日；指定日期不自动回退 |

例如：“查询最新百元溢价率，比较它在近三年的历史位置，并解释适用场景。”
先读模型信息，再查历史；历史分位按该区间中不高于当前值的观测占比计算，注明区间。

字段见 [fields.md](references/fields.md)。涉及估值解读、比较或判断时，参考
[市场估值分析](../convertible-bond-qmc/analysis/market-valuation.md)中的相关口径，不要求完整复盘。
仅解读百元溢价率时使用其历史位置与走势，不为读取该文档补齐 QMC 数据；综合市场分析中作为对照，不单设 analysis。

## 交互网页

将 `get_convertible_premium_history` 的完整结果导出为 `history.json`，然后离线生成：

```bash
python3 "$SKILL_DIR/models/convertible-bond-premium/scripts/visualize.py" \
  --input history.json --output premium.html
```

优先在当前 Agent 的侧边栏打开 HTML。历史区间、分位与模型日期均可切换；
历史图的红线为百元溢价率（左轴），灰色面积为最终拟合券数（右轴），与网页共享渲染器。
Skill 另保留单日拟合曲线，直接读取已发布系数，不重新访问 API 或回归。
