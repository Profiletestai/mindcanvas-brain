// apps/web/components/portal/CreateTestLinkButton.tsx
// Launches the multi-step Create Test Link modal. Usable from the Tests
// model cards, page headers, and the Created test links table.
"use client";

import { useState } from "react";
import CreateTestLinkModal, {
  type ModelOption,
} from "./CreateTestLinkModal";

type Variant = "header" | "card" | "link";

type Props = {
  orgId: string;
  orgSlug: string;
  models: ModelOption[];
  initialModelId?: string;
  variant?: Variant;
  label?: string;
};

export default function CreateTestLinkButton({
  orgId,
  orgSlug,
  models,
  initialModelId,
  variant = "header",
  label = "Create test link",
}: Props) {
  const [open, setOpen] = useState(false);

  const shadow =
    "text-white shadow-[0_6px_20px_0_rgba(26,106,232,0.38)] transition-opacity hover:opacity-90";
  // Header buttons use the two-stop gradient from the design; card buttons use
  // the flat #54AFE0 fill.
  const headerFill = `bg-[linear-gradient(101.83deg,#3A96C7_0%,#54AFE0_100%)] ${shadow}`;
  const cardFill = `bg-[#54AFE0] ${shadow}`;

  const cls =
    variant === "link"
      ? "text-[13px] font-medium text-[#54AFE0] transition hover:text-white"
      : variant === "card"
      ? `inline-flex h-[24px] items-center rounded-md px-[11px] text-[11px] font-semibold leading-none tracking-[0.1px] ${cardFill}`
      : `inline-flex h-[31px] items-center gap-[5px] rounded-md pl-[9px] pr-[7px] text-[12px] font-bold leading-none tracking-[0.1px] ${headerFill}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
        className={cls}
      >
        {variant === "header" && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
        {variant === "link" ? `+ ${label} →` : label}
      </button>

      {open && (
        <CreateTestLinkModal
          orgId={orgId}
          orgSlug={orgSlug}
          models={models}
          initialModelId={initialModelId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
