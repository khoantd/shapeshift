"use client";

import { useMutation, useQuery } from "convex/react";
import { Loader2, UserPlus } from "lucide-react";
import { useId, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { isConvexConfigured } from "../ConvexClientProvider";
import { CONTACT_ROLES, contactRoleLabel } from "@/lib/lead-flow/types";
import type { PlaceDetails } from "@/lib/places/types";

type PlaceContactsSectionProps = {
  place: PlaceDetails;
  compact?: boolean;
};

type SyncStatus = "pending" | "synced" | "failed";

type ContactFields = {
  name: string;
  email: string;
  role?: string;
  phone?: string;
  notes?: string;
};

type ContactRow = ContactFields & {
  _id: Id<"placeContacts">;
  syncStatus: SyncStatus;
  syncError?: string;
};

async function pushToLeadFlow(
  body: ContactFields & {
    placeId: string;
    placeName: string;
    formattedAddress?: string;
    mapsUri?: string;
  },
): Promise<{ leadId: string }> {
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

const inputClass =
  "h-9 w-full cursor-text rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground outline-none transition-[color,box-shadow] duration-150 placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

function ContactFormFields({
  formId,
  compact,
  placeName,
  name,
  email,
  role,
  phone,
  notes,
  submitting,
  onName,
  onEmail,
  onRole,
  onPhone,
  onNotes,
}: {
  formId: string;
  compact?: boolean;
  placeName: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  notes: string;
  submitting: boolean;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onRole: (v: string) => void;
  onPhone: (v: string) => void;
  onNotes: (v: string) => void;
}) {
  return (
    <>
      <p className="text-[12px] text-muted-foreground">
        Company: <span className="font-medium text-foreground">{placeName}</span>
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
          onChange={(e) => onName(e.target.value)}
          disabled={submitting}
          className={inputClass}
          placeholder="Person name"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${formId}-role`} className="text-[12px] font-medium text-foreground">
          Role <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <select
          id={`${formId}-role`}
          name="role"
          value={role}
          onChange={(e) => onRole(e.target.value)}
          disabled={submitting}
          className={`${inputClass} cursor-pointer`}
        >
          <option value="">Select role</option>
          {CONTACT_ROLES.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </select>
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
          onChange={(e) => onEmail(e.target.value)}
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
          onChange={(e) => onPhone(e.target.value)}
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
            onChange={(e) => onNotes(e.target.value)}
            disabled={submitting}
            className="w-full cursor-text resize-y rounded-md border border-input bg-background px-2.5 py-2 text-[13px] text-foreground outline-none transition-[color,box-shadow] duration-150 placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
            placeholder="Context for this lead"
          />
        </div>
      )}
    </>
  );
}

function useContactFormState() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const clearForm = () => {
    setName("");
    setEmail("");
    setRole("");
    setPhone("");
    setNotes("");
  };

  const fields = (): ContactFields => ({
    name: name.trim(),
    email: email.trim(),
    role: role.trim() || undefined,
    phone: phone.trim() || undefined,
    notes: notes.trim() || undefined,
  });

  return {
    name,
    email,
    role,
    phone,
    notes,
    open,
    submitting,
    formError,
    formSuccess,
    setName,
    setEmail,
    setRole,
    setPhone,
    setNotes,
    setOpen,
    setSubmitting,
    setFormError,
    setFormSuccess,
    clearForm,
    fields,
  };
}

function PlaceContactsLeadFlowOnly({ place, compact }: PlaceContactsSectionProps) {
  const formId = useId();
  const form = useContactFormState();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.submitting) return;
    form.setSubmitting(true);
    form.setFormError(null);
    form.setFormSuccess(null);
    try {
      await pushToLeadFlow({
        ...form.fields(),
        placeId: place.placeId,
        placeName: place.name,
        formattedAddress: place.formattedAddress,
        mapsUri: place.mapsUri,
      });
      form.clearForm();
      form.setFormSuccess("Contact saved to Lead Flow. You can add another.");
    } catch (err) {
      form.setFormError(err instanceof Error ? err.message : "Could not save contact.");
    } finally {
      form.setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
          Contacts
        </h3>
        <button
          type="button"
          onClick={() => {
            form.setOpen((v) => !v);
            form.setFormError(null);
            form.setFormSuccess(null);
          }}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <UserPlus className="size-3.5" aria-hidden />
          {form.open ? "Close" : "Add contact"}
        </button>
      </div>

      {form.open && (
        <form onSubmit={onSubmit} className="mt-2.5 flex flex-col gap-2">
          <ContactFormFields
            formId={formId}
            compact={compact}
            placeName={place.name}
            name={form.name}
            email={form.email}
            role={form.role}
            phone={form.phone}
            notes={form.notes}
            submitting={form.submitting}
            onName={form.setName}
            onEmail={form.setEmail}
            onRole={form.setRole}
            onPhone={form.setPhone}
            onNotes={form.setNotes}
          />
          <button
            type="submit"
            disabled={form.submitting}
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {form.submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save to Lead Flow"
            )}
          </button>
          <p className="text-[11px] text-muted-foreground">
            Add as many contacts as you need. Local history needs Convex (
            <code className="text-[10px]">NEXT_PUBLIC_CONVEX_URL</code>).
          </p>
        </form>
      )}

      <div className="mt-2 min-h-4 text-[12px]" aria-live="polite">
        {form.formError && <p className="text-destructive">{form.formError}</p>}
        {!form.formError && form.formSuccess && (
          <p className="text-emerald-700 dark:text-emerald-400">{form.formSuccess}</p>
        )}
      </div>
    </div>
  );
}

function PlaceContactsConvex({ place, compact }: PlaceContactsSectionProps) {
  const formId = useId();
  const contacts = useQuery(api.placeContacts.listByPlaceId, { placeId: place.placeId });
  const createContact = useMutation(api.placeContacts.create);
  const markSynced = useMutation(api.placeContacts.markSynced);
  const markFailed = useMutation(api.placeContacts.markFailed);
  const markPending = useMutation(api.placeContacts.markPending);
  const form = useContactFormState();
  const [retryingId, setRetryingId] = useState<Id<"placeContacts"> | null>(null);

  const syncContact = async (contactId: Id<"placeContacts">, fields: ContactFields) => {
    try {
      const { leadId } = await pushToLeadFlow({
        ...fields,
        placeId: place.placeId,
        placeName: place.name,
        formattedAddress: place.formattedAddress,
        mapsUri: place.mapsUri,
      });
      await markSynced({ id: contactId, leadFlowLeadId: leadId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      await markFailed({ id: contactId, syncError: message });
      throw err;
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.submitting) return;
    form.setSubmitting(true);
    form.setFormError(null);
    form.setFormSuccess(null);
    try {
      const fields = form.fields();
      const { id } = await createContact({
        placeId: place.placeId,
        placeName: place.name,
        formattedAddress: place.formattedAddress,
        ...fields,
      });
      await syncContact(id, fields);
      form.clearForm();
      form.setFormSuccess("Contact saved. You can add another.");
    } catch (err) {
      form.setFormError(err instanceof Error ? err.message : "Could not save contact.");
    } finally {
      form.setSubmitting(false);
    }
  };

  const onRetry = async (row: ContactRow) => {
    if (retryingId) return;
    setRetryingId(row._id);
    form.setFormError(null);
    try {
      await markPending({ id: row._id });
      await syncContact(row._id, {
        name: row.name,
        email: row.email,
        role: row.role,
        phone: row.phone,
        notes: row.notes,
      });
      form.setFormSuccess("Contact synced to Lead Flow.");
    } catch (err) {
      form.setFormError(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
          Contacts{contacts && contacts.length > 0 ? ` (${contacts.length})` : ""}
        </h3>
        <button
          type="button"
          onClick={() => {
            form.setOpen((v) => !v);
            form.setFormError(null);
            form.setFormSuccess(null);
          }}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <UserPlus className="size-3.5" aria-hidden />
          {form.open ? "Close" : "Add contact"}
        </button>
      </div>

      {form.open && (
        <form onSubmit={onSubmit} className="mt-2.5 flex flex-col gap-2">
          <ContactFormFields
            formId={formId}
            compact={compact}
            placeName={place.name}
            name={form.name}
            email={form.email}
            role={form.role}
            phone={form.phone}
            notes={form.notes}
            submitting={form.submitting}
            onName={form.setName}
            onEmail={form.setEmail}
            onRole={form.setRole}
            onPhone={form.setPhone}
            onNotes={form.setNotes}
          />
          <button
            type="submit"
            disabled={form.submitting}
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {form.submitting ? (
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
        {form.formError && <p className="text-destructive">{form.formError}</p>}
        {!form.formError && form.formSuccess && (
          <p className="text-emerald-700 dark:text-emerald-400">{form.formSuccess}</p>
        )}
      </div>

      {contacts === undefined ? (
        <p className="mt-2 text-[12px] text-muted-foreground">Loading contacts…</p>
      ) : contacts.length === 0 ? null : (
        <ul className="mt-2 space-y-2">
          {contacts.map((row) => (
            <li
              key={row._id}
              className="rounded-md border border-border/70 bg-muted/30 px-2.5 py-2 text-[13px]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{row.name}</p>
                  {row.role && (
                    <p className="truncate text-[12px] text-muted-foreground">
                      {contactRoleLabel(row.role)}
                    </p>
                  )}
                  <p className="truncate text-[12px] text-muted-foreground">{row.email}</p>
                  {row.phone && (
                    <p className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">{row.phone}</p>
                  )}
                </div>
                <SyncBadge status={row.syncStatus} />
              </div>
              {row.syncStatus === "failed" && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {row.syncError && <p className="text-[11px] text-destructive">{row.syncError}</p>}
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
    return <PlaceContactsLeadFlowOnly {...props} />;
  }
  return <PlaceContactsConvex {...props} />;
}
