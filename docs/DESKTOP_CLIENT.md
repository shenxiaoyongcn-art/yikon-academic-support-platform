# Yikon 桌面客户端

桌面端采用 Tauri 2，定位为“在线业务平台 + 本地数据工作台”。业务流程继续使用统一线上平台；BMP、医检所和科研成本导出文件可直接在本机导入、查询和汇总，不自动上传云端。

## 当前安装包

- `desktop-release/Yikon学术支持平台_0.2.0_macOS_AppleSilicon.dmg`
- 适用于M1/M2/M3/M4/M5等Apple Silicon Mac。
- 当前为公司内部测试版（ad-hoc签名）。首次打开若被macOS拦截，请在“系统设置→隐私与安全性”中选择允许打开。
- Windows安装包需要在Windows构建环境生成；源代码与本地分析逻辑已经跨平台配置。

## 已封装能力

- Excel（XLSX/XLS）和CSV导入；Excel默认读取第一个工作表。
- 本地SQLite持久化，不保存BMP账号密码。
- 全字段关键词查询，单页最多返回500行。
- 按医院、产品、人员等字段分组，支持记录数、求和、平均值。
- 当前查询结果导出CSV。
- 数据集本地删除；源文件不会被删除。

## 构建

```bash
pnpm install
pnpm tauri icon desktop-ui/icon.svg
pnpm desktop:build
```

macOS产物位于 `src-tauri/target/release/bundle/`。正式对外分发前需要配置Apple Developer ID签名和公证；当前配置使用ad-hoc签名，适合内部测试。

Windows安装包需要在Windows构建环境生成，业务代码与本地数据库逻辑无需重写。
