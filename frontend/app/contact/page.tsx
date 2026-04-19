import type { Metadata } from "next";
import { ContactContent } from "./content";

export const metadata: Metadata = {
  title: "お問い合わせ | Contact",
  description: "Eddivom へのお問い合わせ窓口 / Contact support for Eddivom.",
};

export default function ContactPage() {
  return <ContactContent />;
}
