# 查询当前久期截面

查询共同日期的分布统计：

```bash
python skills/hbmodelstore-query/models/bond-fund-duration/scripts/query.py \
  cross-section --mode summary
```

查询指定样本类型的高久期名单：

```bash
python skills/hbmodelstore-query/models/bond-fund-duration/scripts/query.py cross-section \
  --mode high --sample-type 利率债基金 --limit 50
```

分布比较必须确认两类样本使用相同 `model_date`，并同时报告样本数量和回退数量。高久期名单
只表示当前净值回归久期较高，不表示未来收益更高或基金经理利率判断更准确。
