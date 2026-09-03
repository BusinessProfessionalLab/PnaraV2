import { RouteView } from "@/components/route-view";

export default function AdminTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  // Animate the page area on every admin sub-page navigation while the
  // AdminShell (layout) stays put.
  return <RouteView mode="path">{children}</RouteView>;
}
