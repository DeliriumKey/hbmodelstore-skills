---
name: hbmodelstore-query
description: 通过 hbmodelstore 统一公网 API 发现、查询和解释模型数据，并在用户追问模型构建逻辑、版本演进或消融实验时自动读取网页的最新机器可读模型文档；用于列出可用模型，查询纯债基金指定日期或最新日期的全部修正久期截面、一只或多只基金的修正久期历史，以及按利率/信用模型分支和中长期/短期纯债类型拆分的修正久期中位数历史。无需 API Key，不直接连接 PostgreSQL，不用于模型接入、数据库管理、生产任务或服务器运维。
---

# hbmodelstore 模型查询

只通过 `https://api.delirium.com.cn` 的公开只读 API 查询模型数据。不要连接数据库、拼接
SQL、读取数据库环境变量，或调用管理员和运维流程。

## 使用顺序

1. 不确定模型是否存在或用户问“有哪些模型”时，先运行 `list-models`。
2. 根据 `model_key` 读取 `models/<model_key>/MODEL.md`。纯债基金时序多因子模型读取
   [bond-fund-timeseries-factor/MODEL.md](./models/bond-fund-timeseries-factor/MODEL.md)。
3. 使用对应模型目录的 `scripts/query.py` 查询，不手写 URL 参数；统一客户端只负责模型发现和
   获取机器可读模型文档。
4. 返回结果时说明实际模型日期，并把 `estimated_modified_duration` 明确解释为估算修正久期；
   空结果不解释为零。
5. API 故障、参数和状态码约定见 [api.md](./references/api.md)。
6. 用户追问模型构建逻辑、因子选择、版本演进、解释细节或消融实验时，运行
   `model-docs` 自动取得对应网页的最新机器可读内容，阅读后直接回答用户。不要要求用户自行
   打开网页，也不要用本地旧副本猜测细节。

## 查询入口

```bash
python skills/hbmodelstore-query/scripts/client.py --help
```

常用命令：

```bash
python skills/hbmodelstore-query/scripts/client.py list-models
python skills/hbmodelstore-query/scripts/client.py model-docs \
  --model-key bond-fund-timeseries-factor
python skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/query.py \
  cross-section --date 2025-01-02
python skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/query.py history \
  --fund-code 000005.OF,000015 --start 2025-01-01 --end 2025-12-31
python skills/hbmodelstore-query/models/bond-fund-timeseries-factor/scripts/query.py median \
  --breakdown sample-type-and-fund-type --start 2025-01-01 --end 2025-12-31
```

## 边界

- 只执行 API 已发布的固定、有限查询。
- 不尝试任意 SQL、任意表名、全库导出或绕过行数和日期限制。
- 不运行模型生产、回补、训练、写库、权限、部署或服务器操作。
- 不把估计结果描述为真实持仓，不直接给出投资建议。
- 网页模型文档是构建细节和补充实验的内容源；Agent 负责获取、阅读和回答，不把资料检索工作
  转交给用户。若当前文档确实无法取得，应说明无法验证最新细节，并区分本地已知边界与未验证
  内容。
- 新模型只有在 `/models` 可发现且 API 路由、模型脚本和模型说明均已发布后，才算
  对本 Skill 可用。
