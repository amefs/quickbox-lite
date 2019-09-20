<?php
    $locale = 'en_GB.UTF-8';
    $language = 'lang_en';
    setlocale(LC_ALL, 'en_GB.UTF-8');
    require ($_SERVER['DOCUMENT_ROOT']."/lang/lang_en");

    function T($str)
    {
        global $L;
        if (isset($L[$str]))
            return $L[$str];
        else
            return $str;
    }

?>
