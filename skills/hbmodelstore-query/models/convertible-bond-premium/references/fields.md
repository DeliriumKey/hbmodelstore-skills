# 返回字段

`unit=percent`：溢价率30表示30%，展示时直接加 `%`，不要乘100。

| 字段 | 含义 |
| --- | --- |
| model_date / model_version / source_revision | 结果日期、模型版本、计算代码 revision |
| premium_100 | 平价100元处的拟合转股溢价率 |
| intercept / inverse_coefficient | 截距 c 与反比例项系数 a |
| mae / rmse | 最终参与拟合样本的误差，百分数刻度的绝对差；不是样本外误差 |
| r_squared | 最终样本拟合优度 |
| universe_count / valid_count | 日期范围内公募样本量／有有效输入的样本量 |
| screened_count / fitted_count | 70–130及85%筛选后／残差二次筛选后数量 |
| cb_count / eb_count | 最终拟合中的公募转债／公募可交债数量 |
| parity_min / parity_max | 最终拟合样本的实际平价边界 |

时序接口 `rows` 按日期升序。曲线接口 `result` 是当日上述结果，`curve` 包含
`parity`（元）和 `fitted_premium`（百分数），固定绘制50–150元；筛选范围外属于外推。
