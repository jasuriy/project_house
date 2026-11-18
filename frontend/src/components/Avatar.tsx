import { initials } from "@/lib/format";
import { safeExternalUrl } from "@/lib/safe-url";

/**
 * A person's round picture: their uploaded photo, else `fallback` (initials, or an empty circle as
 * on feed cards). Decorative: the name is always written next to it.
 */
export function Avatar({
  name,
  src,
  className,
  fallback = "initials",
}: {
  name: string;
  src?: string | null;
  className: string;
  fallback?: "initials" | "blank";
}) {
  const photo = safeExternalUrl(src);
  return (
    <span aria-hidden className={`grid flex-none place-items-center overflow-hidden rounded-full ${className}`}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : fallback === "initials" ? (
        initials(name)
      ) : null}
    </span>
  );
}
