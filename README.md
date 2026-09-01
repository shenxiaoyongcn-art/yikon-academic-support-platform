# 学术支持管理平台

面向招标、科研项目、售后闭环、推广会议、数据分析与汇报、PGD 资质评审和遗传咨询培训的一体化学术业务中台。

完整业务逻辑、对接方案、数据模型和实施顺序见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 环境配置

复制 `.env.example` 中的键到托管环境，密码和 Token 不得提交到仓库。

## 主要服务端接口

- `GET /api/integrations/health`：查看 Synology/BMP 连通与配置状态。
- `GET /api/tender/search?q=...`：在 Synology 云盘搜索招标证据。
- `POST /api/bmp/sync/{module}`：管理员触发 BMP 模块增量同步。
- `POST /api/medical-lab/sync`：管理员触发医检所医院运营指标增量同步。
- `GET/POST /api/pgd-centers`：读取或维护全国 PGD 中心名单与周期运营数据。

BMP `module` 可用值：`research`、`aftersales`、`events`、`salesAnalytics`、`pgdReview`、`pgdCenters`、`training`。
