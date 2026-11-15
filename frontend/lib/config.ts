import "server-only";
import { cache } from "react";
import { api } from "./api";

export type Config = { feeEnabled: boolean; emailVerificationEnabled: boolean };
/** Feature switches from the backend (cached per request). */
export const getConfig = cache(async (): Promise<Config> => {
  const r = await api.get<Config>("/api/config");
  return { feeEnabled: !!r.data.feeEnabled, emailVerificationEnabled: !!r.data.emailVerificationEnabled };
});
/** Public site address (used in QR codes). */
export const baseUrl = () => process.env.BASE_URL || "http://localhost:3000";
