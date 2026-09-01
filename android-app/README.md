# 亿康遗传家系图 Android 版

该应用将家系图工作台、GenCC 单基因病目录和变异类型字典完整打包到本地，
不申请网络权限；家系数据存放于应用自己的 WebView 本地存储中。

构建依赖：JDK 17、Android SDK 36 / Build Tools 36.0.0，以及项目现有的
Node.js 依赖。可执行：

```bash
./scripts/build-android-apk.sh <android-sdk-root> <jdk-home> <node-binary> [output-apk]
```

脚本使用 Android 官方 `aapt2`、`d8`、`zipalign` 和 `apksigner` 生成 APK。
首次构建会在 `android-app/keystore/` 生成内部测试签名；该目录不会提交到
Git。后续升级必须保留同一签名文件，否则已安装应用无法覆盖升级。

当前 APK 适用于内部测试和院内试用。正式对外发布前，需改用公司统一保管的
生产签名，并建立版本号、签名备份和发布审批流程。
