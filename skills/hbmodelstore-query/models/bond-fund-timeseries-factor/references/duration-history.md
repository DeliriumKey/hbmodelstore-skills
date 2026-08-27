# 单基久期测算

## 功能

查询一只或多只基金的日频修正久期；按需返回 30 日模型的期限与利差暴露。单基金还可生成与
网页预览同源的修正久期、期限暴露、利差暴露三张联动图。

## 典型请求

- “查永赢裕益A全部历史修正久期。”
- “比较 000005 和 000015 在 2025 年的久期，并返回 3Y 与政金债暴露。”
- “给 006443.OF 生成久期、期限和利差三图 HTML。”

## 输入与默认值

- `--fund-code`：初始基金代码；最多 20 只，英文逗号分隔，可省略 `.OF`。
- `--start`、`--end`：可分别省略；均省略时查询全部已发布历史，均提供时为闭区间。
- `--fields`：默认只有 `estimated_modified_duration`；可选固定白名单见[字段字典](./fields.md)。

```bash
python3 skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/query.py \
  history --fund-code 000005.OF,000015 --start 2025-01-01 --end 2025-12-31 \
  --fields estimated_modified_duration,beta_3,gamma_policy
```

## 返回

客户端逐只调用有界历史接口并合并到 `data.series`。每个元素包含基金身份和按模型日升序的
`points`；缺失交易日不补齐。任一基金请求失败时整次命令失败，不输出残缺的成功结果。

## 可视化

```bash
python3 skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/visualize.py \
  all --fund-code 006443.OF --output 006443-all.html
```

`duration`、`term-exposure`、`spread-exposure` 可分别生成单图；`all` 生成三图并共享时间范围
控制条。四个命令默认绘制全部历史，也接受 `--start`、`--end`。HTML 只提供运行外壳，图形
配置与网页预览共同使用 `assets/chart-renderer.mjs`。

## 边界

- 修正久期是模型估计值，不是报告披露值；披露点只作为离散参照。
- 期限 β 与利差 γ 不代表逐券持仓或真实资产权重。
- 空 `points` 表示指定基金或区间没有已发布结果，不表示久期为零。
- 因子图要求每个模型日都有合法 `sample_type`；合约缺失时停止绘图而不是猜测分支。
