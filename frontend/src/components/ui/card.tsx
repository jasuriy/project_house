import type { ReactNode } from "react";

type CardProps = {
  id?: string;
  icon: ReactNode; // an icon element, about 19px
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
};

/** A white section box with an icon and a title, as used for every section of the editor. */
export function Card({ id, icon, title, subtitle, className = "", children }: CardProps) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={`scroll-mt-4 rounded-[10px] border border-line bg-card px-[15px] pb-[14px] pt-[5px] shadow-[0_1px_2px_rgba(20,16,50,0.03)] ${className}`}
    >
      <header className="flex items-center gap-[10px]">
        <span aria-hidden="true" className="flex h-[22px] w-[22px] items-center justify-center text-ink">
          {icon}
        </span>
        <h2 id={id ? `${id}-title` : undefined} className="text-[16.5px] font-extrabold leading-[22px] tracking-[-0.01em] text-ink">
          {title}
        </h2>
      </header>
      {subtitle && <p className="-mt-[2px] text-[11.5px] leading-[16px] text-muted max-sm:text-[13.5px] max-sm:leading-[19px]">{subtitle}</p>}
      {children}
    </section>
  );
}
