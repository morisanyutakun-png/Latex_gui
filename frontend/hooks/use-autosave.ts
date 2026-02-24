"use client";

import { useEffect, useRef } from "react";
import { saveToLocalStorage } from "@/lib/storage";
import { useDocumentStore } from "@/store/document-store";

export function useAutosave(intervalMs = 10000) {
  const document = useDocumentStore((s) => s.document);
  const timer = useRef<ReturnType<typeof setInterval>>(null);

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
}
