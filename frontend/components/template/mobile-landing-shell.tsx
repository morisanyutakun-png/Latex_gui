"use client";

/**
 * MobileLandingShell — モバイル LP の独立エントリポイント。
 *
 * これを app/page.tsx から (UA がモバイルのときだけ) dynamic import することで、
 * 3554 行ある PC 版 TemplateGallery のコードがモバイル bundle に流入するのを防ぐ。
 * モバイルユーザの初期 JS は MobileLanding + lp-mockups + ここで使うストア程度に絞られ、
 * Lighthouse の TBT・LCP・「未使用 JS」が大幅に改善する。
 *
 * 動作仕様 (CTA 文言・フロー) は TemplateGallery のモバイル分岐と完全一致させる。
 */

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useDocumentStore } from "@/store/document-store";
import { usePlanStore } from "@/store/plan-store";
import { loadFromLocalStorage } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
import { hasUsedAnonymousTrial } from "@/lib/anonymous-trial";
import { trackFreeGenerateLimitReached, trackFreeTrialCtaClick } from "@/lib/gtag";
import { PLANS } from "@/lib/plans";
import { MobileLanding } from "./mobile-landing";

// `@/lib/templates` (5880 行の LaTeX テンプレ) と `@/lib/types` の createDefaultDocument は、
// CTA 押下後にしか使わないので click handler 側で動的 import する。
// LP 初期 hydration では import しないことで、モバイルの初期 JS が ~100 KiB 前後 軽くなる。
async function loadDocFactory() {
  const [templates, types] = await Promise.all([
    import("@/lib/templates"),
    import("@/lib/types"),
  ]);
  return { getTemplateLatex: templates.getTemplateLatex, createDefaultDocument: types.createDefaultDocument };
}

// sonner の toast も初期 LP には不要。エラー時にだけ呼ぶので動的 import で外す。
async function loadToast() {
  const m = await import("sonner");
  return m.toast;
}

// AnonymousTrialModal は radix Dialog + 翻訳まわりを抱える重いコンポーネント。
// open=true になるのは「お試し済みで CTA を再度押した」レアケースだけなので
// dynamic import で初期 JS から外す。
const AnonymousTrialModal = dynamic(
  () => import("./anonymous-trial-modal").then((m) => m.AnonymousTrialModal),
  { ssr: false, loading: () => null },
);

export function MobileLandingShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setDocument = useDocumentStore((s) => s.setDocument);
  const currentPlan = usePlanStore((s) => s.currentPlan);
  const [trialOpen, setTrialOpen] = useState(false);
  const [trialAlreadyUsed, setTrialAlreadyUsed] = useState(false);

  const { locale } = useI18n();
  const isJa = locale !== "en";
  const { status: sessionStatus } = useSession();
  const savedRaw = typeof window !== "undefined" ? loadFromLocalStorage() : null;
  const saved = sessionStatus === "authenticated" ? savedRaw : null;

  const scrollToPricing = () => {
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
  };
  const scrollToSample = () => {
    document.getElementById("sample-output")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleResume = () => {
    const doc = loadFromLocalStorage();
    if (doc) { setDocument(doc); router.push("/editor"); }
  };

  const openEditorBlank = async () => {
    const { getTemplateLatex, createDefaultDocument } = await loadDocFactory();
    setDocument(createDefaultDocument("blank", getTemplateLatex("blank")));
    router.push("/editor?new=1");
  };

  const redirectToCheckout = async (planId: string) => {
    try {
      const { createCheckoutSession } = await import("@/lib/subscription-api");
      const result = await createCheckoutSession(planId as "starter" | "pro" | "premium");
      if (result.action === "already_on_plan") {
        const toast = await loadToast();
        toast.success(
          isJa
            ? `すでに${PLANS[(result.currentPlan || "free") as keyof typeof PLANS]?.name ?? ""}プランをご契約中です。エディタに移動します。`
            : `You already have the ${PLANS[(result.currentPlan || "free") as keyof typeof PLANS]?.name ?? ""} plan. Taking you to the editor.`,
        );
        const { getTemplateLatex, createDefaultDocument } = await loadDocFactory();
        const doc = loadFromLocalStorage() || createDefaultDocument("blank", getTemplateLatex("blank"));
        setDocument(doc);
        router.push("/editor");
        return;
      }
      window.location.href = result.url;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[redirectToCheckout] error:", msg);
      const toast = await loadToast();
      toast.error("決済ページの取得に失敗しました: " + msg);
    }
  };

  const handlePlanSelect = async (planId: "free" | "starter" | "pro" | "premium") => {
    try {
      const { getSession, signIn } = await import("next-auth/react");
      const session = await getSession();
      if (!session) {
        sessionStorage.setItem("pending_plan", planId);
        signIn("google", { callbackUrl: "/?plan=" + planId });
        return;
      }
    } catch (e) {
      console.error("[handlePlanSelect] auth error:", e);
      const toast = await loadToast();
      toast.error("ログインの確認に失敗しました");
      return;
    }
    await redirectToCheckout(planId);
  };

  const openTrialOrLimit = (placement: string = "hero") => {
    trackFreeTrialCtaClick({ placement });
    if (hasUsedAnonymousTrial()) {
      setTrialAlreadyUsed(true);
      trackFreeGenerateLimitReached();
      setTrialOpen(true);
      return;
    }
    setTrialAlreadyUsed(false);
    router.push("/editor?guest=1");
  };

  const handleTrialLoginRequested = () => {
    setTrialOpen(false);
    handlePlanSelect("free");
  };

  // ?plan=... / ?checkout=success のフォールバック処理。TemplateGallery と同一仕様。
  // 通常の LP 閲覧ではこの分岐は走らないので、`templates`/`types` の動的 import で OK。
  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      const plan = searchParams.get("plan") || "";
      const sid = searchParams.get("session_id") || "";
      window.history.replaceState({}, "", "/");
      void loadDocFactory().then(({ getTemplateLatex, createDefaultDocument }) => {
        const doc = loadFromLocalStorage() || createDefaultDocument("blank", getTemplateLatex("blank"));
        setDocument(doc);
        const qs = new URLSearchParams({ checkout: "success" });
        if (plan) qs.set("plan", plan);
        if (sid) qs.set("session_id", sid);
        router.push(`/editor?${qs.toString()}`);
      });
      return;
    }

    const planFromUrl = searchParams.get("plan");
    const planFromStorage = sessionStorage.getItem("pending_plan");
    const pendingPlan = planFromUrl || planFromStorage;
    if (pendingPlan && ["free", "starter", "pro", "premium"].includes(pendingPlan)) {
      sessionStorage.removeItem("pending_plan");
      window.history.replaceState({}, "", "/");
      redirectToCheckout(pendingPlan);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const primaryCta = React.useMemo(() => {
    const planName = PLANS[currentPlan]?.name ?? "";
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
        label: isJa ? "無料で1枚作ってみる" : "Generate one free",
        subLabel: isJa ? "ログインなし · 30〜60秒で1枚" : "No signup · 30–60s per sheet",
        onClick: () => openTrialOrLimit("hero"),
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlan, saved, isJa, sessionStatus]);

  return (
    <>
      <MobileLanding
        primaryCta={primaryCta}
        scrollToPricing={scrollToPricing}
        scrollToSample={scrollToSample}
        onPlanSelect={handlePlanSelect}
      />
      <AnonymousTrialModal
        open={trialOpen}
        onOpenChange={setTrialOpen}
        onLoginRequested={handleTrialLoginRequested}
        alreadyUsed={trialAlreadyUsed}
      />
    </>
  );
}
