"use client";

import { useMutation } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { isConvexConfigured } from "../ConvexClientProvider";

type FormState = "idle" | "submitting" | "joined" | "already" | "error";

function SuccessCard({
  state,
  position,
}: {
  state: "joined" | "already";
  position: number | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex w-full max-w-md items-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-5 py-4 text-left"
      role="status"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="size-4" aria-hidden />
      </span>
      <div className="text-sm">
        <p className="font-medium text-foreground">
          {state === "joined" ? "You're on the list." : "You're already in."}
        </p>
        <p className="mt-0.5 text-muted-foreground">
          {position !== null && <>Spot #{position}. </>}
          We&apos;ll email you the moment your invite is ready.
        </p>
      </div>
    </motion.div>
  );
}

function EmailForm({
  id,
  onSubmit,
  state,
  errorMessage,
}: {
  id: string;
  onSubmit: (email: string) => Promise<void>;
  state: FormState;
  errorMessage: string | null;
}) {
  const [email, setEmail] = useState("");
  const inputId = `${id}-email`;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || state === "submitting") return;
    await onSubmit(email);
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor={inputId} className="sr-only">
            Email address
          </label>
          <input
            id={inputId}
            type="email"
            name="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={state === "submitting"}
            className="h-11 w-full cursor-text rounded-xl border border-input bg-background px-4 text-sm text-foreground shadow-xs transition-[color,box-shadow] duration-150 ease-out outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={state === "submitting"}
          className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors duration-150 ease-out hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]"
        >
          <AnimatePresence mode="wait" initial={false}>
            {state === "submitting" ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-2"
              >
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Joining…
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-2"
              >
                Join the waitlist
                <ArrowRight className="size-4" aria-hidden />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </form>
      <div className="mt-2 min-h-5 text-left text-xs text-muted-foreground" aria-live="polite">
        {state === "error" ? (
          <p className="text-destructive">{errorMessage}</p>
        ) : (
          <p>No spam, no noise. One email when we open the doors.</p>
        )}
      </div>
    </div>
  );
}

function SignupFormConvex({ formId }: { formId: string }) {
  const joinWaitlist = useMutation(api.waitlist.joinWaitlist);
  const [state, setState] = useState<FormState>("idle");
  const [position, setPosition] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (state === "joined" || state === "already") {
    return <SuccessCard state={state} position={position} />;
  }

  return (
    <EmailForm
      id={formId}
      state={state}
      errorMessage={errorMessage}
      onSubmit={async (email) => {
        setState("submitting");
        setErrorMessage(null);
        try {
          const result = await joinWaitlist({ email });
          setPosition(result.position);
          setState(result.status === "joined" ? "joined" : "already");
        } catch (error) {
          setState("error");
          setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
        }
      }}
    />
  );
}

function SignupFormUnavailable({ formId }: { formId: string }) {
  const [state, setState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <EmailForm
      id={formId}
      state={state}
      errorMessage={errorMessage}
      onSubmit={async () => {
        setState("error");
        setErrorMessage("Waitlist is not configured yet. Set NEXT_PUBLIC_CONVEX_URL and run convex dev.");
      }}
    />
  );
}

export function SignupForm() {
  const formId = useId();
  if (!isConvexConfigured()) {
    return <SignupFormUnavailable formId={formId} />;
  }
  return <SignupFormConvex formId={formId} />;
}
