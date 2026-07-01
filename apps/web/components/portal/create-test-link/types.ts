// apps/web/components/portal/create-test-link/types.ts
// Shared types, form shape, and static copy for the Create Test Link modal.

export type ModelOption = {
  id: string;
  name: string;
  category?: string;
};

export type Experience = "show" | "hide" | "host" | "review";
export type LimitMode = "none" | "count" | "date";

export type CreateTestLinkFormValues = {
  modelId: string;
  name: string;
  experience: Experience;
  limitMode: LimitMode;
  maxUses: string;
  expiresDate: string;
};

export const EXPERIENCE_OPTIONS: {
  value: Experience;
  title: string;
  hint: string;
  showResults: boolean;
}[] = [
  {
    value: "show",
    title: "Show report after completion",
    hint: "Test taker sees their report immediately",
    showResults: true,
  },
  {
    value: "hide",
    title: "Hide report after completion",
    hint: "Report delivered to host only",
    showResults: false,
  },
  {
    value: "host",
    title: "Send report to host only",
    hint: "Host reviews and shares manually",
    showResults: false,
  },
  {
    value: "review",
    title: "Require manual review before sharing",
    hint: "You approve before test taker receives the report",
    showResults: false,
  },
];

export const LIMIT_OPTIONS: { value: LimitMode; title: string; hint: string }[] =
  [
    {
      value: "none",
      title: "No limit",
      hint: "Unlimited submissions on this link",
    },
    {
      value: "count",
      title: "Limit by number of submissions",
      hint: "Link closes when the limit is reached",
    },
    {
      value: "date",
      title: "Close on a specific date",
      hint: "Link deactivates automatically",
    },
  ];

// 4 input steps + success.
export const TOTAL_STEPS = 5;
