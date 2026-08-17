# 查询分组修正久期中位数历史

默认按利率债基金和信用债基金模型分支返回两组中位数序列：

```bash
python skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/query.py median \
  --start 2025-01-01 --end 2025-12-31
```

进一步拆分中长期纯债型基金和短期纯债型基金：

```bash
python skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/query.py median \
  --breakdown sample-type-and-fund-type \
  --start 2025-01-01 --end 2025-12-31
```

`--start` 和 `--end` 均可省略；默认查询截至当天的最近五年，最长查询十年。两种口径都只纳入
`中长期纯债型基金` 和 `短期纯债型基金`，并使用每个模型日当时生效的报告期分类，不用未来信息
回填。

中位数按当日有效基金等权计算，不按基金规模加权。解释不同日期或不同分组的变化时必须同时查看
`fund_count`；当日缺失的基金不以零值参与计算。
