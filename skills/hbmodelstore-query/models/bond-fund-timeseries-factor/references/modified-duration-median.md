# 市场久期跟踪

## 计算口径

设模型日 $t$ 属于分组 $g$ 的有效基金集合为 $\mathcal F_{g,t}$，市场久期是组内修正久期的等权中位数：

$$
\widetilde D_{g,t}=\operatorname{median}
\left\{\widehat D^{\mathrm{Mod}}_{i,t}:i\in\mathcal F_{g,t}\right\}.
$$

同一基金集合的第25分位数、第75分位数与四分位距定义为：

$$
Q^{(p)}_{g,t}=\operatorname{quantile}_{p}
\left\{\widehat D^{\mathrm{Mod}}_{i,t}:i\in\mathcal F_{g,t}\right\},
\qquad p\in\{0.25,0.75\},
$$

$$
\operatorname{IQR}_{g,t}=Q^{(0.75)}_{g,t}-Q^{(0.25)}_{g,t}.
$$

每只基金等权参与分位数计算，缺失结果不按零值参与。每个细项直接在对应基金集合上计算，不对下一级分类的统计结果再次平均。

| 分类方式 | 可选细项 |
| --- | --- |
| 按持仓资产类型 | 利率债基金、信用债基金 |
| 按基金二级分类 | 中长期纯债、短期纯债 |
| 交叉分类 | 中长期纯债利率、中长期纯债信用、短期纯债信用 |

短期纯债利率债基金的样本量过少，不单独统计。基金所属分类使用模型日当时已经生效的最新报告信息，不使用未来数据回填。

披露久期中位数使用相同分类下的半年报和年报数据，按报告期对齐；历史时点分析以披露信息的可用日期判断当时能否使用。

## 应用场景

| 场景 | 使用方式 |
| --- | --- |
| 群体久期跟踪 | 观察纯债基金群体的典型久期水平、中枢变化和截面分散程度 |
| 分类比较 | 比较利率债基金、信用债基金以及中长期、短期纯债基金的久期差异 |
| 估计与披露对照 | 将日频模型中位数与半年报、年报披露中位数对照，识别两次披露之间的群体调整 |

## 不适用场景

| 场景 | 原因或替代方式 |
| --- | --- |
| 预测未来债市方向 | 现有利率债基金实验中，整体久期水平没有稳定的方向预测能力，近期久期变化也未通过短中期样本外验证 |
| 将 IQR 解释为观点分歧或拥挤 | IQR 只描述同组基金久期的截面分散程度，原因需要额外证据 |
| 用群体中位数代替单基金判断 | 中位数表示群体典型水平；单基金风险定位需查询其久期与因子暴露历史 |

## 查询与绘图

### 典型请求

- “画利率债基金过去五年的市场久期中位数和 IQR。”
- “比较中长期纯债与短期纯债的市场久期。”
- “查询中长期纯债信用债基金最近十年的历史。”

### 输入与默认值

- `--breakdown`：`sample-type`（默认）、`fund-invest-type` 或
  `sample-type-and-fund-type`。
- `--start`、`--end`：均省略时查询截至当天最近五年；最长十年。

```bash
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/query.py" \
  median --breakdown sample-type --start 2025-01-01 --end 2025-12-31
```

### 返回

每个 `series` 直接在对应基金集合上计算等权分位数，不对子组统计再次平均。日频 `points` 包含
Q25、中位数、Q75、IQR 与 `fund_count`；`disclosed_points` 包含半年报和年报披露中位数。
分类使用每个模型日当时生效的报告期信息，不用未来信息回填。

### 可视化

默认生成交互 HTML 并优先在当前 Agent Harness 的侧边栏打开；不支持预览时提供 HTML
文件或链接，静态图片仅按需导出。

```bash
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/visualize.py" \
  market-duration --input median.json --series rate --output market-rate.html
```

`--series` 支持 `rate`、`credit`、`long-term`、`short-term`、`long-term-rate`、
`long-term-credit`、`short-term-credit`。输入为相应 breakdown 的完整查询响应，离线绘图；
没有快照时可省略 `--input`，脚本自动查询对应 breakdown。复用
`assets/market-duration-renderer.mjs`。

比较不同日期或分组时同时查看 `fund_count`；缺失基金不以零参与。
