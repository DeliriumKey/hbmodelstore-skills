# 单基 Alpha 历史

## 计算口径

正式样本是剔除定期开放基金后的中长期纯债型基金。240 日模型联合估计风险暴露与日频毛 Alpha，并将 Alpha 年化，
并在冻结该长期风险暴露后计算近 60 日平均残差状态。后者用于观察近期变化，不是独立重估的短期 Alpha。

隐含麦考利久期由 240 日期限暴露计算，用于在同一基金分支内形成五分位久期组。
`alpha_rank` 和 `recent_state_rank` 分别是同日、同分支、同久期组内的 240 日 Alpha 和 60 日状态百分位，数值越高排名越靠前。
久期组会随基金久期和同类截面变化，不是基金的固定属性。

长期利差暴露使用代表性曲线作为代理：二级资本债因子可共同反映银行二级资本债和永续债的风险，
AAA、AA＋中短期票据因子可反映产业债、城投债等信用资产的共同利差风险。
模型未单设永续债或城投债因子，具体资产配置由持仓材料进一步识别。

## 应用场景

| 场景 | 使用方式 |
| --- | --- |
| 跟踪风险调整后的收益优势 | 结合 240 日毛 Alpha 与同组排名，观察长期增值水平及其相对位置 |
| 识别近期阶段变化 | 将 60 日冻结暴露残差状态与长期 Alpha 并列，判断近期优势是延续、修复还是减弱 |
| 结合风险结构理解 Alpha | 通过隐含久期和长期利差暴露，识别 Alpha 出现时的配置背景 |

## 不适用场景

| 场景 | 原因或替代方式 |
| --- | --- |
| 将 Alpha 解释为未来收益承诺 | Alpha 是模型因子体系下的历史风险调整后毛收益估计 |
| 跨分支或跨久期组直接比较排名 | 两类排名均在同分支、同久期组内计算，组间数值不是同一比较总体 |
| 将 60 日状态当作独立短期 Alpha | 60 日值固定长期风险暴露后计算，不是重新联合估计的 Alpha |
| 将暴露变化直接写成收益来源分解 | 暴露描述风险结构；要识别收益贡献还需要因子收益等额外证据 |
| 将毛 Alpha 直接当作可投组合收益 | 毛 Alpha 未扣除交易费用，也未纳入组合约束 |

## 查询与绘图

### 典型请求

- “查易方达信用债A全部 Alpha 历史。”
- “画 000032.OF 的 Alpha 信号、久期状态和利差暴露三图。”
- “比较两只基金 2025 年以来的 240 日和 60 日排名。”

### 输入与默认值

- `--fund-code`：初始基金代码，最多 20 只。
- `--start`、`--end`：可分别省略；均省略时返回全部已发布历史。
- `--alpha-weight`：可选，0 至 1；仅在客户端派生 `combined_score`。未传时保留原始响应。

```bash
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/query.py" \
  alpha-history --fund-code 000032.OF --start 2025-01-01 --alpha-weight 0.75
```

### 返回

多基金结果合并到 `data.series`。每个历史点包含模型日期、基金分支、久期组、240 日 Alpha、
60 日残差状态、各自组内排名、隐含麦考利久期和长期 γ 暴露。正式样本仅含剔除定期开放基金
后的中长期纯债型基金。字段含义见[字段字典](./fields.md#alpha-历史与截面)。
久期组随基金久期和同类截面变化，不是固定属性。

### 可视化

推荐生成交互 HTML，并在当前 Agent Harness 的侧边栏打开，保留三图联动。
不能侧边预览时提供 HTML 文件或链接；只有明确要求时再导出静态图片。

```bash
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/visualize.py" \
  alpha-history --fund-code 000032.OF --output 000032-alpha.html
```

默认绘制全部历史，也接受 `--start`、`--end`。HTML 与网页预览共同使用
`assets/alpha-history-renderer.mjs`，三图光标联动。查询命令与绘图命令共同复用
`scripts/bond_fund_data.py` 的取数、字段校验和日期排序口径。

已有单基金 JSON 时可离线重绘，不再次请求 API：

```bash
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/visualize.py" \
  alpha-history --input alpha-history.json --output 000032-alpha.html
```

`--input` 接受完整 MCP 响应、原始单基金 API 响应，或 `query.py alpha-history` 输出的单基金 `data.series`
封装；文件必须只包含一只基金。使用 `--input` 时不能再传 `--start`、`--end`。

`combined_score` 只在显式传权重时由客户端派生，不写回数据库。
空 `points` 或 `series` 表示当前条件没有已发布结果，不表示 Alpha 为零。
