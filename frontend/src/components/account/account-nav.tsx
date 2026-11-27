import { Plus } from "lucide-react";
import Link from "next/link";
import { primaryButton } from "@/components/page/parts";
import { getAccount } from "@/lib/server-api";
import { AccountMenu } from "./account-menu";

const quietButton =
  "inline-flex h-[40px] items-center rounded-[8px] px-[14px] text-[13px] font-semibold text-ink outline-none transition-colors hover:bg-page " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-primary max-sm:h-[44px]";

/**
 * The right end of the header (accounts step 2): Log in and Sign up for a visitor; Add project and
 * the account menu for a logged-in person. Reads the request, so callers put it inside <Suspense>;
 * nothing is drawn while it waits, and nothing when the API could not say who it is (a logged-in
 * person must never be shown "Log in").
 */
export async function AccountNav() {
  const account = await getAccount();
  if (account.state === "unknown") return null;
  return (
    <nav aria-label="Account" className="flex items-center gap-[8px]">
      {account.state === "out" ? (
        <>
          <Link href="/login" className={quietButton}>
            Log in
          </Link>
          <Link href="/signup" className={primaryButton}>
            Sign up
          </Link>
        </>
      ) : (
        <>
          <Link href="/new" className={primaryButton}>
            <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
            Add project
          </Link>
          <AccountMenu name={account.me.display_name} username={account.me.username} avatarUrl={account.me.avatar_url} />
        </>
      )}
    </nav>
  );
}
