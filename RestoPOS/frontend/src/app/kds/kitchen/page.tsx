import { AuthGate } from "@/components/auth-gate";
import { KdsBoard } from "@/components/kds/kds-board";

export default function KitchenPage() {
  return (
    <AuthGate>
      <KdsBoard station="kitchen" />
    </AuthGate>
  );
}
