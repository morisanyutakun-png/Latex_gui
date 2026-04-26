"use client";

/**
 * MobileGate
 * ─────────────────────────────────────────────────
 * UA がモバイルのときに app/page.tsx から呼ばれる薄いクライアントエントリ。
 * MobileLanding に必要な依存 (CTA / mockups / プラン選択) を組み立てて渡す。
 *
 * 設計方針:
 *  - PC LP (TemplateGallery) を import しない → PC LP コードがモバイル bundle に乗らない
 *  - mockup は dynamic import で別 chunk にし、初期描画後に取得
 *  - SSR でヒーローテキストだけ返すので FCP が早い
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useDocumentStore } from "@/store/document-store";
import { usePlanStore } from "@/store/plan-store";
import { createDefaultDocument } from "@/lib/types";
import { getTemplateLatex } from "@/lib/templates";
import { loadFromLocalStorage } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
import { PLANS } from "@/lib/plans";
import { toast } from "sonner";
import { MobileLanding } from "./mobile-landing";

// Mockups は専用ファイル lp-mockups から dynamic import。
// PC LP の重い template-gallery.tsx に依存しないので、モバイル bundle が劇的に軽い。
const EditorMockup = dynamic(
  () => import("./lp-mockups").then((m) => ({ default: m.EditorMockup })),
  {
    ssr: false,
    loading: () => <div className="w-full" style={{ minHeight: 240 }} aria-hidden />,
  },
);
const FigureDrawMockup = dynamic(
  () => import("./lp-mockups").then((m) => ({ default: m.FigureDrawMockup })),
  {
    ssr: false,
    loading: () => <div className="w-full" style={{ minHeight: 240 }} aria-hidden />,
  },
);

type PlanIdLite = "free" | "starter" | "pro" | "premium";

export function MobileGate() {
  const router = useRouter();
  const setDocument = useDocumentStore((s) => s.setDocument);
  const currentPlan = usePlanStore((s) => s.currentPlan);
  const { locale } = useI18n();
  const isJa = locale !== "en";

  // saved doc 読み込みは hydration 後に (SSR 時の window 参照を避ける)
  const [saved, setSaved] = useState<ReturnType<typeof loadFromLocalStorage>>(null);
  useEffect(() => {
    setSaved(loadFromLocalStorage());
  }, []);

  const handleResume = () => {
    const doc = loadFromLocalStorage();
    if (doc) { setDocument(doc); router.push("/editor"); }
  };
  const openEditorBlank = () => {
    setDocument(createDefaultDocument("blank", getTemplateLatex("blank")));
    router.push("/editor?new=1");
  };

  const handlePlanSelect = async (planId: PlanIdLite) => {
    try {
      const { getSession, signIn } = await import("next-auth/react");
      const session = await getSession();
      if (!session) {
        sessionStorage.setItem("pending_plan", planId);
        signIn("google", { callbackUrl: "/?plan=" + planId });
        return;
      }
    } catch (e) {
      console.error("[MobileGate handlePlanSelect] auth error:", e);
      toast.error(isJa ? "ログインの確認に失敗しました" : "Login check failed");
      return;
    }
    // Stripe Checkout に飛ばす
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId }),
      });
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      console.error("[MobileGate checkout] error:", e);
    }
  };

  const planName = PLANS[currentPlan]?.name ?? "";

  const primaryCta = (() => {
    if (currentPlan === "free") {
      if (saved) {
        return {
          label: isJa ? "続きから編集" : "Resume editing",
          subLabel: isJa ? saved.metadata.title || "無題の教材" : saved.metadata.title || "Untitled",
          onClick: handleResume,
          variant: "resume" as const,
        };
      }
      return {
        label: isJa ? "無料で始める" : "Get started free",
        subLabel: isJa ? "カード不要 · 30秒で最初の1枚" : "No credit card · First sheet in 30s",
        onClick: () => handlePlanSelect("free"),
        variant: "free" as const,
      };
    }
    if (saved) {
      return {
        label: isJa ? `続きから編集 (${planName})` : `Resume editing (${planName})`,
        subLabel: isJa ? saved.metadata.title || "無題の教材" : saved.metadata.title || "Untitled",
        onClick: handleResume,
        variant: "resume" as const,
      };
    }
    return {
      label: isJa ? "白紙で始める" : "Start a new worksheet",
      subLabel: isJa ? `${planName}プランでエディタへ` : `Open editor on ${planName}`,
      onClick: openEditorBlank,
      variant: "paid-new" as const,
    };
  })();

  const scrollToPricing = () => {
    if (typeof document !== "undefined") {
      document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
    }
  };
  const scrollToSample = () => {
    if (typeof document !== "undefined") {
      document.getElementById("sample-output")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <MobileLanding
      primaryCta={primaryCta}
      scrollToPricing={scrollToPricing}
      scrollToSample={scrollToSample}
      EditorMockup={EditorMockup}
      FigureDrawMockup={FigureDrawMockup}
      onPlanSelect={handlePlanSelect}
    />
  );
}
