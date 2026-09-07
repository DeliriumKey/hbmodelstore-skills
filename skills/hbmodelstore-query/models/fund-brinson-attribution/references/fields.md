# 公开字段

- `fund_return / benchmark_return / active_return`：半年期基金、复合基准和主动收益。
- `market_allocation_effect`：A股、港股、转债与纯债仓位差异的贡献。
- `industry_allocation_effect`：各市场内申万一级行业权重差异的贡献。
- `security_selection_effect`：实际持仓相对所属行业基准收益的选择贡献。
- `convertible_bond_selection_effect`：转债实际贡献减期初转债仓位乘转债指数收益，与股票选择并列。
- `residual_effect`：基金收益减持仓拟合收益，再加成分篮子与官方指数的基准差额。
- `benchmark_bridge`：成分篮子复合基准收益减官方指数复合基准收益。
- `allocation_effect / selection_effect`：前者包含四资产与股票行业配置，后者包含股票与转债选择；不要与各自子项重复相加。
- `*_portfolio_weight / *_benchmark_weight`：期初实际与上一半年末基准仓位，可以因杠杆超过100%。
- `holdings_coverage_ratio / industry_mapping_coverage_ratio`：持仓与基准有效覆盖率。
- `fund_nav_index / benchmark_nav_index`：单期起点归一为1的日度净值指数。
- `fitted_nav_index`：A股、港股、转债与纯债四部分实际持仓拟合净值。
- `*_cumulative_contribution`：各资产累计绝对收益贡献，相加加1等于拟合净值。
- `fit_residual`：单期基金收益减拟合收益；日度 `cumulative_fit_residual` 则为净值比值减1。
- `convertible_bond_*_contribution`：转债内部的绝对收益拆解，不能再加到主动收益恒等式上。

0.6.0新增字段随新版结果提供；尚未重算的旧结果为null，而不是零。

股票明细 `actual_return_contribution` 是绝对贡献，`excess_selection_contribution` 是相对
`comparison_return` 的行业内选择贡献。行业市场内权重与占基金净值权重不是同一分母。
