# 单期明细

按基金代码和期末日期返回总归因、A股/港股/剩余资产市场层、申万一级行业和基金实际持仓。

```bash
python3 skills/hbmodelstore-query/models/fund-brinson-attribution/scripts/query.py \
  period --fund-code 040001.OF --period-end 2010-06-30
```

个股表保留是否进入归因和剔除原因。未进入归因不等于零持仓。行业口径按期初切换：
`2021-12-31`前为申万2014，自该日起为申万2021。
