# 打新研究的底仓指数行情

用于打新研究中比较股票底仓收益、规模和回撤，按问题读取沪深300、上证50等指数。
打新发行数据继续从 hbmodelstore 查询；底仓指数使用以下公开行情接口，无需 Token。
这是本模型的补充取数指引，不改变 hbmodelstore 的模型 API。

## 公开接口

腾讯财经日线：`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get`

GET 参数 `param` 为 `代码,day,起始日期,结束日期,640,qfq`，日期使用 `YYYY-MM-DD`。
响应的 `code=0` 表示成功，日线位于 `data[代码].day`（兼容 `qfqday`）；
每行前六项为日期、开盘、收盘、最高、最低、成交量，收益计算使用第三项收盘值。

| 指数 | 行情代码 |
| --- | --- |
| 沪深300 | sh000300 |
| 上证50 | sh000016 |

用 Python 标准库即可查询，按自然年分段读取长区间，避免单次条数上限截断历史：

```python
import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

symbol = "sh000300"
start, end = "2025-01-01", "2025-12-31"
url = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?" + urlencode({
    "param": f"{symbol},day,{start},{end},640,qfq",
})
request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urlopen(request, timeout=30) as response:
    payload = json.load(response)
if payload.get("code") != 0:
    raise RuntimeError(payload.get("msg", "指数行情请求失败"))
item = payload.get("data", {}).get(symbol, {})
rows = item.get("day") or item.get("qfqday") or []
prices = [{"date": row[0], "close": float(row[2])}
          for row in rows if start <= row[0] <= end]
if not prices:
    raise ValueError("本次请求未取得指数行情")
```

查询后保存原始响应、指数代码、请求区间、实际首末日期和来源；重复分析复用文件。
合并分段后按日期去重、排序，区间收益另取起始日前一个交易日的收盘值作为基点。
实际行情覆盖决定可比区间；请求失败或交易日缺口保留并说明，不补成零收益。
接口用法可对照 [AKShare 的腾讯指数日线文档](https://github.com/akfamily/akshare/blob/main/docs/data/index/index.md)。
以上两个代码于 2026/10/27 实测可读取 2025/01/02—2026/10/26 日线。

## 用于底仓研究

这些是价格指数，用于观察市场涨跌和价格回撤，不含股息再投资，也不代表指增超额。
有全收益指数或具体产品净值时，按所讨论的收益口径选择并注明；不凭空给指数加一段增强收益。
上证50可以作为沪市底仓市场风险的参照，但其表现不证明深市申购资格；
沪深300的整体走势同样不能替代账户分市场的真实持仓市值。

与打新收益合成完整产品前，按[产品情景指引](../analysis/hs-return-review.md#底仓与策略价值)
确定底仓比例的依据及对应的 `scope`。指数风险对照可以固定打新增量，完整产品比较则使用各方案
可参与市场的测算结果；新增的其他市场底仓也进入组合路径。

将指数与打新按同一期间、同一账户分母比较。合成策略时明确底仓比例和资金处理假设，
用对齐的日度路径计算回撤，避免用全年打新贡献直接抵扣某次最大回撤。
图表中指数来源标为腾讯财经，打新数据来源沿用模型，两者分别标明。
