"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { type AuthField, authErrorField, authErrorKey } from "@/lib/auth-errors";
import { clientPost } from "@/lib/client-api";
import { TextField } from "./TextField";

type Errors = Partial<Record<AuthField, string>>;

/** Sign up (auth mockup screen 3): account type cards, then the fields; errors under their field. */
export function SignupForm() {
  const t = useTranslations("Signup");
  const te = useTranslations("AuthErrors");
  const tl = useTranslations("Login");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "");
    const result = await clientPost("/api/v1/auth/signup", {
      email: value("email"),
      password: value("password"),
      username: value("username"),
      display_name: value("display_name"),
      account_type: value("account_type"),
    });
    if (result.ok) {
      // Onboarding (with the "confirm your email" line) arrives with its own page; the feed until then.
      router.replace("/");
      router.refresh();
      return;
    }
    setErrors({ [authErrorField(result.code)]: te(authErrorKey(result.code)) });
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <fieldset className="grid min-w-0 gap-1.5">
        <legend className="mb-1.5 text-small font-semibold text-fg">{t("accountType")}</legend>
        <div className="grid grid-cols-2 gap-2.5">
          {(["developer", "company"] as const).map((type) => (
            <label
              key={type}
              className="grid cursor-pointer gap-0.5 rounded-media border border-border px-3.5 py-3 has-[:checked]:border-primary has-[:checked]:bg-accent-soft"
            >
              <span className="flex items-center gap-2 text-ui font-semibold text-fg">
                <input
                  type="radio"
                  name="account_type"
                  value={type}
                  defaultChecked={type === "developer"}
                  className="size-4 flex-none appearance-none rounded-full border-[1.5px] border-mute checked:border-[5px] checked:border-primary"
                />
                {t(type)}
              </span>
              <span className="text-meta text-mute">{t(`${type}Hint`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <TextField name="email" type="email" label={t("email")} autoComplete="username" required error={errors.email} />
      <TextField
        name="password"
        type="password"
        label={t("password")}
        autoComplete="new-password"
        required
        help={t("passwordHelp")}
        error={errors.password}
        toggleLabels={{ show: tl("showPassword"), hide: tl("hidePassword") }}
      />
      <TextField
        name="username"
        label={t("username")}
        autoComplete="off"
        required
        prefix="projecthouse.uz/"
        help={t("usernameHelp")}
        error={errors.username}
      />
      <TextField
        name="display_name"
        label={t("name")}
        autoComplete="name"
        required
        help={t("nameHelp")}
      />
      {errors.form && (
        <p role="alert" className="text-small text-danger">
          {errors.form}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-11 w-full items-center justify-center rounded-control bg-primary text-ui font-semibold text-on-primary hover:opacity-90 disabled:opacity-60"
      >
        {busy ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
