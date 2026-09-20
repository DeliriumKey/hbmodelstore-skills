# 单期明细

## 功能

展开一个半年期的基金汇总、四资产、股票行业、股票和转债明细。

## 典型请求

“解释华安创新 2022 年下半年收益主要来自哪里。”

## 输入与默认值

初始份额代码和已发布的期末日期必填，不自动切换到最近一期。
返回代码和名称统一采用当前基金身份，不返回历史 Wind 身份后缀或旧名称。

```bash
python3 "$SKILL_DIR/models/fund-brinson-attribution/scripts/query.py" \
  period --fund-code 040001.OF --period-end 2022-12-31
```

## 返回

`period / markets / industries / securities / convertible_bonds`。
每层使用哪些贡献字段、如何避免重复加总，见[字段映射](./fields.md)。

## 可视化

原有单期图见[可视化](./visualization.md)，解释层级见[收益来源复盘](../analysis/return-source-review.md)。
[跨期计算](./multi-period.md)中的脚本也可处理单期并输出来源明细；转债与被排除持仓保留在分析 JSON。

## 边界

排除的证券不等于零持仓；保留 `included_in_attribution` 与 `exclusion_reason`。
行业按期初切换：`2021-12-31` 前为申万 2014，自该日起为申万 2021，不把当今标签贴回历史。
转债历史回归 β 不是定价 Delta，也不代表预测能力。`terminal_proxy_applied` 表示报价终止后
按等值转股续接正股收益，后段 `terminal_beta=1`，不代表确认实际转股或赎回现金流。
市场最多 4 行，股票最多 500 行，转债最多 1000 行；达到上限时须提示明细可能不完整。
