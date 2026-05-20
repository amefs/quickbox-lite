---
name: quickbox-lite-instructions
description: >-
  Coding standards, module navigation, and best practices for the quickbox-lite monorepo.
  Use when: working with TypeScript, PHP, React components, tests, or documentation across this mixed-stack project.
---

# QuickBox-Lite Development Guidelines

**Version**: 1.5.12 | **License**: GPL-3.0-or-later

This monorepo combines a PHP backend, React/TypeScript frontend, and E2E tests. Use this guide to navigate modules efficiently and follow unified coding standards.

## 📦 Project Structure Overview

### Core Modules (Active Only)

| Path | Purpose | Stack | Entry Point |
|------|---------|-------|------------|
| **setup/dashboard/ws** | WebSocket real-time data service (primary active area) | Node.js, TypeScript, Express, React | `src/index.ts` |
| **setup/dashboard** | Production dashboard frontend | PHP, jQuery, WebSocket | `index.php` |
| **packages/** | System package installers & management scripts | Bash, Shell | `install/`, `remove/`, `update/` |
| **e2e/** | End-to-end test suite | Playwright, TypeScript | `tests/*.spec.ts` |
| **setup/lang** | Multi-language i18n files | JSON | Localazy managed |

### Key Configuration Files

- `.php-cs-fixer.dist.php` – PHP code formatting rules (Symfony PSR-12)
- `phpstan.neon` – PHP static analysis (Level 8, strict)
- `eslint.config.mjs` – TypeScript/JavaScript linting (setup/dashboard/ws/)
- `tsconfig.json` – TypeScript compiler config (per module)
- `composer.json` – PHP dependencies + scripts
- `package.json` – Node.js dependencies (per module)
- `localazy.json` – i18n configuration

---

## 🔤 Coding Standards

### TypeScript / JavaScript (setup/dashboard/ws & e2e)

**File Naming**
- Use **snake_case**: `vnstat.ts`, `bw_tables.tsx`, `ram_stats.tsx`, `disk_data.tsx`
- Exported functions/constants: **camelCase**

**Function/Constant Signatures**
```typescript
// Async functions: explicit return types + `Promise<T>`
export async function getVnstatData(iface: string): Promise<ParsedVnstatData>

// Regular exports
export const netStatus = async () => { ... }
export function readOutputLog(offset?: number, length?: number): OutputLogResult

// Interfaces: PascalCase
export interface ParsedTrafficEntry { ... }
export interface ParsedVnstatData { ... }
```

**Code Style** (from eslint.config.mjs)
- **Indentation**: 4 spaces
- **Module system**: ES6 modules + TypeScript
- **Type checking**: strict mode (`strict: true`)
- **Target**: ES2022
- **React JSX**: enabled with TypeScript support
- **Severity**: TypeScript errors block linting

**Quality Checks**
- Run `npm run lint` to validate types + ESLint rules
- Use `npm run build` to compile TypeScript → JavaScript
- Run `npm test` (Mocha) before committing test changes

---

### PHP (setup/dashboard)

**File Header** (required on all PHP files)
```php
<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// [Brief file description]

error_reporting(\E_ERROR);  // Use backslash-prefixed constants
```

**Code Style** (from .php-cs-fixer.dist.php)
- **String quotes**: single quotes preferred
- **Function braces**: opening brace on same line as declaration
- **Operator alignment**: align `=>` and `=` operators
- **Type comparison**: strict comparison (`===`, `!==`)
- **Banned**: function aliases, short echo tags

**PHPDoc Convention**
```php
/**
 * Brief description.
 *
 * @param mixed $arr Parameter description
 * @return void
 */
function stripSlashesFromArray(&$arr) { ... }
```

**Key Files** (setup/dashboard/)
- `index.php` – Main dashboard entry point
- `inc/config.php` – Configuration & session management
- `inc/info.package.php` – Package/service definitions (maps to TypeScript)
- `inc/util.php` – Utility functions
- `widgets/` – Individual widget PHP files

**Quality Checks**
- `composer run lint` – PHP-CS-Fixer check
- `composer run lint-fix` – auto-fix formatting
- `composer run analyse` – PHPStan static analysis (Level 8)

---

### React Components (setup/dashboard/ws/src)

**Component File Naming**
- Files: **PascalCase** → `Dashboard.tsx`, `BwTables.tsx`, `RamStats.tsx`
- Folders: **kebab-case** → `src/components/`, `src/hooks/`, `src/utils/`

**Exports**
```typescript
// Default export for components
export default function Dashboard(props: DashboardProps) {
  return <div className="dashboard">...</div>
}

