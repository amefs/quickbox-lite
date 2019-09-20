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
$(document).ready(function(){getJSONData();});
var OutSpeed2=<?php echo floor($NetOutSpeed[2]) ?>;
var OutSpeed3=<?php echo floor($NetOutSpeed[3]) ?>;
var OutSpeed4=<?php echo floor($NetOutSpeed[4]) ?>;
var OutSpeed5=<?php echo floor($NetOutSpeed[5]) ?>;
var InputSpeed2=<?php echo floor($NetInputSpeed[2]) ?>;
var InputSpeed3=<?php echo floor($NetInputSpeed[3]) ?>;
var InputSpeed4=<?php echo floor($NetInputSpeed[4]) ?>;
var InputSpeed5=<?php echo floor($NetInputSpeed[5]) ?>;
function getJSONData()
{
  setTimeout("getJSONData()", 1000);
  $.getJSON('?act=rt&callback=?', displayData);
}
function ForDight(Dight,How)
{
  if (Dight<0){
    var Last=0+"B/s";
  }else if (Dight<1024){
    var Last=Math.round(Dight*Math.pow(10,How))/Math.pow(10,How)+"B/s";
  }else if (Dight<1048576){
    Dight=Dight/1024;
    var Last=Math.round(Dight*Math.pow(10,How))/Math.pow(10,How)+"KB/s";
  }else{
    Dight=Dight/1048576;
    var Last=Math.round(Dight*Math.pow(10,How))/Math.pow(10,How)+"MB/s";
  }
  return Last;
}
function displayData(dataJSON) {
  $("#NetOut2").html(dataJSON.NetOut2);
  $("#NetOut3").html(dataJSON.NetOut3);
  $("#NetOut4").html(dataJSON.NetOut4);
  $("#NetOut5").html(dataJSON.NetOut5);
  $("#NetOut6").html(dataJSON.NetOut6);
  $("#NetOut7").html(dataJSON.NetOut7);
  $("#NetOut8").html(dataJSON.NetOut8);
  $("#NetOut9").html(dataJSON.NetOut9);
  $("#NetOut10").html(dataJSON.NetOut10);
  $("#NetInput2").html(dataJSON.NetInput2);
  $("#NetInput3").html(dataJSON.NetInput3);
  $("#NetInput4").html(dataJSON.NetInput4);
  $("#NetInput5").html(dataJSON.NetInput5);
  $("#NetInput6").html(dataJSON.NetInput6);
  $("#NetInput7").html(dataJSON.NetInput7);
  $("#NetInput8").html(dataJSON.NetInput8);
  $("#NetInput9").html(dataJSON.NetInput9);
  $("#NetInput10").html(dataJSON.NetInput10);
  $("#NetOutSpeed2").html(ForDight((dataJSON.NetOutSpeed2-OutSpeed2),3)); OutSpeed2=dataJSON.NetOutSpeed2;
  $("#NetOutSpeed3").html(ForDight((dataJSON.NetOutSpeed3-OutSpeed3),3)); OutSpeed3=dataJSON.NetOutSpeed3;
  $("#NetOutSpeed4").html(ForDight((dataJSON.NetOutSpeed4-OutSpeed4),3)); OutSpeed4=dataJSON.NetOutSpeed4;
  $("#NetOutSpeed5").html(ForDight((dataJSON.NetOutSpeed5-OutSpeed5),3)); OutSpeed5=dataJSON.NetOutSpeed5;
  $("#NetInputSpeed2").html(ForDight((dataJSON.NetInputSpeed2-InputSpeed2),3)); InputSpeed2=dataJSON.NetInputSpeed2;
  $("#NetInputSpeed3").html(ForDight((dataJSON.NetInputSpeed3-InputSpeed3),3)); InputSpeed3=dataJSON.NetInputSpeed3;
  $("#NetInputSpeed4").html(ForDight((dataJSON.NetInputSpeed4-InputSpeed4),3)); InputSpeed4=dataJSON.NetInputSpeed4;
  $("#NetInputSpeed5").html(ForDight((dataJSON.NetInputSpeed5-InputSpeed5),3)); InputSpeed5=dataJSON.NetInputSpeed5;
}
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
