import express from "express";
import cookieParser from "cookie-parser";
import { db } from "./db";
import { errorHandler, ok } from "./http";
import { feeEnabled } from "./restaurant";
import { emailVerificationEnabled } from "./auth";
import { router as files } from "./routes/files";
import { router as google } from "./routes/google";
import { router as auth } from "./routes/auth";
import { router as pub } from "./routes/public";
import { router as customer } from "./routes/customer";
import { router as owner } from "./routes/owner";
import { router as admin } from "./routes/admin";
import { router as superAdmin } from "./routes/super";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/api/health", async (_req, res) => {
    try { await db.prepare("SELECT 1").get(); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
  });
  /** Public feature switches the UI needs. */
  app.get("/api/config", (_req, res) => ok(res, { feeEnabled: feeEnabled(), emailVerificationEnabled: emailVerificationEnabled() }));

  app.use("/api", files);
  app.use("/api", google);
  app.use("/api", auth);       // /api/auth/*, /api/me*
  app.use("/api", pub);        // /api/public/*, /api/restaurants*
  app.use("/api", customer);   // /api/cart/*, /api/orders*
  app.use("/api", owner);      // /api/owner/*
  app.use("/api", admin);      // /api/admin/*
  app.use("/api", superAdmin); // /api/super/*

  app.use("/api", (_req, res) => { res.status(404).json({ error: "Not found." }); });
  app.use(errorHandler);
  return app;
}
