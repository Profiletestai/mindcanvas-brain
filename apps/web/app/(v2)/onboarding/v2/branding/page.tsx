"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { api, isErr } from "../_lib/api";
import { brandingSchema } from "../_lib/schema";
import { StepCard } from "../_components/StepCard";

type BrandingFormInput = z.input<typeof brandingSchema>;
type BrandingFormOutput = z.output<typeof brandingSchema>;

const eyebrowStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: "10px",
  lineHeight: "16px",
  letterSpacing: "1px",
  textTransform: "uppercase",
  color: "rgb(90,122,158)",
};

const EMPTY: BrandingFormInput = {
  primary_colour: "",
  secondary_colour: "",
  background_colour: "",
  text_colour: "",
  surface_colour: "",
  accent_colour: "",
};

export default function BrandingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BrandingFormInput, unknown, BrandingFormOutput>({
    resolver: zodResolver(brandingSchema),
    defaultValues: EMPTY,
    mode: "onTouched",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api.getOrg();
      if (cancelled) return;
      if (!isErr(res) && res.org) {
        reset({
          primary_colour: res.org.brand_primary ?? "",
          secondary_colour: res.org.brand_secondary ?? "",
          background_colour: res.org.brand_background ?? "",
          text_colour: res.org.brand_text ?? "",
          surface_colour: res.org.brand_surface ?? "",
          accent_colour: res.org.brand_accent ?? "",
        });
        setShowMore(Boolean(res.org.brand_surface || res.org.brand_accent));
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [reset]);

  const onSubmit = handleSubmit(async (values) => {
    const payload: BrandingFormOutput = showMore
      ? values
      : { ...values, surface_colour: undefined, accent_colour: undefined };
    const res = await api.patchBranding(payload);
    if (isErr(res)) {
      setError("root", { message: res.error });
      return;
    }
    router.push("/onboarding/v2/welcome");
  });

  const onSkip = async () => {
    setSkipping(true);
    const res = await api.patchBranding({});
    setSkipping(false);
    if (isErr(res)) {
      setError("root", { message: res.error });
      return;
    }
    router.push("/onboarding/v2/welcome");
  };

  if (!ready) {
    return <div className="py-8 text-center text-white/70">Loading…</div>;
  }

  const errMsg =
    errors.primary_colour?.message ??
    errors.secondary_colour?.message ??
    errors.background_colour?.message ??
    errors.text_colour?.message ??
    errors.surface_colour?.message ??
    errors.accent_colour?.message ??
    errors.root?.message;

  const busy = isSubmitting || skipping;

  return (
    <StepCard
      title={
        <>
          Branding <span style={{ color: "rgb(84, 175, 224)" }}>settings</span>
        </>
      }
      subtitle="Set the basic colours for your organisation. This can be updated later."
    >
      <form
        onSubmit={onSubmit}
        className="mt-6 rounded-[14px] border"
        style={{
          background: "#fff",
          borderColor: "rgb(228,238,248)",
          padding: "32px 24px 24px 24px",
          boxShadow: "0px 2px 12px 0px rgba(13,45,94,0.06)",
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Controller
            control={control}
            name="primary_colour"
            render={({ field }) => (
              <ColorTile
                label="Primary colour"
                value={(field.value as string | undefined) ?? ""}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="secondary_colour"
            render={({ field }) => (
              <ColorTile
                label="Secondary colour"
                value={(field.value as string | undefined) ?? ""}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="background_colour"
            render={({ field }) => (
              <ColorTile
                label="Background colour"
                value={(field.value as string | undefined) ?? ""}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="text_colour"
            render={({ field }) => (
              <ColorTile
                label="Text colour"
                value={(field.value as string | undefined) ?? ""}
                onChange={field.onChange}
              />
            )}
          />
          {showMore && (
            <>
              <Controller
                control={control}
                name="surface_colour"
                render={({ field }) => (
                  <ColorTile
                    label="Surface colour"
                    value={(field.value as string | undefined) ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                control={control}
                name="accent_colour"
                render={({ field }) => (
                  <ColorTile
                    label="Accent colour"
                    value={(field.value as string | undefined) ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
            </>
          )}
        </div>

        {!showMore && (
          <button
            type="button"
            className="mt-4 inline-flex items-center font-semibold cursor-pointer"
            style={{ color: "rgb(90,122,158)", fontSize: "13px" }}
            onClick={() => setShowMore(true)}
          >
            + Add More Colors
          </button>
        )}

        {errMsg && <div className="mt-4 text-sm text-rose-500">{errMsg}</div>}

        <button
          type="submit"
          disabled={busy}
          className={`mt-6 w-full h-[52px] rounded-[12px] text-white font-bold tracking-wide ${
            busy ? "cursor-not-allowed opacity-40" : "cursor-pointer"
          }`}
          style={{
            background:
              "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
            fontSize: "15px",
            letterSpacing: "0.2px",
            boxShadow: "0px 4px 16px 0px rgba(37,99,200,0.35)",
          }}
        >
          {isSubmitting ? "Saving…" : "Save and continue"}
        </button>

        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className={`mt-3 w-full h-[52px] rounded-[12px] font-bold tracking-wide ${
            busy ? "cursor-not-allowed opacity-40" : "cursor-pointer"
          }`}
          style={{
            background: "#fff",
            border: "1px solid rgb(208,224,240)",
            color: "rgb(42,137,190)",
            fontSize: "15px",
            letterSpacing: "0.2px",
          }}
        >
          Skip for now
        </button>
      </form>
    </StepCard>
  );
}

const CHECKER_BG =
  "repeating-conic-gradient(rgb(220,226,234) 0% 25%, #ffffff 0% 50%) 50% / 16px 16px";

function ColorTile({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const colorRef = useRef<HTMLInputElement>(null);
  const isEmpty = !value;
  const display = isEmpty
    ? ""
    : value.startsWith("#")
      ? value.toUpperCase()
      : `#${value.toUpperCase()}`;

  return (
    <div
      className="rounded-[12px] overflow-hidden"
      style={{
        background: "rgb(240,246,255)",
        border: "1px solid rgb(208,224,240)",
      }}
    >
      <button
        type="button"
        onClick={() => colorRef.current?.click()}
        aria-label={`Pick ${label}`}
        className="block w-full cursor-pointer"
        style={{
          background: isEmpty ? CHECKER_BG : value,
          height: "72px",
        }}
      />
      <input
        ref={colorRef}
        type="color"
        value={isEmpty ? "#000000" : value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
      <div className="px-4 py-3">
        <div style={eyebrowStyle}>{label}</div>
        <input
          type="text"
          value={display}
          placeholder="Click swatch or type hex"
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full bg-transparent outline-none font-mono placeholder:font-sans placeholder:font-normal placeholder:text-[rgb(140,160,185)]"
          style={{
            color: "rgb(24,44,62)",
            fontSize: "15px",
            fontWeight: 600,
            letterSpacing: "0.2px",
          }}
        />
      </div>
    </div>
  );
}
