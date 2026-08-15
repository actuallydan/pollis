/**
 * The set of languages Pollis ships a catalogue for.
 *
 * Adding a locale is a two-step change and this list is step two — see
 * `frontend/src/i18n/README.md`. Nothing else in the app hardcodes a language
 * code, so the selector, the OS-locale probe and the i18next `supportedLngs`
 * all widen together from this one array.
 */

export interface LanguageOption {
  /** BCP-47 base tag, lowercase. Region subtags are stripped — see `normalizeLanguage`. */
  code: string;
  /**
   * The language's own name for itself (endonym), NOT its English name.
   * A language picker that says "German" is useless to someone who only
   * reads German, which is exactly the person reaching for it.
   */
  label: string;
  /** Writing direction. Latin/Cyrillic scripts are `ltr`; Arabic/Hebrew are `rtl`. */
  dir: "ltr" | "rtl";
}

/** The language every missing key falls back to. Always present. */
export const DEFAULT_LANGUAGE = "en";

export const SUPPORTED_LANGUAGES: readonly LanguageOption[] = [
  { code: "en", label: "English", dir: "ltr" },
];

/** Every shipped language code, in selector order. */
export function supportedLanguageCodes(): string[] {
  return SUPPORTED_LANGUAGES.map((l) => l.code);
}

export function languageOption(code: string): LanguageOption | undefined {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code);
}

export function isSupportedLanguage(code: string | null | undefined): boolean {
  return !!code && SUPPORTED_LANGUAGES.some((l) => l.code === code);
}

/** Writing direction for a language code; unknown codes are treated as `ltr`. */
export function languageDirection(code: string | null | undefined): "ltr" | "rtl" {
  return languageOption(code ?? "")?.dir ?? "ltr";
}

/**
 * Reduce an arbitrary BCP-47 tag to a supported language code, or null.
 *
 * `pt-BR` → `pt` when we ship `pt`, because a regional catalogue we do not
 * have should still land on the language the user actually reads rather than
 * dropping all the way to English.
 */
export function normalizeLanguage(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const tag = raw.trim().toLowerCase();
  if (!tag) {
    return null;
  }
  if (isSupportedLanguage(tag)) {
    return tag;
  }
  const base = tag.split(/[-_]/)[0];
  if (isSupportedLanguage(base)) {
    return base;
  }
  return null;
}

/**
 * Pick a starting language from the OS/browser locale list, in preference
 * order, falling back to English when we ship no catalogue for any of them.
 *
 * Under Tauri the webview inherits the OS locale, so `navigator.languages` is
 * the OS's answer; under the Playwright browser tier it is whatever the test
 * sets. One code path serves both.
 */
export function resolveOsLanguage(
  candidates: readonly string[] | undefined,
): string {
  for (const candidate of candidates ?? []) {
    const match = normalizeLanguage(candidate);
    if (match) {
      return match;
    }
  }
  return DEFAULT_LANGUAGE;
}

/** The browser/OS locale preference list, most-preferred first. */
export function osLanguageCandidates(): string[] {
  try {
    const list = navigator.languages;
    if (list && list.length > 0) {
      return [...list];
    }
    return navigator.language ? [navigator.language] : [];
  } catch {
    return [];
  }
}
