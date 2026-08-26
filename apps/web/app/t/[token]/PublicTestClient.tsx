// apps/web/app/t/[token]/PublicTestClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Question = {
  id: string;
  idx?: number | null;
  order?: number | null;
  type?: string | null;
  text?: string;
  options?: string[] | null;
  category?: "scored" | "qual" | string | null;
};

type AnswersMap = Record<string, number>;
type TextAnswersMap = Record<string, string>;
type Step = "details" | "questions";

type CountryCode = {
  iso: string;
  label: string;
  dial: string;
};

type CountryOption = {
  code: string;
  name: string;
};

const PRIVACY_POLICY_URL = "https://profiletest.ai/privacy-policy";
const LINKEDIN_URL = "https://linkedin.com/in/me";

const COUNTRY_CODES: CountryCode[] = [
  { iso: "ZA", label: "South Africa", dial: "+27" },
  { iso: "GB", label: "United Kingdom", dial: "+44" },
  { iso: "US", label: "United States", dial: "+1" },
  { iso: "CA", label: "Canada", dial: "+1" },
  { iso: "AU", label: "Australia", dial: "+61" },
  { iso: "NZ", label: "New Zealand", dial: "+64" },
  { iso: "IE", label: "Ireland", dial: "+353" },
  { iso: "IS", label: "Iceland", dial: "+354" },
  { iso: "AE", label: "United Arab Emirates", dial: "+971" },
  { iso: "FR", label: "France", dial: "+33" },
  { iso: "DE", label: "Germany", dial: "+49" },
  { iso: "NL", label: "Netherlands", dial: "+31" },
  { iso: "ES", label: "Spain", dial: "+34" },
  { iso: "IT", label: "Italy", dial: "+39" },
  { iso: "PT", label: "Portugal", dial: "+351" },
  { iso: "CH", label: "Switzerland", dial: "+41" },
  { iso: "BE", label: "Belgium", dial: "+32" },
  { iso: "SE", label: "Sweden", dial: "+46" },
  { iso: "NO", label: "Norway", dial: "+47" },
  { iso: "DK", label: "Denmark", dial: "+45" },
  { iso: "FI", label: "Finland", dial: "+358" },
  { iso: "IN", label: "India", dial: "+91" },
  { iso: "SG", label: "Singapore", dial: "+65" },
  { iso: "HK", label: "Hong Kong", dial: "+852" },
  { iso: "JP", label: "Japan", dial: "+81" },
  { iso: "CN", label: "China", dial: "+86" },
  { iso: "BR", label: "Brazil", dial: "+55" },
  { iso: "MX", label: "Mexico", dial: "+52" },
  { iso: "KE", label: "Kenya", dial: "+254" },
  { iso: "NG", label: "Nigeria", dial: "+234" },
  { iso: "ZW", label: "Zimbabwe", dial: "+263" },
  { iso: "ZM", label: "Zambia", dial: "+260" },
  { iso: "BW", label: "Botswana", dial: "+267" },
  { iso: "NA", label: "Namibia", dial: "+264" },
  { iso: "MU", label: "Mauritius", dial: "+230" },
];

