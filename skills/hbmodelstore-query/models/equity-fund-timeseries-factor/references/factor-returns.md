# 市场因子表现

## 计算口径

使用含权基金时序多因子回归实际采用的日收益序列。市场、信用债和转债因子分别为对应市场组合或指数收益减无风险收益；规模为小盘减大盘，价值为高 EP 减低 EP，动量为赢家减输家。

累计因子收益在所选区间的首个有效日期归零，将其后各日因子收益逐日加总。区间因子收益对应曲线终点，保留正负方向。规模为正表示小盘占优，价值为正表示价值占优，动量为正表示前期赢家占优。

六条序列使用相同日期区间，收益值直接以百分比展示。因子收益表示市场环境，基金因子暴露则是回归系数，两者是不同指标。

## 应用场景

比较近期哪些因子提供了正向回报，哪些出现回落；结合历史走势观察风格占优阶段与轮换。分析基金表现时，可将对应阶段的因子收益与基金暴露配合阅读，区分市场风格变化和基金自身的暴露调整。

## 不适用场景

因子收益加总不等于可直接投资的组合净值，也不直接代表某只基金的收益贡献。基金归因还需要对应期间的暴露及回归结果；不同因子的波动水平不同，收益高低本身不表示风险调整后的优劣。

## 查询与绘图

调用 `get_equity_factor_returns` 获取日度序列，沿 `next_start` 读取至 `has_more=false`。
生成可切换区间的面板时，读取截至本轮讨论末日的完整历史，不把讨论起日作为查询 `start`。
绘图命令的 `--start`、`--end` 只设置初始展示区间，完整数据仍留在 HTML 中，近一年、近三年和全部可直接切换。
未指定展示区间时默认近一年。API 的 `start`、`end` 继续用于按范围取数，按需计算与面板展示分别选择。

```bash
python3 "$SKILL_DIR/models/equity-fund-timeseries-factor/scripts/query_factor_returns.py" --output factor-returns.json
python3 "$SKILL_DIR/models/equity-fund-timeseries-factor/scripts/visualize_factor_returns.py" --input factor-returns.json --output factor-returns.html
```

网页和 HTML 共用 `assets/factor-returns.mjs`。`--chart history`、`--chart period` 可独立调用累计收益和区间比较绘图单元。
分析只取完成分页的数据；保留真实日期和模型规格，不把基金暴露当成因子收益。
