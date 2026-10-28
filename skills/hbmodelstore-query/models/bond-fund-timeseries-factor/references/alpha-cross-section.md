# Alpha 截面排行

## 计算口径

正式样本是剔除定期开放基金后的中长期纯债型基金。在同一真实模型日内，先按基金分支区分利率债基金和信用债基金，
再按 240 日模型的隐含麦考利久期形成五个久期比较组。`alpha_rank` 与 `recent_state_rank` 分别是同分支、同久期组内的
240 日毛 Alpha 和冻结长期暴露后 60 日残差状态百分位，数值越高排名越靠前。

混合得分为 `alpha_weight × alpha_rank + (1 - alpha_weight) × recent_state_rank`，
默认将长期 Alpha 与近期状态按 75%/25% 加权。权重决定两项信号对排序的影响。

长期利差暴露包括政金债、二级资本债、AAA与AA＋中短期票据代理因子，并分别计算同组分位。
二级资本债因子代表的银行资本债相关风险可包含银行永续债的共同波动；中短期票据因子代表的
信用利差风险可来自产业债、城投债等资产。模型未单设永续债或城投债因子，
这些分位用于比较共同风险敏感性，细分资产配置由持仓材料进一步识别。
分位按同日、同分支、同久期组的各因子非空样本分别计算，并列使用平均名次；空因子不参与排名。

## 应用场景

| 场景 | 使用方式 |
| --- | --- |
| 在相近风险特征下比较基金 | 在同分支、同久期组内按 240 日 Alpha 和 60 日近期状态查找研究候选 |
| 比较长短期信号的影响 | 比较不同权重下的排名，辨认基金优势更偏长期积累还是近期改善 |
| 比较同组风险暴露 | 结合四类长期利差暴露分位，理解排名靠前基金的风险配置背景 |

## 不适用场景

| 场景 | 原因或替代方式 |
| --- | --- |
| 将截面排名当作未来收益排名 | 排名衡量模型因子体系下的历史风险调整后毛收益与近期状态，不是未来收益承诺 |
| 跨分支或跨久期组直接比较排名 | 原始百分位的比较总体是同日、同分支、同久期组 |
| 将利差暴露分位解释为业绩或持仓比例 | 分位表示长期风险暴露在同组中的相对位置，不是业绩排名或逐券持仓还原 |
| 将排名直接当作可投组合 | 排名未纳入交易成本和组合约束 |

## 查询与绘图

### 典型请求

- “看最新模型日利率债基金 Q3 的 Alpha 排名。”
- “240 日和 60 日按 75/25 打分，给我完整排行。”
- “把 2026-08-24 信用债基金 Q5 结果做成交互 HTML。”

### 输入与默认值

- `--date`：可省略；省略时查询最新模型日。需要列日期时先用 `model-dates`。
- `--sample-type`：可选 `rate` 或 `credit`；不传时返回两个分支。
- `--duration-bucket`：可选 1 至 5；不传时返回全部久期组。
- `--alpha-weight`：可选 0 至 1；近期状态权重自动取 `1 - alpha_weight`。

```bash
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/query.py" \
  alpha-cross-section --date 2026-08-24 --sample-type rate \
  --duration-bucket 3 --alpha-weight 0.75
```

### 返回

服务端返回毛 Alpha、60 日残差状态、隐含麦考利久期、久期组、原始排名，以及四类长期利差暴露和同组分位。显式传权重时，脚本
增加 `derived_score_weights` 与 `combined_score`；相同得分排序时用基金代码稳定打破并列。
混合得分由客户端派生，不是接口原始字段，也不写回数据库。

### 可视化

默认生成交互 HTML 并优先在当前 Agent Harness 的侧边栏打开，保留权重、排序和分页操作；
不支持预览时提供 HTML 文件或链接，不默认输出静态图片。

```bash
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/visualize.py" \
  alpha-cross-section --input cross-section.json --sample-type rate \
  --duration-bucket 3 --alpha-weight 0.75 --output alpha-ranking.html
```

HTML 提供网页预览同口径的五档权重（100%/0%、75%/25%、50%/50%、25%/75%、0%/100%）、数值列排序和分页表，核心评分与格式化逻辑复用
`assets/alpha-cross-section-renderer.mjs`。
`--input` 接收完整 MCP、API 或 CLI 导出；省略时保留按 `--date` 在线查询的便捷入口。

不传 `sample-type` 或 `duration-bucket` 是合法的完整截面查询。
空 `rows` 表示当前日期或筛选条件没有已发布结果，不表示 Alpha 为零。
