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
  { iso: "AF", label: "Afghanistan", dial: "+93" },
  { iso: "AL", label: "Albania", dial: "+355" },
  { iso: "DZ", label: "Algeria", dial: "+213" },
  { iso: "AS", label: "American Samoa", dial: "+1" },
  { iso: "AD", label: "Andorra", dial: "+376" },
  { iso: "AO", label: "Angola", dial: "+244" },
  { iso: "AI", label: "Anguilla", dial: "+1" },
  { iso: "AQ", label: "Antarctica", dial: "+672" },
  { iso: "AG", label: "Antigua and Barbuda", dial: "+1" },
  { iso: "AR", label: "Argentina", dial: "+54" },
  { iso: "AM", label: "Armenia", dial: "+374" },
  { iso: "AW", label: "Aruba", dial: "+297" },
  { iso: "AT", label: "Austria", dial: "+43" },
  { iso: "AZ", label: "Azerbaijan", dial: "+994" },
  { iso: "BS", label: "Bahamas", dial: "+1" },
  { iso: "BH", label: "Bahrain", dial: "+973" },
  { iso: "BD", label: "Bangladesh", dial: "+880" },
  { iso: "BB", label: "Barbados", dial: "+1" },
  { iso: "BY", label: "Belarus", dial: "+375" },
  { iso: "BE", label: "Belgium", dial: "+32" },
  { iso: "BZ", label: "Belize", dial: "+501" },
  { iso: "BJ", label: "Benin", dial: "+229" },
  { iso: "BM", label: "Bermuda", dial: "+1" },
  { iso: "BT", label: "Bhutan", dial: "+975" },
  { iso: "BO", label: "Bolivia", dial: "+591" },
  { iso: "BA", label: "Bosnia and Herzegovina", dial: "+387" },
  { iso: "BW", label: "Botswana", dial: "+267" },
  { iso: "BR", label: "Brazil", dial: "+55" },
  { iso: "IO", label: "British Indian Ocean Territory", dial: "+246" },
  { iso: "VG", label: "British Virgin Islands", dial: "+1" },
  { iso: "BN", label: "Brunei", dial: "+673" },
  { iso: "BG", label: "Bulgaria", dial: "+359" },
  { iso: "BF", label: "Burkina Faso", dial: "+226" },
  { iso: "BI", label: "Burundi", dial: "+257" },
  { iso: "CV", label: "Cabo Verde", dial: "+238" },
  { iso: "KH", label: "Cambodia", dial: "+855" },
  { iso: "CM", label: "Cameroon", dial: "+237" },
  { iso: "BQ", label: "Caribbean Netherlands", dial: "+599" },
  { iso: "KY", label: "Cayman Islands", dial: "+1" },
  { iso: "CF", label: "Central African Republic", dial: "+236" },
  { iso: "TD", label: "Chad", dial: "+235" },
  { iso: "CL", label: "Chile", dial: "+56" },
  { iso: "CN", label: "China", dial: "+86" },
  { iso: "CX", label: "Christmas Island", dial: "+61" },
  { iso: "CC", label: "Cocos (Keeling) Islands", dial: "+61" },
  { iso: "CO", label: "Colombia", dial: "+57" },
  { iso: "KM", label: "Comoros", dial: "+269" },
  { iso: "CK", label: "Cook Islands", dial: "+682" },
  { iso: "CR", label: "Costa Rica", dial: "+506" },
  { iso: "HR", label: "Croatia", dial: "+385" },
  { iso: "CU", label: "Cuba", dial: "+53" },
  { iso: "CW", label: "Curaçao", dial: "+599" },
  { iso: "CY", label: "Cyprus", dial: "+357" },
  { iso: "CZ", label: "Czechia", dial: "+420" },
  { iso: "CI", label: "Côte d’Ivoire", dial: "+225" },
  { iso: "CD", label: "Democratic Republic of the Congo", dial: "+243" },
  { iso: "DK", label: "Denmark", dial: "+45" },
  { iso: "DJ", label: "Djibouti", dial: "+253" },
  { iso: "DM", label: "Dominica", dial: "+1" },
  { iso: "DO", label: "Dominican Republic", dial: "+1" },
  { iso: "TL", label: "East Timor", dial: "+670" },
  { iso: "EC", label: "Ecuador", dial: "+593" },
  { iso: "EG", label: "Egypt", dial: "+20" },
  { iso: "SV", label: "El Salvador", dial: "+503" },
  { iso: "GQ", label: "Equatorial Guinea", dial: "+240" },
  { iso: "ER", label: "Eritrea", dial: "+291" },
  { iso: "EE", label: "Estonia", dial: "+372" },
  { iso: "SZ", label: "Eswatini", dial: "+268" },
  { iso: "ET", label: "Ethiopia", dial: "+251" },
  { iso: "FK", label: "Falkland Islands", dial: "+500" },
  { iso: "FO", label: "Faroe Islands", dial: "+298" },
  { iso: "FJ", label: "Fiji", dial: "+679" },
  { iso: "FI", label: "Finland", dial: "+358" },
  { iso: "FR", label: "France", dial: "+33" },
  { iso: "GF", label: "French Guiana", dial: "+594" },
  { iso: "PF", label: "French Polynesia", dial: "+689" },
  { iso: "GA", label: "Gabon", dial: "+241" },
  { iso: "GM", label: "Gambia", dial: "+220" },
  { iso: "GE", label: "Georgia", dial: "+995" },
  { iso: "DE", label: "Germany", dial: "+49" },
  { iso: "GH", label: "Ghana", dial: "+233" },
  { iso: "GI", label: "Gibraltar", dial: "+350" },
  { iso: "GR", label: "Greece", dial: "+30" },
  { iso: "GL", label: "Greenland", dial: "+299" },
  { iso: "GD", label: "Grenada", dial: "+1" },
  { iso: "GP", label: "Guadeloupe", dial: "+590" },
  { iso: "GU", label: "Guam", dial: "+1" },
  { iso: "GT", label: "Guatemala", dial: "+502" },
  { iso: "GG", label: "Guernsey", dial: "+44" },
  { iso: "GN", label: "Guinea", dial: "+224" },
  { iso: "GW", label: "Guinea-Bissau", dial: "+245" },
  { iso: "GY", label: "Guyana", dial: "+592" },
  { iso: "HT", label: "Haiti", dial: "+509" },
  { iso: "HN", label: "Honduras", dial: "+504" },
  { iso: "HK", label: "Hong Kong", dial: "+852" },
  { iso: "HU", label: "Hungary", dial: "+36" },
  { iso: "IN", label: "India", dial: "+91" },
  { iso: "ID", label: "Indonesia", dial: "+62" },
  { iso: "IR", label: "Iran", dial: "+98" },
  { iso: "IQ", label: "Iraq", dial: "+964" },
  { iso: "IM", label: "Isle of Man", dial: "+44" },
  { iso: "IL", label: "Israel", dial: "+972" },
  { iso: "IT", label: "Italy", dial: "+39" },
  { iso: "JM", label: "Jamaica", dial: "+1" },
  { iso: "JP", label: "Japan", dial: "+81" },
  { iso: "JE", label: "Jersey", dial: "+44" },
  { iso: "JO", label: "Jordan", dial: "+962" },
  { iso: "KZ", label: "Kazakhstan", dial: "+7" },
  { iso: "KE", label: "Kenya", dial: "+254" },
  { iso: "KI", label: "Kiribati", dial: "+686" },
  { iso: "XK", label: "Kosovo", dial: "+383" },
  { iso: "KW", label: "Kuwait", dial: "+965" },
  { iso: "KG", label: "Kyrgyzstan", dial: "+996" },
  { iso: "LA", label: "Laos", dial: "+856" },
  { iso: "LV", label: "Latvia", dial: "+371" },
  { iso: "LB", label: "Lebanon", dial: "+961" },
  { iso: "LS", label: "Lesotho", dial: "+266" },
  { iso: "LR", label: "Liberia", dial: "+231" },
  { iso: "LY", label: "Libya", dial: "+218" },
  { iso: "LI", label: "Liechtenstein", dial: "+423" },
  { iso: "LT", label: "Lithuania", dial: "+370" },
  { iso: "LU", label: "Luxembourg", dial: "+352" },
  { iso: "MO", label: "Macau", dial: "+853" },
  { iso: "MG", label: "Madagascar", dial: "+261" },
  { iso: "MW", label: "Malawi", dial: "+265" },
  { iso: "MY", label: "Malaysia", dial: "+60" },
  { iso: "MV", label: "Maldives", dial: "+960" },
  { iso: "ML", label: "Mali", dial: "+223" },
  { iso: "MT", label: "Malta", dial: "+356" },
  { iso: "MH", label: "Marshall Islands", dial: "+692" },
  { iso: "MQ", label: "Martinique", dial: "+596" },
  { iso: "MR", label: "Mauritania", dial: "+222" },
  { iso: "MU", label: "Mauritius", dial: "+230" },
  { iso: "YT", label: "Mayotte", dial: "+262" },
  { iso: "MX", label: "Mexico", dial: "+52" },
  { iso: "FM", label: "Micronesia", dial: "+691" },
  { iso: "MD", label: "Moldova", dial: "+373" },
  { iso: "MC", label: "Monaco", dial: "+377" },
  { iso: "MN", label: "Mongolia", dial: "+976" },
  { iso: "ME", label: "Montenegro", dial: "+382" },
  { iso: "MS", label: "Montserrat", dial: "+1" },
  { iso: "MA", label: "Morocco", dial: "+212" },
  { iso: "MZ", label: "Mozambique", dial: "+258" },
  { iso: "MM", label: "Myanmar", dial: "+95" },
  { iso: "NA", label: "Namibia", dial: "+264" },
  { iso: "NR", label: "Nauru", dial: "+674" },
  { iso: "NP", label: "Nepal", dial: "+977" },
  { iso: "NL", label: "Netherlands", dial: "+31" },
  { iso: "NC", label: "New Caledonia", dial: "+687" },
  { iso: "NI", label: "Nicaragua", dial: "+505" },
  { iso: "NE", label: "Niger", dial: "+227" },
  { iso: "NG", label: "Nigeria", dial: "+234" },
  { iso: "NU", label: "Niue", dial: "+683" },
  { iso: "NF", label: "Norfolk Island", dial: "+672" },
  { iso: "KP", label: "North Korea", dial: "+850" },
  { iso: "MK", label: "North Macedonia", dial: "+389" },
  { iso: "MP", label: "Northern Mariana Islands", dial: "+1" },
  { iso: "NO", label: "Norway", dial: "+47" },
  { iso: "OM", label: "Oman", dial: "+968" },
  { iso: "PK", label: "Pakistan", dial: "+92" },
  { iso: "PW", label: "Palau", dial: "+680" },
  { iso: "PS", label: "Palestine", dial: "+970" },
  { iso: "PA", label: "Panama", dial: "+507" },
  { iso: "PG", label: "Papua New Guinea", dial: "+675" },
  { iso: "PY", label: "Paraguay", dial: "+595" },
  { iso: "PE", label: "Peru", dial: "+51" },
  { iso: "PH", label: "Philippines", dial: "+63" },
  { iso: "PN", label: "Pitcairn Islands", dial: "+64" },
  { iso: "PL", label: "Poland", dial: "+48" },
  { iso: "PT", label: "Portugal", dial: "+351" },
  { iso: "PR", label: "Puerto Rico", dial: "+1" },
  { iso: "QA", label: "Qatar", dial: "+974" },
  { iso: "CG", label: "Republic of the Congo", dial: "+242" },
  { iso: "RO", label: "Romania", dial: "+40" },
  { iso: "RU", label: "Russia", dial: "+7" },
  { iso: "RW", label: "Rwanda", dial: "+250" },
  { iso: "RE", label: "Réunion", dial: "+262" },
  { iso: "BL", label: "Saint Barthélemy", dial: "+590" },
  { iso: "SH", label: "Saint Helena", dial: "+290" },
  { iso: "KN", label: "Saint Kitts and Nevis", dial: "+1" },
  { iso: "LC", label: "Saint Lucia", dial: "+1" },
  { iso: "MF", label: "Saint Martin", dial: "+590" },
  { iso: "PM", label: "Saint Pierre and Miquelon", dial: "+508" },
  { iso: "VC", label: "Saint Vincent and the Grenadines", dial: "+1" },
  { iso: "WS", label: "Samoa", dial: "+685" },
  { iso: "SM", label: "San Marino", dial: "+378" },
  { iso: "SA", label: "Saudi Arabia", dial: "+966" },
  { iso: "SN", label: "Senegal", dial: "+221" },
  { iso: "RS", label: "Serbia", dial: "+381" },
  { iso: "SC", label: "Seychelles", dial: "+248" },
  { iso: "SL", label: "Sierra Leone", dial: "+232" },
  { iso: "SG", label: "Singapore", dial: "+65" },
  { iso: "SX", label: "Sint Maarten", dial: "+1" },
  { iso: "SK", label: "Slovakia", dial: "+421" },
  { iso: "SI", label: "Slovenia", dial: "+386" },
  { iso: "SB", label: "Solomon Islands", dial: "+677" },
  { iso: "SO", label: "Somalia", dial: "+252" },
  { iso: "GS", label: "South Georgia", dial: "+500" },
  { iso: "KR", label: "South Korea", dial: "+82" },
  { iso: "SS", label: "South Sudan", dial: "+211" },
  { iso: "ES", label: "Spain", dial: "+34" },
  { iso: "LK", label: "Sri Lanka", dial: "+94" },
  { iso: "SD", label: "Sudan", dial: "+249" },
  { iso: "SR", label: "Suriname", dial: "+597" },
  { iso: "SJ", label: "Svalbard and Jan Mayen", dial: "+47" },
  { iso: "SE", label: "Sweden", dial: "+46" },
  { iso: "CH", label: "Switzerland", dial: "+41" },
  { iso: "SY", label: "Syria", dial: "+963" },
  { iso: "ST", label: "São Tomé and Príncipe", dial: "+239" },
  { iso: "TW", label: "Taiwan", dial: "+886" },
  { iso: "TJ", label: "Tajikistan", dial: "+992" },
  { iso: "TZ", label: "Tanzania", dial: "+255" },
  { iso: "TH", label: "Thailand", dial: "+66" },
  { iso: "TG", label: "Togo", dial: "+228" },
  { iso: "TK", label: "Tokelau", dial: "+690" },
  { iso: "TO", label: "Tonga", dial: "+676" },
  { iso: "TT", label: "Trinidad and Tobago", dial: "+1" },
  { iso: "TN", label: "Tunisia", dial: "+216" },
  { iso: "TR", label: "Turkey", dial: "+90" },
  { iso: "TM", label: "Turkmenistan", dial: "+993" },
  { iso: "TC", label: "Turks and Caicos Islands", dial: "+1" },
  { iso: "TV", label: "Tuvalu", dial: "+688" },
  { iso: "VI", label: "U.S. Virgin Islands", dial: "+1" },
  { iso: "UG", label: "Uganda", dial: "+256" },
  { iso: "UA", label: "Ukraine", dial: "+380" },
  { iso: "UY", label: "Uruguay", dial: "+598" },
  { iso: "UZ", label: "Uzbekistan", dial: "+998" },
  { iso: "VU", label: "Vanuatu", dial: "+678" },
  { iso: "VA", label: "Vatican City", dial: "+39" },
  { iso: "VE", label: "Venezuela", dial: "+58" },
  { iso: "VN", label: "Vietnam", dial: "+84" },
  { iso: "WF", label: "Wallis and Futuna", dial: "+681" },
  { iso: "EH", label: "Western Sahara", dial: "+212" },
  { iso: "YE", label: "Yemen", dial: "+967" },
  { iso: "ZM", label: "Zambia", dial: "+260" },
  { iso: "ZW", label: "Zimbabwe", dial: "+263" },
  { iso: "AX", label: "Åland Islands", dial: "+358" },
];

