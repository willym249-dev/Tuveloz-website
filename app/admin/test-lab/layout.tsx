import Link from "next/link";
import type { ReactNode } from "react";

export default function TestLabLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: "#07182d", minHeight: "100vh" }}>
      <nav
        aria-label="Tuveloz owner test tools"
        style={{
          alignItems: "center",
          background: "#111111",
          borderBottom: "1px solid #6d3d20",
          display: "flex",
          flexWrap: "wrap",
          gap: ".75rem",
          padding: ".75rem clamp(1rem, 4vw, 3rem)",
        }}
      >
        <strong style={{ color: "#f7f4f1", marginRight: ".4rem" }}>Owner Test Tools</strong>
        <Link href="/admin/test-lab" style={{ color: "#ff9a55", fontWeight: 800 }}>
          Workflow Test Lab
        </Link>
        <Link href="/admin/test-lab/ai" style={{ color: "#ff9a55", fontWeight: 800 }}>
          Tuveloz AI Test
        </Link>
        <Link href="/admin" style={{ color: "#c8c0ba", fontWeight: 700, marginLeft: "auto" }}>
          Owner Center
        </Link>
      </nav>
      {children}
    </div>
  );
}