// Named exports for utilities
export const useWebSocket = () => { ... }
export const calculateMetric = (data: RawData): Metric => { ... }
```

---

## 🧪 Testing

### Unit Tests (Mocha + Chai + Sinon)
- **Location**: `setup/dashboard/ws/tests/`
- **File suffix**: `.spec.ts`
- **Run command**: `npm run test`
- **Example**: `server.spec.ts`, `debug.spec.ts`, `info.spec.ts`

```typescript
import { expect } from 'chai'
import { stub } from 'sinon'

describe('VnstatData', () => {
  it('should parse traffic data correctly', async () => {
    const result = await getVnstatData('eth0')
    expect(result).to.have.property('sent')
    expect(result.sent).to.be.a('number')
  })
})
```

### E2E Tests (Playwright)
- **Location**: `e2e/tests/`
- **File suffix**: `.spec.ts`
- **Run command**: `npm test` (from e2e/ dir)
- **Docker setup**: `npm run docker:up` → `npm run docker:down`
- **Interactive mode**: `npm run test:headed`

```typescript
import { test, expect } from '@playwright/test'

test('Dashboard should load successfully', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
})
```

---

## 📋 Common Workflow Patterns

### When Working on WebSocket Service (Most Active Area)
1. **Locate files** in `setup/dashboard/ws/src/` (utils, types, server)
2. **Check types** in same directory or shared `types/` folder
3. **Run lint + tests**: `npm run lint && npm run test`
4. **Build for deployment**: `npm run build` (generates `/build`)

### When Adding React Components
1. Create component in `setup/dashboard/ws/src/components/`
2. Use **PascalCase** filenames, **camelCase** exports
3. Add unit tests in `setup/dashboard/ws/tests/`
4. Run `npm run lint` to validate TypeScript

### When Modifying PHP Backend
1. Files are in `setup/dashboard/` and use SPDX headers + backslash constants
2. Run `composer run lint` → `composer run lint-fix` to auto-format
3. Run `composer run analyse` for static analysis
4. Test via E2E suite if UI changes are involved
5. Sync package definitions between `setup/dashboard/inc/info.package.php` (PHP) and `setup/dashboard/ws/src/config/packages.json` (TypeScript)

### When Running E2E Tests
1. Start Docker: `cd e2e && npm run docker:up`
2. Run tests: `npm test` or `npm run test:headed`
3. Reports generated in `e2e/playwright-report/`
4. Stop Docker: `npm run docker:down`

---

## ⚙️ Development Commands Quick Reference

### TypeScript WebSocket Service
```bash
cd setup/dashboard/ws

npm run build          # Webpack bundle → /build
npm run lint           # ESLint + type check
npm run test           # Mocha unit tests
npm run lint:fix       # Auto-fix ESLint issues
npm run dev            # Dev server (if available)
```

### PHP Code
```bash
composer run lint      # PHP-CS-Fixer check
composer run lint-fix  # Auto-format PHP
composer run analyse   # PHPStan analysis
```

### E2E Tests
```bash
cd e2e

