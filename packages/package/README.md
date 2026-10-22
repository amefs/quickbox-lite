# Package 生命周期脚本规范

本目录的 `install/installpackage-*`、`remove/removepackage-*` 和
`update/updatepackage-*` 使用同一套脚本框架。新增或修改软件包时，以
[`install.sh.template`](templates/install.sh.template)、
[`remove.sh.template`](templates/remove.sh.template)、
[`update.sh.template`](templates/update.sh.template) 为起点。
模板是可复制的独立 Bash 文件；部署后的脚本不需要读取模板或加载新增的公共库。

## 运行检查

在仓库根目录运行：

```sh
python3 scripts/lint-package-scripts.py
python3 tests/system/package-scripts-lint-test.py
```

只依赖 Python 3.10+ 标准库和 Bash，不需要安装 Python 包。脚本从自身位置定位仓库，
可以在任意工作目录调用。检查指定的 package 目录时使用：

```sh
python3 scripts/lint-package-scripts.py --root /path/to/packages/package
```

`--root` 下必须有 `install`、`remove`、`update` 目录，检查标准仍来自本仓库的模板。
lint 默认只读，使用 `bash -n` 检查语法，不会执行或 source 软件包脚本。
成功返回 0，规范错误返回 1，依赖或读取失败返回 2。错误包含文件路径、行号和规则名。
GitHub Actions 的 `package-script-linter` job 会运行检查和回归测试。

## 文件框架

文件使用 UTF-8、LF 换行和末尾换行，以 `#!/bin/bash` 开头。
头部使用统一字段和顺序，字段值对齐到第 20 列：

```bash
#!/bin/bash
#
# [QuickBox Lite Authelia Installer]
#
# GitHub:           https://github.com/amefs/quickbox-lite
# Author:           Amefs
# Maintainer:       Amefs
# Current version:  v1.6.1
# Original Repo:    https://github.com/QuickBox/QB
# Credits to:       QuickBox.io
#
# SPDX-License-Identifier: GPL-3.0-or-later
#
################################################################################
```

`GitHub`、`Author`、`Current version` 和 SPDX 标识为必填；`Maintainer` 仅在维护者与作者不同时添加，
`Original Repo`、`Credits to` 只在存在上游来源时添加。字段顺序固定为
`GitHub → Author → Maintainer → Current version → Original Repo → Credits to`，不要保留空的 `URL:` 字段。
`Current version` 由 `bump-version.sh` 维护，标签和两个空格都不要改动；模板目录也在版本扫描范围内。
标题后、SPDX 前各保留一个空 `#`；SPDX 后的空 `#` 之后只允许 `# shellcheck` 指令。
头部只放注释，并保留 license 区域末尾的整行 `#` 标题分隔线。
该分隔线与下一个分区的上边框是两条独立的线；分区标题文字只能出现在完整的分区边框中，不能在边框外重复。
同一软件包的 install/remove/update 头字段值必须一致；lint 会检查字段必填、顺序、对齐、空值和跨脚本差异。
模板使用 `Author: <author>` 和当前版本占位，复制后替换作者和可选来源字段。
下列分区按顺序出现，每个分区用上下各 80 个 `#` 包围标题：

| 分区 | 内容 |
| --- | --- |
| `CORE VARIABLE`（可选） | 运行环境初始化、已有的 shell 选项 |
| `HELP FUNCTIONS` | 与模板完全一致的终端颜色、NEWT 配色和日志函数 |
| `APP VARIABLE` | 软件包身份、服务名、依赖、默认日志路径及专用变量 |
| `SCRIPT FUNCTIONS` | `_usage` 和通用辅助函数，例如版本比较 |
| `INSTALL FUNCTIONS` / `REMOVE FUNCTIONS` / `UPDATE FUNCTIONS` | 对应操作的锁管理及业务函数 |
| `OPT GENERATOR` | 统一参数循环及软件包专用参数分支 |
| `MAIN PROCESS` | 按依赖顺序调用生命周期函数 |

lint 拒绝未知的分区标题，以及长度不是 80 的分隔线；许可头里的单个 `#` 行不受影响。

所有外层函数采用多行定义：

```bash
function _configureApp() {
	# Package-specific configuration.
	_info "Configuring ${APP_TITLE}..."
}
```

`function name() {` 必须写在同一行；`name() {`、`function name {`、把 `{` 放到下一行、单行函数等写法都会报错，避免函数定义逃过重复和必需函数检查。
函数分区只放函数定义和注释；参数解析完成后再从主流程调用业务函数。
公共帮助函数和参数框架采用模板中的 Tab 缩进；业务函数的内容、条件分支及现有缩进可以保留。
heredoc 中生成的配置和嵌入脚本不参加外层框架检查，也不要求改变其缩进。

