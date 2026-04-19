import type { Metadata } from "next";
import { TermsContent } from "./content";

export const metadata: Metadata = {
  title: "利用規約 | Terms of Service",
  description: "Eddivom の利用規約 / Terms of Service for Eddivom.",
};

export default function TermsPage() {
  return <TermsContent />;
}
