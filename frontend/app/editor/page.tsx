"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";
import { useAutosave } from "@/hooks/use-autosave";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CanvasArea } from "@/components/canvas/canvas-area";
import { PropertyPanel } from "@/components/panels/property-panel";

export default function EditorPage() {
  const router = useRouter();
  const document = useDocumentStore((s) => s.document);

  useKeyboardShortcuts();
  useAutosave();

  useEffect(() => {
    if (!document) {
      router.replace("/");
    }
  }, [document, router]);

  if (!document) return null;

  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <CanvasArea />
        <PropertyPanel />
      </div>
    </div>
  );
}