const DEFAULT_COUNTRY =
  COUNTRY_CODES.find((country) => country.iso === "ZA") ?? COUNTRY_CODES[0];

function formatCountryOption(country: CountryCode) {
  return `${country.label} (${country.iso}) ${country.dial}`;
}

function findCountryByIso(iso: string) {
  const normalizedIso = safeString(iso).trim().toUpperCase();
  return COUNTRY_CODES.find((country) => country.iso === normalizedIso) ?? null;
}

function findCountryByDial(dial: string) {
  const normalizedDial = safeString(dial).replace(/\s+/g, "").trim();
  return COUNTRY_CODES.find((country) => country.dial === normalizedDial) ?? null;
}

function findCountryFromSearch(value: string) {
  const normalized = safeString(value).trim().toLowerCase();
  if (!normalized) return null;

  const exact =
    COUNTRY_CODES.find(
      (country) =>
        formatCountryOption(country).toLowerCase() === normalized ||
        country.label.toLowerCase() === normalized ||
        country.iso.toLowerCase() === normalized ||
        country.dial === value.trim()
    ) ?? null;

  if (exact) return exact;

  const partialMatches = COUNTRY_CODES.filter((country) => {
    const searchable = `${country.label} ${country.iso} ${country.dial}`.toLowerCase();
    return searchable.includes(normalized);
  });

  return partialMatches.length === 1 ? partialMatches[0] : null;
}

