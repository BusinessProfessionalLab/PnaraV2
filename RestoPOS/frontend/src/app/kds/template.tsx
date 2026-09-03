import { RouteView } from "@/components/route-view";

export default function KdsTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  // Animate between the KDS board pages (/kds ⇄ /kds/kitchen).
  return <RouteView mode="path">{children}</RouteView>;
}
