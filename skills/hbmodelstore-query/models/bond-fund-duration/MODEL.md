# 纯债基金久期模型

| 项目 | 内容 |
| --- | --- |
| `model_key` | `bond-fund-duration` |
| 当前登记版本 | `1.1.0` |
| 结果口径 | 日频 Hybrid 修正久期 |
| 用户入口 | hbmodelstore 统一公网 API |

## 使用顺序

1. 先读[功能支持](./references/capabilities.md)，确认需求是否已发布为公网 API。
2. 需要检查路径和参数时读[API 汇总](./api.md)。
3. 查询最新久期时读[最新久期](./references/latest-duration.md)。
4. 查询历史久期时读[历史久期](./references/duration-history.md)。
5. 查询当前分布或高久期名单时读[当前久期截面](./references/current-cross-section.md)。
6. 解释估计方法、Hybrid 和结果边界时读[算法原理](./references/algorithm.md)。
7. 需要理解底层对象和字段来源时读[Schema 与字段字典](./references/schema.md)，但不要据此
   绕过 API 直接查询数据库。

## 核心解释边界

- `estimated_duration` 是模型估计的修正久期，单位为年，不是定期报告披露值。
- 模型估计净值层面的利率风险敏感度，不还原逐券持仓、杠杆或完整现金流结构。
- 返回结果时保留日期、样本类型、模型版本、有效性和 `fallback_flag`。
- 空结果表示当前发布版本在指定条件下无数据，不表示久期为零。
