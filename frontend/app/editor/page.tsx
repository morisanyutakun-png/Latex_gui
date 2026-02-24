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

  if (!document) return null;

  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader />
      <Toolbar />
      <DocumentEditor />
    </div>
  );
}
