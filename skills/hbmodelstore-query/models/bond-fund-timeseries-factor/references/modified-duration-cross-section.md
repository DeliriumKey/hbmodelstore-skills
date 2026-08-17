# 查询修正久期截面

查询指定模型日期的全部基金：

```bash
python skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/query.py \
  cross-section --date 2025-01-02
```

省略 `--date` 时查询共同最新模型日期。指定日期按精确模型日期匹配；没有已发布结果时返回空
`rows`，不要自动改用前一个交易日。响应基金代码统一带大写 `.OF` 后缀。

需要排名、分位数或自定义基金池时，在完整截面响应上本地计算，不调用旧统计或高久期名单路由。
