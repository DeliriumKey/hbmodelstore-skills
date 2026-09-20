# 复现网页预览

默认交付交互 HTML，并优先使用当前 Agent Harness 的侧边栏/内置网页预览打开。
不支持时提供可打开的 HTML 文件或链接；用户明确要求时再导出静态图片。

先查 `history` 确认真实可用期间，再用下面的脚本导出 HTML。默认展开最新已发布单期；用户指定单期时加 `--period-end YYYY-MM-DD`。不填造未发布期间，不把接口异常换成样例。

同一张图同时展示实际净值、持仓拟合、行业匹配组合和模型复合基准，四条曲线起点均为1、均为实线。缺少的新字段不以其他曲线替代。

```bash
python3 "$SKILL_DIR/models/fund-brinson-attribution/scripts/visualize.py" \
  --fund-code 001323.OF --output-dir /tmp/brinson-preview
```

输出自包含 HTML 与原始 API JSON：所选单期七项原始贡献的横向条形图、固定四资产分解表、单期四条净值曲线同图对比。历史接口仍取最近最多 40 个已发布半年期，用于选择单期并保留在 JSON 中，不在单期页面绘制历史图。网页和导出共用 `assets/brinson-renderer.mjs`，无需联网加载图表库。

跨期数据与分析 JSON 按[跨期计算](./multi-period.md)生成，再离线绘图：

```bash
python3 "$SKILL_DIR/models/fund-brinson-attribution/scripts/visualize_analysis.py" \
  --input /tmp/brinson-case/analysis.json --output /tmp/brinson-case/analysis.html
```

`visualize_analysis.py` 只消费分析 JSON，不重复取数。
跨期页面按网站顺序展示：累计贡献图、跨期结果、净值对比、半年期归因历史、股票行业贡献、
个股选择贡献、资产贡献、转债贡献、逐期表现与贡献。历史图使用原始各期数值，转债三项合为
转债选择合计，不跨缺期、不直接加总为累计贡献；仅一期时不重复画历史图。
其 `assets/analysis-renderer.mjs` 复用上述单期图表配置；两种 Skill 导出共用
`assets/brinson-report.css` 的标题、表格、图注与 320px 图高。净值图的颜色、字体、底部图例
和区间控制条一致。跨期当前只链接实际、拟合、模型复合基准三条净值，不为凑齐四条而补造
行业匹配曲线。所有依赖均内嵌在输出 HTML 中。

分析行业及持仓时继续读取输出 JSON 中的 `detail.industries`、`detail.securities` 和 `detail.convertible_bonds`，按[收益来源复盘](../analysis/return-source-review.md)生成重点对照表；不以导出图表代替分析。可用 `.OF` 代码直接查询，名称先走 `/models/fund-reference/search?q=名称`，非初始份额由 API 自动映射。空结果只报告无已发布结果。

这是交互网页导出，不是正式报告 SVG/PNG；需要报告图片时另按报告图表规范渲染。

## 跨期页面交付约定

明细直接展开，不截取最高/最低几项。个股表每页 20 项，支持市场、行业、名称/代码筛选和
点击表头排序；先筛选、排序全量明细，再分页。显示累计持仓权重、平均单期权重、跨期贡献和
出现期数；权重口径见[跨期计算](./multi-period.md)。网页与导出共用 `assets/analysis-tables.mjs`
的筛选、排序、分页逻辑。缺失权重显示 `—`；旧分析 JSON 可从原始快照重新运行 `analyze.py`
补出权重字段，不需要重新查询或重跑模型。

复用打包 ECharts 与 `assets/analysis-renderer.mjs`。断开的区间分别展示；来源和实际区间写在
图下，空数据不虚构区间。贡献持续性、被排除持仓等补充字段仍留在分析 JSON，供 Agent 解读。
实际净值用红色、拟合用蓝色、基准用灰色；图例和区间控制条位于底部。
贡献图沿用单期分类色，以坐标表达正负；表格正贡献红色、负贡献绿色，贡献数值统一显示 `%`。
共用 `assets/brinson-report.css`，不另起大号指标卡或居中数值表。
图表输入与绘图解耦，可离线重画，不依赖 CDN、数据库或本机 hb-pic 安装。
