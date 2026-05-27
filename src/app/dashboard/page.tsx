import { Suspense } from "react";
import DashboardClient from "@/components/DashboardClient";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-text-secondary">Loading Dashboard...</div>}>
      <DashboardClient />
    </Suspense>
  );
}
