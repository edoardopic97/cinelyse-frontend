import { getLocales } from 'expo-localization';
import en from './en';
import it from './it';
import es from './es';
import hi from './hi';

const translations: Record<string, typeof en> = { en, it, es, hi };

function getDeviceLanguage(): string {
  try {
    const locales = getLocales();
    if (!locales?.length) return 'en';
    const locale = locales[0];
    // Try languageCode first (e.g. "it"), then parse from languageTag (e.g. "it-IT")
    const code = locale.languageCode || locale.languageTag?.split('-')[0] || 'en';
    return code.toLowerCase();
  } catch {
    return 'en';
  }
}

const lang = getDeviceLanguage();
const t = translations[lang] ?? en;

export default t;
export { lang };
