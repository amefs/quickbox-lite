<?php

$locale   = 'en_US.UTF-8';
$language = 'lang_en';
setlocale(LC_ALL, $locale);
require($_SERVER['DOCUMENT_ROOT']."/lang/{$language}");

/**
 * @param string $str
 *
 * @return string
 */
function T($str) {
    global $L;
    if (isset($L[$str])) {
        return $L[$str];
    } else {
        return $str;
    }
}
