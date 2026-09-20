# 市场久期跟踪

## 功能

按基金二级分类、持仓资产类型或交叉分类查询修正久期 Q25、中位数、Q75、IQR 和报告期披露
中位数，并生成与网页预览同源的交互图。

## 典型请求

- “画利率债基金过去五年的市场久期中位数和 IQR。”
- “比较中长期纯债与短期纯债的市场久期。”
- “查询中长期纯债信用债基金最近十年的历史。”

## 输入与默认值

- `--breakdown`：`sample-type`（默认）、`fund-invest-type` 或
  `sample-type-and-fund-type`。
- `--start`、`--end`：均省略时查询截至当天最近五年；最长十年。

```bash
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/query.py" \
  median --breakdown sample-type --start 2025-01-01 --end 2025-12-31
```

## 返回

每个 `series` 直接在对应基金集合上计算等权分位数，不对子组统计再次平均。日频 `points` 包含
Q25、中位数、Q75、IQR 与 `fund_count`；`disclosed_points` 包含半年报和年报披露中位数。
分类使用每个模型日当时生效的报告期信息，不用未来信息回填。

## 可视化

默认生成交互 HTML 并优先在当前 Agent Harness 的侧边栏打开；不支持预览时提供 HTML
文件或链接，静态图片仅按需导出。

```bash
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/visualize.py" \
  market-duration --series rate --output market-rate.html
```

`--series` 支持 `rate`、`credit`、`long-term`、`short-term`、`long-term-rate`、
`long-term-credit`、`short-term-credit`。脚本自动选择对应 breakdown，并复用
`assets/market-duration-renderer.mjs`。

## 边界

- 比较不同日期或分组时同时查看 `fund_count`；缺失基金不以零参与。
- IQR 只描述同组基金久期的截面分散程度，不直接解释为观点分歧、拥挤或预测信号。

## 统计口径

设模型日 $t$ 属于分组 $g$ 的有效基金集合为 $\mathcal F_{g,t}$，市场久期定义为组内修正久期的等权中位数：

$$
\widetilde D_{g,t}
=
\operatorname{median}
\left\{
\widehat D^{\mathrm{Mod}}_{i,t}:i\in\mathcal F_{g,t}
\right\}.
$$

同一基金集合的第25分位数、第75分位数与四分位距定义为：

$$
Q^{(p)}_{g,t}
=
\operatorname{quantile}_{p}
\left\{
\widehat D^{\mathrm{Mod}}_{i,t}:i\in\mathcal F_{g,t}
\right\},
\qquad p\in\{0.25,0.75\},
$$

$$
\operatorname{IQR}_{g,t}
=
Q^{(0.75)}_{g,t}-Q^{(0.25)}_{g,t}.
$$

每只基金等权参与分位数计算，缺失结果不按零值参与。每个细项直接在对应基金集合上计算，不对下一级分类的统计结果再次平均。

| 分类方式 | 可选细项 |
| --- | --- |
| 按持仓资产类型 | 利率债基金、信用债基金 |
| 按基金二级分类 | 中长期纯债、短期纯债 |
| 交叉分类 | 中长期纯债利率、中长期纯债信用、短期纯债信用 |

短期纯债利率债基金的样本量过少，不单独统计。基金所属分类使用模型日当时已经生效的最新报告信息，不使用未来数据回填。

## 历史序列与图表

市场久期随单基模型结果按交易日更新。红线为所选基金群体的日频修正久期中位数，蓝点为相同分类下半年报和年报披露久期的中位数，右轴灰色面积为日频修正久期四分位距。模型结果与报告期披露结果均保留参与计算的基金数量。

| 图中内容 | 对应的统计结果 |
| --- | --- |
| 模型中位数红线 | 每个模型日有效基金修正久期的等权中位数 |
| 报告期披露中位数蓝点 | 相同分类下基金定期报告披露久期的等权中位数 |
| 久期分散度灰色面积 | 第75分位数与第25分位数之差，使用右侧副轴 |
| 分类选项 | 决定每个日期参与统计的基金集合 |

蓝点按报告期日期绘制，用于比较模型估计与报告披露结果。接口同时返回披露结果的可用日期；进行历史时点分析时，应以可用日期判断当时能否使用该项披露信息。四分位距用于描述同一分类内部的久期分散程度，不直接代表基金经理观点分歧或市场拥挤程度。
