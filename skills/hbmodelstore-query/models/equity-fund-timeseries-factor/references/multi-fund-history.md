# 多基金 Alpha 比较绘图单元

## 计算口径

比较已选定的 2–11 只基金的日频年化 Alpha，直接使用已发布的 `alpha_annual`，按真实模型日对齐，缺失日期保留为空。
年化 Alpha 是每日更新的滚动回归结果，不是基金净值，也不是当天的超额收益。

比较样本为用户指定的基金，或按因子暴露选出的相似基金。

## 应用场景

比较多只基金 Alpha 的水平、改善速度与领先关系是否持续。相似基金先按风格选样，
再用同一张历史图判断当前差异是一时出现，还是已经延续了一段时间。

## 不适用场景

这张图不计算同类排名，也不负责收益归因。不同类型基金可以并列展示，但各自的同类位置
仍按当日分类查询。需要理解单基金风格时使用风格与因子暴露组件；需要实际收益时另查对应数据。

## 查询与绘图

用户指定基金时沿用这些对象；需要找相似基金时，先读取
[同类风格与相似基金比较](peer-comparison.md)，从响应中取得精确代码。
分别读取目标及所选基金的完整历史，统一查询截止日。使用 `get_equity_factor_history` 完成分页，
或使用[查询辅助](query.md)的 `history` 命令自动保存完整历史；已保存的响应直接复用。

```bash
python3 "$SKILL_DIR/models/equity-fund-timeseries-factor/scripts/visualize_comparison.py" \
  --inputs target.json peer-a.json peer-b.json --output comparison.html
```

脚本离线生成一张多基金 Alpha 图，不附加收益、暴露图或排名表。
默认展示近三年。讨论特定阶段时，用绘图参数 `--start YYYY-MM-DD --end YYYY-MM-DD` 设置初始展示范围；
输入仍为截至讨论末日的完整历史，近一年、近三年与全部均可本地切换，不先裁成讨论区间。
共享选项函数为 `assets/equity-renderer.mjs` 中的
`equityMultiFundAlphaOption(histories, {dark, start, end})`，组件入口为 `renderEquityComparison`。
单独导出 PNG 时选择 `[data-hb-chart="equity-multi-alpha"]`，沿用根 Skill 的图片导出流程；
图外标题、日期和来源保留在 HTML，正文图片只包含图形与图例。
分析判断见[同类与多基金比较](../analysis/cross-section.md)。
