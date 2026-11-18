"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { useRouter } from "@/i18n/navigation";
import { clientDelete } from "@/lib/client-api";
import { profileErrorKey } from "@/lib/profile-errors";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, uploadAvatar } from "@/lib/upload";

const BUTTON =
  "inline-flex h-11 items-center justify-center rounded-control border border-border bg-card px-4 text-ui font-semibold hover:border-primary disabled:opacity-60 md:h-10";

/** Profil rasmi (auth mockup screen 10, top row): saved at once, separately from the form. */
export function ProfilePhoto({ name, photo }: { name: string; photo: string | null }) {
  const t = useTranslations("ProfileForm");
  const te = useTranslations("ProfileErrors");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState(photo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (input.current) input.current.value = "";
    if (!file || busy) return;
    const refused = !IMAGE_TYPES.includes(file.type) ? "invalid_image" : file.size > MAX_IMAGE_BYTES ? "image_too_large" : null;
    if (refused) {
      setError(te(refused));
      return;
    }
    setBusy(true);
    setError(null);
    const result = await uploadAvatar(file);
    setBusy(false);
    if (result.ok) {
      setSrc(result.data.avatar_url);
      router.refresh();
    } else {
      setError(te(profileErrorKey(result.status === 0 ? "unreachable" : result.code)));
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await clientDelete("/api/v1/me/avatar");
    setBusy(false);
    if (result.ok) {
      setSrc(null);
      router.refresh();
    } else {
      setError(te(profileErrorKey(result.status === 0 ? "unreachable" : result.code)));
    }
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-lead font-semibold text-fg">{t("photo")}</h2>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          name={name}
          src={src}
          className="size-20 border border-border bg-linear-135 from-avatar-from to-avatar-to text-[26px] font-bold text-fg"
        />
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => input.current?.click()} disabled={busy} className={`${BUTTON} text-fg`}>
              {busy ? t("photoUploading") : src ? t("photoChange") : t("photoUpload")}
            </button>
            {src && (
              <button type="button" onClick={remove} disabled={busy} className={`${BUTTON} text-danger`}>
                {t("photoRemove")}
              </button>
            )}
          </div>
          <p className={`text-meta ${error ? "text-danger" : "text-mute"}`} role={error ? "alert" : undefined}>
            {error ?? t("photoHelp")}
          </p>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        hidden
        onChange={(event) => void pick(event.target.files?.[0])}
      />
    </section>
  );
}
