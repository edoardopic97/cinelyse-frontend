import { getLocales } from 'expo-localization';
import en from './en';
import it from './it';

const translations: Record<string, typeof en> = { en, it };

function getDeviceLanguage(): string {
  const locales = getLocales();
  const code = locales?.[0]?.languageCode ?? 'en';
  return code;
}

const lang = getDeviceLanguage();
const t = translations[lang] ?? en;

// Debug - remove after testing
import { Alert } from 'react-native';
setTimeout(() => Alert.alert('Language debug', `languageCode: ${lang}, locales: ${JSON.stringify(getLocales()?.[0])}`), 3000);

export default t;
export { lang };
