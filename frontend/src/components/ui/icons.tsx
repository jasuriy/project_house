import { Check } from "lucide-react";
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
      className="inline-flex shrink-0 items-center justify-center rounded-[4px] bg-primary-soft font-bold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.62 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function GitHubIcon({ size = 20 }: { size?: number }) {
  return <BrandIcon icon={BRAND_ICONS.github} size={size} color="currentColor" />;
}

/** Green filled circle with a tick when done; an empty ring when not. */
export function StatusDot({ done, size = 16 }: { done: boolean; size?: number }) {
  return done ? (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-success text-white"
      style={{ width: size, height: size }}
    >
      <Check size={size * 0.62} strokeWidth={3.5} aria-hidden="true" />
    </span>
  ) : (
    <span
      className="inline-block shrink-0 rounded-full border-[1.5px] border-field-line bg-field"
      style={{ width: size, height: size }}
    />
  );
}

/** Prostagram logo: two overlapping rounded squares. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="9" y="1.5" width="12.5" height="12.5" rx="2.6" transform="rotate(14 15 8)" fill="#7a72f2" />
      <rect x="2" y="8.5" width="13" height="13" rx="2.8" transform="rotate(-10 8.5 15)" fill="#3b32db" />
    </svg>
  );
}
