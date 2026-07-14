import Stripe from "stripe";

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET,
  );
}

export function createStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

export function isDemoPaymentEnabled(): boolean {
  return (
    process.env.DEMO_PAYMENT_ENABLED === "true" ||
    process.env.NODE_ENV !== "production"
  );
}
