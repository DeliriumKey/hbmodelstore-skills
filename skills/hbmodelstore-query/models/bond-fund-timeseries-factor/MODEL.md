# 纯债基金时序多因子模型

| 项目 | 内容 |
| --- | --- |
| `model_key` | `bond-fund-timeseries-factor` |
| 当前登记版本 | `1.2.0` |
| 模型族 | 短窗风险暴露与 Alpha 选基 |
| 当前公开结果 | 日频 Hybrid 修正久期 |
| 用户入口 | hbmodelstore 统一公网 API |
| 最新模型资料 | 网页机器可读模型页，由 Agent 自动获取 |

## 使用顺序

1. 先读[功能支持](./references/capabilities.md)，确认需求是否已发布为公网 API。
2. 查询指定日期或最新日期的全部基金久期时读
   [修正久期截面](./references/modified-duration-cross-section.md)。
3. 查询一只或多只基金历史久期时读[修正久期历史](./references/duration-history.md)。
4. 查询利率债/信用债分支的中位数历史，或进一步拆分中长期/短期纯债类型时读
   [修正久期中位数](./references/modified-duration-median.md)。
5. 用户询问构建逻辑、因子选择、版本演进或消融实验时，执行：

```bash
python skills/hbmodelstore-query/scripts/client.py model-docs \
  --model-key bond-fund-timeseries-factor
```

   阅读命令返回的最新模型页后直接回答用户，不要求用户自己访问网页。
6. 需要确认响应字段语义时读[公开字段字典](./references/fields.md)。

## 核心解释边界

- 当前公网 API 只发布久期相关查询，尚未发布 Alpha 信号查询。
- `estimated_modified_duration` 是模型估计的修正久期，单位为年，不是定期报告披露值。
- 模型估计净值层面的利率风险敏感度，不还原逐券持仓、杠杆或完整现金流结构。
- 空结果表示当前发布版本在指定条件下无数据，不表示久期为零。
