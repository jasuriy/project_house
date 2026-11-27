"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import { type FormEvent, type ReactNode, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { card } from "@/components/page/parts";
import { Field, TextField } from "@/components/ui/form";
import { ApiError, api, type Catalog } from "@/lib/api";
import { safeNext } from "@/lib/next-path";

// The sign-up and login forms (accounts step 2, docs/design/accounts-screens/brief.md).
// - The page checks the fields itself when the button is pressed: every problem at once, in plain
//   words, under its box; focus moves to the first one, which reads its message out. A field that
//   has shown a problem checks again as you type.
// - The server's answers: "taken" under its field; anything else in one message above the button.
// - Success is a full page load of `next`, so the header drawn on the server shows the new state.

const OFFLINE = "Could not reach Prostagram. Check your connection and try again.";
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Errors<K extends string> = Partial<Record<K, string | null>>;

/** Turns any failure into what the person sees: a field message, or one message above the button. */
function readFailure(error: unknown): { field?: string; message: string } {
  if (!(error instanceof ApiError) || error.status >= 500 || error.code === "network_error") return { message: OFFLINE };
  if (error.code === "validation_error") {
    // "field: Value error, message" from the API (it reports the first bad field only).
    const [field, ...rest] = error.message.split(": ");
    const text = rest.join(": ").replace(/^Value error, /, "");
    return { field: field === "display_name" ? "name" : field, message: text.charAt(0).toUpperCase() + text.slice(1) };
  }
  return { message: error.message };
}

function focusFirst(order: readonly string[], errors: Record<string, string | null | undefined>) {
  const first = order.find((id) => errors[id]);
  if (first) document.getElementById(first)?.focus();
  return !!first;
}

// --- shared parts --------------------------------------------------------------------------------

function PasswordField({
  id,
  value,
  onChange,
  autoComplete,
  message,
  hint,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "new-password" | "current-password";
  message?: string | null;
  hint?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <Field id={id} label="Password" message={message} hint={hint} announce={false}>
      <TextField
        id={id}
        name="password"
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        maxLength={128}
        invalid={!!message}
        describedBy={`${id}-message`}
        hintId={hint ? `${id}-hint` : undefined}
        end={
          <button
            type="button"
            aria-controls={id}
            aria-label={shown ? "Hide password" : "Show password"}
            onClick={() => setShown(!shown)}
            className="h-[36px] min-w-[64px] rounded-[8px] px-[10px] text-cap font-semibold text-primary-strong outline-none transition-colors hover:bg-page focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-solid focus-visible:outline-primary"
          >
            {shown ? "Hide" : "Show"}
          </button>
        }
      />
    </Field>
  );
}

/** An answer that belongs to no field. Rendered with key={attempt}, so a repeat is a new alert and is read again. */
function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex gap-[8px] rounded-[10px] border border-danger-line bg-danger-bg px-[12px] py-[10px] text-body text-danger">
      <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" className="mt-[3px] shrink-0" />
      {message}
    </p>
  );
}

function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      aria-disabled={pending || undefined}
      className={`inline-flex h-[44px] w-full items-center justify-center gap-[8px] rounded-[10px] bg-primary text-body font-semibold text-white shadow-[0_1px_2px_rgba(79,70,229,0.25),0_4px_12px_rgba(79,70,229,0.2)] outline-none transition-colors hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-primary ${pending ? "cursor-progress" : ""}`}
    >
      {pending && <LoaderCircle size={16} strokeWidth={2} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
      {pending ? pendingLabel : label}
    </button>
  );
}

function FormCard({ onSubmit, pending, children }: { onSubmit: (e: FormEvent<HTMLFormElement>) => void; pending: boolean; children: ReactNode }) {
  // method="post": pressing Enter before the page's script has loaded would otherwise send the
  // fields, the password included, in the address (a GET). A POST to the page sends nothing anywhere else.
  return (
    <form method="post" noValidate onSubmit={onSubmit} aria-busy={pending || undefined} className={`${card} mt-[24px] flex flex-col gap-[16px] p-pi`}>
      {children}
    </form>
  );
}

// --- sign up -------------------------------------------------------------------------------------

const SIGN_UP_FIELDS = ["name", "username", "email", "password"] as const;
type SignUpField = (typeof SIGN_UP_FIELDS)[number];

