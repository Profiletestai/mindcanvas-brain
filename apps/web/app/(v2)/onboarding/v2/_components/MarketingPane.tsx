"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

export const FEATURES = [
  {
    title: "Secure & Private",
    description: "Your data is encrypted and always protected.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Data-Driven Insights",
    description: "Make smarter decisions with proven data.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M3 16l5-5 4 4 3-3 6 6" />
        <circle cx="8.5" cy="8.5" r="1.2" fill="#fff" stroke="none" />
      </svg>
    ),
  },
  {
    title: "Built for Growth",
    description: "Tools and insights to help you grow faster.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polygon points="12,3 14.6,9.1 21,9.8 16.2,14.1 17.6,20.5 12,17.3 6.4,20.5 7.8,14.1 3,9.8 9.4,9.1" />
      </svg>
    ),
  },
];

type MarketingCopy = {
  titleLines: string[];
  description: string;
  image?: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };
};

const DEFAULT_COPY: MarketingCopy = {
  titleLines: ["Make Growth", "Predictable"],
  description:
    "Join thousands of professionals using data-driven insights to grow with confidence.",
};

const POST_PAYMENT_COPY: Record<string, MarketingCopy> = {
  "/onboarding/v2/organisation": {
    titleLines: ["Your MindCanvas", "Workspace"],
    description:
      "Your organisation brings your selected engines, assessments, test links, reports and team activity together in one place.",
    image: {
      src: "/onboarding/organisation-workspace-building.png",
      alt: "MindCanvas organisation workspace",
      width: 150,
      height: 112,
    },
  },
  "/onboarding/v2/created": {
    titleLines: ["Your Workspace", "Is Ready"],
    description:
      "Your organisation has been created successfully. Review your selections, then continue with the final onboarding steps.",
    image: {
      src: "/onboarding/organisation-workspace-building.png",
      alt: "MindCanvas organisation workspace",
      width: 150,
      height: 112,
    },
  },
  "/onboarding/v2/welcome": {
    titleLines: ["Turn Insight", "Into Action"],
    description:
      "MindCanvas turns behavioural insight into practical decisions across sales, coaching and people.",
    image: {
      src: "/onboarding/welcome-profile-illustration.png",
      alt: "MindCanvas behavioural profile",
      width: 164,
      height: 120,
    },
  },
  "/onboarding/v2/book-session": {
    titleLines: ["Get Value", "Faster"],
    description:
      "Your onboarding session connects MindCanvas to your goals, helping you begin with the right engine, assessment and use case.",
    image: {
      src: "/onboarding/booking-chart-illustration.png",
      alt: "MindCanvas onboarding growth chart",
      width: 154,
      height: 116,
    },
  },
  "/onboarding/v2/session-booked": {
    titleLines: ["You’re Booked"],
    description:
      "Your onboarding session will help you turn your first MindCanvas use case into a practical plan.",
    image: {
      src: "/onboarding/session-booked-link-illustration.png",
      alt: "MindCanvas onboarding session booked",
      width: 148,
      height: 108,
    },
  },
  "/onboarding/v2/diagnostic": {
    titleLines: ["Experience It", "for Yourself"],
    description:
      "Complete a diagnostic to experience the assessment journey and report before using MindCanvas with your clients, candidates or team.",
    image: {
      src: "/onboarding/diagnostic-checklist-illustration.png",
      alt: "MindCanvas diagnostic checklist",
      width: 158,
      height: 118,
    },
  },
};

function normalisePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function MarketingPane() {
  const pathname = normalisePathname(usePathname());
  const copy = POST_PAYMENT_COPY[pathname] ?? DEFAULT_COPY;
  const showFeatures = !POST_PAYMENT_COPY[pathname];
  const isPostPayment = Boolean(POST_PAYMENT_COPY[pathname]);

  return (
    <aside className="hidden lg:flex max-w-[430px] flex-col text-white">
      {copy.image && (
        <div
          className="mb-7 flex items-end"
          style={{ minHeight: `${copy.image.height}px` }}
        >
          <Image
            src={copy.image.src}
            alt={copy.image.alt}
            width={copy.image.width}
            height={copy.image.height}
            priority
            className="h-auto w-auto select-none object-contain"
          />
        </div>
      )}

      <h1
        className="font-extrabold tracking-tight text-white"
        style={{
          fontSize: isPostPayment ? "52px" : "62px",
          lineHeight: isPostPayment ? "52px" : "62px",
          letterSpacing: isPostPayment ? "-1.7px" : "-2px",
        }}
      >
        {copy.titleLines.map((line, index) => (
          <span key={line}>
            {index > 0 && <br />}
            {line}
          </span>
        ))}
      </h1>

      <p
        className={isPostPayment ? "mt-6" : "mt-8"}
        style={{
          fontSize: "15px",
          lineHeight: "25.5px",
          color: "rgba(255,255,255,0.6)",
          maxWidth: "360px",
        }}
      >
        {copy.description}
      </p>

      {showFeatures && (
        <ul className="mt-10 space-y-5">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-center gap-4">
              <span
                className="flex items-center justify-center"
                style={{
                  width: "46px",
                  height: "46px",
                  borderRadius: "14px",
                  background: "rgb(84,175,224)",
                  border: "1px solid rgba(84,175,224,0.12)",
                  boxShadow: "0px 4px 16px 0px rgba(0,0,0,0.2)",
                }}
              >
                {f.icon}
              </span>
              <div>
                <div
                  className="font-bold text-white"
                  style={{ fontSize: "14px", lineHeight: 1 }}
                >
                  {f.title}
                </div>
                <div
                  className="mt-1"
                  style={{
                    fontSize: "12px",
                    color: "rgba(255,255,255,0.5)",
                    lineHeight: "18.6px",
                  }}
                >
                  {f.description}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
