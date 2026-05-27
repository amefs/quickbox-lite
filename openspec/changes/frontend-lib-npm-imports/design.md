## Context

当前 split runtime 下，dashboard shell 由 frontend 的 SSR 组件输出，但仍保留大量 `/lib/*` 的 link/script 标签。页面逻辑依赖 jQuery 与插件的全局注入顺序（如 bootstrap、datatables、select2、lobipanel、gritter、toggles 等），并由 `/js/quick.js` 与 `/js/dashboard.js` 继续消费这些全局对象。该模式与 workspace 依赖治理目标冲突，也阻碍了版本可控升级和前端构建一致性。

## Goals / Non-Goals

**Goals:**
- 前端第三方库由 npm 统一管控，并在 frontend 工程中模块化导入。
- dashboard shell 移除 `/lib/*` 的 script/link 直引。
- 保留现有视觉与行为：主题、面板、菜单、弹窗、服务状态刷新、socket 通讯路径不变。
- 使用 `setup/dashboard/package.json` 的现有版本作为迁移基线，不引入未批准的版本漂移。

**Non-Goals:**
- 不重写 Quickbox UI 组件或主题 CSS。
- 不在本变更中重构 backend widget SSR 输出格式。
- 不移除 `/js/quick.js` 与 `/js/dashboard.js` 的业务逻辑（仅调整其依赖供应方式）。

## Decisions

### 1. 采用“前端依赖聚合入口”替代 HTML 脚本顺序注入
- 在 frontend 建立 `src/vendor/index.ts`（或等价入口）按顺序 import 第三方库与样式。
- 入口负责初始化全局桥接：`window.$`、`window.jQuery`、以及插件对 jQuery 原型的挂载可见性。
- `client.ts` 仅消费聚合入口，不再依赖页面 script 注入。

Rationale:
- 用模块入口显式表达依赖顺序，避免 SSR 模板维护脆弱脚本序。

Alternative considered:
- 保留 script 注入并仅做版本对齐。该方案无法真正消除 /lib 耦合。

### 2. CSS 走 npm import + 构建产物，不再来自 /lib 路径
- 将 jquery-ui、datatables、select2、lobipanel、font-awesome、animate.css、perfect-scrollbar、gritter、toggles 等样式改为 frontend import。
- 保留 `/skins/quick.css` 为主题来源，不进入本变更的重写范围。

Rationale:
- 样式与脚本同源于 npm，版本与构建产物统一可追踪。

Alternative considered:
- CSS 继续走 `/lib`，仅 JS 模块化。会保留双轨依赖源，后续维护复杂。

### 3. 与 legacy 脚本保持兼容的最小全局接口
- 对仍使用全局变量的 legacy 脚本，frontend 入口提供最小必要 global bridge。
- 明确白名单全局（jQuery、bootbox、io/Socket、ansi_up 等），禁止继续新增隐式全局。

Rationale:
- 降低一次性重构风险，先完成依赖来源切换。

Alternative considered:
- 一步到位重写 legacy 脚本为纯模块。风险高、范围超出本次目标。

### 4. 依赖版本治理以 dashboard workspace 根为准
- 使用 `setup/dashboard/package.json` 中已定义版本，不在本变更提升主版本。
- frontend 包仅声明实际使用依赖，安装由 workspace 统一解析。

Rationale:
- 符合已有 workspace 治理与审计流程。

Alternative considered:
- frontend 单独固定另一套版本，会引入重复依赖与冲突风险。

## Risks / Trade-offs

- 插件加载顺序错误导致运行时功能异常（DataTables/Select2/Lobipanel）
  - Mitigation: 在 vendor 入口中显式顺序 import，并增加 smoke 测试覆盖关键插件存在性。
- 全局桥接不完整导致 legacy JS 报错
  - Mitigation: 列出并测试最小全局接口矩阵，禁止隐式新增。
- CSS 来源变化导致样式差异
  - Mitigation: 增加 shell 渲染快照与关键 DOM class 可视基线校验。
- 构建产物体积上升
  - Mitigation: 通过 Vite 手动 chunk 策略分组 vendor 包，并监控首屏脚本大小。

## Migration Plan

1. 在 frontend 引入 vendor 聚合入口，完成 JS/CSS 依赖导入与全局桥接。
2. dashboard-page.tsx 移除 `/lib/*` link/script 标签，仅保留 runtime config、主题与业务入口脚本。
3. 更新 frontend 与 backend 的相关测试断言：从“script 顺序包含 /lib”转为“无 /lib 引用 + 关键功能可用”。
4. 在 split runtime 下执行 frontend/backend 测试与页面 smoke 验证。
5. 若出现回归，可临时回滚到上一个 shell 模板与 vendor 入口前版本（单变更回滚，不动 backend API）。

## Open Questions

- 是否允许在本变更中将 `/js/quick.js`、`/js/dashboard.js` 逐步并入 frontend 模块（建议后续独立变更处理）。
- 对 `visibilityjs`、`gritter` 这类较旧库，是否需要在迁移后追加替代计划（不阻塞本次）。
