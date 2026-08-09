export const PROVIDERS = ["google_analytics", "google_ads", "meta_ads"] as const;
export type Provider = (typeof PROVIDERS)[number];
