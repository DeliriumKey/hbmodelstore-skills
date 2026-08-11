# 公网 API

基础路径：`https://api.delirium.com.cn/models/bond-fund-duration`

API 公开只读，无需 API Key。所有成功响应均为 `{"rows": [...]}`；空数组表示指定条件下没有
数据，不表示久期为零。非法参数返回 `422`。

## 最新久期

`GET /latest`

| 参数 | 必填 | 约定 |
| --- | --- | --- |
| `fund_code` | 是 | 可重复或使用逗号分隔；六位代码可带 `.OF`；去重后最多 200 只 |

每个请求代码返回一行，并用 `found_flag` 区分是否找到。主要字段包括
`requested_fund_code`、`fund_name`、`model_date`、`sample_type`、`estimated_duration`、
`estimated_macaulay_duration`、模型版本、来源报告日期、有效性和回退标记。

## 历史久期

`GET /history`

| 参数 | 必填 | 约定 |
| --- | --- | --- |
| `fund_code` | 是 | 单只六位基金代码，可带 `.OF` |
| `start` | 是 | `YYYY-MM-DD` |
| `end` | 是 | `YYYY-MM-DD`，不得早于 `start`；区间最长十年 |
| `limit` | 否 | `1–2500`，默认 `2500` |

结果按 `model_date` 升序返回，仅包含当前发布版本的有效结果。字段包括基金代码和名称、日期、
样本类型、两种久期、版本、来源报告日期、有效性、回退标记和可用权重。

## 当前截面

`GET /cross-section`

| 参数 | 必填 | 约定 |
| --- | --- | --- |
| `mode` | 否 | `summary` 或 `high`，默认 `summary` |
| `sample_type` | 条件必填 | 仅用于 `high`；取 `利率债基金` 或 `信用债基金` |
| `limit` | 否 | `1–200`，默认 `50`；仅影响 `high` 名单 |

`summary` 返回共同最新日期上各样本类型的数量、均值、P10/P25/P50/P75/P90 和回退数量。
`high` 返回指定样本类型按估计久期降序排列的基金名单和追溯字段。

## 推荐调用方式

使用本模型的 `scripts/query.py`，不要手写 URL、访问旧 `/v1` 路径或绕过参数限制：

```bash
python skills/hbmodelstore-query/models/bond-fund-duration/scripts/query.py --help
```
