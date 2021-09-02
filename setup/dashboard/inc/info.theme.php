<?php

$themes = [
    ['file' => 'defaulted', 'title' => 'Defaulted'],
    ['file' => 'smoked', 'title' => 'Smoked'],
];

if (count($_GET) > 0) {
    foreach ($themes as $theme) {
        if (isset($_GET['themeSelect-'.$theme['file']])) {
            header('Location: /');
            shell_exec('sudo /usr/local/bin/quickbox/system/theme/themeSelect-'.$theme['file']);
            break;
        }
    }
}
