import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

// One file per namespace and locale: messages/<locale>/<namespace>.json.
// Nobody edits this list after Task C1.
export const NAMESPACES = ["common", "projects", "auth"];

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const files = await Promise.all(
    NAMESPACES.map(
      async (namespace) =>
        (await import(`../../messages/${locale}/${namespace}.json`)).default,
    ),
  );

  return { locale, messages: Object.assign({}, ...files) };
});
