/**
 * i18next setup. Import this module once, near the app root, before any
 * component that calls `useTranslation` renders.
 *
 * Language resolution order on boot:
 *   1. the device-local choice for this device (see `storage.ts`)
 *   2. the OS/browser locale, if we ship a catalogue for it
 *   3. English
 *
 * See `README.md` in this directory for the key conventions and for how to
 * add a locale.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { buildResources } from "./resources";
import { DEFAULT_NAMESPACE, NAMESPACES } from "./namespaces";
import {
  DEFAULT_LANGUAGE,
  languageDirection,
  normalizeLanguage,
  osLanguageCandidates,
  resolveOsLanguage,
  supportedLanguageCodes,
} from "./languages";
import { loadDeviceLanguage, saveDeviceLanguage } from "./storage";

/**
 * The language to start in: a stored device choice wins over the OS guess,
 * and English catches everything else.
 */
export function resolveInitialLanguage(): string {
  const stored = loadDeviceLanguage(null);
  if (stored) {
    return stored;
  }
  return resolveOsLanguage(osLanguageCandidates());
}

/**
 * Keep the document in sync with the active language.
 *
 * `lang` drives the browser's hyphenation, spellcheck dictionary and
 * screen-reader voice; `dir` is what an RTL locale needs (no such locale
 * ships yet, but wiring it here means adding one is a catalogue change and
 * not a plumbing change).
 */
function applyDocumentLanguage(language: string): void {
  try {
    document.documentElement.lang = language;
    document.documentElement.dir = languageDirection(language);
  } catch {
    // No document (non-DOM context) — nothing to sync.
  }
}

void i18n.use(initReactI18next).init({
  resources: buildResources(),
  lng: resolveInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: supportedLanguageCodes(),
  ns: NAMESPACES,
  defaultNS: DEFAULT_NAMESPACE,
  // A key present in `en` but missing in the active language must render the
  // English string. That is `fallbackLng` doing its job, but only if empty
  // strings are not treated as translations — otherwise a stub entry left as
  // "" in a partial catalogue renders as blank UI instead of falling back.
  returnEmptyString: false,
  returnNull: false,
  interpolation: {
    // React escapes everything it renders; escaping again turns apostrophes
    // into `&#39;` in the DOM text.
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

applyDocumentLanguage(i18n.language);
i18n.on("languageChanged", applyDocumentLanguage);

/**
 * Switch language and remember the choice on this device.
 *
 * `userId` scopes the stored value so two Pollis users sharing one OS account
 * keep separate choices, mirroring the device-local font size.
 */
export async function setLanguage(
  language: string,
  userId?: string | null,
): Promise<void> {
  const normalized = normalizeLanguage(language) ?? DEFAULT_LANGUAGE;
  saveDeviceLanguage(userId ?? null, normalized);
  await i18n.changeLanguage(normalized);
}

/**
 * Re-resolve the language for a user who just signed in. Their stored choice
 * (if any) wins over whatever the pre-auth screens were showing.
 */
export async function adoptUserLanguage(userId: string | null | undefined): Promise<void> {
  const stored = loadDeviceLanguage(userId);
  if (stored && stored !== i18n.language) {
    await i18n.changeLanguage(stored);
  }
}

export default i18n;
