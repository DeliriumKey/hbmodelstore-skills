# 历史汇总

使用初始基金代码查询最多40个半年期，默认按期末倒序返回。

```bash
python3 skills/hbmodelstore-query/models/fund-brinson-attribution/scripts/query.py \
  history --fund-code 040001.OF --limit 40
```

市场配置、行业配置、个股选择和残差与主动收益严格闭合。残差是真实基金收益与期初
静态持仓收益的差，包含交易、非股票资产、费用和持仓时点差异，不单独代表交易能力。
