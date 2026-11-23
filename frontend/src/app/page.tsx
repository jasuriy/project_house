import Image from "next/image";
import Link from "next/link";
import { LogoMark } from "@/components/ui/icons";
import { AUTHOR } from "@/lib/author";

// Home: one way in, the Add project button, which opens the upload page. Header and button use
// the upload page's sizes and colours, so the step from here to /new looks seamless.
export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-[52px] items-center border-b border-[#f0ebea] px-[16px] md:h-[42px] md:pl-[38px] md:pr-[30px]">
        <div className="flex items-center gap-[7px]">
          <LogoMark size={23} />
          <span className="text-[19px] font-extrabold tracking-[-0.015em] text-ink">Prostagram</span>
        </div>
        <Image
          src={AUTHOR.photo}
          alt={AUTHOR.name}
          width={25}
          height={25}
          className="ml-auto rounded-full"
        />
      </header>

      <main className="flex flex-1 items-center justify-center px-[16px]">
        <Link
          href="/new"
          className="inline-flex h-[44px] items-center rounded-[6px] bg-primary px-[22px] text-[14px] font-bold text-white shadow-[0_1px_2px_rgba(59,50,219,0.25)] outline-none transition-colors hover:bg-primary-strong focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          Add project
        </Link>
      </main>
    </div>
  );
}
