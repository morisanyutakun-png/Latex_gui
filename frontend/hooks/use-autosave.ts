"use client";

import { useEffect, useRef } from "react";
import { useDocumentStore } from "@/store/document-store";
import { saveToLocalStorage } from "@/lib/storage";

const INTERVAL_MS = 10_000; // 10秒ごとに自動保存

/**
 * 自動保存フック
 * ドキュメント変更を監視し、一定間隔で localStorage に保存
 */
export function useAutosave() {
  const document = useDocumentStore((s) => s.document);
  const savedRef = useRef<string>("");

  useEffect(() => {
    if (!document) return;

    const timer = setInterval(() => {
      const json = JSON.stringify(document);
      if (json !== savedRef.current) {
        saveToLocalStorage(document);
        savedRef.current = json;
      }
    }, INTERVAL_MS);

    return () => clearInterval(timer);
  }, [document]);
}
