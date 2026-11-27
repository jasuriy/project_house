import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LogInForm } from "@/components/account/auth-forms";
import { AuthShell, SwitchLine } from "@/components/account/auth-shell";
import { safeNext, withNext } from "@/lib/next-path";
import { getAccount } from "@/lib/server-api";

export const metadata: Metadata = { title: "Log in - Prostagram" };

// As /signup: the title is static, the part that reads the request streams in.
export default function LogInPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell title="Log in">
      <Suspense fallback={null}>
        <LogIn searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function LogIn({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw);
  if ((await getAccount()).state === "in") redirect(next); // already logged in
  return (
    <>
      <SwitchLine question="New to Prostagram?" href={withNext("/signup", next)} label="Sign up" />
      <LogInForm next={next} />
    </>
  );
}
