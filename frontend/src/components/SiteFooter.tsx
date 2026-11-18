import { getTranslations } from "next-intl/server";

const NEW_ISSUE = "https://github.com/jasuriy/project_house/issues/new";

/** Every page's footer: where friends send feedback and bug reports (GitHub issues, Bek). */
export async function SiteFooter() {
  const t = await getTranslations("Nav");
  return (
    <footer className="border-t border-border bg-card">
      <div className="page-width flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3 text-small text-mute">
        <span>Project House</span>
        <a
          href={NEW_ISSUE}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline md:min-h-0"
        >
          {t("feedback")}
        </a>
      </div>
    </footer>
  );
}
