# 查询历史久期

执行：

```bash
python skills/hbmodelstore-query/models/bond-fund-duration/scripts/query.py history \
  --fund-code 000005.OF --start 2025-01-01 --end 2025-12-31
```

起止日期必填，结束日期不得早于开始日期；单次最长十年，`--limit` 最大 2,500。结果按
`model_date` 升序返回，并锁定当前发布的 Hybrid 和来源模型版本。

样本类型可能随报告生效而变化。`fallback_flag=true` 仍可能是有效 Hybrid 结果，但必须说明
使用了剩余有效组件重新归一化。空数组表示指定区间无当前版本结果。
