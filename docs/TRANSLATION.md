# Workflow Translations (#292)

Login/register, send payment, contacts and validation messages are translated in all supported locales (en, ar, es, fr). The strings live in `src/lib/i18n/workflowTranslations.ts` (sections `auth`, `payment`, `contacts`, `validation`) and are merged into each locale in `translations.ts`.

- **Components:** use `useT()` (`src/lib/i18n/useT.ts`), which returns `t(key)` for the current UI language and `tv(message)` for validation errors.
- **Validation messages:** the zod schemas keep their English messages. `tv`/`translateValidation` maps a known English message to its `validation.*` key, and unknown messages are shown unchanged.
- **No untranslated keys:** a missing key falls back to English, then to a readable label built from the key name (`auth.forgotPassword` becomes "Forgot password"). The raw key path is never shown. Missing keys log a warning outside production.
- **Key parity:** `workflowTranslations.test.ts` fails if any locale has a different set of keys than English.