async function fetchJson(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const ct = r.headers.get("content-type") || "";

  if (!ct.includes("application/json")) {
    const text = (await r.text()).slice(0, 600);
    throw new Error(`HTTP ${r.status} – non-JSON response:\n${text}`);
  }

  const j = await r.json();
  if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
  return j;
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

  [k: string]: any;
};

function isTextQuestion(q?: Question | null) {
  const t = String(q?.type || "").toLowerCase().trim();
  return t === "text" || t === "textarea" || t === "longtext";
}

function safeString(x: any): string {
  if (typeof x === "string") return x;
  if (x == null) return "";
  return String(x);
}

function isAbsoluteUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function buildInternationalPhone(countryCode: string, localNumber: string) {
  const cleanedCountryCode = safeString(countryCode).trim() || "+27";
  const cleanedLocal = safeString(localNumber)
    .replace(/[^\d]/g, "")
    .replace(/^0+/, "");

  return cleanedLocal ? `${cleanedCountryCode}${cleanedLocal}` : "";
}

function parseSavedPhone(
  savedCountryCode: any,
  savedPhone: any,
  savedCountryIso?: any
) {
  const existingCountryCode = safeString(savedCountryCode).trim();
  const existingCountryIso = safeString(savedCountryIso).trim().toUpperCase();
  const phone = safeString(savedPhone).trim();

  const savedCountry =
    findCountryByIso(existingCountryIso) ??
    findCountryByDial(existingCountryCode) ??
    DEFAULT_COUNTRY;

  if (existingCountryCode) {
    const localWithoutCountry = phone.startsWith(existingCountryCode)
      ? phone.slice(existingCountryCode.length)
      : phone;

    return {
      countryCode: savedCountry.dial,
      countryIso: savedCountry.iso,
      localPhone: localWithoutCountry,
    };
  }

  if (!phone) {
    return {
      countryCode: savedCountry.dial,
      countryIso: savedCountry.iso,
      localPhone: "",
    };
  }

  const compactPhone = phone.replace(/\s+/g, "");

  const matchingCountry = [...COUNTRY_CODES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((country) => compactPhone.startsWith(country.dial));

  if (matchingCountry) {
    return {
      countryCode: matchingCountry.dial,
      countryIso: matchingCountry.iso,
      localPhone: compactPhone.slice(matchingCountry.dial.length),
    };
  }

  return {
    countryCode: DEFAULT_COUNTRY.dial,
    countryIso: DEFAULT_COUNTRY.iso,
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

  const [testName, setTestName] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [introText, setIntroText] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState<Step>("details");

  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [textAnswers, setTextAnswers] = useState<TextAnswersMap>({});

  const [isVisibilityEngine, setIsVisibilityEngine] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState(DEFAULT_COUNTRY.dial);
  const [phoneCountryIso, setPhoneCountryIso] = useState(DEFAULT_COUNTRY.iso);
  const [phoneCountrySearch, setPhoneCountrySearch] = useState(
    formatCountryOption(DEFAULT_COUNTRY)
  );
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [linkedinProfile, setLinkedinProfile] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [dataConsent, setDataConsent] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [takerId, setTakerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);

  const [completedMessage, setCompletedMessage] = useState<string | null>(null);

  const key = (k: string) => `mc_${k}_${token}`;

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const metaRes: any = await fetchJson(`/api/public/test/${token}`);
        if (!alive) return;

        const metaData = metaRes?.data ?? {};
        const nameFromMeta: string | null = metaData?.name ?? null;

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

        if (!embed && typeof window !== "undefined") {
          const detail = { orgName: orgNameFromMeta, testName: nameFromMeta };
          window.dispatchEvent(new CustomEvent("mc_test_meta", { detail }));
        }

        const qRes: any = await fetchJson(`/api/public/test/${token}/questions`);
        if (!alive) return;

        const list: Question[] = Array.isArray(qRes?.questions) ? qRes.questions : [];
        setQuestions(list);

        const engine = safeString(qRes?.__debug?.engine).toLowerCase();
        setIsVisibilityEngine(engine.includes("visibility"));

        if (typeof window !== "undefined") {
          const savedAns = window.localStorage.getItem(key("answers"));
          if (savedAns) {
            try {
              setAnswers(JSON.parse(savedAns));
            } catch {}
          }

          const savedText = window.localStorage.getItem(key("text_answers"));
          if (savedText) {
            try {
              setTextAnswers(JSON.parse(savedText));
            } catch {}
          }

          const d = window.localStorage.getItem(key("details"));
          if (d) {
            try {
              const o = JSON.parse(d);
              const parsedPhone = parseSavedPhone(
                o.phoneCountryCode,
                o.phone,
                o.phoneCountryIso
              );

              setFirstName(o.firstName || "");
              setLastName(o.lastName || "");
              setEmail(o.email || "");
              setPhoneCountryCode(parsedPhone.countryCode);
              setPhoneCountryIso(parsedPhone.countryIso);

              const restoredCountry =
                findCountryByIso(parsedPhone.countryIso) ?? DEFAULT_COUNTRY;
              setPhoneCountrySearch(formatCountryOption(restoredCountry));

              setPhone(parsedPhone.localPhone);
              setCompany(o.company || "");
              setRoleTitle(o.roleTitle || "");
              setLinkedinProfile(o.linkedinProfile || "");
              setReferredBy(o.referredBy || "");
              setDataConsent(Boolean(o.dataConsent));
            } catch {}
          }

          const tid = window.localStorage.getItem(key("taker_id"));
          if (tid) setTakerId(tid);
        }

        setStarted(true);
      } catch (e: any) {
        if (alive) setError(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token, embed]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key("answers"), JSON.stringify(answers));
    }
  }, [answers, token]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key("text_answers"), JSON.stringify(textAnswers));
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
          phoneCountryIso,
          phone,
          company,
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
    phoneCountryIso,
    phone,
    company,
    roleTitle,
    linkedinProfile,
    referredBy,
    dataConsent,
    token,
  ]);

  const selectedPhoneCountry =
    findCountryByIso(phoneCountryIso) ??
    findCountryByDial(phoneCountryCode) ??
    DEFAULT_COUNTRY;

  const countryListId = `mc-country-codes-${token}`;

  const selectPhoneCountry = (country: CountryCode) => {
    setPhoneCountryCode(country.dial);
    setPhoneCountryIso(country.iso);
    setPhoneCountrySearch(formatCountryOption(country));
    setDetailsError(null);
  };

  const q = questions[i];

  const isAnswered = (qq: Question) => {
    if (isTextQuestion(qq)) return (textAnswers[qq.id] || "").trim().length > 0;
    return Number(answers[qq.id]) >= 1;
  };

  const allAnswered = useMemo(
    () => questions.length > 0 && questions.every((qq) => isAnswered(qq)),
    [questions, answers, textAnswers]
  );

  const setChoice = (qid: string, val: number) => setAnswers((a) => ({ ...a, [qid]: val }));
  const setText = (qid: string, val: string) => setTextAnswers((a) => ({ ...a, [qid]: val }));

  const validateDetails = (): string | null => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim();
    const ph = buildInternationalPhone(phoneCountryCode, phone);

    if (!fn || !ln || !em || !ph) {
      return "Please complete all required fields before starting.";
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(em)) {
      return "Please enter a valid email address.";
    }

    const localDigits = phone.replace(/[^\d]/g, "").replace(/^0+/, "");
    if (localDigits.length < 6) {
      return "Please enter a valid mobile number.";
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

      const internationalPhone = buildInternationalPhone(phoneCountryCode, phone);

      const res: any = await fetchJson(`/api/public/test/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          email: email.trim().toLowerCase() || null,
          phone: internationalPhone || null,
          company: company.trim() || null,
          role_title: roleTitle.trim() || null,
          linkedin_profile: linkedinProfile.trim() || null,
          referred_by: referredBy.trim() || null,
          data_consent: true,
        }),
      });

      const tid = res?.id;
      if (!tid) throw new Error("Failed to create taker");

      setTakerId(tid);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(key("taker_id"), tid);
      }

      setStep("questions");
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSavingDetails(false);
    }
  };

  function resolveRedirectAndNextSteps(j: SubmitResponse) {
    const redirect =
      safeString(j.redirect).trim() ||
      safeString((j as any).redirect_url).trim() ||
      safeString((j as any).redirectUrl).trim() ||
      safeString((j as any).qsc_public_path).trim() ||
      safeString((j as any).qsc_public_url).trim() ||
      "";

    const nextSteps =
      safeString(j.next_steps_url).trim() ||
      safeString((j as any).nextStepsUrl).trim() ||
      safeString((j as any).next_steps?.url).trim() ||
      safeString((j as any).link_meta?.next_steps_url).trim() ||
      safeString((j as any).meta?.next_steps_url).trim() ||
      safeString((j as any).link?.next_steps_url).trim() ||
      "";

    const showResults =
      typeof j.show_results === "boolean"
        ? j.show_results
        : typeof (j as any).showResults === "boolean"
        ? (j as any).showResults
        : undefined;

    return { redirect: redirect || null, nextSteps: nextSteps || null, showResults };
  }

  const submit = async () => {
    try {
      setSubmitting(true);
      setError("");
      setCompletedMessage(null);

      if (!takerId) throw new Error("missing taker_id");

      const payloadAnswers = questions.map((qq) => {
        if (isTextQuestion(qq)) {
          return { question_id: qq.id, text: (textAnswers[qq.id] || "").trim() };
        }

        return { question_id: qq.id, selected: Number(answers[qq.id] || 0) - 1 };
      });

      const res = await fetch(`/api/public/test/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taker_id: takerId, answers: payloadAnswers }),
      });

      const j: SubmitResponse = await res.json().catch(() => ({} as any));

      if (!res.ok || (j as any)?.ok === false) {
        throw new Error((j as any)?.error || `HTTP ${res.status}`);
      }

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(key("answers"));
        window.localStorage.removeItem(key("text_answers"));
        window.localStorage.removeItem(key("details"));
      }

      if (isVisibilityEngine) {
        router.replace(`/t/${token}/visibility/report?tid=${encodeURIComponent(takerId)}`);
        return;
      }

      const { redirect, nextSteps, showResults } = resolveRedirectAndNextSteps(j);

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
        router.replace(`/t/${token}/result?tid=${encodeURIComponent(takerId)}`);
        return;
      }

      setCompletedMessage(
        j.hidden_results_message ||
          (j as any).hiddenResultsMessage ||
          "Thanks — your results have been sent to your organisation. You can close this page."
      );
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  const finalOrg = orgName || "Profiletest.ai";
  const finalTest = testName || "Profile Test";

  if (loading) {
    return (
      <div className={embed ? "p-0" : "p-6"}>
        <div className="text-lg font-semibold text-white">Loading…</div>
        <div className="mt-2 text-sm text-white/70">Preparing your assessment.</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={embed ? "p-0" : "p-6"} style={embed ? { minHeight: 420 } : undefined}>
        <h1 className="text-xl font-semibold text-white">Couldn’t load test</h1>
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
          <div className="text-lg font-semibold text-white">All done</div>
          <p className="text-sm text-white/80">{completedMessage}</p>
        </div>
      </div>
    );
  }

  const noQuestions = questions.length === 0 || !q;

  const canProceedDetails =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    buildInternationalPhone(phoneCountryCode, phone).length > 0 &&
    dataConsent &&
    !savingDetails;

  const currentAnswered = q ? isAnswered(q) : false;

  return (
    <div className={embed ? "p-0" : "p-6"}>
      {step === "details" ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-5">
              <div className="text-sm text-white/80 font-medium">
                {finalOrg} invites you to complete this assessment
              </div>

              <div className="text-2xl font-semibold text-white">{finalTest}</div>

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
                <div className="text-sm font-semibold text-white/90">Instructions</div>
                <p className="mt-2 text-sm leading-6 text-white/75">
                  Please answer each question honestly and instinctively. There are no right or wrong
                  answers. Your results are based on patterns across your responses.
                </p>
                <p className="mt-3 text-sm text-white/75">Enjoy this experience with {finalOrg}.</p>
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
                  <span className="text-sm text-white/80">First name *</span>
                  <input
                    className="w-full rounded-xl bg-white text-black p-3 mt-1"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      setDetailsError(null);
                    }}
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-white/80">Last name *</span>
                  <input
                    className="w-full rounded-xl bg-white text-black p-3 mt-1"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      setDetailsError(null);
                    }}
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm text-white/80">Email *</span>
                  <input
                    type="email"
                    className="w-full rounded-xl bg-white text-black p-3 mt-1"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setDetailsError(null);
                    }}
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-white/80">Mobile *</span>

                  <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                    <div>
                      <input
                        type="text"
                        list={countryListId}
                        autoComplete="country"
                        placeholder="Search country or dialling code"
                        className="w-full rounded-xl bg-white text-black p-3"
                        value={phoneCountrySearch}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPhoneCountrySearch(value);
                          setDetailsError(null);

                          const country = findCountryFromSearch(value);
                          if (country) {
                            setPhoneCountryCode(country.dial);
                            setPhoneCountryIso(country.iso);
                          }
                        }}
                        onBlur={() => {
                          const country = findCountryFromSearch(phoneCountrySearch);

                          if (country) {
                            selectPhoneCountry(country);
                          } else {
                            setPhoneCountrySearch(
                              formatCountryOption(selectedPhoneCountry)
                            );
                          }
                        }}
                      />

                      <datalist id={countryListId}>
                        {COUNTRY_CODES.map((country) => (
                          <option
                            key={country.iso}
                            value={formatCountryOption(country)}
                          />
                        ))}
                      </datalist>
                    </div>

                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-slate-600">
                        {phoneCountryCode}
                      </div>

                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        placeholder="Mobile number"
                        className="w-full rounded-xl bg-white py-3 pr-3 pl-16 text-black"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          setDetailsError(null);
                        }}
                      />
                    </div>
                  </div>

                  <p className="mt-1 text-xs text-white/55">
                    Start typing a country name or dialling code. The selected
                    code is added automatically.
                  </p>
                </label>

                <label className="block">
                  <span className="text-sm text-white/80">Organisation (optional)</span>
                  <input
                    className="w-full rounded-xl bg-white text-black p-3 mt-1"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-white/80">Role / Department (optional)</span>
                  <input
                    className="w-full rounded-xl bg-white text-black p-3 mt-1"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                  />
                </label>

                <label className="block">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/80">LinkedIn Profile (optional)</span>

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
                    onChange={(e) => setLinkedinProfile(e.target.value)}
                  />

                  <p className="mt-1 text-xs text-white/55">
                    Open LinkedIn, copy your profile URL, then paste it here.
                  </p>
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm text-white/80">Who referred you? (optional)</span>
                  <input
                    placeholder="Name, company, campaign, or source"
                    className="w-full rounded-xl bg-white text-black p-3 mt-1"
                    value={referredBy}
                    onChange={(e) => setReferredBy(e.target.value)}
                  />
                </label>
              </div>

              <div className="rounded-xl bg-black/20 border border-white/10 p-4 flex flex-col gap-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent"
                    checked={dataConsent}
                    onChange={(e) => {
                      setDataConsent(e.target.checked);
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
                  <a href="/terms" target="_blank" className="underline" rel="noopener noreferrer">
                    Terms &amp; Conditions
                  </a>
                  .
                </p>
              </div>

              {detailsError && <p className="text-sm text-red-300">{detailsError}</p>}

              <div className="pt-1">
                <button
                  onClick={proceedToQuestions}
                  disabled={!canProceedDetails}
                  className="w-full px-5 py-3 rounded-xl bg-white text-slate-900 font-semibold hover:bg-white/90 disabled:opacity-60"
                >
                  {savingDetails ? "Saving…" : "Start This Assessment 👉"}
                </button>

                {!embed && (
                  <div className="pt-3 text-center text-xs text-white/50">
                    powered by <span className="text-white/65">profiletest.ai</span>
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
              {q.category && (
                <span className="ml-2 uppercase text-[11px] px-2 py-0.5 rounded bg-white/10">
                  {q.category}
                </span>
              )}
            </div>

            <div className="text-lg font-medium mb-4 text-white">
              {q.text || `Question ${i + 1}`}
            </div>

            {isTextQuestion(q) ? (
              <div className="space-y-2">
                <textarea
                  className="w-full min-h-[140px] rounded-xl border border-white/20 bg-white/5 px-3 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
                  placeholder="Type your answer here…"
                  value={textAnswers[q.id] || ""}
                  onChange={(e) => setText(q.id, e.target.value)}
                />
              </div>
            ) : Array.isArray(q.options) && q.options.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {q.options.map((label: string, idx: number) => {
                  const val = idx + 1;
                  const selected = answers[q.id] === val;

                  return (
                    <button
                      key={idx}
                      onClick={() => setChoice(q.id, val)}
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
                })}
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    onClick={() => setChoice(q.id, val)}
                    className={[
                      "px-3 py-3 rounded-xl border transition",
                      answers[q.id] === val
                        ? "bg-white text-black border-white"
                        : "bg-white/5 border-white/20 hover:bg-white/10",
                    ].join(" ")}
                  >
                    {val}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setI(Math.max(0, i - 1))}
              disabled={i === 0}
              className="px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10 disabled:opacity-50 text-white"
            >
              Previous
            </button>

            {i < questions.length - 1 ? (
              <button
                onClick={() => setI(Math.min(questions.length - 1, i + 1))}
                className="px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-60 text-white"
                disabled={!currentAnswered}
              >
                Next
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!allAnswered || submitting}
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}