import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Always log full error server-side so you can see root cause in terminal
  console.error("💥 Unhandled error:", err);

  if (err instanceof Error) {
    const errAsAny = err as unknown as Record<string, unknown>;
    const code = errAsAny["code"];

    // Prisma errors
    if (code === "P2025") {
      res.status(404).json({ success: false, message: "Record not found" });
      return;
    }
    if (code === "P2002") {
      res.status(409).json({ success: false, message: "Duplicate entry" });
      return;
    }

    // Known user-facing errors
    const knownPhrases = ["Invalid credentials", "already exists", "not found"];
    if (
      knownPhrases.some((m) =>
        err.message.toLowerCase().includes(m.toLowerCase()),
      )
    ) {
      res.status(400).json({ success: false, message: err.message });
      return;
    }

    // CORS
    if (err.message.startsWith("CORS:")) {
      res.status(403).json({ success: false, message: err.message });
      return;
    }
  }

  // In development always surface the real error detail — critical for debugging
  res.status(500).json({
    success: false,
    message: "Internal server error",
    detail:
      env.NODE_ENV !== "production"
        ? err instanceof Error
          ? err.message
          : String(err)
        : undefined,
    // Stack trace only in development
    stack:
      env.NODE_ENV === "development"
        ? err instanceof Error
          ? err.stack
          : undefined
        : undefined,
  });
}
