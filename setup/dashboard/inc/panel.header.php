<?php
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/info.system.php');
require_once($_SERVER['DOCUMENT_ROOT'].'/inc/config.php');

assert(isset($panel));

$netinfo = SystemInfo::netinfo();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- META -->
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta name="description" content="<?php echo $panel['description']; ?>">
  <meta name="author" content="<?php echo $panel['author']; ?>">
  <title><?php echo $panel['title']; ?></title>
  <meta name="robots" content="<?php echo $panel['robots']; ?>">
  <meta name="theme-color" content="#ffffff">
  <!-- FAVICON ASSETTS -->
  <link rel="apple-touch-icon" sizes="180x180" href="img/favicon/apple-touch-icon.png">
  <link rel="shortcut icon" href="/img/favicon/favicon.ico" type="image/ico">
  <link rel="icon" type="image/png" href="img/favicon/favicon-32x32.png" sizes="32x32">
  <link rel="icon" type="image/png" href="img/favicon//favicon-16x16.png" sizes="16x16">
  <link rel="manifest" href="img/favicon/manifest.json">
  <link rel="mask-icon" href="img/favicon/safari-pinned-tab.svg" color="#5bbad5">
  <!-- CSS STYLESHEETS AND ASSETTS -->
  <link rel="stylesheet" href="lib/jquery-ui/jquery-ui.min.css">
  <link rel="stylesheet" href="lib/hover.css/hover-min.css">
  <link rel="stylesheet" href="lib/jquery-toggles/toggles-full.css">
  <link rel="stylesheet" href="lib/jquery-gritter/css/jquery.gritter.css">
  <link rel="stylesheet" href="lib/datatables/css/dataTables.bootstrap.min.css">
  <link rel="stylesheet" href="lib/perfect-scrollbar/css/perfect-scrollbar.min.css">
  <link rel="stylesheet" href="lib/animate.css/animate.min.css">
  <link rel="stylesheet" href="lib/font-awesome/css/font-awesome.min.css">
  <link rel="stylesheet" href="lib/ionicons/css/ionicons.css">
  <link rel="stylesheet" href="lib/select2/select2.min.css">
  <link rel="stylesheet" href="lib/lobipanel/css/lobipanel.min.css"/>
  <link rel="stylesheet" href="skins/quick.css">
  <!-- JAVASCRIPT -->
  <script src="lib/jquery/jquery.min.js"></script>

  <script type="text/javascript">
    window.NetOutSpeed = <?php echo json_encode($netinfo['Transmit']); ?>;
    window.NetInputSpeed = <?php echo json_encode($netinfo['Receive']); ?>;
    window.NetTimeStamp = <?php echo json_encode(microtime(true)); ?>;
  </script>

  <style>
    <?php if (file_exists($_SERVER['DOCUMENT_ROOT'].'custom/custom.css')) {
    include($_SERVER['DOCUMENT_ROOT'].'custom/custom.css');
}
    ?>
  </style>
</head>
