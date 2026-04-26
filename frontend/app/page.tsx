import { Suspense } from "react";
import { TemplateGallery } from "@/components/template/template-gallery";

export default function Home() {
  return (
    <Suspense>
      <TemplateGallery />
    </Suspense>
  );
}
