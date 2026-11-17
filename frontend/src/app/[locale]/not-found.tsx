import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** Missing project or page: a short message and the way back to the feed. */
export default function NotFound() {
  const t = useTranslations("Errors");
  const tn = useTranslations("Nav");
  return (
    <div className="mx-auto mt-12 max-w-md rounded-card border border-border bg-card px-6 py-10 text-center">
      <h1 className="text-h3 font-semibold text-fg">{t("notFound")}</h1>
      <Link
        href="/"
        className="mt-4 inline-flex h-11 items-center rounded-control bg-primary px-4 text-ui font-semibold text-on-primary md:h-10"
      >
        {tn("feed")}
      </Link>
    </div>
  );
}
