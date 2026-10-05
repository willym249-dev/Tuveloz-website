import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./repair-records.css";

export const metadata: Metadata = {
  title: "Estimate and invoice",
  robots: { index: false, follow: false },
};

export default function RepairRecordsLayout({ children }: { children: ReactNode }) {
  return children;
}
