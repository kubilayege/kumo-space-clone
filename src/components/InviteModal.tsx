"use client";

import { useState } from "react";
import { Check, Copy, Globe, Pencil, UserPlus, X } from "lucide-react";

interface InviteModalProps {
  spaceId: string;
  onClose: () => void;
}

type RoleId = "visitor" | "member" | "editor";

const ROLES: { id: RoleId; label: string; hint: string; icon: typeof Globe }[] = [
  { id: "visitor", label: "Visitor", hint: "Can walk + chat", icon: Globe },
  { id: "member", label: "Member", hint: "Can also edit profile", icon: Check },
  { id: "editor", label: "Editor", hint: "Can change the space", icon: Pencil },
];

const EXPIRY_OPTIONS = ["1 hour", "24 hours", "7 days", "Never"];
const APPROVAL_OPTIONS = ["Auto-admit", "Host approves"];

export function InviteModal({ spaceId, onClose }: InviteModalProps) {
  const [role, setRole] = useState<RoleId>("visitor");
  const [expiry, setExpiry] = useState(EXPIRY_OPTIONS[1]);
  const [approval, setApproval] = useState(APPROVAL_OPTIONS[0]);
  const [copied, setCopied] = useState(false);

  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/space/${encodeURIComponent(spaceId)}`
      : `/space/${spaceId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[rgba(20,16,12,0.45)] backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="animate-scale-in relative w-full max-w-[460px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
        {/* header */}
        <div className="flex items-start justify-between px-6 pb-4 pt-5">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] text-[12px] font-bold text-white">
                ◐
              </div>
              <span className="max-w-[260px] truncate font-mono text-[12px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
                {spaceId}
              </span>
            </div>
            <h2 className="text-[22px] font-semibold tracking-tight text-[var(--ink)]">
              Invite people in
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--paper-2)] text-[var(--ink-soft)] transition hover:bg-[var(--line)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* link */}
        <div className="px-6 pb-5">
          <label className="vs-label">Invite link</label>
          <div className="flex items-center gap-2 rounded-[10px] border border-[var(--line-2)] bg-[var(--paper-2)] py-1 pl-3.5 pr-1">
            <span className="flex-1 truncate font-mono text-[13px] text-[var(--ink-2)]">{link}</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-[12px] font-medium text-white transition hover:bg-[var(--accent-hover)]"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">
            Anyone with this link can join
          </p>
        </div>

        <div className="h-px bg-[var(--line)]" />

        {/* role */}
        <div className="px-6 py-5">
          <label className="vs-label">They join as</label>
          <div className="flex gap-1.5">
            {ROLES.map((r) => {
              const active = role === r.id;
              const Icon = r.icon;
              return (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className={`flex flex-1 flex-col gap-1 rounded-[10px] border p-2.5 text-left transition ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--line-2)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Icon
                      className="h-3.5 w-3.5"
                      style={{ color: active ? "var(--accent)" : "var(--ink-2)" }}
                    />
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: active ? "var(--accent)" : "var(--ink)" }}
                    >
                      {r.label}
                    </span>
                  </span>
                  <span className="text-[11px] leading-tight text-[var(--ink-faint)]">{r.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* options */}
        <div className="grid grid-cols-2 gap-3 px-6 pb-5">
          <SelectField label="Expires" value={expiry} options={EXPIRY_OPTIONS} onChange={setExpiry} />
          <SelectField
            label="Approval"
            value={approval}
            options={APPROVAL_OPTIONS}
            onChange={setApproval}
          />
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--paper-2)] px-6 py-3.5">
          <span className="flex items-center gap-1.5 text-[13px] text-[var(--ink-soft)]">
            <UserPlus className="h-3.5 w-3.5" />
            Share the link to invite
          </span>
          <button
            onClick={onClose}
            className="rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)] px-4 py-2 text-[13px] font-medium text-[var(--ink)] transition hover:bg-[var(--surface-2)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 rounded-[10px] border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2">
      <span className="text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="cursor-pointer bg-transparent text-[13px] text-[var(--ink)] outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
