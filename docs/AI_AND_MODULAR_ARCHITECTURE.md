# Yikon 学术支持平台：AI、数据分析与模块化架构

## 1. “AI Enhanced”在本平台中的真实含义

AI不是一个装饰标签，也不直接替代临床诊断。平台采用五层链路：

1. 数据接入：BMP、医检所、Synology、Excel与人工录入。
2. 结构化计算：字段映射、去重、时间窗、目标达成、异常阈值、投入产出等确定性规则。
3. 知识检索：从SOP、资质、论文、历史案例及评审材料中定位证据。
4. 模型增强：本地或私有模型只对汇总结果做归纳、问答和初稿整理，不改写原始事实。
5. 人工决策：负责人复核结论、确认责任动作和时间节点，平台保留审计记录。

“AI-Powered Decision”应翻译为“AI辅助决策”，不是“AI代替决策”。临床诊断、遗传咨询结论、PGT实施方案和评审材料仍由相应专业人员最终确认。

## 2. 当前已经落地的能力

- `/api/ai/analyze`：按业务模块读取真实平台记录并生成可追溯研判。
- 规则分析：高优先级、逾期、阶段集中度、数据来源覆盖；数据分析模块额外检查产品目标达成和医检所指标；科研模块额外汇总医院投入产出。
- 模型适配：兼容OpenAI格式的私有模型接口；未配置模型时自动使用规则结果，不影响业务。
- 数据控制：默认不向模型发送数据。只有明确设置 `AI_MODEL_SEND_AGGREGATES=true` 后，才会发送已汇总的判断，不发送患者级数据。
- 审计：每次分析记录模块、数据量、模型模式和判断数量。

可选服务端配置：

```text
AI_MODEL_BASE_URL=https://私有模型服务/v1
AI_MODEL_NAME=已部署模型名称
AI_MODEL_API_KEY=服务端密钥（如需要）
AI_MODEL_SEND_AGGREGATES=false
```

## 3. BMP数据二次分析建议

BMP负责业务事实，本平台负责分析语义。建议分三层：

- 原始层：原样保存BMP外部编号、更新时间和源字段，不覆盖证据。
- 标准层：统一医院、产品、人员、地区和月份主数据，保留无法映射记录。
- 分析层：形成医院×产品×人员×月份的销量事实，以及会议、科研、售后和评审的业务事实。

小中规模数据继续使用D1/SQLite即可。较大批量的CSV、JSON或Parquet二次分析，可增加本地DuckDB与Polars任务服务：DuckDB适合直接查询CSV/Parquet，Polars适合列式清洗、连接和批处理。模型不负责算销量、比例或ROI，只负责解释规则计算后的结果。

建议的开源组合：

- [DuckDB](https://duckdb.org/docs/current/data/overview)：嵌入式分析数据库，适合CSV、JSON、Parquet及批量聚合。
- [Polars](https://docs.pola.rs/)：数据清洗、主数据映射和高性能表格计算。
- [Ollama](https://docs.ollama.com/)：在内网或单机运行开源模型；通过兼容接口接入模型增强层。
- [Tauri](https://tauri.app/)：如后续需要签名安装包，可复用现有前端封装Windows/macOS客户端。

## 4. 八模块独立维护结构

每个业务模块现在均在 `lib/platform/modules/` 下有独立文件：

1. `tender.ts`：招标中心
2. `research.ts`：科研项目
3. `aftersales.ts`：售后闭环
4. `events.ts`：推广会议
5. `analytics.ts`：数据分析与汇报
6. `pgd-review.ts`：PGT资质评审
7. `training.ts`：遗传咨询培训
8. `pedigree.ts`：遗传家系图

每个文件自行维护首页卡片、模块目标、流程门禁、指标、示例表和数据录入字段；`modules/index.ts`只负责注册顺序，`catalog.ts`和`module-maintenance.ts`只负责总控装配。

## 5. 客户端路径

当前版本采用PWA：Chrome、Edge或Safari可把同一网站安装为桌面客户端，不复制第二套前端代码；业务数据仍从服务端读取，服务工作线程不缓存内部页面和接口响应。

如后续必须交付 `.exe`、`.dmg` 安装包，再增加Tauri外壳。Tauri只承担窗口、自动更新、证书和本地模型连接，业务模块继续复用当前代码，避免网页和客户端分别维护。
