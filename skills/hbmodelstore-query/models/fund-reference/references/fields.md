# 公开字段

| 字段 | 含义 |
| --- | --- |
| `fund_code` | 用户命中的具体基金份额代码，保留 `.OF` 后缀 |
| `fund_name` | 该份额的基金名称 |
| `initial_fund_code` | 同一基金对应的初始基金代码，保留 `.OF` 后缀；尚未补齐时为 `null` |

当 `fund_code` 与 `initial_fund_code` 相同时，当前份额本身就是初始份额。`initial_fund_code`
为 `null` 时不要猜测主份额；空搜索结果表示没有命中当前已发布参考数据，不表示代码一定不存在。
