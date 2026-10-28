# 单基久期测算

## 计算口径

单基久期使用 30 日无 Alpha 模型估计的期限暴露。设正式期限节点集合为
$\mathcal J=\{0,1,3,10,30\}$，基金 $i$ 在模型日 $t$ 的期限暴露为
$\widehat\beta_{i,j,t}$，则麦考利久期为：

$$
\widehat D^{\mathrm{Mac}}_{i,t}
=
\sum_{j\in\mathcal J}
j\,\widehat\beta_{i,j,t}.
$$

设 $y^{(\mathrm{gov})}_{j,t}$ 为模型日 $t$ 的国债 $j$ 年期即期收益率，则修正久期为：

$$
\widehat D^{\mathrm{Mod}}_{i,t}
=
\sum_{j\in\mathcal J}
\widehat\beta_{i,j,t}
\frac{j}{1+y^{(\mathrm{gov})}_{j,t}}.
$$

0 年节点的久期贡献为 0。当前对外开放的估计久期为修正久期。模型自 2018 年 8 月 1 日起按交易日生成结果，
基金分类和因子口径使用模型日当时可获得的信息。

披露久期来自半年报和年报。嵌套结构中，期限 $j$ 对利差因子 $k$ 的载荷为
$\widehat\beta_{i,j,t}\widehat\gamma_{i,k,t}$。

利差暴露以代表性曲线作为代理：二级资本债因子可共同反映
银行二级资本债和永续债的利差波动；AAA、AA＋中短期票据因子可反映产业债、城投债等信用资产的
共同利差波动。模型未单设永续债或城投债因子，具体券种配置由持仓材料进一步识别。

## 应用场景

| 场景 | 使用方式 |
| --- | --- |
| 单基金久期跟踪 | 补充半年报和年报之间的信息，观察当前久期水平及持续变化 |
| 久期中枢切换 | 识别基金是否从一个稳定久期区间迁移到另一个区间，并结合报告期披露久期确认变化方向 |
| 同类基金风险比较 | 在相同模型分支下比较基金的利率敏感度和期限风险结构 |
| 利差风险结构比较 | 按代理曲线代表的经济风险，比较银行资本债相关风险及不同评级信用利差风险的敏感性 |
| 利率压力测试 | 将期限暴露代入给定的国债曲线冲击，比较不同基金的利率风险水平 |

## 不适用场景

| 场景 | 原因或替代方式 |
| --- | --- |
| 预测未来债市方向 | 本面板组件估计基金已经形成的风险暴露。现有研究中，绝对久期水平没有明显预测能力；相对市场的近期加久期行为虽有短期统计关系，但跨年度表现不稳定，2026 年还出现方向反转 |
| 还原逐券持仓、杠杆或现金流 | 久期和因子暴露是净值时序模型估计的风险敏感度，不是持仓比例 |
| 用估计久期替代报告披露值 | 两者是不同来源的结果；披露点作为离散参照，不补齐或连成日频序列 |

## 查询与绘图

### 典型请求

- “查永赢裕益A全部历史修正久期。”
- “比较 000005 和 000015 在 2025 年的久期，并返回 3Y 与政金债暴露。”
- “给 006443.OF 生成久期、期限和利差三图 HTML。”

### 输入与默认值

- `--fund-code`：初始基金代码；最多 20 只，英文逗号分隔，可省略 `.OF`。
- `--start`、`--end`：可分别省略；均省略时查询全部已发布历史，均提供时为闭区间。
- `--fields`：默认只有 `estimated_modified_duration`；可选固定白名单见[字段字典](./fields.md)。

```bash
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/query.py" \
  history --fund-code 000005.OF,000015 --start 2025-01-01 --end 2025-12-31 \
  --fields estimated_modified_duration,beta_3,gamma_policy
```

### 返回

客户端逐只调用有界历史接口并合并到 `data.series`。每个元素包含基金身份和按模型日升序的
`points`；缺失交易日不补齐。任一基金请求失败时整次命令失败，不输出残缺的成功结果。

### 可视化

推荐生成交互 HTML，在当前 Agent Harness 的侧边栏打开，联动查看久期与风险暴露。
不支持侧边预览时提供 HTML 文件或链接；不默认生成 PNG 截图。

```bash
python3 "$SKILL_DIR/models/bond-fund-timeseries-factor/scripts/visualize.py" \
  all --input history.json --disclosed-input disclosed.json --output 006443-all.html
```

`duration`、`term-exposure`、`spread-exposure` 可分别生成单图；`all` 生成三图并共享时间范围
控制条。`--input` 接收完整 MCP 响应、API JSON 或单基 CLI 导出，离线绘制已保存区间；
`--disclosed-input` 可省略。三图的 history 需包含修正久期、全部 beta/gamma 和 `sample_type`。
没有快照时仍可用 `--fund-code` 配合 `--start`、`--end` 一步查询绘图。HTML 只提供运行外壳，图形
配置与网页预览共同使用 `assets/chart-renderer.mjs`。
图高、图例、标题及间距与网页一致；图内不放时间拖动条，滚轮用于上下浏览页面。

空 `points` 表示指定基金或区间没有已发布结果，不表示久期为零。
因子图要求每个模型日都有合法 `sample_type`；合约缺失时停止绘图。