## 元信息和日志

```bash
APP_TITLE="Example App"
APP_NAME="example"
APP_SERVICE="example"
APP_BASEDEPS=""
APP_LOCK=".${APP_NAME}.lock"
OUTTO="/srv/dashboard/db/output.log"
```

`APP_TITLE` 和 `APP_NAME` 必须是非空的双引号字符串，在同一个软件包的三类脚本中保持一致。
文件名使用对外的软件包标识；`APP_NAME` 可以使用实际应用名，例如 `cifs` 对应 `samba`。
有服务或依赖时声明 `APP_SERVICE`、`APP_BASEDEPS`，没有时可以省略。
上述核心元信息不能重复赋值。

全局操作锁使用 `/install/.install.lock`，软件包安装标记按现有粒度保存。
声明 `APP_LOCK` 时使用 `".${APP_NAME}.lock"` 或 `".${username}.${APP_NAME}.lock"`。
已有直接使用用户级标记路径的脚本可以保留其路径，不能为统一外观而改变锁的粒度。

`HELP FUNCTIONS` 提供 `_execute`、`_print`、`_info`、`_success`、`_warning`、`_error`。
日志输出默认追加到 `OUTTO`，`-l` / `--log` 可以覆盖。当前 `_execute` 沿用项目原有的
单个命令字符串调用约定；需要管道、重定向或复杂引号的命令应直接写 Bash 并显式重定向日志。

## 参数约定

每个脚本都提供 `-h` / `--help` 和 `-l` / `--log <logfile>`，并在 `_usage` 中说明。
帮助正常退出时返回 0，`getopt` 拒绝参数时返回 1。使用 GNU getopt：

```bash
if ! ARGS=$(getopt -a -o hl: -l help,log: -- "$@"); then
	_usage
	exit 1
fi
eval set -- "${ARGS}"
```

必须保留 `"$@"`、`eval set -- "${ARGS}"` 和 `OUTTO="$2"` 的引号，确保带空格或单引号的值能够正确传递。
`_usage` 必须逐一说明 getopt 声明的短选项和长选项；lint 会检查遗漏的参数。
专用参数在 `getopt` 的短、长选项中声明，并在公共 `--help` / `--log` 分支之后、`--)` 之前增加处理分支。
所有声明都必须有处理分支，所有处理分支也必须有声明，别名的取值要求必须一致。
需要值的参数在分支内只 `shift` 一次，并从 `$2` 读取值；不需要值的参数不得在分支内 `shift`。lint 会检查这两点。

```bash
	-v | --version)
		version="$2"
		shift
		;;
```

不得保留只有声明、没有实际行为的参数；新增参数时同时更新 `_usage` 中的调用示例和说明。

## 生命周期约定

| 操作 | 开始步骤（顺序固定） | 中间步骤 | 结束步骤 |
| --- | --- | --- | --- |
| install | `_lockCheck` → `_setLock` → `_installInfo` | 按需添加源、安装依赖、安装或配置应用、调用 `_installAppLock`、启动服务 | `_lockCleanup` |
| remove | `_lockCheck` → `_setLock` → `_removeInfo` | 按需停止服务、移除依赖或应用、调用 `_removeAppLock` | `_lockCleanup` |
| update | `_lockCheck` → `_setLock` → `_updateInfo` | 调用 `_updateApp`，按需重新配置、重启服务 | `_lockCleanup` |

`_usage` 放在 `SCRIPT FUNCTIONS`，其余必需的生命周期函数放在对应操作的函数分区。
`_lockCheck` 检查全局操作锁和软件包自身的前置条件，`_setLock` 写入全局操作锁，
`_lockCleanup` 删除全局操作锁，或调用已有的 `_clearInstallLock` 来完成清理。
`_installAppLock` 必须创建软件包安装标记，`_removeAppLock` 必须删除该标记；空的成功提示函数不算完成锁管理。
同一个软件包在 install/remove/update 中声明 `APP_LOCK` 时，表达式必须一致。
主流程允许按软件包需要增加条件分支，所有调用的函数必须已定义。

软件包业务可以只需要依赖安装或配置步骤，不强制添加空的安装、服务或依赖函数。
模板中的业务占位函数会报错退出，复制后必须实现相应业务再使用。
lint 检查框架、参数对应关系和 Bash 语法；下载是否成功、命令失败处理、锁的并发和异常清理
等运行行为仍需对应软件包的功能验证。
