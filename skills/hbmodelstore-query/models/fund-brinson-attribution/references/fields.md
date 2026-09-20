# 分析所需字段映射

这里维护接口到分析的映射，不替代网页模型方法。数值通常以十进制字符串返回；收益为小数，
展示收益率乘 100 后用 `%`，展示归因贡献乘 100 后用百分点 `pp`。`null` 不等于 0。

## 基金层：只加同一层不重叠的贡献

| 字段 | 分析含义 / 使用方式 |
| --- | --- |
| `fund_return / benchmark_return / fitted_portfolio_return` | 实际、官方复合基准、持仓拟合的半年收益 |
| `active_return` | 实际减基准的算术差，不是净值比值 |
| `market_allocation_effect` | **四资产配置合计**，已包括转债与纯债配置 |
| `industry_allocation_effect / security_selection_effect` | 股票市场内行业配置 / 股票选择合计 |
| `convertible_bond_industry_allocation_effect` | 转债正股行业配置 |
| `convertible_bond_stock_selection_contribution` | 转债正股选择；注意不是下方 `selection_effect` |
| `convertible_bond_other_excess_effect` | 转债其他超额 |
| `residual_effect` | 最终残差 = `fit_residual + benchmark_bridge` |

以上四资产配置、股票两项、转债三项和最终残差共 **7 项**闭合到 `active_return`。

- `convertible_bond_allocation_effect / pure_bond_allocation_effect` 是配置合计的子项，不额外加。
- `convertible_bond_selection_effect` 是转债行业、正股选择、其他超额的**合计**，不能再与三项相加。
- `hk_selection_effect` 是股票选择的子项，不重复加。
- `allocation_effect / selection_effect` 是兼容合计：前者包括四资产和股票行业配置，后者包括
  股票与转债选择；不能与上表分项重复相加。
- `fit_residual = fund_return - fitted_portfolio_return`；`benchmark_bridge` 是成分篮子相对官方
  指数的差额。展示诊断时可拆，但不得连同 `residual_effect` 三项一起加。

## 明细层

- `markets`：四资产的权重、收益、配置/行业/选择/其他和 `active_contribution`。
  转债行的 `allocation_effect / industry_allocation_effect / selection_effect / other_effect`
  分别是仓位配置、正股行业配置、正股选择、其他超额；不要与基金层的同名合计混用。
- `industries`：按 `market_code + industry_standard + industry_code` 识别，`active_contribution`
  是股票行业配置与选择之和。不要把市场内权重当作占基金净值的权重。
- `securities`：`excess_selection_contribution` 是股票选择明细；被排除持仓保留原因，不填成零。
- `convertible_bonds`：逐券 `industry_allocation_contribution + stock_selection_contribution +
  other_excess_contribution` 对应转债三项超额。资产配置项不在逐券三项中。
  原始权重、归因权重、β、正股和终止续接字段原样保留；不对 β 跨期平均。
  `industry_linked_contribution / bond_component_contribution / convertible_bond_specific_contribution`
  是兼容的绝对贡献诊断，不能混入上述超额分解。

不同层次是同一笔收益的展开，不能相互叠加。`actual_return_contribution` 是绝对收益贡献，
不能当作相对基准的贡献加入上述 7 项。未披露语义的额外字段不凭名称作解释。

## 日度与覆盖

- `fund_nav_index / fitted_nav_index / benchmark_nav_index`：单期从 1 开始的日度净值。
- `industry_matched_nav_index`：把期初 A 股、港股持仓替换为对应行业基准后的净值；转债与纯债
  沿用持仓拟合贡献。尚未补齐时为 `null`，不以其他曲线替代。
- `*_cumulative_contribution`：四资产累计绝对收益贡献，相加再加 1 等于持仓拟合净值。
- `cumulative_active_return`：基金/基准净值比减 1，与 `active_return` 不同。
- `cumulative_fit_residual`：基金/拟合净值比减 1，与单期算术差 `fit_residual` 不同。
- `*_portfolio_weight / *_benchmark_weight`：期初实际与上一半年末基准仓位，杠杆下可超过 100%。
- `holdings_coverage_ratio / industry_mapping_coverage_ratio` 及转债覆盖字段：检查输入覆盖程度。
  `quality_status=passed` 不是拟合优度评分，更不证明残差很小。

## 下钻对照口径

行业相对权重比较 `portfolio_market_weight` 与 `benchmark_market_weight`，
不能用占基金净值的 `portfolio_nav_weight` 减市场内基准权重。
行业对照保留组合与基准收益及配置、选择贡献；A股与港股同名行业仍分开。
股票只汇总 `included_in_attribution=true` 且非空的记录，保留归因权重、股票收益、
`comparison_return`、绝对贡献及选择贡献。未披露或未纳入不填零。
转债市场层的 `selection_effect` 是正股选择，基金层的 `convertible_bond_selection_effect`
却是行业、正股选择、其他超额三项合计；分解直接展示这三项及仓位配置，不再加重复中间层。
纯债用指数代理；其选择项为零是模型设定。拟合较好或闭合误差小不证明选股能力或持仓完整。
