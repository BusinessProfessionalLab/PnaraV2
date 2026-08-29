import { AdminShell } from "@/components/admin/admin-shell";
import { AuthGate } from "@/components/auth-gate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AdminShell>{children}</AdminShell>
    </AuthGate>
  );
}
