import { AuthGate } from "@/components/auth-gate";
import { PosRegister } from "@/components/pos/pos-register";

export default function PosPage() {
  return (
    <AuthGate>
      <PosRegister />
    </AuthGate>
  );
}
