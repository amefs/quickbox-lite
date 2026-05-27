# lib to npm Mapping

This file tracks the migration baseline from legacy `/lib/*` runtime assets to npm-managed frontend imports.

| Legacy runtime path (shell) | npm package | Baseline version |
|---|---|---|
| `/lib/jquery/jquery.min.js` | `jquery` | `^3.7.1` |
| `/lib/jquery-ui/jquery-ui.min.js` | `jquery-ui` | `^1.14.1` |
| `/lib/jquery-ui/jquery-ui.min.css` | `jquery-ui` | `^1.14.1` |
| `/lib/jquery-ui-touch-punch/jquery.ui.touch-punch.min.js` | `jquery-ui-touch-punch` | `^0.2.3` |
| `/lib/bootstrap/js/bootstrap.min.js` | `bootstrap` | `3.4.1` |
| `/lib/jquery-toggles/toggles.min.js` | `jquery-toggles` | `^4.0.0` |
| `/lib/jquery-toggles/toggles-full.css` | `jquery-toggles` | `^4.0.0` |
| `/lib/jquery-gritter/css/jquery.gritter.css` | `gritter` | `^1.7.4` |
| `/lib/datatables/js/jquery.dataTables.min.js` | `datatables` | `^1.10.18` |
| `/lib/datatables/css/dataTables.bootstrap.min.css` | `datatables` | `^1.10.18` |
| `/lib/perfect-scrollbar/js/perfect-scrollbar.min.js` | `perfect-scrollbar` | `^1.5.6` |
| `/lib/perfect-scrollbar/css/perfect-scrollbar.min.css` | `perfect-scrollbar` | `^1.5.6` |
| `/lib/animate.css/animate.min.css` | `animate.css` | `^4.1.1` |
| `/lib/font-awesome/css/font-awesome.min.css` | `font-awesome` | `^4.7.0` |
| `/lib/select2/select2.min.css` | `select2` | `^4.0.13` |
| `/lib/select2/select2.min.js` | `select2` | `^4.0.13` |
| `/lib/lobipanel/js/lobipanel.min.js` | `lobipanel` | `^1.0.0` |
| `/lib/lobipanel/css/lobipanel.min.css` | `lobipanel` | `^1.0.0` |
| `/lib/visibility/visibility.fallback.js` | `visibilityjs` | `^2.0.2` |
| `/lib/visibility/visibility.core.js` | `visibilityjs` | `^2.0.2` |
| `/lib/visibility/visibility.timers.js` | `visibilityjs` | `^2.0.2` |
| `/lib/socket.io/socket.io.min.js` | `socket.io-client` | `^4.8.3` |
| `/lib/ansi_up/ansi_up.min.js` | `ansi_up` | `^5.2.1` |
| `/lib/lazysizes/lazysizes.min.js` | `lazysizes` | `^5.3.2` |
| `/lib/bootbox/bootbox.all.min.js` | `bootbox` | `^5.5.3` |

Source of baseline versions: setup/dashboard/package.json
