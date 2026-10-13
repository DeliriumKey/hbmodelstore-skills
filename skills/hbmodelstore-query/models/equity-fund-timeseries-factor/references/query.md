# 查询与绘图

## 功能

单基历史返回 Alpha、六因子暴露和拟合诊断；截面按共同模型日筛选、排序、分页；
同类比较一次返回完整同类的风格位置、表现摘要和相似基金，不需要下载完整截面。
先用 `get_equity_factor_info` 取得真实可用日期、八类基金及各日样本量。

## 典型请求

- “查华安创新（040001.OF）的含权多因子 Alpha 历史，并画出因子暴露。”
- “看看最新模型日普通股票型基金的 Alpha，按高到低取前 20 只。”

## 输入与默认值

名称用 `search_funds` 定位，A/C 份额通过 `resolve_fund` 取得初始代码再查询。
带 `!1` 等历史后缀时保留完整身份，不套用当前份额映射，也不自动与无后缀代码拼接。

- 历史：调用 `get_equity_factor_history`，省略日期从最早结果起读取；`has_more` 时用
  `next_start` 续读，保持原 `end`，合并各页 `rows` 与 `factor_dates`。单次上限以 MCP schema 为准。
- 截面：调用 `get_equity_factor_cross_section`，默认共同最新日、年化 Alpha 降序。
  建议指定基金类型；`q` 筛名称或代码。`total` 为筛选后总量，`has_more` 为真则增加
  `offset` 继续读取。指定日期无结果不向前回退；不是每只基金各取一个最新日。
- 同类比较：`get_equity_factor_comparison(fund_code, model_date, peers=5)`。
  综合分析将 `model_date` 固定为历史末日；`peers` 在 5–10 中预先选定。
  分类、版本和规格取目标当日记录，不手填类别。省略日期用全模型共同最新日，
  目标当日无结果返回缺失，不回退到其个人最新日。接口最多处理 10000 只同类基金。
  该能力是否已发布以 capabilities.json 为准，尚未部署时不能声称线上已调用成功。

## 返回

`rows` 含精确代码、名称、分类、训练起止日、有效观测数、日／年化 Alpha、252 日收益、六个 beta、
R²、调整后 R²、MSE、条件数、转债因子开关与季报日期、模型版本及规格。
Alpha 为小数收益率，展示百分比时乘 100；beta 为系数，不是持仓比例。
完整含义见[计算与字段](fields.md)。

同类比较返回 `target`、`category_factor_positions`、`category_performance`、`peers`
及 `current_group`。规模对应 `beta_smb_ep`，价值对应 `beta_vmg_ep`。
分位是 0–1 的比例：`percentile_below` 到 `percentile_at_or_below` 保留并列区间，
越低表示系数越小，不表示基金越差。风格分位用完整同类，非近邻子集；
目标未启用转债时不返回该风格列。相似基金只按暴露距离挑选，并附当日 Alpha、收益与 beta。
`selection_status` 非 `ok` 时保留实际结果：候选不足不凑数，缺少目标暴露或全列零方差时
不生成近邻；仍可使用有效的同类风格位置。接口不作历史判断。

## 可视化

完整 MCP 历史响应保存为 `history.json`，再离线生成网页：

```bash
python3 "$SKILL_DIR/models/equity-fund-timeseries-factor/scripts/visualize.py" \
  --input history.json --output alpha.html
```

与网页预览共用 `assets/equity-renderer.mjs`，展示 Alpha 与 252 日收益、股票因子暴露、债券与转债暴露
三张联动图，默认完整历史。优先在 Agent Harness 侧边栏打开 HTML。
有同日同基金的完整比较结果时，加 `--comparison comparison.json`，在历史图下显示
市场、规模、价值、动量的同类风格位置，与网页共用渲染器。点的位置使用
`percentile_at_or_below`，悬停查看并列分位区间；未启用转债的日期不画结构性零暴露。
不要用聊天里截断的几行重建原始响应；需要直接落盘时使用导出脚本：

```bash
python3 "$SKILL_DIR/models/equity-fund-timeseries-factor/scripts/query.py" \
  history --fund-code 040001.OF --output history.json
```

导出脚本只做有边界的取数与分页，不负责分析或绘图；它不是普通 MCP 查询的前置步骤。
截面导出使用 `cross-section --category 普通股票型基金 --output cross-section.json`，
保存单页及分页元数据，不伪装为全截面。
同类比较导出使用 `comparison --fund-code 040001.OF --date 2026-10-09 --peers 5 --output comparison.json`；
普通分析直接保存相应 MCP 响应即可。

## 多基金比较网页

分别保存 2–5 只指定基金的完整历史响应，查询时使用相同起止范围，再离线绘图：

```bash
python3 "$SKILL_DIR/models/equity-fund-timeseries-factor/scripts/visualize_comparison.py" \
  --inputs fund-a.json fund-b.json fund-c.json --output comparison.html
```

一个网页依次展示 Alpha、252 日收益及各有效因子暴露的多基金对照，图例与光标联动。
每只基金使用固定颜色，缺失日期留空；图外可选近一年、近三年或全部。
脚本只消费已导出的历史，不选近邻、不取数，也不将滚动收益拼成净值。

## 分析表格

已有完整同日 `comparison.json` 时，以下命令离线输出可直接插入正文的 Markdown，
不重新查询、筛选近邻或计算同类分位，也不要求另存统计 JSON：

```bash
python3 "$SKILL_DIR/models/equity-fund-timeseries-factor/scripts/review.py" \
  style --input comparison.json
python3 "$SKILL_DIR/models/equity-fund-timeseries-factor/scripts/review.py" \
  peers --input comparison.json
```

`--input -` 接收标准输入；支持 API JSON 和完整 MCP 导出。
`style` 默认显示四个股票因子；需要债券暴露对照时加 `--include-bonds`。
百分位使用 `percentile_at_or_below`，即暴露系数不高于本基金的同类占比，不是优劣排名。
`peers` 保留 API 返回顺序，目标置顶，完整展示实际参与回归的暴露，转债关闭时不列其结构性零值。
数值按列统一精度、缺失用 `—`，代码与名称分列。正文交代共同模型日及二级分类；候选不足时
说明实际数量，不能把错误或无法选样的结果当成没有同类。

历史分析不提供预制表格命令；Agent 按问题与证据自行决定是否插表，不需要为成稿另跑一套历史表流程。

## 边界

- 年化 Alpha 是 252 日回归截距年化，不是区间累计收益或未来收益承诺。
- 不套用纯债模型的久期分组、240/60 日混合得分或排名。
- 绘图保留 `factor_dates`：休市日正常连线，因子交易日缺少基金结果时留白，不补零。
- 正式覆盖八类基金，不等于所有类型均有同样的选基有效性；比较优先在同类型进行。
