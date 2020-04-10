<?php
if (isset($_GET['clean_mem'])) {
        header('Location: //');
        shell_exec("sudo /usr/local/bin/quickbox/system/box clean mem");
}

if (isset($_GET['clean_log'])) {
        header('Location: /');
        shell_exec("sudo /usr/local/bin/quickbox/system/box clean log");
}

if (isset($_GET['updateQuickBox'])) {
        header('Location: //');
        shell_exec("sudo /usr/local/bin/quickbox/system/box update quickbox --only-core");
}

?>
