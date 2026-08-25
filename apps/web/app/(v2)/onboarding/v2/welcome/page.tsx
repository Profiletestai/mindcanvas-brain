"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, isErr } from "../_lib/api";
import { StepCard } from "../_components/StepCard";
import { BOOK_SESSION_PATH } from "../_lib/progress";

const VIDEO_URL =
  "/onboarding/welcome.mp4";

export default function WelcomePage() {
  const router = useRouter();

  const [advancing, setAdvancing] =
    useState(false);

  async function advance() {
    if (advancing) return;

    setAdvancing(true);

    const response =
      await api.completeStep(7);

    if (isErr(response)) {
      setAdvancing(false);
      return;
    }

    router.push(BOOK_SESSION_PATH);
  }

  return (
    <StepCard
      titleNoWrap={false}
      title={
        <>
          Welcome to{" "}
          <span
            style={{
              color: "rgb(84, 175, 224)",
            }}
          >
            MindCanvas
          </span>
        </>
      }
      subtitle="Watch this short introduction to understand your MindCanvas workspace, available assessments and how to get started."
    >
      <div
        className="mt-8 rounded-[18px] border"
        style={{
          background: "#fff",
          borderColor:
            "rgb(228,238,248)",
          padding: "24px",
          boxShadow:
            "0px 2px 12px 0px rgba(13,45,94,0.06)",
        }}
      >
        <div
          className="relative w-full overflow-hidden rounded-[12px]"
          style={{
            aspectRatio: "16 / 9",
            background: "rgb(9,25,38)",
          }}
        >
          <video
            controls
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-contain"
          >
            <source
              src={VIDEO_URL}
              type="video/mp4"
            />

            Your browser does not support
            embedded video.
          </video>
        </div>

        <button
          type="button"
          onClick={advance}
          disabled={advancing}
          className={`mt-6 h-[56px] w-full rounded-[12px] font-bold tracking-wide text-white ${
            advancing
              ? "cursor-not-allowed opacity-40"
              : "cursor-pointer"
          }`}
          style={{
            background:
              "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
            fontSize: "16px",
            letterSpacing: "0.2px",
            boxShadow:
              "0px 6px 20px 0px rgba(37,99,200,0.30)",
          }}
        >
          {advancing
            ? "Loading…"
            : "Continue"}
        </button>

        <button
          type="button"
          onClick={advance}
          disabled={advancing}
          className={`mt-3 h-[50px] w-full rounded-[12px] border font-semibold ${
            advancing
              ? "cursor-not-allowed opacity-40"
              : "cursor-pointer"
          }`}
          style={{
            background: "#fff",
            borderColor:
              "rgb(208,224,240)",
            color: "rgb(42,137,190)",
            fontSize: "14px",
          }}
        >
          {advancing
            ? "Loading…"
            : "Skip for now"}
        </button>
      </div>
    </StepCard>
  );
}
