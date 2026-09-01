# 净值对比

返回单个半年期内基金复权净值指数和复合基准净值指数，起点均为1。

```bash
python3 skills/hbmodelstore-query/models/fund-brinson-attribution/scripts/query.py \
  nav --fund-code 040001.OF --period-end 2010-06-30
```

复合基准由中证800、中证港股通综合人民币指数和中证全债组成，权重使用期初及此前最近
12个非空季度股票/港股仓位均值。它是模型解释基准，不是合同业绩比较基准。
