import type { Metadata } from "next";
import { RefundsContent } from "./content";

export const metadata: Metadata = {
  title: "返金ポリシー | Refund Policy",
  description: "Eddivom の返金・キャンセルポリシー / Refund and cancellation policy for Eddivom.",
};

export default function RefundsPage() {
  return <RefundsContent />;
}
