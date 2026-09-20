# 历史汇总

## 功能

查询单基金已发布的半年期归因，识别区间覆盖、缺期及值得下钻的时期。

## 典型请求

“查询华安创新的历史归因。”跨期汇总见[跨期计算](./multi-period.md)，文字解读见[收益来源复盘](../analysis/return-source-review.md)。

## 输入与默认值

初始份额代码必填，`--limit` 默认 40、最大 40，结果按期末倒序返回。
历史更名、转型或代码复用产生的 Wind 身份后缀由 API 按份额映射归并；不输入 `!1` 等历史代码。
返回代码和名称统一采用当前身份，同一基金不会因更名拆成多条历史序列。

```bash
python3 "$SKILL_DIR/models/fund-brinson-attribution/scripts/query.py" \
  history --fund-code 040001.OF --limit 40
```

## 返回

`rows` 包含期初/期末、方法标识、实际/基准/拟合收益、各项归因与覆盖率。
字段合计和子项关系见[字段映射](./fields.md)。

## 可视化

单期七项贡献图与净值图使用 `visualize.py`，见[可视化](./visualization.md)。
半年期归因历史图放在跨期分析中，只展示所选连续区间内的原始各期贡献；仅一期时不重复画。
跨期用 `analyze.py` 组织完整半年期，再用 `visualize_analysis.py` 生成离线交互页面。

## 边界

返回条数不是连续期数；缺期不填零。达到 40 期不能断言更早没有结果。
多期贡献不得直接相加，见[跨期计算](./multi-period.md)。
