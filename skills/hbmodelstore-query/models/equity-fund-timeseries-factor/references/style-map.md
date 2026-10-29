# 风格与因子暴露面板组件

## 计算口径

风格定位使用价值与规模因子的原始回归系数。价值系数为正表示偏价值、为负表示偏成长；
规模系数为正表示偏小盘、为负表示偏大盘。基金轨迹使用逐模型日结果，对照样本为基金最新模型日、
同分类、同版本和回归规格的完整同类；自身历史位置不代表历史同类排名。

因子暴露包括市场、规模、价值、动量、信用债和转债六项。同类中位数按每个模型日的基金分类、
模型版本和回归规格计算，使用完整初始份额样本，包含目标基金。转债因子在已启用该因子的同类中
求中位数，不受目标基金是否启用影响。基金未参与转债回归的日期按零暴露处理，真正缺失的模型结果仍为缺失。

同类分位数为 `(低于目标的数量 + 0.5 × 等于目标的数量) / 有效数量`，取值为0%–100%，并列值取中点。
它表示暴露在同类中的高低，不是业绩评分。转债因子仅在启用日与已启用同类比较分位数，未启用日不计算分位数。

## 应用场景

观察基金当前偏成长还是价值、偏大盘还是小盘，以及在同类中的分布位置。
结合同类中位数与各因子的时间序列，辨认基金自身的风格调整，以及同类基金共同变化的阶段，为组合的风格补充和基金比较提供依据。

## 不适用场景

两个风格维度不代表全部风险暴露。相邻散点不等同于完整多因子近邻；自动寻找相似基金时使用完整因子比较。
坐标是滚动回归系数，不是持仓比例，也不使用晨星九宫格的分类阈值；历史变化不能还原具体调仓日期或行业持仓。

## 查询与绘图

名称通过 `search_funds` 定位初始份额。完整历史用 `get_equity_factor_history` 获取；背景取历史末日的分类，
使用 `get_equity_factor_cross_section` 读取该日全部分页，合并后保留 `total`，`offset=0`、`has_more=false`。
用 `get_equity_factor_exposure_peer_history` 指定 `frequency="daily"` 获取日频同类统计，`end` 固定为基金历史末日；中位数与分位数均读取预计算结果，每页最多5000个模型日，沿 `next_start` 续取至 `has_more=false`。
一次返回六因子的 `median`、`percentile` 和 `sample_counts`，分位数口径为 `percentile_method="midrank"`。
按日期对齐历史，不使用当前中位数作整段历史对照。接口通过统一 API/MCP 查询。
不要用前200条或五只近邻替代完整同类。网页与离线输出都使用 `assets/style-map.mjs`。

一次保存完整数据并生成 HTML：

```bash
python3 "$SKILL_DIR/models/equity-fund-timeseries-factor/scripts/query.py" \
  style-map --fund-code 161005.OF --output style-map.json
python3 "$SKILL_DIR/models/equity-fund-timeseries-factor/scripts/visualize_style_map.py" \
  --input style-map.json --output style-map.html
```

讨论特定阶段时，查询仍保留截至讨论末日的全部基金和同类历史；绘图用 `--start YYYY-MM-DD --end YYYY-MM-DD`
设置默认展示区间，近一年、近三年和全部在完整历史上切换。`--end` 与历史末日及同类截面日期一致，
保持风格定位的比较背景一致；未指定展示区间时默认近三年。

已有完整历史时给查询命令加 `--history history.json` 复用，不重复取数。
也可将已有完整 MCP 响应按 `{"history": 历史响应, "cross_section": 完整同类响应, "peer_history": 完整日频同类统计响应}` 保存后直接绘图。
不另行标准化坐标、裁掉极值或平滑轨迹。

正文需要 PNG 时，按问题从同一 HTML 导出：定位图为 `[data-hb-chart="equity-style-map"]`，
价值暴露历史为 `[data-hb-chart="equity-style-value-history"]`，规模暴露历史为 `[data-hb-chart="equity-style-size-history"]`；
其余为 `equity-style-mkt-history`、`equity-style-mom-history`、`equity-style-credit-history` 和 `equity-style-cb-history`。
区间控件使用 `button[data-years="1"]`、`button[data-years="3"]` 和 `button[data-years="0"]`，
遵循根 Skill 的无标题脚注导出方式。
需要判断风格及其变化时参考[风格与暴露解读](../analysis/exposure-review.md)。

### 独立绘图单元

每个图可单独生成 HTML：在同一命令上加 `--chart map` 只画定位图；加 `--chart beta_mkt`、`beta_smb_ep`、
`beta_vmg_ep`、`beta_mom`、`beta_credit` 或 `beta_cb` 只画对应因子。`--mode percentile` 使用同类分位数，
默认 `--mode exposure` 使用暴露值。单图与组件共用 `equityStyleMapOption`、`equityStyleHistoryOption`，无需自行拼 ECharts。

例如仅生成价值因子分位数图：

```bash
python3 "$SKILL_DIR/models/equity-fund-timeseries-factor/scripts/visualize_style_map.py" \
  --input style-map.json --chart beta_vmg_ep --mode percentile --output value-percentile.html
```

PNG 选择相同的 `data-hb-chart`，模式按钮为 `button[data-mode="exposure"]` 和 `button[data-mode="percentile"]`。
