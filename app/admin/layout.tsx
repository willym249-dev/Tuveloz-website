import type { ReactNode } from "react";
import { OwnerDashboardGate } from "./owner-dashboard-gate";
import "./owner-dashboard-gate.css";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <OwnerDashboardGate>{children}</OwnerDashboardGate>;
}
