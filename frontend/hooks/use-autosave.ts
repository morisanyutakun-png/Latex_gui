"use client";

import { useEffect, useRef } from "react";
import { saveToLocalStorage, STORAGE_TAB_KEY, TAB_ID } from "@/lib/storage";
import { useDocumentStore } from "@/store/document-store";
import { useUIStore } from "@/store/ui-store";
import { toast } from "sonner";

export function useAutosave(intervalMs = 10000) {
  const document = useDocumentStore((s) => s.document);
  const isChatLoading = useUIStore((s) => s.isChatLoading);
  const timer = useRef<ReturnType<typeof setInterval>>(null);
  const lastConflictAlertRef = useRef<number>(0);

  useEffect(() => {
    timer.current = setInterval(() => {
      const doc = useDocumentStore.getState().document;
      if (doc) saveToLocalStorage(doc);
    }, intervalMs);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [intervalMs]);

  useEffect(() => {
    if (document) saveToLocalStorage(document);
  }, [document]);

  // タブクローズ警告: 進行中の AI ストリームがある間はブラウザ標準の確認ダイアログを表示する。
  // 通常の編集内容は本フック冒頭の immediate autosave で localStorage に随時保存済みだが、
  // AI 生成中のレスポンスは in-flight 状態で保存されないため、ここを失うユーザー影響が大きい。
  useEffect(() => {
    if (!isChatLoading) return;
    const handler = (e: BeforeUnloadEvent) => {
      // ほとんどのブラウザはメッセージ本文を無視し、確認ダイアログのみ表示する。
      // returnValue を設定するのは互換性のため。
      e.preventDefault();
      e.returnValue = "AI が応答を生成中です。このページを離れると処理が中断されます。";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isChatLoading]);

  // マルチタブ競合検知: 別タブが同じドキュメントを上書きしたら通知する。
  // autosave が tab id とタイムスタンプを書くので、storage event の key が
  // STORAGE_TAB_KEY で自タブ以外の ID が入っていたら「他タブが保存した」と判定する。
  // (reload で同期するかは ユーザー判断に任せる — 自動で上書きすると現在の編集を失う)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_TAB_KEY) return;
      if (!e.newValue || e.newValue === TAB_ID) return;
      // 短時間に連発する同じ通知を抑制 (AI 連続実行などで storm しないように)
      const now = Date.now();
      if (now - lastConflictAlertRef.current < 15000) return;
      lastConflictAlertRef.current = now;
      toast.warning("同じドキュメントが別のタブで編集されています。", {
        description: "保存内容が上書きされる可能性があります。作業は 1 タブに絞るか、リロードして最新を取り込んでください。",
        duration: 10000,
        action: {
          label: "リロード",
          onClick: () => window.location.reload(),
        },
      });
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
}
