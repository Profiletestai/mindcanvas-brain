// apps/web/lib/stripe.ts
// Server-only Stripe SDK singleton.

import "server-only";
import Stripe from "stripe";

const KEY = process.env.STRIPE_SECRET_KEY;

if (!KEY) {
  // Defer the throw to call sites so unrelated routes still build.
  // Routes that depend on Stripe will surface the error on first call.
  // eslint-disable-next-line no-console
  console.warn("[stripe] STRIPE_SECRET_KEY is not set — Stripe calls will fail.");
}

export const stripe = new Stripe(KEY ?? "sk_test_missing", {
  apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
  appInfo: { name: "mindcanvas-web", version: "0.1.0" },
});
