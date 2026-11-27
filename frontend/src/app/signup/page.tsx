import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignUpForm } from "@/components/account/auth-forms";
import { AuthShell, SwitchLine } from "@/components/account/auth-shell";
import { safeNext, withNext } from "@/lib/next-path";
import { fetchCatalog, getAccount } from "@/lib/server-api";

export const metadata: Metadata = { title: "Sign up - Prostagram" };

// The title is part of the static page; the rest reads the request (where to go next, whether the
// visitor is already logged in), so it sits inside a Suspense boundary (cacheComponents).
export default function SignUpPage({ searchParams }: PageProps<"/signup">) {
  return (
    <AuthShell title="Sign up">
      <Suspense fallback={null}>
        <SignUp searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function SignUp({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw);
  const [account, catalog] = await Promise.all([getAccount(), fetchCatalog()]);
  if (account.state === "in") redirect(next); // already logged in
  return (
    <>
      <SwitchLine question="Already have an account?" href={withNext("/login", next)} label="Log in" />
      <SignUpForm rules={catalog.username_rules} next={next} />
    </>
  );
}
