"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/store/document-store";

export default function Home() {
  const router = useRouter();
  const initBlank = useDocumentStore((s) => s.initBlankDocument);

  useEffect(() => {
    initBlank();
    router.replace("/editor");
  }, [initBlank, router]);

  return null;
}
