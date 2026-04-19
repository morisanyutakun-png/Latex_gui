import type { Metadata } from "next";
import { PrivacyContent } from "./content";

export const metadata: Metadata = {
  title: "プライバシーポリシー | Privacy Policy",
  description:
    "Eddivom のプライバシーポリシー / Eddivom's privacy policy — how we handle your personal information.",
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
