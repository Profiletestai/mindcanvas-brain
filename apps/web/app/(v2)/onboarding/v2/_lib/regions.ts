export interface BillingRegion {
  code: string;
  label: string;
}

export const BILLING_REGIONS: BillingRegion[] = [
  { code: "NA", label: "North America" },
  { code: "EMEA", label: "Europe, Middle East & Africa" },
  { code: "APAC", label: "Asia-Pacific" },
  { code: "LATAM", label: "Latin America" },
  { code: "OTHER", label: "Other" },
];
