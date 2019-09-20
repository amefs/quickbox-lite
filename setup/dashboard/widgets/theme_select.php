<?php

$option = array(
        'defaulted',
        'smoked'
);

foreach ($option as $theme) {
if (isset($_GET['themeSelect-'.$theme.''])) {
        header('Location: /');
        shell_exec("sudo /usr/local/bin/quickbox/system/theme/themeSelect-$theme");
}}

?>