npm run docker:up      # Start Docker environment
npm test               # Run all tests
npm run test:headed    # Interactive mode
npm run docker:down    # Stop Docker environment
```

---

## 🔍 Module-Specific Notes

### setup/dashboard (Production Dashboard)

**Important Files**
- `index.php` – Main dashboard entry point
- `inc/config.php` – Session & configuration initialization
- `inc/util.php` – Common utility functions
- `inc/info.package.php` – Package/service definitions (60+ services)
- `inc/panel.*.php` – Dashboard widgets & panels
- `inc/panel.*.ws.js` – WebSocket data handlers (legacy)
- `widgets/` – Individual widget PHP files

**Service Management**
- The dashboard manages 60+ system services (rtorrent, transmission, qbittorrent, deluge, plex, sabnzbd, etc.)
- Service definitions in `inc/info.package.php` must be synced with TypeScript config

**Connection to WebSocket Service**
- Legacy widgets use WebSocket via `inc/panel.*.ws.js`
- New widgets connect to `setup/dashboard/ws` (Node.js TypeScript service)

### setup/dashboard/ws

**Important Files**
- `src/index.ts` – Server entry point (Express + WebSocket)
- `src/types/` – Shared TypeScript interfaces
- `src/utils/` – Utility modules (vnstat, bw_tables, etc.)
- `src/server/` – Core server logic
- `src/widgets/` – React widgets (service status, uptime, etc.)
- `config/packages.json` – Package definitions (synced from PHP)
- `tests/` – Mocha test suite

**Common Utils**
- `vnstat.ts` – Parse vnstat network traffic data
- `bw_tables.tsx` – Bandwidth visualization
- `ram_stats.tsx` – RAM usage display
- `disk_data.tsx` – Disk analytics
- `service_status.tsx` – Service health indicators

**Troubleshooting**
- If Vitest fails with "@rc-component/util" module errors: Use Mocha + Node.js environment instead (background-only mode).
- Always run `npm run lint` before pushing changes.

### packages/ (System Installers)

**Directory Structure**
- `packages/package/install/` – Install scripts for various services
- `packages/package/remove/` – Uninstall scripts
- `packages/package/update/` – Update scripts
- `packages/system/` – System-level scripts

**Key Services Managed**
- **Torrent Clients**: rtorrent, transmission, qbittorrent, deluge, flood
- **Download Tools**: sabnzbd, autodl-irssi, nzbget
- **Media Services**: plex, emby, jellyfin
- **Utilities**: syncthing, rclone, filebrowser, openvpn, wireguard
- **Monitoring**: netdata, fail2ban, denyhosts, pbh (PeerBanHelper)

**Script Format**
- Bash shell scripts with standardized functions
- Lock files: `/install/.{service}.lock`
- Output log: `/srv/dashboard/db/output.log`
- Version/configuration stored in `/install/` directory

### E2E Tests

**Docker Configuration**
- `e2e/docker-compose.yml` – Brings up test environment
- `e2e/docker/Dockerfile.php` – Custom PHP image
- `e2e/docker/nginx.conf` – Web server config
- `e2e/docker/mock/` – Mock data providers

**Test Organization**
- `e2e/tests/dashboard.spec.ts` – Main dashboard tests
- Reports: `e2e/playwright-report/`
- Results: `e2e/test-results/`
- Tests cover: Widget rendering, WebSocket connection, service status, bandwidth tables, etc.

---

## 🌍 Internationalization (i18n)

- **Config**: `localazy.json` (managed via Localazy service)
- **Lang files**: `setup/lang/` (JSON format)
- **Use case**: Multi-language dashboard labels and messages

---

## 📝 File Header Requirements

**All files must include appropriate headers:**

```php
<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// [Brief description]
```

```typescript
// SPDX-License-Identifier: GPL-3.0-or-later
// [Brief description]
```

---

## 💡 Best Practices

1. **Avoid module-hopping**: If working in `setup/dashboard/ws/`, complete tasks there before switching modules.
2. **Type safety first**: Enable strict TypeScript; avoid `any` types when possible.
3. **Test-driven**: Write tests before modifying core logic.
4. **Static analysis**: Run linters + type checkers before committing (PHPStan, ESLint, TypeScript compiler).
5. **Commit messages**: Reference module names (`[ws]`, `[php]`, `[e2e]`).
6. **Documentation**: Update README/comments if adding new utility functions or components.

---

## 📚 Additional Resources

- **Main README**: [README.md](README.md)
- **TypeScript Config**: `setup/dashboard/ws/tsconfig.json`
- **ESLint Config**: `setup/dashboard/ws/eslint.config.mjs`
- **PHP Standards**: `.php-cs-fixer.dist.php` & `phpstan.neon`
- **E2E Guide**: `e2e/README.md`
