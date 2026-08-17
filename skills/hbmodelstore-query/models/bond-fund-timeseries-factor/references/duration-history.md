# 查询一只或多只基金修正久期历史

查询全部历史：

```bash
python skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/query.py history \
  --fund-code 000005.OF
```

按日期范围查询：

```bash
python skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/query.py history \
  --fund-code 000005,000015.OF --start 2025-01-01 --end 2025-12-31
```

`--start` 和 `--end` 均可省略，只提供一端时查询到另一侧全部已发布历史；同时提供时使用闭区间，
且结束日期不得早于起始日期。`--fund-code` 接受一个或多个基金代码，多个代码使用英文逗号分隔；
每个代码均可省略 `.OF` 后缀，重复代码会被合并，响应统一带大写 `.OF` 后缀。

客户端按基金逐个调用有界历史接口，并将结果合并到 `data.series`。任一基金请求失败时命令返回
失败，不输出不完整的成功结果。每个 `series[]` 元素对应一只基金；空 `points` 不表示久期为零，
缺失交易日不补齐。
