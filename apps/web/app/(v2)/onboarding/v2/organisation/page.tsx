"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  useForm,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { api, isErr } from "../_lib/api";
import { orgSchema } from "../_lib/schema";
import { WELCOME_PATH } from "../_lib/progress";
import { StepCard } from "../_components/StepCard";

type OrgFormInput = z.input<typeof orgSchema>;
type OrgFormOutput = z.output<typeof orgSchema>;

countries.registerLocale(enLocale);

const eyebrowStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: "10px",
  lineHeight: "16px",
  letterSpacing: "1px",
  textTransform: "uppercase",
  color: "rgb(90,122,158)",
};

const inputStyle: React.CSSProperties = {
  background: "rgb(240,246,255)",
  border: "1px solid rgb(208,224,240)",
  color: "rgb(24,44,62)",
};

const inputClass =
  "h-[46px] w-full rounded-[10px] px-4 text-[14px] outline-none transition focus:bg-white placeholder:text-[rgb(140,160,185)]";

const EMPTY: OrgFormInput = {
  name: "",
  country: "",
  address: "",
  website_url: "",
  industry: "",
  logo_url: "",
};

const POLL_INTERVAL_MS = 2000;
const POLL_ATTEMPTS = 20;

export default function OrganisationPage() {
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get("status");

  const fileRef =
    useRef<HTMLInputElement>(null);

  const [ready, setReady] = useState(false);
  const [uploading, setUploading] =
    useState(false);

  const [confirmError, setConfirmError] =
    useState("");

  const confirmStarted = useRef(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<
    OrgFormInput,
    unknown,
    OrgFormOutput
  >({
    resolver: zodResolver(
      orgSchema
    ) as unknown as Resolver<
      OrgFormInput,
      unknown,
      OrgFormOutput
    >,
    defaultValues: EMPTY,
    mode: "onTouched",
  });

  const logoUrl =
    (watch("logo_url") as
      | string
      | undefined) ?? "";

  const confirmPayment = useCallback(
    async () => {
      for (
        let attempt = 0;
        attempt < POLL_ATTEMPTS;
        attempt++
      ) {
        const response = await fetch(
          "/api/billing/summary",
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        const json = await response
          .json()
          .catch(() => null);

        const active =
          json?.ok &&
          json.billing?.stripe_status ===
            "active" &&
          json.billing?.is_pilot === false;

        if (active) {
          setReady(true);
          return;
        }

        await new Promise((resolve) =>
          setTimeout(
            resolve,
            POLL_INTERVAL_MS
          )
        );
      }

      setConfirmError(
        "Your payment went through but we are still waiting for confirmation. Refresh this page in a moment."
      );

      setReady(true);
    },
    []
  );

  useEffect(() => {
    if (
      status === "success" &&
      !confirmStarted.current
    ) {
      confirmStarted.current = true;
      void confirmPayment();
    }
  }, [status, confirmPayment]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const response = await api.getOrg();

      if (cancelled) return;

      if (
        !isErr(response) &&
        response.org
      ) {
        reset({
          name: response.org.name ?? "",
          country:
            response.org.country ?? "",
          address:
            response.org.address ?? "",
          website_url:
            response.org.website_url ?? "",
          industry:
            response.org.industry ?? "",
          logo_url:
            response.org.logo_url ?? "",
        });
      }

      if (status !== "success") {
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reset, status]);

  const countryOptions = useMemo(() => {
    const all = countries.getNames("en", {
      select: "official",
    }) as Record<string, string>;

    return Object.entries(all)
      .map(([code, name]) => ({
        code,
        name,
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );
  }, []);

  async function handleFile(
    file: File | null
  ) {
    if (!file || uploading) return;

    setUploading(true);

    const response =
      await api.uploadLogo(file);

    setUploading(false);

    if (isErr(response)) {
      setError("root", {
        message: response.error,
      });
      return;
    }

    setValue("logo_url", response.url, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }

  const onSubmit = handleSubmit(
    async (values) => {
      const response =
        await api.patchOrg(values);

      if (isErr(response)) {
        setError("root", {
          message: response.error,
        });
        return;
      }

      const stepResponse =
        await api.completeStep(5);

      if (isErr(stepResponse)) {
        setError("root", {
          message: stepResponse.error,
        });
        return;
      }

      // The old Organisation Created screen has been removed.
      router.push(WELCOME_PATH);
    }
  );

  if (!ready) {
    return (
      <StepCard
        titleNoWrap={false}
        title={
          <>
            Confirming your{" "}
            <span
              style={{
                color:
                  "rgb(84, 175, 224)",
              }}
            >
              subscription
            </span>
          </>
        }
        subtitle="This only takes a moment."
      >
        <div className="mt-10 text-center text-white/70">
          {confirmError ? (
            <p className="text-rose-400">
              {confirmError}
            </p>
          ) : (
            <p>
              Waiting for Stripe to confirm
              your payment…
            </p>
          )}
        </div>
      </StepCard>
    );
  }

  const errorMessage =
    errors.name?.message ??
    errors.country?.message ??
    errors.address?.message ??
    errors.website_url?.message ??
    errors.industry?.message ??
    errors.logo_url?.message ??
    errors.root?.message;

  return (
    <StepCard
      title={
        <>
          Set up your{" "}
          <span
            style={{
              color: "rgb(84, 175, 224)",
            }}
          >
            organisation
          </span>
        </>
      }
      subtitle="Add your organisation details to create your MindCanvas workspace. You can update this information later in Profile Settings."
    >
      <form
        onSubmit={onSubmit}
        className="mt-6 rounded-[14px] border"
        style={{
          background: "#fff",
          borderColor:
            "rgb(228,238,248)",
          padding: "32px 24px 24px",
          boxShadow:
            "0px 2px 12px 0px rgba(13,45,94,0.06)",
        }}
      >
        <button
          type="button"
          onClick={() =>
            fileRef.current?.click()
          }
          disabled={uploading}
          className={`flex min-h-[148px] w-full flex-col items-center justify-center rounded-[12px] transition ${
            uploading
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:bg-[rgb(232,240,252)]"
          }`}
          style={{
            background:
              "rgb(240,246,255)",
            border:
              "1.5px dashed rgb(180,204,232)",
            padding: "26px 16px",
          }}
        >
          {logoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Organisation logo"
                className="h-16 w-16 rounded-md bg-white object-contain"
              />

              <span
                className="mt-2"
                style={{
                  fontSize: "12px",
                  color:
                    "rgb(90,122,158)",
                }}
              >
                {uploading
                  ? "Uploading…"
                  : "Replace logo"}
              </span>
            </>
          ) : (
            <>
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <path
                  d="M3 16.5V5.5C3 4.67 3.67 4 4.5 4h15c.83 0 1.5.67 1.5 1.5v13c0 .83-.67 1.5-1.5 1.5h-15C3.67 20 3 19.33 3 18.5"
                  stroke="rgb(24,44,62)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <path
                  d="m3.5 17 4.5-4.5 4 4 3.5-3.5 5 5"
                  stroke="rgb(24,44,62)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <span
                className="mt-2 font-bold"
                style={{
                  fontSize: "14px",
                  color: "rgb(24,44,62)",
                }}
              >
                {uploading
                  ? "Uploading…"
                  : "Upload logo"}
              </span>

              <span
                className="mt-1 text-center"
                style={{
                  fontSize: "12px",
                  color:
                    "rgb(90,122,158)",
                }}
              >
                Recommended: 800 × 800 px,
                square
              </span>

              <span
                className="mt-1 text-center"
                style={{
                  fontSize: "11px",
                  color:
                    "rgb(120,144,176)",
                }}
              >
                PNG, JPG or WebP · Maximum
                2MB
              </span>
            </>
          )}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) =>
            handleFile(
              event.target.files?.[0] ??
                null
            )
          }
        />

        {logoUrl && (
          <div className="mt-2 text-center">
            <p
              className="mb-2 text-[11px]"
              style={{
                color:
                  "rgb(120,144,176)",
              }}
            >
              Recommended: 800 × 800 px
              square · PNG, JPG or WebP ·
              Maximum 2MB
            </p>

            <button
              type="button"
              onClick={() =>
                setValue("logo_url", "", {
                  shouldDirty: true,
                })
              }
              className="text-[12px] font-semibold"
              style={{
                color: "rgb(200,60,80)",
              }}
            >
              Remove
            </button>
          </div>
        )}

        <div className="mt-5">
          <label
            className="mb-1.5 block"
            style={eyebrowStyle}
          >
            Organisation name{" "}
            <span
              style={{
                color: "rgb(200,60,80)",
              }}
            >
              *
            </span>
          </label>

          <input
            type="text"
            placeholder="Your organisation name"
            {...register("name")}
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              className="mb-1.5 block"
              style={eyebrowStyle}
            >
              Address{" "}
              <span
                style={{
                  color:
                    "rgb(140,160,185)",
                }}
              >
                (optional)
              </span>
            </label>

            <input
              type="text"
              placeholder="Street address"
              {...register("address")}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div>
            <label
              className="mb-1.5 block"
              style={eyebrowStyle}
            >
              Country{" "}
              <span
                style={{
                  color:
                    "rgb(200,60,80)",
                }}
              >
                *
              </span>
            </label>

            <select
              {...register("country")}
              className={`${inputClass} appearance-none pr-9`}
              style={{
                ...inputStyle,
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M2 4.5l4 4 4-4' stroke='%235A7A9E' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
                backgroundRepeat:
                  "no-repeat",
                backgroundPosition:
                  "right 14px center",
              }}
            >
              <option value="">
                Select country
              </option>

              {countryOptions.map(
                (option) => (
                  <option
                    key={option.code}
                    value={option.code}
                  >
                    {option.name}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              className="mb-1.5 block"
              style={eyebrowStyle}
            >
              Website{" "}
              <span
                style={{
                  color:
                    "rgb(140,160,185)",
                }}
              >
                (optional)
              </span>
            </label>

            <input
              type="url"
              placeholder="https://"
              {...register("website_url")}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div>
            <label
              className="mb-1.5 block"
              style={eyebrowStyle}
            >
              Industry{" "}
              <span
                style={{
                  color:
                    "rgb(140,160,185)",
                }}
              >
                (optional)
              </span>
            </label>

            <input
              type="text"
              placeholder="Select industry"
              {...register("industry")}
              className={inputClass}
              style={inputStyle}
            />
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 text-sm text-rose-500">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={
            isSubmitting || uploading
          }
          className={`mt-6 h-[52px] w-full rounded-[12px] font-bold tracking-wide text-white ${
            isSubmitting || uploading
              ? "cursor-not-allowed opacity-40"
              : "cursor-pointer"
          }`}
          style={{
            background:
              "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
            fontSize: "15px",
            letterSpacing: "0.2px",
            boxShadow:
              "0px 4px 16px 0px rgba(37,99,200,0.35)",
          }}
        >
          {isSubmitting
            ? "Creating…"
            : uploading
              ? "Uploading logo…"
              : "Create organisation"}
        </button>
      </form>
    </StepCard>
  );
}
