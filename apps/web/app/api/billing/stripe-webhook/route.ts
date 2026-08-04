// Compatibility URL for the former legacy webhook destination.
// Both Stripe URLs now execute the same canonical processor, preventing the
// onboarding and legacy billing paths from applying different rules.

import "server-only";

import { POST as processStripeWebhook } from "@/app/api/stripe/webhook/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  return processStripeWebhook(request);
}