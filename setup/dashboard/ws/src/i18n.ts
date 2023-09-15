import { I18n } from "./libs/i18n";

import * as da from "../lang/lang_da.json";
import * as de from "../lang/lang_de.json";
import * as en from "../lang/lang_en.json";
import * as es from "../lang/lang_es.json";
import * as fr from "../lang/lang_fr.json";
import * as zh from "../lang/lang_zh-Hans-CN.json";

const i18n = new I18n({
    da,
    de,
    en,
    es,
    fr,
    zh,
});

export default i18n;
