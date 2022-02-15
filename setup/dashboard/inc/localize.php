<?php

include($_SERVER['DOCUMENT_ROOT'].'/db/locale.php');

$fallback_language = 'lang_en';
$fallback_locale   = 'en_US.UTF-8';

if (!isset($language) || !file_exists($_SERVER['DOCUMENT_ROOT']."/lang/{$language}.json")) {
    $language = $fallback_language;
    $locale   = $fallback_locale;
}

if (isset($locale)) {
    setlocale(\LC_ALL, $locale);
}
$locale_assets = file_get_contents($_SERVER['DOCUMENT_ROOT']."/lang/{$language}.json");
assert($locale_assets !== false);
$L = json_decode($locale_assets, true);

/**
 * @param string              $message
 * @param array<string,mixed> $values
 *
 * @return string
 */
function T($message, $values = null) {
    global $L;
    if (isset($L[$message])) {
        $value = $L[$message];
        if (is_array($values)) {
            foreach ($values as $key => $val) {
                $value = str_replace("{{$key}}", $val, $value);
            }
        }

        return $value;
    } else {
        return $message;
    }
}