export function SignUpForm({ rules, next }: { rules: Catalog["username_rules"]; next: string }) {
  const [values, setValues] = useState<Record<SignUpField, string>>({ name: "", username: "", email: "", password: "" });
  const [shown, setShown] = useState<Errors<SignUpField>>({}); // problems on screen
  const [taken, setTaken] = useState<{ username?: string; email?: string }>({}); // the server's "taken"
  const [alert, setAlert] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const sending = useRef(false); // set at once; `pending` is only seen after the next render
  const pattern = new RegExp(rules.pattern);

  const check = (v: Record<SignUpField, string>, t = taken): Errors<SignUpField> => {
    const username = v.username.trim().toLowerCase();
    const email = v.email.trim().toLowerCase();
    return {
      name: v.name.trim() ? null : "Enter your name",
      username: !username
        ? "Choose a username"
        : !pattern.test(username)
          ? "Use 3-30 letters, digits or hyphens, with no hyphen at the start or end"
          : rules.reserved.includes(username) || username === t.username
            ? "This username is taken"
            : null,
      email: !email
        ? "Enter your email"
        : !EMAIL.test(email)
          ? "Enter an email address like name@example.com"
          : email === t.email
            ? "An account with this email already exists"
            : null,
      password: v.password.length >= 8 ? null : "Use at least 8 characters",
    };
  };

  const change = (field: SignUpField) => (value: string) => {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    // A field that shows a problem checks again as you type, and clears once it is right.
    if (shown[field]) setShown({ ...shown, [field]: check(nextValues)[field] });
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending.current) return;
    setAlert(null);
    const problems = check(values);
    flushSync(() => setShown(problems)); // on screen before focus moves, so the message is read
    if (focusFirst(SIGN_UP_FIELDS, problems)) return;
    sending.current = true;
    setPending(true);
    try {
      await api.signUp({ display_name: values.name.trim(), username: values.username.trim().toLowerCase(), email: values.email.trim().toLowerCase(), password: values.password });
      window.location.assign(safeNext(next));
      return; // the page is leaving; the button stays busy
    } catch (error) {
      sending.current = false;
      setPending(false);
      if (error instanceof ApiError && (error.code === "username_taken" || error.code === "email_taken")) {
        const field = error.code === "username_taken" ? "username" : "email";
        const nowTaken = { ...taken, [field]: values[field].trim().toLowerCase() };
        setTaken(nowTaken);
        const again = { ...problems, [field]: check(values, nowTaken)[field] };
        flushSync(() => setShown(again));
        focusFirst(SIGN_UP_FIELDS, again);
        return;
      }
      const failure = readFailure(error);
      if (failure.field && (SIGN_UP_FIELDS as readonly string[]).includes(failure.field)) {
        const again = { ...problems, [failure.field]: failure.message };
        flushSync(() => setShown(again));
        focusFirst(SIGN_UP_FIELDS, again);
        return;
      }
      setAttempt((n) => n + 1);
      setAlert(failure.message);
    }
  };

  const username = values.username.trim().toLowerCase();
  // The address only for a name that could really be yours (not reserved, not already taken).
  const usernameHint = pattern.test(username) && !rules.reserved.includes(username) && username !== taken.username ? (
    <>
      Your profile: <b className="font-medium text-ink-2">/u/{username}</b>
    </>
  ) : (
    "3-30 letters, digits or hyphens"
  );

  return (
    <FormCard onSubmit={submit} pending={pending}>
      <Field id="name" label="Name" message={shown.name} announce={false}>
        <TextField id="name" name="name" autoComplete="name" value={values.name} onChange={change("name")} maxLength={60} invalid={!!shown.name} describedBy="name-message" />
      </Field>
      <Field id="username" label="Username" message={shown.username} hint={usernameHint} announce={false}>
        <TextField
          id="username"
          name="username"
          autoComplete="nickname"
          autoCapitalize="none"
          spellCheck={false}
          value={values.username}
          onChange={change("username")}
          maxLength={30}
          invalid={!!shown.username}
          describedBy="username-message"
          hintId="username-hint"
        />
      </Field>
      <Field id="email" label="Email" message={shown.email} announce={false}>
        <TextField id="email" name="email" type="email" autoComplete="username" value={values.email} onChange={change("email")} maxLength={254} invalid={!!shown.email} describedBy="email-message" />
      </Field>
      <PasswordField id="password" value={values.password} onChange={change("password")} autoComplete="new-password" message={shown.password} hint="At least 8 characters" />
      <FormAlert key={attempt} message={alert} />
      <SubmitButton pending={pending} label="Sign up" pendingLabel="Signing up..." />
    </FormCard>
  );
}

// --- log in --------------------------------------------------------------------------------------

const LOG_IN_FIELDS = ["email", "password"] as const;
type LogInField = (typeof LOG_IN_FIELDS)[number];

export function LogInForm({ next }: { next: string }) {
  const [values, setValues] = useState<Record<LogInField, string>>({ email: "", password: "" });
  const [shown, setShown] = useState<Errors<LogInField>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const sending = useRef(false);

  const check = (v: Record<LogInField, string>): Errors<LogInField> => ({
    email: v.email.trim() ? null : "Enter your email",
    password: v.password ? null : "Enter your password",
  });

  const change = (field: LogInField) => (value: string) => {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    if (shown[field]) setShown({ ...shown, [field]: check(nextValues)[field] });
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending.current) return;
    setAlert(null);
    const problems = check(values);
    flushSync(() => setShown(problems));
    if (focusFirst(LOG_IN_FIELDS, problems)) return;
    sending.current = true;
    setPending(true);
    try {
      await api.logIn(values.email.trim(), values.password);
      window.location.assign(safeNext(next));
      return;
    } catch (error) {
      sending.current = false;
      setPending(false);
      setAttempt((n) => n + 1);
      setAlert(readFailure(error).message); // 401, 429 and failures: one message above the button
    }
  };

  return (
    <FormCard onSubmit={submit} pending={pending}>
      <Field id="email" label="Email" message={shown.email} announce={false}>
        <TextField id="email" name="email" type="email" autoComplete="username" value={values.email} onChange={change("email")} maxLength={254} invalid={!!shown.email} describedBy="email-message" />
      </Field>
      <PasswordField id="password" value={values.password} onChange={change("password")} autoComplete="current-password" message={shown.password} />
      <FormAlert key={attempt} message={alert} />
      <SubmitButton pending={pending} label="Log in" pendingLabel="Logging in..." />
    </FormCard>
  );
}

