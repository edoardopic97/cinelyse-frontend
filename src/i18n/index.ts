import { getLocales } from 'expo-localization';
import en from './en';
import it from './it';

const translations: Record<string, typeof en> = { en, it };

function getDeviceLanguage(): string {
  const locales = getLocales();
  return locales?.[0]?.languageCode ?? 'en';
}

const lang = getDeviceLanguage();
const t = translations[lang] ?? en;

export default t;
export { lang };
