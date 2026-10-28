# Alpha 与收益表现面板组件

## 计算口径

单基历史读取指定初始份额已经计算的模型日结果。每个模型日使用252个中国交易日窗口，至少240个有效观测，
对基金超额收益做带截距的显式多因子回归。图中年化 Alpha 为日截距乘252，252日收益为
`NAV[t] / NAV[t-252] - 1`，两者均以百分比展示。

同类按每个模型日的基金分类、模型版本和回归规格确定，包含目标基金。同类比较使用该日样本的
Alpha 中位数、第25至75分位区间及目标基金的分位数。分位数越高表示 Alpha 越高，并列值取所在位置的中点。

## 应用场景

观察单只基金 Alpha 的水平、变化与持续性，结合同期252日收益，区分回归截距与实际滚动表现。
通过同类区间与分位数，判断 Alpha 的变化是同类普遍变化，还是基金相对位置发生了改变。
需要解释收益变化时，再联用[风格与因子暴露](https://api.delirium.com.cn/docs/models/equity-fund-timeseries-factor/style-map)查看因子暴露。

## 不适用场景

年化 Alpha 是滚动回归截距的年化值，不是区间累计收益或未来收益承诺。
同类25%–75%区间描述基金间的分布，不是单基金 Alpha 的置信区间。
相邻252日收益的窗口重叠且分母变化，不能拼成净值或据此计算组合回撤。

## 查询与绘图

名称先用 `search_funds` 定位，再用 `resolve_fund` 取得初始代码。带 `!1` 等历史后缀时保留完整身份。
调用 `get_equity_factor_history` 和 `get_equity_factor_alpha_peer_history`，使用同一初始代码和日期区间，
固定 `end`，按 `next_start` 续读。合并各页后，将 Alpha 同类响应放入历史响应的 `alpha_peer_history` 字段。
同类历史由服务端预计算，直接读取即可。批量保存完整组件数据也可用查询脚本一次完成，随后使用同源绘图入口：

```bash
python3 "$SKILL_DIR/models/equity-fund-timeseries-factor/scripts/query.py" history \
  --fund-code INITIAL_CODE --with-alpha-peers --output history.json
python3 "$SKILL_DIR/models/equity-fund-timeseries-factor/scripts/visualize.py" \
  --input history.json --output alpha.html
```

默认输出两张图；旧历史 JSON 未附同类数据时仍可绘制收益图。
单图可以独立调用：`--chart alpha` 只画 Alpha，`--chart return` 只画252日收益；
`--chart alpha-peer` 只画同类比较，可用 `--mode percentile` 初始化为分位数。
网页与离线输出共用 `assets/equity-renderer.mjs` 的 `equityPerformanceOption` 和 `equityAlphaPeerOption`。
PNG 导出选择 `[data-hb-chart="equity-performance"]` 或 `[data-hb-chart="equity-alpha-peer"]`，
独立收益单图分别为 `equity-alpha_annual`、`equity-return_252`。

最新四因子同类分位定位仍保留为独立绘图单元：取历史末日的 `get_equity_factor_comparison`，保存为
`comparison.json`，使用 `--chart style-position --comparison comparison.json` 单独绘制，不附加到 Alpha 组件。

需要解释表现时读取[Alpha 表现解读](../analysis/fund-review.md)。已有完整结果可直接复用。
