# 数据库 Schema 与字段字典

## 内容索引

- [一、Schema 总览](#一schema-总览)
- [二、对象关系](#二对象关系)
- [三、久期运行表 model_runs](#三久期运行表-model_runs)
- [四、样本快照表 sample_snapshots](#四样本快照表-sample_snapshots)
- [五、正式久期结果表 fund_duration_daily](#五正式久期结果表-fund_duration_daily)
- [六、Hybrid 运行表 hybrid_runs](#六hybrid-运行表-hybrid_runs)
- [七、Hybrid 久期结果表 fund_duration_hybrid_daily](#七hybrid-久期结果表-fund_duration_hybrid_daily)
- [八、异动运行表 anomaly_runs](#八异动运行表-anomaly_runs)
- [九、收益异动结果表 fund_return_anomaly_daily](#九收益异动结果表-fund_return_anomaly_daily)
- [十、生产发布内部表](#十生产发布内部表)
- [十一、只读视图](#十一只读视图)
- [十二、空值和查询约定](#十二空值和查询约定)

## 一、Schema 总览

数据库 schema 为 `model_bond_fund_duration`。当前包含 7 张业务表、5 张生产发布内部表和 4 个只读视图。

### 1.1 基础表

| 对象 | 数据粒度 | 主键 | 用途 |
| --- | --- | --- | --- |
| `model_runs` | 每次久期生产运行一行 | `run_id` | 记录正式久期任务的版本、区间、状态和行数 |
| `sample_snapshots` | 每个报告期、每只基金一行 | `report_date, fund_code` | 保存当期可见样本分类及基金基础信息 |
| `fund_duration_daily` | 每个模型版本、日期、基金、组件一行 | `model_version, model_date, fund_code, component` | 保存正式模型及历史组件的日频久期、参数和诊断 |
| `hybrid_runs` | 每次 Hybrid 生成运行一行 | `hybrid_run_id` | 记录 Hybrid 规则、来源运行、release 和运行状态 |
| `fund_duration_hybrid_daily` | 每个 Hybrid 规则、来源模型版本、日期、基金一行 | `hybrid_rule_version, source_model_version, model_date, fund_code` | 保存连续历史久期、组件权重和回退信息 |
| `anomaly_runs` | 每次收益异动运行一行 | `run_id` | 记录异动任务的信号版本、计算区间、阈值和行数 |
| `fund_return_anomaly_daily` | 每个模型版本、信号版本、日期、基金一行 | `model_version, signal_version, model_date, fund_code` | 保存使用滞后久期参数预测基金收益后得到的残差和异动分数 |
| `model_run_sample_stage` | 每次运行、报告期、基金一行 | `run_id, report_date, fund_code` | 正式运行发布前的样本暂存区 |
| `model_run_duration_stage` | 每次运行、日期、基金、组件一行 | 唯一索引 `run_id, model_date, fund_code, component` | 正式久期发布前的结果暂存区 |
| `model_publications` | 每个发布频道一行 | `channel` | 指向当前正式模型 release |
| `hybrid_run_duration_stage` | 每次 Hybrid 运行、日期、基金一行 | 唯一索引 `hybrid_run_id, model_date, fund_code` | Hybrid 发布前的结果暂存区 |
| `hybrid_publications` | 每个发布频道一行 | `channel` | 指向当前 Hybrid release |

### 1.2 只读视图

| 对象 | 数据粒度 | 用途 |
| --- | --- | --- |
| `latest_formal_duration` | 每只基金最近一条有效正式模型记录 | 查询当前正式模型久期 |
| `current_hybrid_history` | 当前发布 release 下每只基金、每个日期一行 | 查询当前版本的完整有效 Hybrid 历史 |
| `latest_hybrid_duration` | 每只基金最近一条当前 Hybrid 有效记录 | 查询当前连续口径久期，默认入口 |
| `latest_return_anomaly_watchlist` | 最新异动日期、每只入选基金一行 | 查询最新实验性异动观察名单 |

### 1.3 数据类型

| PostgreSQL 类型 | 含义 |
| --- | --- |
| `text` | 文本标识或说明 |
| `date` | 不含时区的自然日 |
| `timestamptz` | 带时区的时间戳 |
| `boolean` | 布尔值 |
| `integer` | 整数 |
| `bigint` | 大整数，主要用于行数统计 |
| `double precision` | 双精度浮点数 |
| `jsonb` | 结构化配置或原始补充信息 |

字段表中的“可空”为“否”表示数据库要求必须有值；“是”表示该字段允许为 `NULL`。允许为空不代表业务上可以忽略，尤其是无效模型记录中的参数和久期通常会为空。

## 二、对象关系

| 上游对象 | 下游对象 | 关联字段 | 含义 |
| --- | --- | --- | --- |
| `model_runs` | `fund_duration_daily` | `run_id` | 一次正式久期运行产生多条基金、日期、组件结果 |
| `model_runs` | `hybrid_runs` | `source_run_id` | Hybrid 运行指向用于合成的正式久期来源运行 |
| `hybrid_runs` | `fund_duration_hybrid_daily` | `hybrid_run_id` | 一次 Hybrid 运行产生多条基金日频连续久期 |
| `model_runs` | `fund_duration_hybrid_daily` | `source_run_id` | 每条 Hybrid 结果保留底层正式久期运行来源 |
| `anomaly_runs` | `fund_return_anomaly_daily` | `run_id` | 一次异动运行产生多条基金日频异动记录 |
| `sample_snapshots` | 久期和异动结果 | `report_date/source_report_date, fund_code` | 补充基金名称、样本类型、投资类型和报告期来源 |
| `model_runs` | `model_run_sample_stage` | `run_id` | 运行中样本先写暂存区，通过门禁后发布 |
| `model_runs` | `model_run_duration_stage` | `run_id` | 运行中正式结果先写暂存区，通过门禁后发布 |
| `model_publications` | `model_runs` | `published_by_run_id` | 正式查询频道指向已完成的模型 release |
| `hybrid_runs` | `hybrid_run_duration_stage` | `hybrid_run_id` | 运行中 Hybrid 结果先写暂存区，通过门禁后发布 |
| `hybrid_publications` | `hybrid_runs` | `published_by_hybrid_run_id` | Hybrid 查询频道指向已完成的 Hybrid release |

`sample_snapshots` 没有对结果表设置数据库外键，因为生产结果需要保留历史快照，即使样本元数据随后更新也不能改变既有结果。查询时可按 `source_report_date` 和 `fund_code` 显式关联。

## 三、久期运行表 `model_runs`

粒度：每次正式久期生产运行一行。

主键：`run_id`。

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `run_id` | `text` | 否 | 久期生产运行的不可变唯一标识，也是正式结果表的来源运行标识；已完成标识不得复用 |
| `model_version` | `text` | 否 | 正式久期模型版本 |
| `contract_hash` | `text` | 是 | 可执行正式模型契约的 SHA-256；历史迁移前记录可能为空 |
| `release_key` | `text` | 是 | 由模型版本、契约版本和契约摘要组成的 release 标识 |
| `status` | `text` | 否 | 运行状态，只能为 `running`、`complete` 或 `failed` |
| `requested_start` | `date` | 是 | 本次运行请求的起始模型日期 |
| `requested_end` | `date` | 是 | 本次运行请求的结束模型日期 |
| `started_at` | `timestamptz` | 否 | 运行开始时间 |
| `completed_at` | `timestamptz` | 是 | 运行完成时间；运行中或异常中断时可能为空 |
| `sample_rows` | `bigint` | 否 | 本次导入涉及的样本快照行数 |
| `estimate_rows` | `bigint` | 否 | 本次导入的正式模型及历史组件结果总行数 |
| `valid_estimate_rows` | `bigint` | 否 | `valid_flag=true` 的结果行数 |
| `configuration` | `jsonb` | 否 | 本次运行的窗口、损失函数、组件列表和样本可见性等配置快照 |
| `manifest_hash` | `text` | 是 | 本次不可变运行 Manifest 的 SHA-256 |
| `manifest` | `jsonb` | 否 | 模型契约、代码提交、锁文件、样本输入摘要和运行区间 |
| `code_commit` | `text` | 是 | 运行时 Git commit；非 Git 环境中可以为空 |

## 四、样本快照表 `sample_snapshots`

粒度：每个持仓报告期、每只基金一行。

主键：`report_date, fund_code`。

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `report_date` | `date` | 否 | 样本划分使用的季度末报告期 |
| `effective_date` | `date` | 否 | 该报告期开始用于生产模型的日期，当前规则为报告期下下个月 1 日 |
| `fund_code` | `text` | 否 | 六位基金代码，数据库中不保留市场后缀 |
| `fund_name` | `text` | 是 | 基金简称 |
| `sample_type` | `text` | 否 | 样本分支，只能为 `利率债基金` 或 `信用债基金` |
| `fund_invest_type` | `text` | 是 | 基金投资类型的二级分类 |
| `fund_manager_company` | `text` | 是 | 基金管理人名称 |
| `metadata` | `jsonb` | 否 | 样本生成时保留的原始报告期、持仓比例、成立日、到期日、估值方法等补充字段；键可能随数据源字段调整，不应替代稳定列 |

## 五、正式久期结果表 `fund_duration_daily`

粒度：每个模型版本、模型日期、基金和模型组件一行。

主键：`model_version, model_date, fund_code, component`。

外键：`run_id` 指向 `model_runs.run_id`。

### 5.1 身份和时点字段

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `model_version` | `text` | 否 | 正式久期模型版本 |
| `model_date` | `date` | 否 | 久期估计对应的交易日，也是 30 日回归窗口的结束日 |
| `fund_code` | `text` | 否 | 六位基金代码，数据库中不保留市场后缀 |
| `component` | `text` | 否 | 模型组件：`formal`、`without_30y`、`without_secondary` 或 `without_30y_secondary` |
| `method_id` | `text` | 否 | 该组件实际使用的模型方法标识 |
| `sample_type` | `text` | 否 | 当日可见样本路由，只能为 `利率债基金` 或 `信用债基金` |
| `source_report_date` | `date` | 否 | 样本划分所依据的季度末报告期 |
| `source_effective_date` | `date` | 否 | 该报告期进入生产样本划分的生效日期 |
| `run_id` | `text` | 否 | 产生该记录的久期运行标识 |

### 5.2 有效性和久期字段

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `valid_flag` | `boolean` | 否 | 该组件结果是否满足净值数据、因子数据、求解和久期有效性要求 |
| `invalid_reason` | `text` | 是 | 无效原因，例如 `missing_nav`、`insufficient_obs`、`abnormal_nav`、`missing_factor`、`solver_failed` 或 `invalid_duration` |
| `estimated_duration` | `double precision` | 是 | 模型估计的修正久期，单位为年；无效记录通常为空 |
| `estimated_macaulay_duration` | `double precision` | 是 | 模型估计的麦考利久期，单位为年；无效记录通常为空 |

### 5.3 期限和利差参数

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `beta_0` | `double precision` | 是 | 0 年国债 Spot 因子的期限权重；参与收益拟合但对久期贡献为 0 |
| `beta_1` | `double precision` | 是 | 1 年国债 Spot 因子的期限权重 |
| `beta_3` | `double precision` | 是 | 3 年国债 Spot 因子的期限权重 |
| `beta_10` | `double precision` | 是 | 10 年国债 Spot 因子的期限权重 |
| `beta_30` | `double precision` | 是 | 30 年国债 Spot 因子的期限权重；不含 30 年的组件中为空 |
| `gamma_policy` | `double precision` | 是 | 国开债 YTM 相对国债 YTM 的利差乘数 |
| `gamma_secondary` | `double precision` | 是 | AAA- 二级资本债 YTM 相对国债 YTM 的利差乘数；利率债分支或剔除该因子的组件中为空 |
| `gamma_cpnote` | `double precision` | 是 | AAA 中短期票据 YTM 相对国债 YTM 的利差乘数；利率债分支中为空 |
| `gamma_rating_aa_plus` | `double precision` | 是 | AA+ 中短期票据 YTM 相对 AAA 中短期票据 YTM 的评级利差乘数；利率债分支中为空 |

### 5.4 拟合和求解诊断

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `r_square` | `double precision` | 是 | 最终参数在原始收益量纲下计算的普通样本内 $R^2$，不是 Huber 加权拟合优度 |
| `mse` | `double precision` | 是 | 最终预测残差的普通均方误差 |
| `objective` | `double precision` | 是 | 优化器使用的加权 Huber 目标值，不等同于原始收益量纲的 MSE |
| `huber_scale` | `double precision` | 是 | 由第一阶段平方损失残差得到的 Huber 稳健尺度 |
| `n_obs` | `integer` | 是 | 窗口内可用基金收益观测数，正式模型要求 30 |
| `window_start_date` | `date` | 是 | 回归窗口的第一个交易日 |
| `window_end_date` | `date` | 是 | 回归窗口的最后一个交易日，通常等于 `model_date` |
| `factor_30y_enabled` | `boolean` | 否 | 当前组件是否启用 30 年期限因子 |
| `secondary_enabled` | `boolean` | 否 | 当前组件是否启用二级资本债利差因子 |
| `solver_success` | `boolean` | 是 | SLSQP 是否报告成功收敛 |
| `solver_status` | `integer` | 是 | SLSQP 返回的状态代码 |
| `solver_message` | `text` | 是 | SLSQP 返回的状态说明或捕获的求解异常信息 |
| `created_at` | `timestamptz` | 否 | 结果生成时间 |

## 六、Hybrid 运行表 `hybrid_runs`

粒度：每次 Hybrid 历史序列生成运行一行。

主键：`hybrid_run_id`。

外键：`source_run_id` 指向 `model_runs.run_id`。

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `hybrid_run_id` | `text` | 否 | Hybrid 运行的不可变唯一标识；已完成标识不得复用 |
| `hybrid_rule_version` | `text` | 否 | Hybrid 拼接规则版本 |
| `source_model_version` | `text` | 否 | 底层正式久期模型版本 |
| `contract_hash` | `text` | 是 | 来源正式模型的可执行契约摘要 |
| `release_key` | `text` | 是 | 来源正式模型 release 与 Hybrid 规则共同形成的 release 标识 |
| `source_run_id` | `text` | 否 | 用于生成 Hybrid 结果的正式久期运行 |
| `status` | `text` | 否 | 运行状态，只能为 `running`、`complete` 或 `failed` |
| `requested_start` | `date` | 是 | 请求生成 Hybrid 结果的起始日期 |
| `requested_end` | `date` | 是 | 请求生成 Hybrid 结果的结束日期 |
| `started_at` | `timestamptz` | 否 | 运行开始时间 |
| `completed_at` | `timestamptz` | 是 | 运行完成时间 |
| `result_rows` | `bigint` | 否 | 本次生成的 Hybrid 结果总行数 |
| `valid_rows` | `bigint` | 否 | 本次生成的有效 Hybrid 结果行数 |
| `is_current` | `boolean` | 否 | 兼容旧查询保留的最近发布运行标记；正式查询以 `hybrid_publications` 为准 |
| `configuration` | `jsonb` | 否 | 30 年和二级资本债因子的过渡区间、权重方式及缺失组件回退规则 |

## 七、Hybrid 久期结果表 `fund_duration_hybrid_daily`

粒度：每个 Hybrid 规则版本、来源模型版本、模型日期和基金一行。

主键：`hybrid_rule_version, source_model_version, model_date, fund_code`。

外键：`hybrid_run_id` 指向 `hybrid_runs.hybrid_run_id`，`source_run_id` 指向 `model_runs.run_id`。

### 7.1 身份和结果字段

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `hybrid_rule_version` | `text` | 否 | Hybrid 拼接规则版本 |
| `source_model_version` | `text` | 否 | 底层正式久期模型版本 |
| `model_date` | `date` | 否 | Hybrid 久期对应的交易日 |
| `fund_code` | `text` | 否 | 六位基金代码，数据库中不保留市场后缀 |
| `hybrid_run_id` | `text` | 否 | 产生该记录的 Hybrid 运行 |
| `source_run_id` | `text` | 否 | 底层正式久期结果的来源运行 |
| `sample_type` | `text` | 否 | 当日可见样本路由，只能为 `利率债基金` 或 `信用债基金` |
| `source_report_date` | `date` | 否 | 样本划分所依据的季度末报告期 |
| `source_effective_date` | `date` | 否 | 该报告期进入生产样本划分的生效日期 |
| `valid_flag` | `boolean` | 否 | Hybrid 是否至少有一个目标组件可用于合成 |
| `invalid_reason` | `text` | 是 | 无效原因；当前主要为 `no_valid_component` |
| `estimated_duration` | `double precision` | 是 | 组件加权并在必要时重新归一化后的修正久期，单位为年 |
| `estimated_macaulay_duration` | `double precision` | 是 | 组件加权并在必要时重新归一化后的麦考利久期，单位为年 |

### 7.2 目标权重和回退字段

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `weight_30y` | `double precision` | 否 | 30 年因子的日历线性启用权重，范围为 0 至 1 |
| `weight_secondary` | `double precision` | 否 | 二级资本债因子的日历线性启用权重，范围为 0 至 1；利率债基金固定为 1 |
| `weight_formal` | `double precision` | 否 | 正式全因子组件的目标权重 |
| `weight_without_30y` | `double precision` | 否 | 不含 30 年组件的目标权重 |
| `weight_without_secondary` | `double precision` | 否 | 不含二级资本债组件的目标权重 |
| `weight_without_30y_secondary` | `double precision` | 否 | 同时不含 30 年和二级资本债组件的目标权重 |
| `available_weight_sum` | `double precision` | 否 | 有效目标组件的原始权重之和；小于 1 表示部分目标组件缺失，等于 0 表示无法生成结果 |
| `fallback_flag` | `boolean` | 否 | 是否因部分目标组件无效而在剩余组件之间重新归一化权重 |

### 7.3 组件状态和组件久期

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `formal_valid` | `boolean` | 否 | 正式全因子组件是否有效 |
| `without_30y_valid` | `boolean` | 否 | 不含 30 年组件是否有效 |
| `without_secondary_valid` | `boolean` | 否 | 不含二级资本债组件是否有效 |
| `without_30y_secondary_valid` | `boolean` | 否 | 同时不含 30 年和二级资本债组件是否有效 |
| `formal_duration` | `double precision` | 是 | 正式全因子组件的修正久期 |
| `without_30y_duration` | `double precision` | 是 | 不含 30 年组件的修正久期 |
| `without_secondary_duration` | `double precision` | 是 | 不含二级资本债组件的修正久期 |
| `without_30y_secondary_duration` | `double precision` | 是 | 同时不含 30 年和二级资本债组件的修正久期 |
| `created_at` | `timestamptz` | 否 | Hybrid 结果生成时间 |

## 八、异动运行表 `anomaly_runs`

粒度：每次收益异动监测运行一行。

主键：`run_id`。

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `run_id` | `text` | 否 | 异动运行的唯一标识，也是异动明细表的来源运行标识 |
| `model_version` | `text` | 否 | 用于生成滞后风险参数的正式久期模型版本 |
| `signal_version` | `text` | 否 | 异动信号计算规则版本 |
| `status` | `text` | 否 | 运行状态，只能为 `running`、`complete` 或 `failed` |
| `requested_start` | `date` | 否 | 用户请求输出异动结果的起始日期 |
| `requested_end` | `date` | 否 | 用户请求输出异动结果的结束日期 |
| `calculation_start` | `date` | 否 | 为准备滚动历史残差而向前扩展后的实际计算起始日期 |
| `started_at` | `timestamptz` | 否 | 运行开始时间 |
| `completed_at` | `timestamptz` | 是 | 运行完成时间 |
| `result_rows` | `bigint` | 否 | 本次写入的异动结果总行数 |
| `scored_rows` | `bigint` | 否 | 已具备足够历史数据并得到单日 Z 值的行数 |
| `anomaly_rows` | `bigint` | 否 | `anomaly_flag=true` 的行数 |
| `watchlist_rows` | `bigint` | 否 | `watchlist_flag=true` 的行数 |
| `error_message` | `text` | 是 | 运行失败时记录的异常信息 |
| `configuration` | `jsonb` | 否 | 历史窗口、最少观测数、持续窗口、同类样本数和各类阈值的配置快照 |

## 九、收益异动结果表 `fund_return_anomaly_daily`

粒度：每个正式模型版本、异动信号版本、被检验日期和基金一行。

主键：`model_version, signal_version, model_date, fund_code`。

外键：`run_id` 指向 `anomaly_runs.run_id`。

异动监测使用 `parameter_date` 已知的久期和因子暴露预测下一可用交易日 `model_date` 的基金收益，残差定义为实际收益减预测收益。所有收益和贡献字段均使用小数收益率。

### 9.1 身份、时点和滞后参数

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `model_version` | `text` | 否 | 滞后久期参数所属的正式模型版本 |
| `signal_version` | `text` | 否 | 异动信号计算规则版本 |
| `parameter_date` | `date` | 否 | 用于预测的久期和因子暴露日期，早于 `model_date` |
| `model_date` | `date` | 否 | 实际基金收益和因子收益被检验的日期 |
| `fund_code` | `text` | 否 | 六位基金代码，数据库中不保留市场后缀 |
| `fund_name` | `text` | 是 | 基金简称，来自对应报告期样本快照 |
| `sample_type` | `text` | 否 | `parameter_date` 对应的利率债或信用债样本分支 |
| `fund_invest_type` | `text` | 是 | 基金投资类型的二级分类，用于构造细分同类组 |
| `source_report_date` | `date` | 否 | 滞后久期参数使用的样本报告期 |
| `lagged_estimated_duration` | `double precision` | 是 | `parameter_date` 的 Hybrid 修正久期 |
| `lagged_fallback_flag` | `boolean` | 否 | 滞后 Hybrid 久期是否发生组件缺失回退 |
| `available_weight_sum` | `double precision` | 是 | 滞后 Hybrid 暴露中有效组件的原始权重之和 |

### 9.2 预测收益和残差

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `level_contribution` | `double precision` | 是 | 滞后期限暴露乘当日国债期限因子收益后加总得到的贡献 |
| `policy_contribution` | `double precision` | 是 | 滞后国开债利差暴露乘当日国开债利差因子收益后得到的贡献 |
| `secondary_contribution` | `double precision` | 是 | 滞后二级资本债利差暴露乘当日二级资本债利差因子收益后得到的贡献 |
| `cpnote_contribution` | `double precision` | 是 | 滞后中短期票据利差暴露乘当日中短期票据利差因子收益后得到的贡献 |
| `rating_aa_plus_contribution` | `double precision` | 是 | 滞后 AA+－AAA 评级利差暴露乘当日评级利差因子收益后得到的贡献 |
| `predicted_return` | `double precision` | 否 | 各类因子贡献之和，即使用上一可用参数预测的当日基金收益 |
| `fund_return` | `double precision` | 否 | 基金当日实际净值收益 |
| `residual` | `double precision` | 否 | 实际收益减预测收益，即 `fund_return - predicted_return` |

### 9.3 单基金历史标准化

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `history_observations` | `integer` | 否 | 当前日期之前、最近 60 个可用日期中的历史残差观测数 |
| `residual_history_median` | `double precision` | 是 | 当前日期之前最近 60 个可用残差的中位数，至少需要 40 个观测 |
| `residual_history_scale` | `double precision` | 是 | 历史残差四分位距除以 1.349 后得到的稳健尺度，最低为 0.00005 |
| `residual_surprise` | `double precision` | 是 | 当日残差减去该基金历史残差中位数 |
| `single_day_z` | `double precision` | 是 | `residual_surprise / residual_history_scale` |
| `persistent_z` | `double precision` | 是 | 最近 5 日单日 Z 值截断在正负 4 后求和，再除以 $\sqrt{5}$ |
| `persistent_same_sign_days` | `integer` | 否 | 最近 5 日中同方向且单日 Z 值绝对值不低于 0.5 的最大天数 |

### 9.4 同类截面标准化

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `peer_group_level` | `text` | 是 | 同类组层级；细分组不少于 50 只时使用样本分支加投资类型，否则退回样本分支 |
| `peer_count` | `integer` | 是 | 当日所用同类组的基金数量 |
| `peer_median` | `double precision` | 是 | 当日同类组 `residual_surprise` 的中位数 |
| `peer_scale` | `double precision` | 是 | 当日同类组 `residual_surprise` 四分位距除以 1.349 后得到的稳健尺度 |
| `peer_percentile` | `double precision` | 是 | 基金 `residual_surprise` 在当日同类组中的截面分位，范围为 0 至 1 |
| `peer_z` | `double precision` | 是 | 基金 `residual_surprise` 相对同类中位数的稳健 Z 值 |
| `positive_anomaly_breadth` | `double precision` | 是 | 当日同一样本分支中 `single_day_z >= 2` 的基金占比 |
| `negative_anomaly_breadth` | `double precision` | 是 | 当日同一样本分支中 `single_day_z <= -2` 的基金占比 |
| `market_common_flag` | `boolean` | 否 | 正向或负向异动占比达到 20% 时为真，表示更可能是分支层面的共同波动 |

### 9.5 异动标记

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `single_day_flag` | `boolean` | 否 | `abs(single_day_z) >= 4` 时为真 |
| `persistent_flag` | `boolean` | 否 | `abs(persistent_z) >= 4` 且最近 5 日至少 4 日同方向时为真 |
| `peer_flag` | `boolean` | 否 | 同类组不少于 50 只、`abs(peer_z) >= 5` 且位于同类前后 1% 尾部时为真 |
| `anomaly_flag` | `boolean` | 否 | 单日、持续或同类异动任一标记为真 |
| `watchlist_flag` | `boolean` | 否 | 同类异动，或非市场共同波动下的单日或持续异动；当前观察名单据此筛选 |
| `anomaly_score` | `double precision` | 是 | `single_day_z`、`persistent_z` 和 `peer_z` 绝对值的最大值 |
| `anomaly_type` | `text` | 是 | 触发类型，可由 `single_day`、`persistent` 和 `peer` 组合 |
| `run_id` | `text` | 否 | 产生该记录的异动运行标识 |
| `created_at` | `timestamptz` | 否 | 异动结果生成时间 |

## 十、生产发布内部表

这些表只由生产任务写入，查询 Skill 不直接读取暂存表。

### 10.1 `model_run_sample_stage`

字段为 `run_id` 加上 `sample_snapshots` 的全部 8 个字段。主键为 `run_id, report_date, fund_code`。样本先按运行写入此表，正式久期结果通过发布门禁后，才在同一事务中合并到 `sample_snapshots`。

### 10.2 `model_run_duration_stage`

字段与 `fund_duration_daily` 的 35 个字段一致，唯一索引为 `run_id, model_date, fund_code, component`。运行中的分区可以分批写入；只有样本覆盖、模型日期和有效结果检查通过后，整批结果才会替换对应正式日期分区。

### 10.3 `model_publications`

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `channel` | `text` | 否 | 发布频道，正式查询使用 `production` |
| `model_version` | `text` | 否 | 当前发布的正式模型版本 |
| `release_key` | `text` | 否 | 当前发布的可执行模型 release |
| `published_by_run_id` | `text` | 否 | 完成本次发布的正式运行 |
| `published_at` | `timestamptz` | 否 | 发布指针切换时间 |

### 10.4 `hybrid_run_duration_stage`

字段与 `fund_duration_hybrid_daily` 的 30 个字段一致，唯一索引为 `hybrid_run_id, model_date, fund_code`。Hybrid 结果先在此表完成来源行数和日期覆盖校验，再原子替换正式 Hybrid 日期分区。

### 10.5 `hybrid_publications`

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `channel` | `text` | 否 | 发布频道，默认查询使用 `production` |
| `release_key` | `text` | 否 | 当前 Hybrid release 标识 |
| `source_model_version` | `text` | 否 | 当前 release 的底层正式模型版本 |
| `hybrid_rule_version` | `text` | 否 | 当前 release 的 Hybrid 规则版本 |
| `published_by_hybrid_run_id` | `text` | 否 | 完成本次发布的 Hybrid 运行 |
| `published_at` | `timestamptz` | 否 | 发布指针切换时间 |

运行完成和对外发布是两个动作。历史回补可以写入其所属 release，而不会因为某一次回补运行较晚完成就自动切换当前版本；日常正式任务显式执行发布。

## 十一、只读视图

### 11.1 `latest_formal_duration`

字段：与 `fund_duration_daily` 的 35 个字段完全一致，字段含义见第五节。

筛选规则：

- 只读取 `model_publications.channel='production'` 指向的 release，以及 `model_runs.status='complete'` 的记录。
- 只保留 `component='formal'` 且 `valid_flag=true` 的记录。
- 每只基金按 `model_date` 和 `created_at` 降序取第一条。

### 11.2 `current_hybrid_history`

字段：与 `fund_duration_hybrid_daily` 的 30 个字段完全一致，字段含义见第七节。

筛选规则：

- 读取 `hybrid_publications.channel='production'` 指向的 release。
- 只读取该 release 下 `hybrid_runs.status='complete'` 的日期分区。
- 只保留 `valid_flag=true` 的记录。
- 该视图是历史查询、市场中位数、当前截面和异动任务的统一来源。

### 11.3 `latest_hybrid_duration`

字段：与 `fund_duration_hybrid_daily` 的 30 个字段完全一致，字段含义见第七节。

筛选规则：

- 从 `current_hybrid_history` 中读取当前 release 的完整有效历史。
- 每只基金按 `model_date` 和 `created_at` 降序取第一条。
- 这是当前久期和当前截面查询的默认入口。

### 11.4 `latest_return_anomaly_watchlist`

字段：与 `fund_return_anomaly_daily` 的 45 个字段完全一致，字段含义见第九节。

筛选规则：

- 先取 `fund_return_anomaly_daily` 全表中的最大 `model_date`。
- 只保留该日期且 `watchlist_flag=true` 的记录。
- 该视图是实验性观察名单，不等于已经确认发生赎回、信用事件或其他特定事件。

## 十二、空值和查询约定

- 查询对象必须写明 `model_bond_fund_duration` schema，避免命中同名对象。
- 当前久期默认使用 `latest_hybrid_duration`，正式模型研究使用 `fund_duration_daily` 或 `latest_formal_duration`。
- 当前 Hybrid 历史默认使用 `current_hybrid_history`；直接查询底表时必须明确 `source_model_version`、`hybrid_rule_version` 或 `model_version`，不能混合不同 release。
- `valid_flag=false` 时，久期、参数和拟合诊断可能为空；不得用 0 代替这些空值。
- 某个分支未使用的参数为空不代表估计值为 0，例如利率债基金的 `gamma_secondary`、`gamma_cpnote` 和 `gamma_rating_aa_plus`。
- `fallback_flag=true` 表示 Hybrid 使用了剩余有效组件重新归一化，不表示底层正式模型本身有效。
- 异动表中的 Z 值和观察名单属于实验性结果，使用时必须同时保留 `signal_version`、`model_date` 和对应标记。
