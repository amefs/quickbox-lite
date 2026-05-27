## 1. Dependency Governance And Bootstrap Setup

- [x] 1.1 梳理当前 dashboard shell 中所有 `/lib/*` script/link 引用，并建立“库名 -> npm 包 -> 当前版本”映射清单（以 setup/dashboard/package.json 为基线）。
- [x] 1.2 在 frontend 增加 vendor 聚合入口（如 `src/vendor/index.ts`），按依赖顺序 import JS/CSS。
- [x] 1.3 在 vendor 聚合入口实现最小全局桥接（`window.$`、`window.jQuery`、以及 legacy 依赖的必要全局）。
- [x] 1.4 调整 frontend 依赖声明，确保由 workspace 统一解析，不再依赖 `/lib` 作为运行时来源。

## 2. Shell And Runtime Refactor

- [x] 2.1 更新 frontend shell 渲染（dashboard-page.tsx），移除所有 `/lib/*` link/script 标签。
- [x] 2.2 保留并验证 runtime config、`/skins/quick.css`、`/js/quick.js`、`/js/dashboard.js` 的必要注入。
- [x] 2.3 将 `client.ts` 接入 vendor 聚合入口，确保页面初始化顺序可重复且可测试。
- [x] 2.4 在 backend 路由或页面数据层完成必要适配，确保 split runtime 输出与入口资源路径正确。
- [ ] 2.5 将 `/js/quick.js` 与 `/js/dashboard.js` 运行时逻辑迁入 frontend 模块，shell 不再后置加载这两个 legacy 脚本。
- [ ] 2.6 将旧运行时依赖的 socket、弹窗、ANSI、滚动条、表格、toggle、tooltip/dropdown/modal 初始化改为模块内显式导入。

## 3. Test Migration And Validation

- [x] 3.1 更新 frontend shell 测试：将“包含 /lib 脚本顺序”断言替换为“无 /lib 直引 + 核心入口存在”断言。
- [x] 3.2 新增/更新 frontend 运行时 smoke 测试，覆盖 jQuery 插件链与关键全局可用性。
- [x] 3.3 更新 backend 路由/页面合同测试，验证渲染结果不再输出 `/lib` 的 script/link。
- [x] 3.4 执行 dashboard workspace build/type-check/test，确认 split runtime 关键交互无回归。

## 4. Hardening And Rollout

- [x] 4.1 为迁移后 bundle 进行体积与加载分析，必要时通过 Vite manualChunks 优化 vendor 分包。
- [x] 4.2 记录迁移后的依赖加载策略与全局桥接白名单，禁止新增隐式全局。
- [x] 4.3 完成回滚预案验证：若出现插件回归，可回滚到迁移前 shell/vendor 版本。

## 5. Browser Runtime Verification

- [ ] 5.1 使用真实浏览器验证 split dashboard 的 Font Awesome 图标与字体资源可见且无 404。
- [ ] 5.2 使用真实浏览器验证 DataTables/分页控件初始化成功且分页交互可用。
- [ ] 5.3 使用真实浏览器验证页面初始化期间 dashboard API、资源与 Socket.IO 请求无由拆分引入的 4xx/5xx 或动态导入错误。