const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "AF", name: "Afghanistan" },
  { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" },
  { code: "AS", name: "American Samoa" },
  { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" },
  { code: "AI", name: "Anguilla" },
  { code: "AQ", name: "Antarctica" },
  { code: "AG", name: "Antigua and Barbuda" },
  { code: "AR", name: "Argentina" },
  { code: "AM", name: "Armenia" },
  { code: "AW", name: "Aruba" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "BS", name: "Bahamas" },
  { code: "BH", name: "Bahrain" },
  { code: "BD", name: "Bangladesh" },
  { code: "BB", name: "Barbados" },
  { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" },
  { code: "BZ", name: "Belize" },
  { code: "BJ", name: "Benin" },
  { code: "BM", name: "Bermuda" },
  { code: "BT", name: "Bhutan" },
  { code: "BO", name: "Bolivia, Plurinational State of" },
  { code: "BQ", name: "Bonaire, Sint Eustatius and Saba" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BW", name: "Botswana" },
  { code: "BV", name: "Bouvet Island" },
  { code: "BR", name: "Brazil" },
  { code: "IO", name: "British Indian Ocean Territory" },
  { code: "BN", name: "Brunei Darussalam" },
  { code: "BG", name: "Bulgaria" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" },
  { code: "CV", name: "Cabo Verde" },
  { code: "KH", name: "Cambodia" },
  { code: "CM", name: "Cameroon" },
  { code: "CA", name: "Canada" },
  { code: "KY", name: "Cayman Islands" },
  { code: "CF", name: "Central African Republic" },
  { code: "TD", name: "Chad" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "China" },
  { code: "CX", name: "Christmas Island" },
  { code: "CC", name: "Cocos (Keeling) Islands" },
  { code: "CO", name: "Colombia" },
  { code: "KM", name: "Comoros" },
  { code: "CG", name: "Congo" },
  { code: "CD", name: "Congo, The Democratic Republic of the" },
  { code: "CK", name: "Cook Islands" },
  { code: "CR", name: "Costa Rica" },
  { code: "HR", name: "Croatia" },
  { code: "CU", name: "Cuba" },
  { code: "CW", name: "Curaçao" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czechia" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "DK", name: "Denmark" },
  { code: "DJ", name: "Djibouti" },
  { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominican Republic" },
  { code: "EC", name: "Ecuador" },
  { code: "EG", name: "Egypt" },
  { code: "SV", name: "El Salvador" },
  { code: "GQ", name: "Equatorial Guinea" },
  { code: "ER", name: "Eritrea" },
  { code: "EE", name: "Estonia" },
  { code: "SZ", name: "Eswatini" },
  { code: "ET", name: "Ethiopia" },
  { code: "FK", name: "Falkland Islands (Malvinas)" },
  { code: "FO", name: "Faroe Islands" },
  { code: "FJ", name: "Fiji" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GF", name: "French Guiana" },
  { code: "PF", name: "French Polynesia" },
  { code: "TF", name: "French Southern Territories" },
  { code: "GA", name: "Gabon" },
  { code: "GM", name: "Gambia" },
  { code: "GE", name: "Georgia" },
  { code: "DE", name: "Germany" },
  { code: "GH", name: "Ghana" },
  { code: "GI", name: "Gibraltar" },
  { code: "GR", name: "Greece" },
  { code: "GL", name: "Greenland" },
  { code: "GD", name: "Grenada" },
  { code: "GP", name: "Guadeloupe" },
  { code: "GU", name: "Guam" },
  { code: "GT", name: "Guatemala" },
  { code: "GG", name: "Guernsey" },
  { code: "GN", name: "Guinea" },
  { code: "GW", name: "Guinea-Bissau" },
  { code: "GY", name: "Guyana" },
  { code: "HT", name: "Haiti" },
  { code: "HM", name: "Heard Island and McDonald Islands" },
  { code: "VA", name: "Holy See (Vatican City State)" },
  { code: "HN", name: "Honduras" },
  { code: "HK", name: "Hong Kong" },
  { code: "HU", name: "Hungary" },
  { code: "IS", name: "Iceland" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IR", name: "Iran, Islamic Republic of" },
  { code: "IQ", name: "Iraq" },
  { code: "IE", name: "Ireland" },
  { code: "IM", name: "Isle of Man" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "JM", name: "Jamaica" },
  { code: "JP", name: "Japan" },
  { code: "JE", name: "Jersey" },
  { code: "JO", name: "Jordan" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" },
  { code: "KI", name: "Kiribati" },
  { code: "KP", name: "Korea, Democratic People's Republic of" },
  { code: "KR", name: "Korea, Republic of" },
  { code: "KW", name: "Kuwait" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "LA", name: "Lao People's Democratic Republic" },
  { code: "LV", name: "Latvia" },
  { code: "LB", name: "Lebanon" },
  { code: "LS", name: "Lesotho" },
  { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libya" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MO", name: "Macao" },
  { code: "MG", name: "Madagascar" },
  { code: "MW", name: "Malawi" },
  { code: "MY", name: "Malaysia" },
  { code: "MV", name: "Maldives" },
  { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" },
  { code: "MH", name: "Marshall Islands" },
  { code: "MQ", name: "Martinique" },
  { code: "MR", name: "Mauritania" },
  { code: "MU", name: "Mauritius" },
  { code: "YT", name: "Mayotte" },
  { code: "MX", name: "Mexico" },
  { code: "FM", name: "Micronesia, Federated States of" },
  { code: "MD", name: "Moldova, Republic of" },
  { code: "MC", name: "Monaco" },
  { code: "MN", name: "Mongolia" },
  { code: "ME", name: "Montenegro" },
  { code: "MS", name: "Montserrat" },
  { code: "MA", name: "Morocco" },
  { code: "MZ", name: "Mozambique" },
  { code: "MM", name: "Myanmar" },
  { code: "NA", name: "Namibia" },
  { code: "NR", name: "Nauru" },
  { code: "NP", name: "Nepal" },
  { code: "NL", name: "Netherlands" },
  { code: "NC", name: "New Caledonia" },
  { code: "NZ", name: "New Zealand" },
  { code: "NI", name: "Nicaragua" },
  { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" },
  { code: "NU", name: "Niue" },
  { code: "NF", name: "Norfolk Island" },
  { code: "MK", name: "North Macedonia" },
  { code: "MP", name: "Northern Mariana Islands" },
  { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" },
  { code: "PK", name: "Pakistan" },
  { code: "PW", name: "Palau" },
  { code: "PS", name: "Palestine, State of" },
  { code: "PA", name: "Panama" },
  { code: "PG", name: "Papua New Guinea" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" },
  { code: "PN", name: "Pitcairn" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "PR", name: "Puerto Rico" },
  { code: "QA", name: "Qatar" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russian Federation" },
  { code: "RW", name: "Rwanda" },
  { code: "RE", name: "Réunion" },
  { code: "BL", name: "Saint Barthélemy" },
  { code: "SH", name: "Saint Helena, Ascension and Tristan da Cunha" },
  { code: "KN", name: "Saint Kitts and Nevis" },
  { code: "LC", name: "Saint Lucia" },
  { code: "MF", name: "Saint Martin (French part)" },
  { code: "PM", name: "Saint Pierre and Miquelon" },
  { code: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "WS", name: "Samoa" },
  { code: "SM", name: "San Marino" },
  { code: "ST", name: "Sao Tome and Principe" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SN", name: "Senegal" },
  { code: "RS", name: "Serbia" },
  { code: "SC", name: "Seychelles" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SG", name: "Singapore" },
  { code: "SX", name: "Sint Maarten (Dutch part)" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "SB", name: "Solomon Islands" },
  { code: "SO", name: "Somalia" },
  { code: "ZA", name: "South Africa" },
  { code: "GS", name: "South Georgia and the South Sandwich Islands" },
  { code: "SS", name: "South Sudan" },
  { code: "ES", name: "Spain" },
  { code: "LK", name: "Sri Lanka" },
  { code: "SD", name: "Sudan" },
  { code: "SR", name: "Suriname" },
  { code: "SJ", name: "Svalbard and Jan Mayen" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "SY", name: "Syrian Arab Republic" },
  { code: "TW", name: "Taiwan, Province of China" },
  { code: "TJ", name: "Tajikistan" },
  { code: "TZ", name: "Tanzania, United Republic of" },
  { code: "TH", name: "Thailand" },
  { code: "TL", name: "Timor-Leste" },
  { code: "TG", name: "Togo" },
  { code: "TK", name: "Tokelau" },
  { code: "TO", name: "Tonga" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "TN", name: "Tunisia" },
  { code: "TM", name: "Turkmenistan" },
  { code: "TC", name: "Turks and Caicos Islands" },
  { code: "TV", name: "Tuvalu" },
  { code: "TR", name: "Türkiye" },
  { code: "UG", name: "Uganda" },
  { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "UM", name: "United States Minor Outlying Islands" },
  { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "VU", name: "Vanuatu" },
  { code: "VE", name: "Venezuela, Bolivarian Republic of" },
  { code: "VN", name: "Viet Nam" },
  { code: "VG", name: "Virgin Islands, British" },
  { code: "VI", name: "Virgin Islands, U.S." },
  { code: "WF", name: "Wallis and Futuna" },
  { code: "EH", name: "Western Sahara" },
  { code: "YE", name: "Yemen" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" },
  { code: "AX", name: "Åland Islands" },
];

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = (await response.text()).slice(0, 600);
    throw new Error(`HTTP ${response.status} – non-JSON response:\n${text}`);
  }

  const json = await response.json();

  if (!response.ok || json?.ok === false) {
    throw new Error(json?.error || `HTTP ${response.status}`);
  }

  return json;
}

type SubmitResponse = {
  ok: boolean;
  redirect?: string | null;
  show_results?: boolean;
  next_steps_url?: string | null;
  hidden_results_message?: string | null;

  redirect_url?: string | null;
  redirectUrl?: string | null;
  showResults?: boolean;
  nextStepsUrl?: string | null;

  qsc_public_path?: string | null;
  qsc_public_url?: string | null;

  [key: string]: any;
};

function isTextQuestion(question?: Question | null) {
  const type = String(question?.type || "").toLowerCase().trim();

  return (
    type === "text" ||
    type === "textarea" ||
    type === "longtext"
  );
}

function safeString(value: any): string {
  if (typeof value === "string") {
    return value;
  }

  if (value == null) {
    return "";
  }

  return String(value);
}

function isAbsoluteUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function isValidWebsiteInput(value: string) {
  const raw = value.trim();

  if (!raw) {
    return false;
  }

  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(candidate);

    return (
      ["http:", "https:"].includes(parsed.protocol) &&
      parsed.hostname.includes(".")
    );
  } catch {
    return false;
  }
}

function buildInternationalPhone(
  countryCode: string,
  localNumber: string
) {
  const cleanedCountryCode =
    safeString(countryCode).trim() || "+27";

  const cleanedLocal = safeString(localNumber)
    .replace(/[^\d]/g, "")
    .replace(/^0+/, "");

  return cleanedLocal
    ? `${cleanedCountryCode}${cleanedLocal}`
    : "";
}

function parseSavedPhone(
  savedCountryCode: any,
  savedPhone: any
) {
  const existingCountryCode =
    safeString(savedCountryCode).trim();

  const phone = safeString(savedPhone).trim();

  if (existingCountryCode) {
    const localWithoutCountry = phone.startsWith(existingCountryCode)
      ? phone.slice(existingCountryCode.length)
      : phone;

    return {
      countryCode: existingCountryCode,
      localPhone: localWithoutCountry,
    };
  }

  if (!phone) {
    return {
      countryCode: "+27",
      localPhone: "",
    };
  }

  const compactPhone = phone.replace(/\s+/g, "");

  const matchingCountry = [...COUNTRY_CODES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((country) =>
      compactPhone.startsWith(country.dial)
    );

  if (matchingCountry) {
    return {
      countryCode: matchingCountry.dial,
      localPhone: compactPhone.slice(
        matchingCountry.dial.length
      ),
    };
  }

  return {
    countryCode: "+27",
    localPhone: phone,
  };
}

export default function PublicTestClient({
  token,
  embed = false,
}: {
  token: string;
  embed?: boolean;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [testName, setTestName] =
    useState<string | null>(null);

  const [orgName, setOrgName] =
    useState<string | null>(null);

  const [introText, setIntroText] =
    useState<string | null>(null);

  const [questions, setQuestions] =
    useState<Question[]>([]);

  const [started, setStarted] = useState(false);
  const [step, setStep] = useState<Step>("details");

  const [i, setI] = useState(0);
  const [answers, setAnswers] =
    useState<AnswersMap>({});

  const [textAnswers, setTextAnswers] =
    useState<TextAnswersMap>({});

  const [
    requiresWhatsWhatsFields,
    setRequiresWhatsWhatsFields,
  ] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [phoneCountryCode, setPhoneCountryCode] =
    useState("+27");

  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [countryName, setCountryName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [linkedinProfile, setLinkedinProfile] =
    useState("");

  const [referredBy, setReferredBy] = useState("");
  const [dataConsent, setDataConsent] = useState(false);

  const [detailsError, setDetailsError] =
    useState<string | null>(null);

  const [takerId, setTakerId] =
    useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [savingDetails, setSavingDetails] =
    useState(false);

  const [completedMessage, setCompletedMessage] =
    useState<string | null>(null);

  const key = (name: string) => `mc_${name}_${token}`;

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const metaRes: any = await fetchJson(
          `/api/public/test/${token}`
        );

        if (!alive) {
          return;
        }

        const metaData = metaRes?.data ?? {};

        const nameFromMeta: string | null =
          metaData?.name ?? null;

        const orgNameFromMeta: string | null =
          metaData?.org_name ??
          metaData?.organisation_name ??
          metaData?.org?.name ??
          null;

        const introFromMeta: string | null =
          metaData?.intro_text ??
          metaData?.briefing ??
          metaData?.assessment_intro ??
          null;

        setTestName(nameFromMeta);
        setOrgName(orgNameFromMeta);
        setIntroText(introFromMeta);

        setRequiresWhatsWhatsFields(
          metaData?.requires_whatswhats_fields === true ||
            metaData?.intake_config?.website?.visible === true
        );

        if (!embed && typeof window !== "undefined") {
          const detail = {
            orgName: orgNameFromMeta,
            testName: nameFromMeta,
          };

          window.dispatchEvent(
            new CustomEvent("mc_test_meta", { detail })
          );
        }

        const qRes: any = await fetchJson(
          `/api/public/test/${token}/questions`
        );

        if (!alive) {
          return;
        }

        const list: Question[] = Array.isArray(
          qRes?.questions
        )
          ? qRes.questions
          : [];

        setQuestions(list);

        if (typeof window !== "undefined") {
          const savedAnswers = window.localStorage.getItem(
            key("answers")
          );

          if (savedAnswers) {
            try {
              setAnswers(JSON.parse(savedAnswers));
            } catch {}
          }

          const savedText =
            window.localStorage.getItem(
              key("text_answers")
            );

          if (savedText) {
            try {
              setTextAnswers(JSON.parse(savedText));
            } catch {}
          }

          const savedDetails =
            window.localStorage.getItem(key("details"));

          if (savedDetails) {
            try {
              const saved = JSON.parse(savedDetails);

              const parsedPhone = parseSavedPhone(
                saved.phoneCountryCode,
                saved.phone
              );

              setFirstName(saved.firstName || "");
              setLastName(saved.lastName || "");
              setEmail(saved.email || "");

              setPhoneCountryCode(
                parsedPhone.countryCode
              );

              setPhone(parsedPhone.localPhone);
              setCompany(saved.company || "");
              setWebsite(saved.website || "");
              setIndustry(saved.industry || "");
              setCountryCode(saved.countryCode || "");
              setCountryName(saved.countryName || "");
              setRoleTitle(saved.roleTitle || "");

              setLinkedinProfile(
                saved.linkedinProfile || ""
              );

              setReferredBy(saved.referredBy || "");
              setDataConsent(
                Boolean(saved.dataConsent)
              );
            } catch {}
          }

          const storedTakerId =
            window.localStorage.getItem(
              key("taker_id")
            );

          if (storedTakerId) {
            setTakerId(storedTakerId);
          }
        }

        setStarted(true);
      } catch (e: any) {
        if (alive) {
          setError(String(e?.message || e));
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [token, embed]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        key("answers"),
        JSON.stringify(answers)
      );
    }
  }, [answers, token]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        key("text_answers"),
        JSON.stringify(textAnswers)
      );
    }
  }, [textAnswers, token]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        key("details"),
        JSON.stringify({
          firstName,
          lastName,
          email,
          phoneCountryCode,
          phone,
          company,
          website,
          industry,
          countryCode,
          countryName,
          roleTitle,
          linkedinProfile,
          referredBy,
          dataConsent,
        })
      );
    }
  }, [
    firstName,
    lastName,
    email,
    phoneCountryCode,
    phone,
    company,
    website,
    industry,
    countryCode,
    countryName,
    roleTitle,
    linkedinProfile,
    referredBy,
    dataConsent,
    token,
  ]);

  const question = questions[i];

  const isAnswered = (item: Question) => {
    if (isTextQuestion(item)) {
      return (
        textAnswers[item.id] || ""
      ).trim().length > 0;
    }

    return Number(answers[item.id]) >= 1;
  };

  const allAnswered = useMemo(
    () =>
      questions.length > 0 &&
      questions.every((item) =>
        isAnswered(item)
      ),
    [questions, answers, textAnswers]
  );

  const setChoice = (
    questionId: string,
    value: number
  ) =>
    setAnswers((current) => ({
      ...current,
      [questionId]: value,
    }));

  const setText = (
    questionId: string,
    value: string
  ) =>
    setTextAnswers((current) => ({
      ...current,
      [questionId]: value,
    }));

  const validateDetails = (): string | null => {
    const first = firstName.trim();
    const last = lastName.trim();
    const normalisedEmail = email.trim();

    const fullPhone = buildInternationalPhone(
      phoneCountryCode,
      phone
    );

    if (!first || !last || !normalisedEmail || !fullPhone) {
      return "Please complete all required fields before starting.";
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalisedEmail)) {
      return "Please enter a valid email address.";
    }

    const localDigits = phone
      .replace(/[^\d]/g, "")
      .replace(/^0+/, "");

    if (localDigits.length < 6) {
      return "Please enter a valid mobile number.";
    }

    if (requiresWhatsWhatsFields) {
      if (
        !website.trim() ||
        !industry.trim() ||
        !countryCode ||
        !countryName
      ) {
        return "Please complete Website, Industry and Country before starting.";
      }

      if (!isValidWebsiteInput(website)) {
        return "Please enter a valid website address.";
      }
    }

    if (!dataConsent) {
      return "Please confirm that you agree to the use of your data before starting.";
    }

    return null;
  };

  const proceedToQuestions = async () => {
    const validationError = validateDetails();

    if (validationError) {
      setDetailsError(validationError);
      return;
    }

    try {
      setSavingDetails(true);
      setError("");
      setDetailsError(null);

      const internationalPhone =
        buildInternationalPhone(
          phoneCountryCode,
          phone
        );

      const response: any = await fetchJson(
        `/api/public/test/${token}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            first_name:
              firstName.trim() || null,
            last_name:
              lastName.trim() || null,
            email:
              email.trim().toLowerCase() || null,
            phone:
              internationalPhone || null,
            company:
              company.trim() || null,
            role_title:
              roleTitle.trim() || null,
            linkedin_profile:
              linkedinProfile.trim() || null,
            referred_by:
              referredBy.trim() || null,

            // These fields are sent only for WhatsWhats.
            website_url: requiresWhatsWhatsFields
              ? website.trim() || null
              : null,
            industry: requiresWhatsWhatsFields
              ? industry.trim() || null
              : null,
            country_code: requiresWhatsWhatsFields
              ? countryCode || null
              : null,
            country_name: requiresWhatsWhatsFields
              ? countryName || null
              : null,

            data_consent: true,
          }),
        }
      );

      const newTakerId = response?.id;

      if (!newTakerId) {
        throw new Error("Failed to create taker");
      }

      setTakerId(newTakerId);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          key("taker_id"),
          newTakerId
        );
      }

      setStep("questions");
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSavingDetails(false);
    }
  };

  function resolveRedirectAndNextSteps(
    response: SubmitResponse
  ) {
    const redirect =
      safeString(response.redirect).trim() ||
      safeString(
        (response as any).redirect_url
      ).trim() ||
      safeString(
        (response as any).redirectUrl
      ).trim() ||
      safeString(
        (response as any).qsc_public_path
      ).trim() ||
      safeString(
        (response as any).qsc_public_url
      ).trim() ||
      "";

    const nextSteps =
      safeString(
        response.next_steps_url
      ).trim() ||
      safeString(
        (response as any).nextStepsUrl
      ).trim() ||
      safeString(
        (response as any).next_steps?.url
      ).trim() ||
      safeString(
        (response as any).link_meta
          ?.next_steps_url
      ).trim() ||
      safeString(
        (response as any).meta
          ?.next_steps_url
      ).trim() ||
      safeString(
        (response as any).link
          ?.next_steps_url
      ).trim() ||
      "";

    const showResults =
      typeof response.show_results === "boolean"
        ? response.show_results
        : typeof (response as any).showResults === "boolean"
        ? (response as any).showResults
        : typeof (response as any).link?.show_results === "boolean"
        ? (response as any).link.show_results
        : undefined;

    return {
      redirect: redirect || null,
      nextSteps: nextSteps || null,
      showResults,
    };
  }

  const submit = async () => {
    try {
      setSubmitting(true);
      setError("");
      setCompletedMessage(null);

      if (!takerId) {
        throw new Error("missing taker_id");
      }

      const payloadAnswers = questions.map(
        (item) => {
          if (isTextQuestion(item)) {
            return {
              question_id: item.id,
              text: (
                textAnswers[item.id] || ""
              ).trim(),
            };
          }

          return {
            question_id: item.id,
            selected:
              Number(
                answers[item.id] || 0
              ) - 1,
          };
        }
      );

      const response = await fetch(
        `/api/public/test/${token}/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            taker_id: takerId,
            answers: payloadAnswers,
          }),
        }
      );

      const json: SubmitResponse =
        await response
          .json()
          .catch(() => ({} as any));

      if (
        !response.ok ||
        (json as any)?.ok === false
      ) {
        throw new Error(
          (json as any)?.error ||
            `HTTP ${response.status}`
        );
      }

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(
          key("answers")
        );

        window.localStorage.removeItem(
          key("text_answers")
        );

        window.localStorage.removeItem(
          key("details")
        );
      }

      const {
        redirect,
        nextSteps,
        showResults,
      } = resolveRedirectAndNextSteps(json);

      if (redirect) {
        if (isAbsoluteUrl(redirect)) {
          window.location.href = redirect;
        } else {
          router.replace(redirect);
        }

        return;
      }

      if (nextSteps) {
        if (isAbsoluteUrl(nextSteps)) {
          window.location.href = nextSteps;
        } else {
          router.replace(nextSteps);
        }

        return;
      }

      if (showResults !== false) {
        router.replace(
          `/t/${token}/result?tid=${encodeURIComponent(
            takerId
          )}`
        );

        return;
      }

      setCompletedMessage(
        json.hidden_results_message ||
          (json as any).hiddenResultsMessage ||
          (json as any).link?.hidden_results_message ||
          "Thanks — your results have been sent to your organisation. You can close this page."
      );
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  const finalOrg =
    orgName || "Profiletest.ai";

  const finalTest =
    testName || "Profile Test";

  if (loading) {
    return (
      <div className={embed ? "p-0" : "p-6"}>
        <div className="text-lg font-semibold text-white">
          Loading…
        </div>

        <div className="mt-2 text-sm text-white/70">
          Preparing your assessment.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={embed ? "p-0" : "p-6"}
        style={
          embed
            ? { minHeight: 420 }
            : undefined
        }
      >
        <h1 className="text-xl font-semibold text-white">
          Couldn&apos;t load test
        </h1>

        <pre className="mt-3 p-3 rounded bg-white text-black whitespace-pre-wrap border border-black/10">
          {error}
        </pre>
      </div>
    );
  }

  if (completedMessage) {
    return (
      <div className={embed ? "p-0" : "p-6"}>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 max-w-2xl space-y-3">
          <div className="text-lg font-semibold text-white">
            All done
          </div>

          <p className="text-sm text-white/80">
            {completedMessage}
          </p>
        </div>
      </div>
    );
  }

  const noQuestions =
    questions.length === 0 || !question;

  const baseRequiredFieldsComplete =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    buildInternationalPhone(
      phoneCountryCode,
      phone
    ).length > 0;

  const whatsWhatsFieldsComplete =
    !requiresWhatsWhatsFields ||
    (
      website.trim().length > 0 &&
      industry.trim().length > 0 &&
      countryCode.length > 0 &&
      countryName.length > 0 &&
      isValidWebsiteInput(website)
    );

  const canProceedDetails =
    baseRequiredFieldsComplete &&
    whatsWhatsFieldsComplete &&
    dataConsent &&
    !savingDetails;

  const currentAnswered = question
    ? isAnswered(question)
    : false;

  return (
    <div className={embed ? "p-0" : "p-6"}>
      {step === "details" ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-5">
              <div className="text-sm text-white/80 font-medium">
                {finalOrg} invites you to complete this assessment
              </div>

              <div className="text-2xl font-semibold text-white">
                {finalTest}
              </div>

              <div>
                <div className="text-sm font-semibold text-white/90">
                  Introduction To {finalTest}
                </div>

                <p className="mt-2 text-sm leading-6 text-white/75">
                  {introText?.trim()
                    ? introText
                    : "This assessment is designed to help you understand your profile and the patterns that influence how you operate. Your results will be used to generate a personalised report and insights for your organisation."}
                </p>
              </div>

              <div className="rounded-xl bg-black/20 border border-white/10 p-4">
                <div className="text-sm font-semibold text-white/90">
                  Instructions
                </div>

                <p className="mt-2 text-sm leading-6 text-white/75">
                  Please answer each question honestly and instinctively. There are no right or wrong
                  answers. Your results are based on patterns across your responses.
                </p>

                <p className="mt-3 text-sm text-white/75">
                  Enjoy this experience with {finalOrg}.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
              <div className="text-lg font-semibold text-white">
                Before we start, tell us about you
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-white/80">
                    First name *
                  </span>

                  <input
                    className="w-full rounded-xl bg-white text-black p-3 mt-1"
                    value={firstName}
                    onChange={(event) => {
                      setFirstName(
                        event.target.value
                      );

                      setDetailsError(null);
                    }}
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-white/80">
                    Last name *
                  </span>

                  <input
                    className="w-full rounded-xl bg-white text-black p-3 mt-1"
                    value={lastName}
                    onChange={(event) => {
                      setLastName(
                        event.target.value
                      );

                      setDetailsError(null);
                    }}
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm text-white/80">
                    Email *
                  </span>

                  <input
                    type="email"
                    className="w-full rounded-xl bg-white text-black p-3 mt-1"
                    value={email}
                    onChange={(event) => {
                      setEmail(
                        event.target.value
                      );

                      setDetailsError(null);
                    }}
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-white/80">
                    Mobile *
                  </span>

                  <div className="mt-1 flex gap-2">
                    <select
                      className="w-36 rounded-xl bg-white text-black p-3"
                      value={phoneCountryCode}
                      onChange={(event) => {
                        setPhoneCountryCode(
                          event.target.value
                        );

                        setDetailsError(null);
                      }}
                    >
                      {COUNTRY_CODES.map(
                        (country) => (
                          <option
                            key={`${country.iso}-${country.dial}`}
                            value={country.dial}
                          >
                            {country.iso}{" "}
                            {country.dial}
                          </option>
                        )
                      )}
                    </select>

                    <input
                      type="tel"
                      inputMode="tel"
                      placeholder="Mobile number"
                      className="min-w-0 flex-1 rounded-xl bg-white text-black p-3"
                      value={phone}
                      onChange={(event) => {
                        setPhone(
                          event.target.value
                        );

                        setDetailsError(null);
                      }}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-sm text-white/80">
                    Organisation (optional)
                  </span>

                  <input
                    className="w-full rounded-xl bg-white text-black p-3 mt-1"
                    value={company}
                    onChange={(event) =>
                      setCompany(
                        event.target.value
                      )
                    }
                  />
                </label>

                {requiresWhatsWhatsFields ? (
                  <>
                    <label className="block">
                      <span className="text-sm text-white/80">
                        Website *
                      </span>

                      <input
                        type="text"
                        inputMode="url"
                        placeholder="yourwebsite.com"
                        className="w-full rounded-xl bg-white text-black p-3 mt-1"
                        value={website}
                        onChange={(event) => {
                          setWebsite(
                            event.target.value
                          );

                          setDetailsError(null);
                        }}
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm text-white/80">
                        Industry *
                      </span>

                      <input
                        type="text"
                        placeholder="e.g. Professional Services"
                        className="w-full rounded-xl bg-white text-black p-3 mt-1"
                        value={industry}
                        onChange={(event) => {
                          setIndustry(
                            event.target.value
                          );

                          setDetailsError(null);
                        }}
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm text-white/80">
                        Country *
                      </span>

                      <select
                        className="w-full rounded-xl bg-white text-black p-3 mt-1"
                        value={countryCode}
                        onChange={(event) => {
                          const nextCode =
                            event.target.value;

                          const selectedCountry =
                            COUNTRY_OPTIONS.find(
                              (item) =>
                                item.code === nextCode
                            );

                          setCountryCode(nextCode);

                          setCountryName(
                            selectedCountry?.name || ""
                          );

                          setDetailsError(null);
                        }}
                      >
                        <option value="">
                          Select country
                        </option>

                        {COUNTRY_OPTIONS.map(
                          (country) => (
                            <option
                              key={country.code}
                              value={country.code}
                            >
                              {country.name}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-sm text-white/80">
                        Role / Department (optional)
                      </span>

                      <input
                        className="w-full rounded-xl bg-white text-black p-3 mt-1"
                        value={roleTitle}
                        onChange={(event) =>
                          setRoleTitle(
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label className="block md:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-white/80">
                          LinkedIn Profile (optional)
                        </span>

                        <a
                          href={LINKEDIN_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-white/20 px-3 py-1 text-xs font-medium text-white/90 hover:bg-white/10"
                        >
                          Open LinkedIn
                        </a>
                      </div>

                      <input
                        type="url"
                        placeholder="Paste your LinkedIn profile URL here"
                        className="w-full rounded-xl bg-white text-black p-3 mt-1"
                        value={linkedinProfile}
                        onChange={(event) =>
                          setLinkedinProfile(
                            event.target.value
                          )
                        }
                      />

                      <p className="mt-1 text-xs text-white/55">
                        Open LinkedIn, copy your profile URL, then paste it here.
                      </p>
                    </label>
                  </>
                ) : (
                  <>
                    <label className="block">
                      <span className="text-sm text-white/80">
                        Role / Department (optional)
                      </span>

                      <input
                        className="w-full rounded-xl bg-white text-black p-3 mt-1"
                        value={roleTitle}
                        onChange={(event) =>
                          setRoleTitle(
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label className="block">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-white/80">
                          LinkedIn Profile (optional)
                        </span>

                        <a
                          href={LINKEDIN_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-white/20 px-3 py-1 text-xs font-medium text-white/90 hover:bg-white/10"
                        >
                          Open LinkedIn
                        </a>
                      </div>

                      <input
                        type="url"
                        placeholder="Paste your LinkedIn profile URL here"
                        className="w-full rounded-xl bg-white text-black p-3 mt-1"
                        value={linkedinProfile}
                        onChange={(event) =>
                          setLinkedinProfile(
                            event.target.value
                          )
                        }
                      />

                      <p className="mt-1 text-xs text-white/55">
                        Open LinkedIn, copy your profile URL, then paste it here.
                      </p>
                    </label>
                  </>
                )}

                <label className="block md:col-span-2">
                  <span className="text-sm text-white/80">
                    Who referred you? (optional)
                  </span>

                  <input
                    placeholder="Name, company, campaign, or source"
                    className="w-full rounded-xl bg-white text-black p-3 mt-1"
                    value={referredBy}
                    onChange={(event) =>
                      setReferredBy(
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>

              <div className="rounded-xl bg-black/20 border border-white/10 p-4 flex flex-col gap-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent"
                    checked={dataConsent}
                    onChange={(event) => {
                      setDataConsent(
                        event.target.checked
                      );

                      setDetailsError(null);
                    }}
                  />

                  <span className="text-sm text-white/90">
                    I agree that my responses can be used to build my profile and report.
                  </span>
                </label>

                <p className="text-xs text-white/70">
                  By submitting this assessment, you have read and agree to our{" "}
                  <a
                    href={PRIVACY_POLICY_URL}
                    target="_blank"
                    className="underline"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://profiletest.ai/terms-and-conditions"
                    target="_blank"
                    className="underline"
                    rel="noopener noreferrer"
                  >
                    Terms &amp; Conditions
                  </a>
                  .
                </p>
              </div>

              {detailsError && (
                <p className="text-sm text-red-300">
                  {detailsError}
                </p>
              )}

              <div className="pt-1">
                <button
                  onClick={proceedToQuestions}
                  disabled={!canProceedDetails}
                  className="w-full px-5 py-3 rounded-xl bg-white text-slate-900 font-semibold hover:bg-white/90 disabled:opacity-60"
                >
                  {savingDetails
                    ? "Saving…"
                    : "Start This Assessment 👉"}
                </button>

                {!embed && (
                  <div className="pt-3 text-center text-xs text-white/50">
                    powered by{" "}
                    <span className="text-white/65">
                      profiletest.ai
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : noQuestions ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 max-w-2xl">
          <div className="text-lg font-semibold mb-2 text-white">
            This test isn&apos;t configured with any questions yet
          </div>

          <p className="text-sm text-white/70">
            The link is valid, but no question set was found for this test. If you believe this is an
            error, please contact the organiser or MindCanvas support so they can add questions to
            this assessment.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="text-sm text-white/60 mb-2">
              Question {i + 1} / {questions.length}

              {question.category && (
                <span className="ml-2 uppercase text-[11px] px-2 py-0.5 rounded bg-white/10">
                  {question.category}
                </span>
              )}
            </div>

            <div className="text-lg font-medium mb-4 text-white">
              {question.text ||
                `Question ${i + 1}`}
            </div>

            {isTextQuestion(question) ? (
              <div className="space-y-2">
                <textarea
                  className="w-full min-h-[140px] rounded-xl border border-white/20 bg-white/5 px-3 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
                  placeholder="Type your answer here…"
                  value={
                    textAnswers[question.id] || ""
                  }
                  onChange={(event) =>
                    setText(
                      question.id,
                      event.target.value
                    )
                  }
                />
              </div>
            ) : Array.isArray(question.options) &&
              question.options.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {question.options.map(
                  (label: string, index: number) => {
                    const value = index + 1;

                    const selected =
                      answers[question.id] === value;

                    return (
                      <button
                        key={index}
                        onClick={() =>
                          setChoice(
                            question.id,
                            value
                          )
                        }
                        className={[
                          "text-left px-3 py-3 rounded-xl border transition",
                          selected
                            ? "bg-white text-black border-white"
                            : "bg-white/5 border-white/20 hover:bg-white/10",
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    );
                  }
                )}
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map(
                  (value) => (
                    <button
                      key={value}
                      onClick={() =>
                        setChoice(
                          question.id,
                          value
                        )
                      }
                      className={[
                        "px-3 py-3 rounded-xl border transition",
                        answers[question.id] ===
                        value
                          ? "bg-white text-black border-white"
                          : "bg-white/5 border-white/20 hover:bg-white/10",
                      ].join(" ")}
                    >
                      {value}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() =>
                setI(Math.max(0, i - 1))
              }
              disabled={i === 0}
              className="px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10 disabled:opacity-50 text-white"
            >
              Previous
            </button>

            {i < questions.length - 1 ? (
              <button
                onClick={() =>
                  setI(
                    Math.min(
                      questions.length - 1,
                      i + 1
                    )
                  )
                }
                className="px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-60 text-white"
                disabled={!currentAnswered}
              >
                Next
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={
                  !allAnswered || submitting
                }
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white"
              >
                {submitting
                  ? "Submitting…"
                  : "Submit"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}