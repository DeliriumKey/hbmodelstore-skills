# 单期明细

按基金代码和期末日期返回总归因、市场层、申万一级行业和基金实际持仓。
0.6.0市场层为A股/港股/转债/纯债，并追加 `convertible_bonds` 逐券结果；旧结果保留原市场层。
基金代码和名称统一采用当前身份；更名前的报告期不返回Wind历史身份后缀或旧名称。

```bash
python3 skills/hbmodelstore-query/models/fund-brinson-attribution/scripts/query.py \
  period --fund-code 040001.OF --period-end 2010-12-31
```

个股表保留是否进入归因和剔除原因。未进入归因不等于零持仓。行业口径按期初切换：
`2021-12-31`前为申万2014，自该日起为申万2021。

转债逐券明细包含正股代码、行业、历史回归β和四项绝对贡献。β不是定价Delta；
`terminal_proxy_applied`表示价格终止后用了指数续接，并非确认了真实赎回现金流。
市场最多4行，股票明细最多500行，转债明细最多1000行；不提供任意表查询。
