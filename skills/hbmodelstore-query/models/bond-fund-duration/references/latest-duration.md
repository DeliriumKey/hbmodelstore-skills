# 查询最新久期

执行：

```bash
python skills/hbmodelstore-query/models/bond-fund-duration/scripts/query.py \
  latest --fund-code 000005.OF
```

`--fund-code` 可重复，接受六位代码或 `.OF` 后缀，最多 200 只。结果来自当前发布版本的
`latest_hybrid_duration` 稳定口径。

解释时至少保留基金代码、`model_date`、`sample_type`、`estimated_duration`、
`source_model_version`、`valid_flag` 和 `fallback_flag`。未找到记录不能回答为久期零。
