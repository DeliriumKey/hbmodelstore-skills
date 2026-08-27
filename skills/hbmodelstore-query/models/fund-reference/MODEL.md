# 基金搜索与主份额解析

`model_key`：`fund-reference`

本能力用于把用户熟悉的基金名称、A/C 等具体份额转换成模型使用的稳定基金实体。先读
[基金搜索与主份额解析](./references/fund-search.md)；只有需要解释响应字段时再读
[公开字段](./references/fields.md)。

基金名称是份额名称，不能据此推断分类、存续状态或模型覆盖。模型以初始基金代码为实体时，
后续查询统一使用 `initial_fund_code`。
