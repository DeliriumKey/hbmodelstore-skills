# 全局可用模型日

## 功能

返回某类结果当前可以直接查询的全部真实模型日，用于日期控件、精确截面查询和防止按交易日历
猜测日期。

## 典型请求

- “Alpha 哪些日期有结果？”
- “修正久期截面最早和最新模型日是什么？”

## 输入与默认值

`--result-type` 必填，取 `modified-duration` 或 `alpha`。

```bash
python3 skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/query.py \
  model-dates --result-type alpha
```

## 返回

`dates` 按升序排列，可直接传给对应截面命令的 `--date`。日期来自结果发布事务，不按交易日历
推算。

## 可视化

不单独作图；网页 Alpha 截面日历只启用这里返回的日期。

## 边界

空列表表示该结果类型当前没有已发布模型日，不应自行补交易日或回退日期。
