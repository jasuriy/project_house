import type { SimpleIcon } from "simple-icons";
import { BRAND_ICONS } from "./brand-icons";

/** A brand logo (simple-icons) in its own color. */
export function BrandIcon({ icon, size = 14, color }: { icon: SimpleIcon; size?: number; color?: string }) {
  return (
    <svg role="img" aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill={color ?? `#${icon.hex}`}>
      <path d={icon.path} />
    </svg>
  );
}

/** A technology's logo, or its first letter in a small badge when no logo exists. */
export function TechIcon({ name, slug, size = 14 }: { name: string; slug: string | null; size?: number }) {
  const icon = slug ? BRAND_ICONS[slug] : undefined;
  if (icon) return <BrandIcon icon={icon} size={size} />;
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#e3f4f1] font-semibold leading-none text-[#115e59]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.8) }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function GitHubIcon({ size = 20 }: { size?: number }) {
  return <BrandIcon icon={BRAND_ICONS.github} size={size} color="currentColor" />;
}

/** Prostagram logo: two overlapping rounded squares (D29). */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 22 22" width={size} height={size} aria-hidden="true">
      <rect x="1" y="1" width="13" height="13" rx="4" fill="#4F46E5" />
      <rect x="8" y="8" width="13" height="13" rx="4" fill="#8B5CF6" fillOpacity="0.9" />
    </svg>
  );
}
