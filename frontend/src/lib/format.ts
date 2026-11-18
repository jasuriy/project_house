/** Up to two capital letters from a name ("Aziz Rahimov" -> "AR"), for an avatar without a photo. */
export function initials(name: string): string {
  return name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

const MONTHS: Record<string, string[]> = {
  uz: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

// Uzbekistan is UTC+5 all year (no daylight saving time).
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * "17 noyabr 2026" / "17 ноября 2026 г." / "November 17, 2026"; "" for an unparsable date.
 * Our own month names and a fixed time zone, not Intl: the server and every browser must print
 * the same text (some browsers have no Uzbek month names), or a client component's text would
 * not match the server's HTML.
 */
export function formatDate(iso: string, locale: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  const local = new Date(time + TASHKENT_OFFSET_MS);
  const day = local.getUTCDate();
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  if (locale === "uz") return `${day} ${MONTHS.uz[month]} ${year}`;
  if (locale === "ru") return `${day} ${MONTHS.ru[month]} ${year} г.`;
  return `${MONTHS.en[month]} ${day}, ${year}`;
}
