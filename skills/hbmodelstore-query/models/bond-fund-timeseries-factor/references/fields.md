# 公开字段字典

本文件只说明公网 API 返回字段，不公开物理表、运行表、发布指针和模型内部诊断。

## 修正久期截面

| 字段 | 含义 |
| --- | --- |
| `model_date` | 查询目标模型日期；未指定日期且无已发布数据时为 `null` |
| `rows` | 目标日期的全部有效基金结果 |
| `rows[].fund_code` | 基金代码，统一为六位代码加大写 `.OF` 后缀 |
| `rows[].fund_name` | 基金简称，源数据缺失时可为 `null` |
| `rows[].estimated_modified_duration` | 估算修正久期，单位为年 |

## 基金修正久期历史

模型脚本将一个或多个服务端响应合并到 `data.series`；每个 `series[]` 元素包含以下字段：

| 字段 | 含义 |
| --- | --- |
| `fund_code` | 规范化基金代码，统一带大写 `.OF` 后缀 |
| `fund_name` | 查询区间内最后一个非空基金简称；没有结果时为 `null` |
| `points` | 按模型日期升序排列的历史点 |
| `points[].model_date` | 模型估计对应的交易日 |
| `points[].estimated_modified_duration` | 估算修正久期，单位为年 |

## 分组修正久期中位数历史

| 字段 | 含义 |
| --- | --- |
| `start`、`end` | 实际查询日期闭区间 |
| `breakdown` | 分组口径：模型分支，或模型分支与基金投资类型的交叉分组 |
| `series[].sample_type` | 利率债基金或信用债基金模型分支 |
| `series[].fund_invest_type` | 中长期纯债型基金或短期纯债型基金；仅细分口径返回具体类型 |
| `series[].points[].model_date` | 中位数对应的模型日期 |
| `series[].points[].fund_count` | 当日参与计算的有效基金数量 |
| `series[].points[].median_modified_duration` | 当日等权截面修正久期中位数，单位为年 |

空 `rows`、`points` 或 `series` 表示指定条件下没有当前发布结果，不表示久期为零。精确响应
结构以生成的 OpenAPI/API Reference 为准。
