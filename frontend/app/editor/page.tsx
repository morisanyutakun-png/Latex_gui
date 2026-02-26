"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Toolbar } from "@/components/layout/toolbar";
import { DocumentEditor } from "@/components/editor/document-editor";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";
import { useAutosave } from "@/hooks/use-autosave";
import { useDocumentStore } from "@/store/document-store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function EditorPage() {
  useKeyboardShortcuts();
  useAutosave();

  const document = useDocumentStore((s) => s.document);
  const router = useRouter();

  // Redirect to home if no document loaded
  useEffect(() => {
    if (!document) {
      router.push("/");
    }
  }, [document, router]);

  // エディタを開いた瞬間にバックエンド (Koyeb) を起こす
  // コールドスタート時はコンテナ起動に10-30秒かかるため、
  // PDF生成ボタンを押す前に事前にウォームアップしておく
  useEffect(() => {
    const warmup = async () => {
      try {
        // health エンドポイントを叩いてコンテナを起動させる
        await fetch("/api/health", { signal: AbortSignal.timeout(15000) });
      } catch {
        // 失敗しても問題ない — PDF生成時にリトライされる
      }
    };
    warmup();
  }, []);

  if (!document) return null;

  return (
    <div className="flex h-screen flex-col bg-secondary/30 dark:bg-background">
      <AppHeader />
      <Toolbar />
      <DocumentEditor />
    </div>
  );
}
