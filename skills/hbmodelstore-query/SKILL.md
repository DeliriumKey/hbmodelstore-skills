---
name: hbmodelstore-query
description: 通过 hbmodelstore 统一公网 API 发现、查询和解释模型数据；用于列出可用模型，查询纯债基金最新久期、历史久期和当前久期截面，并在后续模型接入 API 后作为统一用户入口。无需 API Key，不直接连接 PostgreSQL，不用于模型接入、数据库管理、生产任务或服务器运维。
---

# hbmodelstore 模型查询

只通过 `https://api.delirium.com.cn` 的公开只读 API 查询模型数据。不要连接数据库、拼接
SQL、读取数据库环境变量，或调用管理员和运维流程。

## 使用顺序

1. 不确定模型是否存在或用户问“有哪些模型”时，先运行 `list-models`。
2. 根据 `model_key` 读取 `models/<model_key>/MODEL.md`。久期模型读取
   [bond-fund-duration/MODEL.md](./models/bond-fund-duration/MODEL.md)。
3. 使用 `scripts/client.py` 的固定命令查询，不手写 URL 参数。
4. 返回结果时说明数据日期、模型版本、样本类型和有效性或回退标记；空结果不解释为零。
5. API 故障、参数和状态码约定见 [api.md](./references/api.md)。

## 查询入口

```bash
python skills/hbmodelstore-query/scripts/client.py --help
```

常用命令：

```bash
python skills/hbmodelstore-query/scripts/client.py list-models
python skills/hbmodelstore-query/models/bond-fund-duration/scripts/query.py \
  latest --fund-code 000005.OF
python skills/hbmodelstore-query/models/bond-fund-duration/scripts/query.py history \
  --fund-code 000005.OF --start 2025-01-01 --end 2025-12-31
python skills/hbmodelstore-query/models/bond-fund-duration/scripts/query.py \
  cross-section --mode summary
```

## 边界

- 只执行 API 已发布的固定、有限查询。
- 不尝试任意 SQL、任意表名、全库导出或绕过行数和日期限制。
- 不运行模型生产、回补、训练、写库、权限、部署或服务器操作。
- 不把估计结果描述为真实持仓，不直接给出投资建议。
- 新模型只有在 `/models` 可发现且 API 路由、模型脚本和模型说明均已发布后，才算
  对本 Skill 可用。
