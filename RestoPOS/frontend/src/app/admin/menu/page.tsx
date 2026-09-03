import { MenuBomBuilder } from "@/components/admin/menu-bom-builder";
import { CategoryManager } from "@/components/admin/category-manager";
import { DisplayOrderManager } from "@/components/admin/display-order-manager";

export default function Page() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-black">سازنده منو و BOM</h1>
      <DisplayOrderManager />
      <CategoryManager />
      <MenuBomBuilder />
    </div>
  );
}
