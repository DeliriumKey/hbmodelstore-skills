# 查询辅助

本页只记录跨面板组件共用的身份、保存与表格操作；面板组件口径和任务入口见 [MODEL.md](../MODEL.md)。

## 基金身份与完整响应

名称用 `search_funds` 定位，A/C 份额通过 `resolve_fund` 取得初始代码再查询。
带 `!1` 等历史后缀时保留完整身份，不套用当前份额映射，也不自动与无后缀代码拼接。

普通查询直接使用 MCP。只有需要完整数据落盘或离线 HTML 时才运行 `scripts/query.py`；
脚本调用公开 API，按面板组件 Reference 的边界取数，不负责分析或绘图。不要用聊天中截断的几行
重建响应；已有完整 JSON 时直接复用。

历史分页须保持右端点不变，以 `next_start` 继续读取，合并 `rows` 与 `factor_dates`；
截面导出保留单页和分页元数据，不得把一页结果当作完整截面。

## 分析表格

已有完整同日 `comparison.json` 时，以下命令离线输出可插入正文的 Markdown，
不重新查询、筛选近邻或计算同类分位：

```bash
python3 "$SKILL_DIR/models/equity-fund-timeseries-factor/scripts/review.py" \
  style --input comparison.json
python3 "$SKILL_DIR/models/equity-fund-timeseries-factor/scripts/review.py" \
  peers --input comparison.json
```

`--input -` 接收标准输入；支持 API JSON 和完整 MCP 导出。`style` 默认显示四个股票因子，
需要债券暴露对照时加 `--include-bonds`。百分位使用 `percentile_at_or_below`，
即暴露系数不高于本基金的同类占比，不是优劣排名。

`peers` 保留 API 返回顺序，目标置顶，完整展示实际参与回归的暴露；转债关闭时不列结构性零值。
数值按列统一精度、缺失用 `—`，代码与名称分列。正文交代共同模型日及二级分类；候选不足时
说明实际数量，不能把错误或无法选样的结果当成没有同类。

历史分析不提供预制表格命令；Agent 按问题与证据决定是否插表，不另跑一套固定历史表流程。
