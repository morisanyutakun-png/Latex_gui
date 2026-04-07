"use client";

import { signIn } from "next-auth/react";
import { Sparkles, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const { t } = useI18n();
  const [authConfigured, setAuthConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data) => setAuthConfigured(data.configured))
      .catch(() => setAuthConfigured(false));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 dark:bg-[#08090c] relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 items-center justify-center shadow-2xl shadow-indigo-500/20 ring-1 ring-white/10 mb-5">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gradient-ai">
            Eddivom
          </h1>
          <p className="mt-2 text-sm text-muted-foreground/60">
            {t("login.tagline")}
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl border border-foreground/[0.06] bg-surface-2/80 dark:bg-surface-1/80 backdrop-blur-xl p-8 shadow-2xl shadow-black/5">
          <h2 className="text-lg font-bold text-foreground/80 text-center mb-2">
            {t("login.heading")}
          </h2>
          <p className="text-sm text-muted-foreground/50 text-center mb-8">
            {t("login.subheading")}
          </p>

          {authConfigured === false && (
            <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    {t("login.unconfigured.title")}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    <code className="text-[11px] bg-foreground/5 px-1 py-0.5 rounded">GOOGLE_CLIENT_ID</code> {t("login.unconfigured.body.before")}{" "}
                    <code className="text-[11px] bg-foreground/5 px-1 py-0.5 rounded">GOOGLE_CLIENT_SECRET</code> {t("login.unconfigured.body.after")}{" "}
                    <code className="text-[11px] bg-foreground/5 px-1 py-0.5 rounded">.env.local</code> {t("login.unconfigured.body.tail")}
                  </p>
                  <p className="text-xs text-muted-foreground/40 mt-2">
                    {t("login.unconfigured.hint")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Google login button */}
          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            disabled={authConfigured === false}
            className="w-full flex items-center justify-center gap-3 h-12 rounded-xl bg-white dark:bg-surface-4 border border-foreground/[0.08] text-foreground/80 font-medium text-sm hover:bg-foreground/[0.02] hover:border-foreground/[0.12] hover:shadow-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t("login.google.button")}
          </button>

          <div className="mt-6 text-center">
            <p className="text-[11px] text-muted-foreground/30">
              {t("login.terms")}
            </p>
          </div>
        </div>

        {/* Skip login option */}
        <div className="text-center mt-6">
          <a
            href="/"
            className="text-xs text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
          >
            {t("login.skip")}
          </a>
        </div>
      </div>
    </div>
  );
}
