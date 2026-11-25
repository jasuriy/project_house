import Image from "next/image";
import Link from "next/link";
import { LogoMark } from "@/components/ui/icons";
import { AUTHOR } from "@/lib/author";

// Home: one way in, the Add project button, which opens the upload page. Header and button use
// the upload page's sizes and colours (D29), so the step from here to /new looks seamless.
export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-card shadow-[0_1px_0_var(--color-line)]">
        <div className="mx-auto flex h-[52px] max-w-[1920px] items-center justify-between gap-[16px] px-[16px] sm:px-[48px]">
          <span className="inline-flex h-[44px] items-center gap-[8px] text-[17px] font-bold text-ink">
            <LogoMark />
            Prostagram
          </span>
          <Image src={AUTHOR.photo} alt={AUTHOR.name} width={32} height={32} className="rounded-full" />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-[16px]">
        <Link
          href="/new"
          className="inline-flex h-[44px] items-center rounded-[8px] bg-primary px-[20px] text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(79,70,229,0.25),0_4px_12px_rgba(79,70,229,0.2)] outline-none transition-colors hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Add project
        </Link>
      </main>
    </div>
  );
}
