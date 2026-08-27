# 历史披露久期

## 功能

查询单只模型样本基金在半年报和年报披露的组合久期，用于与模型估计结果做稀疏时点核对。

## 典型请求

- “查 000005.OF 历年半年报和年报披露久期。”
- “只看 2021 年中到 2025 年末的披露值。”

## 输入与默认值

只接受一只初始基金代码。`--start`、`--end` 是报告期闭区间，均可省略。

```bash
python3 skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/query.py \
  disclosed-history --fund-code 000005.OF --start 2021-06-30 --end 2025-12-31
```

## 返回

返回按 `report_date` 升序的稀疏 `points`。`available_date` 使用保守防前视规则：半年报从当年
9 月 1 日起可用，年报从次年 4 月 1 日起可用。

## 可视化

本能力不单独生成图。`visualize.py duration` 与 `visualize.py all` 会自动调用它，并把披露值以
蓝色离散点叠加在日频模型估计曲线上。

## 边界

- 只收录各报告期进入本模型样本的基金。
- 不把半年报、年报观测补齐或连接成日频线。
- 空 `points` 表示没有可用披露观测，不表示久期为零。
