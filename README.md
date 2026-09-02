# 学术支持管理平台

面向招标、科研项目、售后闭环、推广会议、数据分析与汇报、PGD 资质评审和遗传咨询培训的一体化学术业务中台。

完整业务逻辑、对接方案、数据模型和实施顺序见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

新电脑从零运行、环境变量、数据库和线上发布交接流程见 [《网站复现部署交接文档》](./docs/网站复现部署交接文档.md)。

## 环境配置

复制 `.env.example` 中的键到托管环境，密码和 Token 不得提交到仓库。

## 遗传家系图网页版

遗传家系图提供独立的静态网页构建，不依赖服务器和数据库。疾病目录、常用位点快捷数据与绘图功能随网页一起打包，病例数据只保存在使用者当前浏览器中。

```bash
pnpm install --frozen-lockfile
pnpm dev:pedigree-web
pnpm build:pedigree-web
```

生产文件输出到 `web-dist/`，可直接部署到 GitHub Pages、Cloudflare Pages、对象存储静态网站或普通 Nginx/Apache 目录。由于采用相对资源路径，也可部署在域名子目录。

仓库中的 `Deploy pedigree web to GitHub Pages` 工作流会在家系图相关代码更新后自动构建并发布；首次使用时需在 GitHub 仓库的 **Settings → Pages → Build and deployment** 中将 Source 设为 **GitHub Actions**。

> 本工具用于家系资料整理和遗传咨询辅助。疾病、遗传模式和变异快捷数据必须结合正式检测报告、标准 HGVS、临床表型及最新数据库进行专业复核。

## 主要服务端接口

- `GET /api/integrations/health`：查看 Synology/BMP 连通与配置状态。
- `GET /api/tender/search?q=...`：在 Synology 云盘搜索招标证据。
- `POST /api/bmp/sync/{module}`：管理员触发 BMP 模块增量同步。
- `POST /api/medical-lab/sync`：管理员触发医检所医院运营指标增量同步。
- `GET/POST /api/pgd-centers`：读取或维护全国 PGD 中心名单与周期运营数据。

BMP `module` 可用值：`research`、`aftersales`、`events`、`salesAnalytics`、`pgdReview`、`pgdCenters`、`training`。
