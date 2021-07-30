<?php

$option = [
    'defaulted',
    'smoked',
];

if (count($_GET) > 0) {
    foreach ($option as $theme) {
        if (isset($_GET['themeSelect-'.$theme.''])) {
            header('Location: /');
            shell_exec("sudo /usr/local/bin/quickbox/system/theme/themeSelect-{$theme}");
            break;
        }
    }
}
