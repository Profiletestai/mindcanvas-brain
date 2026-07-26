"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, isErr } from "../_lib/api";
import { StepCard } from "../_components/StepCard";
import {
  DIAGNOSTIC_PATH,
  SESSION_BOOKED_PATH,
} from "../_lib/progress";

const BOOKING_URL =
  process.env.NEXT_PUBLIC_ONBOARDING_BOOKING_URL?.trim() ?? "";

const SESSION_OUTCOMES = [
  "Choose your best first use case",
  "Understand which model to use first",
  "Review how diagnostic results are completed",
  "Plan how to use your included submissions",
  "Map MindCanvas to your sales, coaching or people workflow",
  "Confirm your launch and next actions",
];

export default function BookSessionPage() {
  const router = useRouter();
  const [bookingOpened, setBookingOpened] = useState(false);
  const [pending, setPending] = useState<"booked" | "later" | null>(null);
  const [error, setError] = useState("");

  function openBookingCalendar() {
    setError("");
    if (!BOOKING_URL) {
      setError(
        "The booking calendar is not connected yet. You can continue and book your session later from the portal."
      );
      return;
    }

    window.open(BOOKING_URL, "_blank", "noopener,noreferrer");
    setBookingOpened(true);
  }

  async function confirmBooked() {
    if (pending) return;
    setPending("booked");
    setError("");
    const res = await api.completeStep(8);
    if (isErr(res)) {
      setError(res.error);
      setPending(null);
      return;
    }
    router.push(SESSION_BOOKED_PATH);
  }

  async function doThisLater() {
    if (pending) return;
    setPending("later");
    setError("");

    // Completing step 9 skips both the booking choice and its confirmation
    // screen while keeping progress monotonic and resumable.
    const res = await api.completeStep(9);
    if (isErr(res)) {
      setError(res.error);
      setPending(null);
      return;
    }
    router.push(DIAGNOSTIC_PATH);
  }

  return (
    <StepCard
      titleNoWrap={false}
      title={
        <>
          Book your{" "}
          <span style={{ color: "rgb(84, 175, 224)" }}>
            onboarding session
          </span>
        </>
      }
      subtitle="Choose a time that suits you and we will help you get value from MindCanvas faster."
    >
      <div
        className="mt-8 rounded-[18px] border"
        style={{
          background: "#fff",
          borderColor: "rgb(228,238,248)",
          padding: "24px",
          boxShadow: "0px 2px 12px 0px rgba(13,45,94,0.06)",
        }}
      >
        <p
          className="font-bold"
          style={{ color: "rgb(24,44,62)", fontSize: "14px" }}
        >
          On the call, we will help you:
        </p>

        <ul className="mt-4 space-y-2.5">
          {SESSION_OUTCOMES.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5"
              style={{
                color: "rgb(90,122,158)",
                fontSize: "13px",
                lineHeight: "20px",
              }}
            >
              <span
                className="mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: "rgba(34,197,94,0.12)",
                  color: "rgb(22,163,74)",
                  fontSize: "10px",
                  fontWeight: 800,
                }}
              >
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {error && (
          <p className="mt-4 text-sm text-rose-500" role="alert">
            {error}
          </p>
        )}

        {!bookingOpened ? (
          <button
            type="button"
            onClick={openBookingCalendar}
            disabled={pending !== null}
            className={`mt-6 h-[54px] w-full rounded-[12px] font-bold text-white ${
              pending ? "cursor-not-allowed opacity-40" : "cursor-pointer"
            }`}
            style={{
              background:
                "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
              fontSize: "15px",
              boxShadow: "0px 4px 16px 0px rgba(37,99,200,0.35)",
            }}
          >
            Open booking calendar
          </button>
        ) : (
          <>
            <p
              className="mt-5 text-center"
              style={{
                color: "rgb(90,122,158)",
                fontSize: "12px",
                lineHeight: "18px",
              }}
            >
              Complete the booking in the calendar tab, then return here.
            </p>
            <button
              type="button"
              onClick={confirmBooked}
              disabled={pending !== null}
              className={`mt-3 h-[54px] w-full rounded-[12px] font-bold text-white ${
                pending ? "cursor-not-allowed opacity-40" : "cursor-pointer"
              }`}
              style={{
                background:
                  "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
                fontSize: "15px",
                boxShadow: "0px 4px 16px 0px rgba(37,99,200,0.35)",
              }}
            >
              {pending === "booked"
                ? "Saving…"
                : "I’ve booked my session"}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={doThisLater}
          disabled={pending !== null}
          className={`mt-3 h-[50px] w-full rounded-[12px] border font-semibold ${
            pending ? "cursor-not-allowed opacity-40" : "cursor-pointer"
          }`}
          style={{
            background: "#fff",
            borderColor: "rgb(208,224,240)",
            color: "rgb(42,137,190)",
            fontSize: "14px",
          }}
        >
          {pending === "later" ? "Saving…" : "Do this later"}
        </button>
      </div>
    </StepCard>
  );
}
