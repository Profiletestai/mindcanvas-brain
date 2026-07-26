"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, isErr } from "../_lib/api";
import { StepCard } from "../_components/StepCard";
import { BOOK_SESSION_PATH } from "../_lib/progress";

// Kept in an env var so the welcome video can be swapped without a deploy.
// Falls back to Daniel's welcome message video when nothing is configured.
const VIDEO_URL =
  process.env.NEXT_PUBLIC_ONBOARDING_WELCOME_VIDEO_URL ??
  "https://www.youtube.com/watch?v=GEom39_LJV4";

function isEmbed(url: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com|loom\.com/i.test(url);
}

// Converts share/watch URLs into their embeddable form so they load in an iframe.
function toEmbedUrl(url: string): string {
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/i,
  );
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return url;
}

export default function WelcomePage() {
  const router = useRouter();
  const [advancing, setAdvancing] = useState(false);

  async function advance() {
    if (advancing) return;
    setAdvancing(true);
    const res = await api.completeStep(7);
    if (isErr(res)) {
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
          <span style={{ color: "rgb(84, 175, 224)" }}>MindCanvas</span>
        </>
      }
      subtitle="A short message from Daniel on what MindCanvas helps you build."
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
        {VIDEO_URL ? (
          <div
            className="relative w-full overflow-hidden rounded-[12px]"
            style={{ aspectRatio: "16 / 9", background: "rgb(240,246,255)" }}
          >
            {isEmbed(VIDEO_URL) ? (
              <iframe
                src={toEmbedUrl(VIDEO_URL)}
                title="Welcome to MindCanvas"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            ) : (
              <video
                src={VIDEO_URL}
                controls
                playsInline
                className="absolute inset-0 h-full w-full"
              />
            )}
          </div>
        ) : (
          // should be replaced to video
          <p
            className="rounded-[12px] px-5 py-8 text-center text-[14px] leading-[24px]"
            style={{ background: "rgb(240,246,255)", color: "rgb(90,122,158)" }}
          >
            MindCanvas helps you move beyond static reports into trust, better
            conversations, stronger delivery, smarter decisions, and systems
            that can scale.
          </p>
        )}

        <button
          type="button"
          onClick={advance}
          disabled={advancing}
          className={`mt-6 w-full h-[56px] rounded-[12px] text-white font-bold tracking-wide ${
            advancing ? "cursor-not-allowed opacity-40" : "cursor-pointer"
          }`}
          style={{
            background:
              "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
            fontSize: "16px",
            letterSpacing: "0.2px",
            boxShadow: "0px 6px 20px 0px rgba(37,99,200,0.30)",
          }}
        >
          {advancing ? "Loading…" : "Continue"}
        </button>

        {/* <button
          type="button"
          onClick={advance}
          disabled={advancing}
          className={`mt-3 w-full h-[52px] rounded-[12px] border font-semibold ${
            advancing ? "cursor-not-allowed opacity-40" : "cursor-pointer"
          }`}
          style={{
            background: "#fff",
            borderColor: "rgb(208,224,240)",
            color: "rgb(24,44,62)",
            fontSize: "15px",
          }}
        >
          Skip
        </button> */}
      </div>
    </StepCard>
  );
}
