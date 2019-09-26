<!DOCTYPE html>
<html lang="en">
<head>
  <!-- META -->
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta name="description" content="<?php echo $panel['description'] ?>">
  <meta name="author" content="<?php echo $panel['author'] ?>">
  <title><?php echo $panel['title'] ?></title>
  <meta name="robots" content="<?php echo $panel['robots'] ?>">
  <meta name="theme-color" content="#ffffff">
  <!-- FAVICON ASSETTS -->
  <link rel="apple-touch-icon" sizes="180x180" href="img/favicon/apple-touch-icon.png">
  <link rel="icon" type="image/png" href="img/favicon/favicon-32x32.png" sizes="32x32">
  <link rel="icon" type="image/png" href="img/favicon//favicon-16x16.png" sizes="16x16">
  <link rel="manifest" href="img/favicon/manifest.json">
  <link rel="mask-icon" href="img/favicon/safari-pinned-tab.svg" color="#5bbad5">
  <!-- CSS STYLESHEETS AND ASSETTS -->
  <link rel="shortcut icon" href="/img/favicon.ico" type="image/ico">
  <link rel="stylesheet" href="lib/jquery-ui/jquery-ui.css">
  <link rel="stylesheet" href="lib/Hover/hover.css">
  <link rel="stylesheet" href="lib/jquery-toggles/toggles-full.css">
  <link rel="stylesheet" href="lib/jquery.gritter/jquery.gritter.css">
  <link rel="stylesheet" href="lib/animate.css/animate.css">
  <link rel="stylesheet" href="lib/font-awesome/font-awesome.css">
  <link rel="stylesheet" href="lib/ionicons/css/ionicons.css">
  <link rel="stylesheet" href="lib/select2/select2.css">
  <link rel="stylesheet" href="skins/quick.css">
  <link rel="stylesheet" href="skins/lobipanel.css"/>
  <!-- JAVASCRIPT -->
  <script src="lib/modernizr/modernizr.js"></script>
  <script src="lib/jquery/jquery.js"></script>
  
<script type="text/javascript" src="inc/panel.app_status.ajax.js"></script>

<script type="text/javascript">
  window.NetOutSpeed = <?php echo json_encode($NetOutSpeed) ?>;
  window.NetInputSpeed = <?php echo json_encode($NetInputSpeed) ?>;
  window.NetTimeStamp = <?php echo json_encode(microtime(true)) ?>;
</script>

  <!-- HTML5 shim and Respond.js IE8 support of HTML5 elements and media queries -->
  <!--[if lt IE 9]>
  <script src="../lib/html5shiv/html5shiv.js"></script>
  <script src="../lib/respond/respond.src.js"></script>
  <![endif]-->

  <style>
  #sysPre{
    max-height : 600px;
    overflow-y: scroll;
  }
  .legend > table{
    background-color: transparent !important;
    color: #acacac !important;
    font-size: 11px !important;
  }
  </style>

  <style>
  <?php include ('custom/custom.css'); ?>
  </style>

</head>
