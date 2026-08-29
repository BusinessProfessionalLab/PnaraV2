import { AuthGate } from "@/components/auth-gate";
import { KdsBoard } from "@/components/kds/kds-board";

export default function KdsPage() {
  return (
    <AuthGate>
      <KdsBoard station="bar" />
    </AuthGate>
  );
}
