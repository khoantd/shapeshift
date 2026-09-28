"use client";

import { useMutation, useQuery } from "convex/react";
import { Loader2, UserPlus } from "lucide-react";
import { useId, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { isConvexConfigured } from "../ConvexClientProvider";
import type { PlaceDetails } from "@/lib/places/types";

type PlaceContactsSectionProps = {
  place: PlaceDetails;
  compact?: boolean;
};

type SyncStatus = "pending" | "synced" | "failed";

type ContactRow = {
  _id: Id<"placeContacts">;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  syncStatus: SyncStatus;
  syncError?: string;
  leadFlowLeadId?: string;
};

async function pushToLeadFlow(body: {
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  placeId: string;
  placeName: string;
  formattedAddress?: string;
  mapsUri?: string;
}): Promise<{ leadId: string }> {
  const res = await fetch("/api/places/contacts", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    leadId?: string;
    error?: { message?: string };
  } | null;

  if (!res.ok || !json?.success || !json.leadId) {
    throw new Error(json?.error?.message ?? `Could not sync contact (${res.status})`);
  }
  return { leadId: json.leadId };
}

function SyncBadge({ status }: { status: SyncStatus }) {
  const label = status === "synced" ? "Synced" : status === "failed" ? "Failed" : "Pending";
  const className =
    status === "synced"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : status === "failed"
        ? "bg-destructive/15 text-destructive"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${className}`}>
      {label}
    </span>
  );
}

function PlaceContactsUnavailable() {
  return (
    <p className="mt-3 border-t border-border pt-3 text-[12px] text-muted-foreground">
      Contact history needs Convex. Set <code className="text-[11px]">NEXT_PUBLIC_CONVEX_URL</code>{" "}
      and run <code className="text-[11px]">bunx convex dev</code>.
    </p>
  );
}

function PlaceContactsConvex({ place, compact }: PlaceContactsSectionProps) {
  const formId = useId();
  const contacts = useQuery(api.placeContacts.listByPlaceId, { placeId: place.placeId });
  const createContact = useMutation(api.placeContacts.create);
  const markSynced = useMutation(api.placeContacts.markSynced);
  const markFailed = useMutation(api.placeContacts.markFailed);
  const markPending = useMutation(api.placeContacts.markPending);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [retryingId, setRetryingId] = useState<Id<"placeContacts"> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const syncContact = async (
    contactId: Id<"placeContacts">,
    fields: {
      name: string;
      email: string;
      phone?: string;
      notes?: string;
    },
  ) => {
    try {
      const { leadId } = await pushToLeadFlow({
        ...fields,
        placeId: place.placeId,
        placeName: place.name,
        formattedAddress: place.formattedAddress,
        mapsUri: place.mapsUri,
      });
      await markSynced({ id: contactId, leadFlowLeadId: leadId });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      await markFailed({ id: contactId, syncError: message });
      throw err;
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const { id } = await createContact({
        placeId: place.placeId,
        placeName: place.name,
        formattedAddress: place.formattedAddress,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      await syncContact(id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
      setFormSuccess("Contact saved and synced to Lead Flow.");
      setOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save contact.");
    } finally {
      setSubmitting(false);
    }
  };

  const onRetry = async (row: ContactRow) => {
    if (retryingId) return;
    setRetryingId(row._id);
    setFormError(null);
    try {
      await markPending({ id: row._id });
      await syncContact(row._id, {
        name: row.name,
        email: row.email,
        phone: row.phone,
        notes: row.notes,
      });
      setFormSuccess("Contact synced to Lead Flow.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setRetryingId(null);
    }
  };

  const inputClass =
    "h-9 w-full cursor-text rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground outline-none transition-[color,box-shadow] duration-150 placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
          Contacts
        </h3>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setFormError(null);
            setFormSuccess(null);
          }}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <UserPlus className="size-3.5" aria-hidden />
          {open ? "Close" : "Add contact"}
        </button>
      </div>

      {open && (
        <form onSubmit={onSubmit} className="mt-2.5 flex flex-col gap-2">
          <p className="text-[12px] text-muted-foreground">
            Company: <span className="font-medium text-foreground">{place.name}</span>
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${formId}-name`} className="text-[12px] font-medium text-foreground">
              Name
            </label>
            <input
              id={`${formId}-name`}
              name="name"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              className={inputClass}
              placeholder="Person name"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${formId}-email`} className="text-[12px] font-medium text-foreground">
              Email
            </label>
            <input
              id={`${formId}-email`}
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              className={inputClass}
              placeholder="name@example.com"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${formId}-phone`} className="text-[12px] font-medium text-foreground">
              Phone <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id={`${formId}-phone`}
              name="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={submitting}
              className={inputClass}
              placeholder="+84 …"
            />
          </div>
          {!compact && (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${formId}-notes`} className="text-[12px] font-medium text-foreground">
                Notes <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id={`${formId}-notes`}
                name="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
                className="w-full cursor-text resize-y rounded-md border border-input bg-background px-2.5 py-2 text-[13px] text-foreground outline-none transition-[color,box-shadow] duration-150 placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                placeholder="Context for this lead"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save to Lead Flow"
            )}
          </button>
        </form>
      )}

      <div className="mt-2 min-h-4 text-[12px]" aria-live="polite">
        {formError && <p className="text-destructive">{formError}</p>}
        {!formError && formSuccess && <p className="text-emerald-700 dark:text-emerald-400">{formSuccess}</p>}
      </div>

      {contacts === undefined ? (
        <p className="mt-2 text-[12px] text-muted-foreground">Loading contacts…</p>
      ) : contacts.length === 0 ? (
        !open && (
          <p className="mt-2 text-[12px] text-muted-foreground">No contacts for this place yet.</p>
        )
      ) : (
        <ul className="mt-2 space-y-2">
          {contacts.map((row) => (
            <li
              key={row._id}
              className="rounded-md border border-border/70 bg-muted/30 px-2.5 py-2 text-[13px]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{row.name}</p>
                  <p className="truncate text-[12px] text-muted-foreground">{row.email}</p>
                  {row.phone && (
                    <p className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">{row.phone}</p>
                  )}
                </div>
                <SyncBadge status={row.syncStatus} />
              </div>
              {row.syncStatus === "failed" && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {row.syncError && (
                    <p className="text-[11px] text-destructive">{row.syncError}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => onRetry(row)}
                    disabled={retryingId === row._id}
                    className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
                  >
                    {retryingId === row._id ? (
                      <>
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                        Retrying…
                      </>
                    ) : (
                      "Retry sync"
                    )}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlaceContactsSection(props: PlaceContactsSectionProps) {
  if (!isConvexConfigured()) {
    return <PlaceContactsUnavailable />;
  }
  return <PlaceContactsConvex {...props} />;
}
