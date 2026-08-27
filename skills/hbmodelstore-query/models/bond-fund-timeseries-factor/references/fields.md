# 查询字段字典

本文件说明当前公开 API 的返回字段，不公开物理表、运行表、发布指针和模型内部诊断。

## 当前可查询基金搜索

| 字段 | 含义 |
| --- | --- |
| `rows[].fund_code` | 最近模型日在近两年内的初始基金代码 |
| `rows[].fund_name` | 对应基金简称，源数据缺失时可为 `null` |
| `has_more` | 当前页之后是否仍有候选 |
| `next_offset` | 下一页偏移量；没有下一页时为 `null` |

## 修正久期截面

| 字段 | 含义 |
| --- | --- |
| `model_date` | 查询目标模型日期；未指定日期且无已发布数据时为 `null` |
| `rows` | 目标日期的全部有效基金结果 |
| `rows[].fund_code` | 基金代码，统一为六位代码加大写 `.OF` 后缀 |
| `rows[].fund_name` | 基金简称，源数据缺失时可为 `null` |
| `rows[].estimated_modified_duration` | 估算修正久期，单位为年 |

## 基金修正久期历史

模型脚本将一个或多个服务端响应合并到 `data.series`；每个 `series[]` 元素包含以下字段：

| 字段 | 含义 |
| --- | --- |
| `fund_code` | 规范化基金代码，统一带大写 `.OF` 后缀 |
| `fund_name` | 查询区间内最后一个非空基金简称；没有结果时为 `null` |
| `points` | 按模型日期升序排列的历史点 |
| `points[].model_date` | 模型估计对应的交易日 |
| `points[].estimated_modified_duration` | 估算修正久期，单位为年 |

历史接口默认只返回修正久期。重复传入 `fields` 参数可选择下列附加字段；未选择的字段不出现在
响应中，选择后没有有效值的字段返回 `null`。

| 可选字段 | 含义 |
| --- | --- |
| `sample_type` | 当日模型分支：利率债基金或信用债基金 |
| `beta_0`、`beta_1`、`beta_3`、`beta_10`、`beta_30` | 30 日正式模型在 0Y、1Y、3Y、10Y、30Y 的期限暴露 |
| `gamma_policy` | 政策性金融债利差因子暴露 |
| `gamma_secondary` | 二级资本债利差因子暴露 |
| `gamma_high_grade_credit` | 高评级普通信用债利差因子暴露 |
| `gamma_low_grade_credit` | 低评级普通信用债利差因子暴露 |

## 基金历史披露久期

披露久期接口仅返回进入本模型样本的基金，观测频率为半年报和年报。

| 字段 | 含义 |
| --- | --- |
| `fund_code` | 规范化基金代码，统一带大写 `.OF` 后缀 |
| `fund_name` | 查询区间内最后一个非空基金简称；没有结果时为 `null` |
| `points[].report_date` | 披露久期所属的半年末或年末报告期 |
| `points[].available_date` | 按保守规则可使用该披露值的日期，避免前视 |
| `points[].sample_type` | 该报告期的利率债基金或信用债基金模型分支 |
| `points[].disclosed_duration` | 报告披露的组合久期，单位为年 |
| `points[].anomaly_flag` | 是否为达到 20 年及以上的异常披露值 |

## 分组修正久期中位数历史

| 字段 | 含义 |
| --- | --- |
| `start`、`end` | 实际查询日期闭区间 |
| `breakdown` | 分组口径：基金二级分类、持仓资产类型或两者的交叉分类 |
| `series[].series_key` | 七个细项之一的稳定标识 |
| `series[].sample_type` | 利率债基金或信用债基金；按基金二级分类查询时为 `null` |
| `series[].fund_invest_type` | 中长期纯债型基金或短期纯债型基金；按持仓资产类型查询时为 `null` |
| `series[].points[].model_date` | 中位数对应的模型日期 |
| `series[].points[].fund_count` | 当日参与计算的有效基金数量 |
| `series[].points[].q25_modified_duration` | 当日等权截面修正久期第25分位数，单位为年 |
| `series[].points[].median_modified_duration` | 当日等权截面修正久期中位数，单位为年 |
| `series[].points[].q75_modified_duration` | 当日等权截面修正久期第75分位数，单位为年 |
| `series[].points[].iqr_modified_duration` | 当日修正久期四分位距，等于第75分位数减去第25分位数，单位为年 |
| `series[].disclosed_points[].report_date` | 披露中位数所属的半年末或年末报告期 |
| `series[].disclosed_points[].available_date` | 按保守规则可使用该披露中位数的日期 |
| `series[].disclosed_points[].fund_count` | 当期参与披露中位数计算的基金数量 |
| `series[].disclosed_points[].median_disclosed_duration` | 当期报告披露久期中位数，单位为年 |

## Alpha 历史与截面

正式 Alpha 样本仅包含剔除定期开放基金后的中长期纯债型基金。

历史接口在顶层返回基金身份与正式合约信息，截面接口在顶层返回目标模型日期与正式合约
信息。两者的基金结果共享以下字段：

| 字段 | 含义 |
| --- | --- |
| `alpha_model_version` | 当前发布的 Alpha 模型版本 |
| `score_version` | 排名与正式生产得分的合约版本；不代表客户端自定义混合权重 |
| `method_id` | 240 日 Alpha 估计方法标识 |
| `fund_code` | 基金代码，统一带大写 `.OF` 后缀 |
| `fund_name` | 基金简称，源数据缺失时可为 `null` |
| `model_date` | Alpha 信号对应的模型日期 |
| `sample_type` | Alpha 模型分支：利率债基金或信用债基金 |
| `fund_invest_type` | 基金二级分类 |
| `source_report_date` | 当日样本分类所依据的报告期 |
| `alpha_daily` | 240 日模型估计的日频毛 Alpha |
| `alpha_annualized` | 240 日模型估计的年化毛 Alpha |
| `recent_residual_mean_60` | 冻结长期风险暴露后，近 60 日残差的日均值 |
| `implied_macaulay_duration` | 用于分层的隐含麦考利久期，单位为年 |
| `duration_bucket` | 同一基金分支内按久期形成的五分位组，取值为 1 至 5 |
| `alpha_rank` | 同分支、同久期组内的 240 日 Alpha 百分位排名 |
| `recent_state_rank` | 同分支、同久期组内的近 60 日状态百分位排名 |
| `n_obs` | 240 日估计窗口内的有效收益观测数 |

Alpha 历史响应还包含长期模型的利差暴露，用于单基历史图：

| 字段 | 含义 |
| --- | --- |
| `gamma_policy` | 政策性金融债利差暴露 |
| `gamma_secondary` | 二级资本债利差暴露 |
| `gamma_cpnote` | 票据信用利差暴露 |
| `gamma_rating_aa_plus` | AA+ 评级信用利差暴露 |

当命令显式传入 `--alpha-weight` 时，查询脚本会在 API 响应之外增加
`derived_score_weights`，并为每个基金增加 `combined_score`。其计算为
`alpha_weight × alpha_rank + (1 - alpha_weight) × recent_state_rank`。这是客户端派生字段，
不是服务端正式模型结果。

空 `rows`、`points` 或 `series` 表示指定条件下没有当前发布结果，不表示久期为零。精确响应
结构以生成的 OpenAPI/API Reference 为准。
