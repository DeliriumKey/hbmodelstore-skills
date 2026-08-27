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
python3 skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/query.py \
  alpha-history --fund-code 000032.OF --start 2025-01-01 --alpha-weight 0.75
```

## 返回

多基金结果合并到 `data.series`。每个历史点包含模型日期、基金分支、久期组、240 日 Alpha、
60 日残差状态、各自组内排名、隐含麦考利久期和长期 γ 暴露。正式样本仅含剔除定期开放基金
后的中长期纯债型基金。

## 可视化

```bash
python3 skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/visualize.py \
  alpha-history --fund-code 000032.OF --output 000032-alpha.html
```

默认绘制全部历史，也接受 `--start`、`--end`。HTML 与网页预览共同使用
`assets/alpha-history-renderer.mjs`，三图共享时间范围控制条。查询命令与绘图命令共同复用
`scripts/bond_fund_data.py` 的取数、字段校验和日期排序口径。

已有单基金 JSON 时可离线重绘，不再次请求 API：

```bash
python3 skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/visualize.py \
  alpha-history --input alpha-history.json --output 000032-alpha.html
```

`--input` 接受原始单基金 API 响应，或 `query.py alpha-history` 输出的单基金 `data.series`
封装；文件必须只包含一只基金。使用 `--input` 时不能再传 `--start`、`--end`。

## 边界

- Alpha 是毛信号；交易成本、组合约束和用户混合权重不是服务端模型字段。
- `combined_score` 只在显式传权重时由客户端派生，不写回数据库。
- 60 日独立重估 Alpha 不属于本能力。
- 空 `points` 或 `series` 不表示 Alpha 为零。
