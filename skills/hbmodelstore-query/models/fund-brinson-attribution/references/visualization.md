# 复现网页预览

默认交付交互 HTML，并优先使用当前 Agent Harness 的侧边栏/内置网页预览打开。
不支持时提供可打开的 HTML 文件或链接；用户明确要求时再导出静态图片。

先查 `history` 确认真实可用期间，再用下面的脚本导出 HTML。默认展开最新已发布单期；用户指定单期时加 `--period-end YYYY-MM-DD`。不填造未发布期间，不把接口异常换成样例。

同一张图同时展示实际净值、持仓拟合、行业匹配组合和模型复合基准，四条曲线起点均为1、均为实线。缺少的新字段不以其他曲线替代。

```bash
python3 "$SKILL_DIR/models/fund-brinson-attribution/scripts/visualize.py" \
  --input snapshot.json --period-end 2026-06-30 --output-dir /tmp/brinson-preview
```

`snapshot.json` 可以是之前单期导出的 `{history, detail, nav}`，也可复用跨期原始快照
`{history, details, nav}`；各部分均支持完整 MCP 响应。没有快照时可将 `--input` 换为
`--fund-code 001323.OF` 在线查询。历史身份如 `000011!1.OF` 原样交由 API 解析。

输出自包含 HTML 与原始 JSON：所选单期七项原始贡献的横向条形图、固定四资产分解表、单期四条净值曲线同图对比。历史接口保留最近最多 40 个已发布半年期，不在单期页面绘制历史图。网页和导出共用 `assets/brinson-renderer.mjs`，无需联网加载图表库。

跨期数据与分析 JSON 按[跨期计算](./multi-period.md)生成，再离线绘图：

```bash
python3 "$SKILL_DIR/models/fund-brinson-attribution/scripts/visualize_analysis.py" \
  --input /tmp/brinson-case/analysis.json --output /tmp/brinson-case/analysis.html
```

`visualize_analysis.py` 只消费分析 JSON，不重复取数。
跨期页面按网站顺序展示：累计贡献图、跨期结果（收益汇总、四资产平均权重及链接贡献分解）、净值对比、半年期归因历史、股票行业贡献、
持仓明细、转债贡献、逐期表现与贡献。历史图使用原始各期数值，转债三项合为
转债选择合计，不跨缺期、不直接加总为累计贡献；仅一期时不重复画历史图。
其 `assets/analysis-renderer.mjs` 复用上述单期图表配置；两种 Skill 导出共用
`assets/brinson-report.css` 的标题、表格、图注与 320px 图高。净值图的颜色、字体、底部图例
和区间控制条一致。跨期当前只链接实际、拟合、模型复合基准三条净值，不为凑齐四条而补造
行业匹配曲线。所有依赖均内嵌在输出 HTML 中。

分析行业及持仓时继续读取输出 JSON 中的 `detail.industries`、`detail.securities` 和 `detail.convertible_bonds`，按[收益来源复盘](../analysis/return-source-review.md)生成重点对照表；不以导出图表代替分析。可用 `.OF` 代码直接查询，名称先走 `/models/fund-reference/search?q=名称`，非初始份额由 API 自动映射。空结果只报告无已发布结果。

这是交互网页导出，不是正式报告 SVG/PNG；需要报告图片时另按报告图表规范渲染。

## 跨期页面交付约定

明细直接展开，行业表与持仓表均默认显示 A 股，可切换港股。两市场均以 SW2014、SW2021 等
原始行业标准名分表，仅展示有数据的分类，各表独立排序，并在表下标注该市场、该分类实际涉及报告期的起止日期；列出平均组合权重、平均基准权重、
配置贡献和选择贡献，出现期数的分母取该市场、该分类实际覆盖的期数，不重算跨期贡献或平均权重。持仓表每页 20 项，支持行业、名称/代码筛选和表头排序，先
筛选、排序全量明细，再分页；显示股票最新行业、累计持仓权重、平均单期权重、跨期贡献与
出现期数。同一股票不因历史行业变化拆行，行业取所选区间内最新一次披露的分类。
计算见[跨期计算](./multi-period.md)。网页与导出共用 `assets/analysis-tables.mjs`；缺失权重
显示 `—`。旧分析 JSON 需从原始快照重跑 `analyze.py`，更新股票合并结果、行业分项及其覆盖区间、期数与四资产分解，
不需要重新查询或重跑模型。

复用打包 ECharts 与 `assets/analysis-renderer.mjs`。断开的区间分别展示；来源和实际区间写在
图下，空数据不虚构区间。贡献持续性、被排除持仓等补充字段仍留在分析 JSON，供 Agent 解读。
实际净值用红色、拟合用蓝色、基准用灰色；图例和区间控制条位于底部。
贡献图沿用单期分类色，以坐标表达正负；表格正贡献红色、负贡献绿色，贡献数值统一显示 `%`。
逐期表现表全部数值列共用整张表的最大绝对值作为红绿渐变色阶，零值无底色，日期列不着色。
共用 `assets/brinson-report.css`，不另起大号指标卡或居中数值表。
图表输入与绘图解耦，可离线重画，不依赖 CDN、数据库或本机 hb-pic 安装。
