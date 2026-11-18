"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Banner } from "@/components/auth/Banner";
import { TextField } from "@/components/auth/TextField";
import { useRouter } from "@/i18n/navigation";
import { clientPatch } from "@/lib/client-api";
import { type ProfileField, profileErrorField, profileErrorKey } from "@/lib/profile-errors";
import type { Account } from "@/lib/types";

// The backend limits (app/users/profile.py); inputs stop there, so in practice only link format can fail.
const MAX = { display_name: 60, headline: 120, location: 80, university_or_employer: 120, company_name: 80, about: 1000, link: 200 };
const TEXT = ["display_name", "headline", "location", "university_or_employer", "company_name", "about"] as const;
const LINKS = ["github", "linkedin", "website"] as const;
const SAVE =
  "inline-flex h-11 w-full items-center justify-center rounded-control bg-primary px-4 text-ui font-semibold text-on-primary hover:opacity-90 disabled:opacity-60 md:h-10 md:w-auto md:justify-self-start";

type Values = Record<(typeof TEXT)[number] | (typeof LINKS)[number], string> & { open_to_work: boolean };

function valuesOf(account: Account): Values {
  const link = (key: string) => (typeof account.links[key] === "string" ? (account.links[key] as string) : "");
  return {
    display_name: account.display_name,
    headline: account.headline ?? "",
    location: account.location ?? "",
    university_or_employer: account.university_or_employer ?? "",
    company_name: account.company_name ?? "",
    about: account.about ?? "",
    open_to_work: account.open_to_work,
    github: link("github"),
    linkedin: link("linkedin"),
    website: link("website"),
  };
}

/** Profilni tahrirlash (auth mockup screen 10). Sends only the fields that changed. */
export function ProfileForm({ account }: { account: Account }) {
  const t = useTranslations("ProfileForm");
  const te = useTranslations("ProfileErrors");
  const router = useRouter();
  const isDeveloper = account.account_type === "developer";
  const [saved, setSaved] = useState<Values>(() => valuesOf(account));
  const [aboutLength, setAboutLength] = useState(saved.about.length);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ field: ProfileField | "form"; message: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const read = (name: string) => String(form.get(name) ?? "");
    const body: Record<string, unknown> = {};
    for (const name of TEXT) {
      if (form.has(name) && read(name) !== saved[name]) body[name] = read(name);
    }
    if (isDeveloper && form.has("open_to_work") !== saved.open_to_work) body.open_to_work = form.has("open_to_work");
    const links: Record<string, string> = {};
    for (const name of LINKS) {
      const input = `link_${name}`;
      if (form.has(input) && read(input) !== saved[name]) links[name] = read(input);
    }
    if (Object.keys(links).length > 0) body.links = links;

    setError(null);
    setDone(false);
    if (Object.keys(body).length === 0) {
      setDone(true);
      return;
    }
    setPending(true);
    const result = await clientPatch<Account>("/api/v1/auth/me", body);
    setPending(false);
    if (result.ok) {
      setSaved(valuesOf(result.data));
      setDone(true);
      router.refresh(); // the header shows the new name
    } else {
      const code = result.status === 0 ? "unreachable" : result.code;
      setError({ field: profileErrorField(code), message: te(profileErrorKey(code)) });
    }
  }

  const fieldError = (field: ProfileField) => (error?.field === field ? error.message : undefined);

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 md:gap-6">
      {done && <Banner tone="ok">{t("saved")}</Banner>}
      {error?.field === "form" && <Banner tone="warn">{error.message}</Banner>}

      <section className="grid gap-4">
        <h2 className="text-lead font-semibold text-fg">{t("main")}</h2>
        <TextField name="display_name" label={t("name")} required help={t("nameHelp")} defaultValue={saved.display_name} maxLength={MAX.display_name} error={fieldError("display_name")} autoComplete="name" />
        <TextField
          name="headline"
          label={isDeveloper ? t("headline") : t("role")}
          help={isDeveloper ? t("headlineHelp") : t("roleHelp")}
          defaultValue={saved.headline}
          maxLength={MAX.headline}
          error={fieldError("headline")}
        />
        {isDeveloper ? (
          <TextField name="university_or_employer" label={t("university")} defaultValue={saved.university_or_employer} maxLength={MAX.university_or_employer} error={fieldError("university_or_employer")} />
        ) : (
          <TextField name="company_name" label={t("company")} defaultValue={saved.company_name} maxLength={MAX.company_name} error={fieldError("company_name")} autoComplete="organization" />
        )}
        <TextField name="location" label={t("location")} defaultValue={saved.location} maxLength={MAX.location} error={fieldError("location")} />
        {isDeveloper && (
          <label className="flex items-start gap-2.5 text-ui text-fg">
            <input type="checkbox" name="open_to_work" defaultChecked={saved.open_to_work} className="mt-0.5 size-4.5 flex-none accent-primary" />
            <span>
              {t("openToWork")}
              <small className="block text-meta text-mute">{t("openToWorkHelp")}</small>
            </span>
          </label>
        )}
      </section>

      <div className="h-px bg-border" />

      <section className="grid gap-1.5">
        <h2 id="profile-about" className="mb-2.5 text-lead font-semibold text-fg">
          {isDeveloper ? t("about") : t("aboutCompany")}
        </h2>
        <div className={`rounded-control border bg-card focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--color-accent-soft)] ${fieldError("about") ? "border-danger" : "border-border"}`}>
          <textarea
            data-field
            name="about"
            aria-labelledby="profile-about"
            aria-invalid={fieldError("about") ? true : undefined}
            aria-describedby={fieldError("about") ? "profile-about-error" : undefined}
            defaultValue={saved.about}
            maxLength={MAX.about}
            rows={4}
            onChange={(event) => setAboutLength(event.target.value.length)}
            className="block min-h-26 w-full resize-y rounded-control bg-transparent px-3 py-2.5 text-ui leading-[1.45] text-fg outline-none"
          />
        </div>
        {fieldError("about") && (
          <p id="profile-about-error" className="text-meta text-danger">
            {fieldError("about")}
          </p>
        )}
        <p className="text-right text-meta text-mute tabular-nums">
          {aboutLength} / {MAX.about}
        </p>
      </section>

      <div className="h-px bg-border" />

      <section className="grid gap-4">
        <h2 className="text-lead font-semibold text-fg">{t("links")}</h2>
        {isDeveloper && (
          <>
            <TextField name="link_github" label={t("github")} placeholder="https://github.com/" defaultValue={saved.github} maxLength={MAX.link} error={fieldError("github")} />
            <TextField name="link_linkedin" label={t("linkedin")} placeholder="https://www.linkedin.com/in/" defaultValue={saved.linkedin} maxLength={MAX.link} error={fieldError("linkedin")} />
          </>
        )}
        <TextField
          name="link_website"
          label={isDeveloper ? t("website") : t("companyWebsite")}
          placeholder="https://"
          defaultValue={saved.website}
          maxLength={MAX.link}
          error={fieldError("website")}
          autoComplete="url"
        />
      </section>

      <button type="submit" disabled={pending} className={SAVE}>
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
