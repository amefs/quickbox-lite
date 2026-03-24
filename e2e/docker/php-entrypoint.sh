#!/bin/sh
# Initialize mock data for the dashboard db directory.
# This is run as an entrypoint override in docker-compose.

DB_DIR="/srv/dashboard/db"
INSTALL_DIR="/install"
IFACE="${E2E_IFACE:-eth0}"

# Create db directory structure
mkdir -p "$DB_DIR/session_5sec"
mkdir -p "$INSTALL_DIR"

# Write mock data if files don't exist
[ -f "$DB_DIR/master.txt" ] || echo 'testuser' > "$DB_DIR/master.txt"
[ -f "$DB_DIR/interface.txt" ] || echo "$IFACE" > "$DB_DIR/interface.txt"
[ -f "$DB_DIR/output.log" ] || echo '' > "$DB_DIR/output.log"
[ -f "$DB_DIR/locale.php" ] || cat > "$DB_DIR/locale.php" <<'EOF'
<?php

// SPDX-License-Identifier: GPL-3.0-or-later

$locale   = 'en_US.UTF-8';
$language = 'lang_en';
EOF
[ -f "$DB_DIR/branding-l.php" ] || cat > "$DB_DIR/branding-l.php" <<'EOF'
<?php
// SPDX-License-Identifier: GPL-3.0-or-later
?>

<a href="#"><img src="img/logo-light.png" alt="QuickBox Seedbox" class="logo-image" height="50" /></a>
EOF
[ -f "$DB_DIR/branding-m.php" ] || cat > "$DB_DIR/branding-m.php" <<'EOF'
<?php
// SPDX-License-Identifier: GPL-3.0-or-later

assert(isset($branch));
?>
<ul class="dropdown-menu pull-right">
  <li>
  <?php if ($branch === 'master') { ?>
    <a onclick="boxHandler(event)" data-package="" data-operation="enable-dev" data-toggle="modal" data-target="#sysResponse" style="cursor: pointer;"><?php echo T('SWITCH_DEV'); ?></a>
  <?php } elseif ($branch === 'development') { ?>
    <a onclick="boxHandler(event)" data-package="" data-operation="disable-dev" data-toggle="modal" data-target="#sysResponse" style="cursor: pointer;"><?php echo T('SWITCH_MASTER'); ?></a>
  <?php } ?>
  </li>
  <li style="border-top: 1px solid #444">
    <a href="https://github.com/amefs/quickbox-lite/issues/new" target="_blank" rel="noopenner noreferrer"><i class="fa fa-warning text-warning"></i><?php echo T('ISSUE_REPORT_TXT'); ?></a>
  </li>
</ul>
EOF
[ -f "$DB_DIR/.smoked.lock" ] || : > "$DB_DIR/.smoked.lock"

# Mirror setup.sh install markers that PHP/JS may inspect.
[ -f "$INSTALL_DIR/.dashboard.lock" ] || : > "$INSTALL_DIR/.dashboard.lock"
[ -f "$INSTALL_DIR/.quickbox-ws.lock" ] || : > "$INSTALL_DIR/.quickbox-ws.lock"

# setup.sh replaces the interface placeholder in config.php after detecting the active NIC.
if grep -q "INETFACE" /srv/dashboard/inc/config.php; then
    sed -i "s/INETFACE/$IFACE/g" /srv/dashboard/inc/config.php
fi

# setup.sh defaults to the smoked theme and copies those assets into /srv/dashboard/skins.
if [ -d /src/setup/themes/smoked/skins ]; then
    rm -f /srv/dashboard/skins/quick.css
    cp -fR /src/setup/themes/smoked/skins/. /srv/dashboard/skins/
fi

# Set permissions
chmod -R 777 "$DB_DIR"

# Execute the original entrypoint
exec docker-php-entrypoint php-fpm "$@"
