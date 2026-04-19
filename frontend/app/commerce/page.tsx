import type { Metadata } from "next";
import { CommerceContent } from "./content";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | Commerce Disclosure",
  description:
    "Eddivom の特定商取引法に基づく表記 / Legally required commerce disclosure for Eddivom.",
};

export default function CommercePage() {
  return <CommerceContent />;
}
