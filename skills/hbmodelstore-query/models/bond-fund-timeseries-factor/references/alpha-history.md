# 单基 Alpha 历史

## 功能

查询一只或多只基金的 240 日毛 Alpha、冻结长期风险暴露后的 60 日残差状态、同组排名、隐含
麦考利久期和长期利差暴露。单基金可生成 Alpha 信号、长期久期状态、长期利差暴露三张联动图。

## 典型请求

- “查易方达信用债A全部 Alpha 历史。”
- “画 000032.OF 的 Alpha 信号、久期状态和利差暴露三图。”
- “比较两只基金 2025 年以来的 240 日和 60 日排名。”

## 输入与默认值

- `--fund-code`：初始基金代码，最多 20 只。
- `--start`、`--end`：可分别省略；均省略时返回全部已发布历史。
- `--alpha-weight`：可选，0 至 1；仅在客户端派生 `combined_score`。未传时保留原始响应。

```bash
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/query.py" \
  alpha-history --fund-code 000032.OF --start 2025-01-01 --alpha-weight 0.75
```

## 返回

多基金结果合并到 `data.series`。每个历史点包含模型日期、基金分支、久期组、240 日 Alpha、
60 日残差状态、各自组内排名、隐含麦考利久期和长期 γ 暴露。正式样本仅含剔除定期开放基金
后的中长期纯债型基金。

## 可视化

推荐生成交互 HTML，并在当前 Agent Harness 的侧边栏打开，保留三图联动。
不能侧边预览时提供 HTML 文件或链接；只有明确要求时再导出静态图片。

```bash
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/visualize.py" \
  alpha-history --fund-code 000032.OF --output 000032-alpha.html
```

默认绘制全部历史，也接受 `--start`、`--end`。HTML 与网页预览共同使用
`assets/alpha-history-renderer.mjs`，三图共享时间范围控制条。查询命令与绘图命令共同复用
`scripts/bond_fund_data.py` 的取数、字段校验和日期排序口径。

已有单基金 JSON 时可离线重绘，不再次请求 API：

```bash
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/visualize.py" \
  alpha-history --input alpha-history.json --output 000032-alpha.html
```

`--input` 接受原始单基金 API 响应，或 `query.py alpha-history` 输出的单基金 `data.series`
封装；文件必须只包含一只基金。使用 `--input` 时不能再传 `--start`、`--end`。

## 边界

- Alpha 是毛信号；交易成本、组合约束和用户混合权重不是服务端模型字段。
- `combined_score` 只在显式传权重时由客户端派生，不写回数据库。
- 60 日独立重估 Alpha 不属于本能力。
- 空 `points` 或 `series` 不表示 Alpha 为零。

## 返回内容

| 字段 | 含义 |
| --- | --- |
| 240日长期Alpha | 长窗口联合估计风险暴露后的日均未解释收益及其年化值 |
| 60日冻结暴露残差 | 固定长期风险暴露后，近60日平均未解释收益 |
| 隐含麦考利久期 | 使用240日期限暴露计算，用于形成久期比较组 |
| 久期组 | 同一基金分支内按隐含久期形成的五分位比较组 |
| 240日排名 | 同一基金分支、同一久期组内的长期Alpha百分位排名 |
| 60日排名 | 同一基金分支、同一久期组内的近期状态百分位排名 |

历史查询的起止日期均可省略，默认返回基金的全部已发布Alpha记录。久期组会随基金久期和同类基金截面变化，不是基金的固定属性。

## 使用边界

Alpha结果是模型因子体系下的风险调整后收益估计，不代表基金未来收益承诺。跨基金比较应在相同基金分支和久期组内进行。交易成本、组合约束和用户自定义混合权重不属于接口原始结果。
