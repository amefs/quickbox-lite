import { I18n } from "./libs/i18n";

import da from "../lang/lang_da.json";
import de from "../lang/lang_de.json";
import en from "../lang/lang_en.json";
import es from "../lang/lang_es.json";
import fr from "../lang/lang_fr.json";
import zh from "../lang/lang_zh-Hans-CN.json";

const translations = { da, de, en, es, fr, zh };
const i18n = new I18n(translations);

export const VALID_LOCALES = Object.keys(translations);
export default i18n;
