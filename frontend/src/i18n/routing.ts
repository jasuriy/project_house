import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["uz", "ru", "en"],
  defaultLocale: "uz",
  localePrefix: "never",
  // The browser Accept-Language header picks the first locale; the choice made in the
  // LanguageSwitcher is what this cookie keeps (one year).
  localeCookie: { maxAge: 31536000 },
});
