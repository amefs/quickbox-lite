## Why

当前前端页面仍通过 HTML script/link 直接引用 /lib 下的浏览器库，依赖全局变量与脚本加载顺序，导致依赖升级、类型约束、打包与测试都难以统一管理。项目已具备 npm workspace 与 frontend React 工程，应该将这些库纳入 npm 依赖与模块化入口，消除对 /lib 直引的运行时耦合。

## What Changes

- 将 frontend 的第三方浏览器库从 HTML script/link 直引迁移为 npm 依赖导入与 React/Vite 构建产物加载。
- 在 frontend 建立库初始化与兼容层（如 jQuery 全局桥接、插件注册顺序）以替代页面内脚本顺序依赖。
- 将 dashboard shell 中对 /lib/* 的 script/link 引用移除，改为只加载 frontend 构建产物与必要静态资源。
- 按 workspace 根 package 约束版本治理前端库，frontend 仅通过 npm 依赖使用这些库，不再依赖 /lib 目录作为运行时来源。
- 补充测试与验收项，确保主题、控件、表格、弹窗、socket、滚动与可见性逻辑在模块化加载后保持一致。

## Capabilities

### New Capabilities
- `frontend-lib-npm-modules`: Dashboard frontend SHALL 通过 npm 管控和模块导入方式加载历史 lib 依赖，并消除对 /lib script/link 直引的依赖。

### Modified Capabilities
- None.

## Impact

- Affected code:
  - setup/dashboard/frontend/src/dashboard-page.tsx
  - setup/dashboard/frontend/src/client.ts
  - setup/dashboard/frontend/vite.config.ts
  - setup/dashboard/frontend/package.json
  - setup/dashboard/package.json
  - setup/dashboard/backend/src/controllers/dashboard.tsx (如需调整 shell 输出策略)
  - setup/dashboard/backend/tests/router.spec.ts
  - setup/dashboard/frontend/tests/dashboard-page.spec.tsx
- Dependencies:
  - 以 setup/dashboard/package.json 中既定版本为基线（例如 jquery、bootstrap、datatables、socket.io-client、select2、lobipanel、perfect-scrollbar、animate.css、font-awesome、ansi_up、bootbox、gritter、jquery-ui、jquery-ui-touch-punch、jquery-toggles、lazysizes、visibilityjs）。
- Runtime:
  - 前端将从“服务端注入多个 /lib 脚本”切换为“单入口构建产物 + 模块初始化”，减少脚本顺序耦合。
