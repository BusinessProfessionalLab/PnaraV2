import { apiClient } from "@/api/client";
import type { AddonDto, CategoryDto, MenuItemDto, ModifierDto } from "@/lib/types";

export interface CreateCategoryRequest {
  name: string;
  nameEn: string | null;
  displayPriority: number;
  isVisible: boolean;
  iconUrl: string | null;
  imageUrl: string | null;
  parentId: string | null;
}

export type UpdateCategoryRequest = Partial<CategoryDto>;
export type UpdateMenuItemRequest = Partial<MenuItemDto>;
export type UpdateModifierRequest = Partial<ModifierDto>;

/** Menu domain: categories, products, modifiers, shared add-ons, recipes. */
export const menuService = {
  /* ------------------------------ categories ------------------------------ */
  categories: (includeHidden = false) =>
    apiClient
      .get<CategoryDto[]>("/api/menu/categories", { params: { includeHidden } })
      .then((r) => r.data),

  createCategory: (payload: CreateCategoryRequest) =>
    apiClient.post<string>("/api/menu/categories", payload).then((r) => r.data),

  updateCategory: (id: string, payload: UpdateCategoryRequest) =>
    apiClient.put<void>(`/api/menu/categories/${id}`, payload).then((r) => r.data),

  deleteCategory: (id: string) =>
    apiClient.delete<void>(`/api/menu/categories/${id}`).then((r) => r.data),

  reorderCategories: (orderedIds: string[]) =>
    apiClient
      .put<void>("/api/menu/categories/order", { orderedIds })
      .then((r) => r.data),

  /* ------------------------------- menu items ----------------------------- */
  menuItems: (activeOnly = true) =>
    apiClient
      .get<MenuItemDto[]>("/api/menu/items", { params: { activeOnly } })
      .then((r) => r.data),

  menuItem: (id: string) =>
    apiClient.get<MenuItemDto>(`/api/menu/items/${id}`).then((r) => r.data),

  createMenuItem: (payload: Record<string, unknown>) =>
    apiClient.post<string>("/api/menu/items", payload).then((r) => r.data),

  updateMenuItem: (id: string, payload: UpdateMenuItemRequest) =>
    apiClient
      .put<void>(`/api/menu/items/${id}`, { ...payload, id })
      .then((r) => r.data),

  deleteMenuItem: (id: string) =>
    apiClient.delete<void>(`/api/menu/items/${id}`).then((r) => r.data),

  reorderMenuItems: (categoryId: string, orderedIds: string[]) =>
    apiClient
      .put<void>("/api/menu/items/order", { categoryId, orderedIds })
      .then((r) => r.data),

  /* ------------------------------ modifiers ------------------------------- */
  createModifier: (payload: Record<string, unknown>) =>
    apiClient.post<string>("/api/menu/modifiers", payload).then((r) => r.data),

  updateModifier: (id: string, payload: UpdateModifierRequest) =>
    apiClient
      .put<void>(`/api/menu/modifiers/${id}`, { ...payload, id })
      .then((r) => r.data),

  deleteModifier: (id: string) =>
    apiClient.delete<void>(`/api/menu/modifiers/${id}`).then((r) => r.data),

  /* ------------------------------ shared add-ons -------------------------- */
  addons: (activeOnly = true) =>
    apiClient
      .get<AddonDto[]>("/api/menu/addons", { params: { activeOnly } })
      .then((r) =>
        // Present shared add-ons through the same lens as menu modifiers so
        // POS/ordering code can treat both uniformly.
        r.data.map((a) => ({ ...a, title: a.name, basePrice: a.extraPrice })),
      ),

  createAddon: (payload: Record<string, unknown>) =>
    apiClient.post<string>("/api/menu/addons", payload).then((r) => r.data),

  updateAddon: (id: string, payload: Record<string, unknown>) =>
    apiClient
      .put<void>(`/api/menu/addons/${id}`, { ...payload, id })
      .then((r) => r.data),

  deleteAddon: (id: string) =>
    apiClient.delete<void>(`/api/menu/addons/${id}`).then((r) => r.data),

  attachAddon: (menuItemId: string, addonId: string) =>
    apiClient
      .post<void>(`/api/menu/items/${menuItemId}/addons/${addonId}`)
      .then((r) => r.data),

  detachAddon: (menuItemId: string, addonId: string) =>
    apiClient
      .delete<void>(`/api/menu/items/${menuItemId}/addons/${addonId}`)
      .then((r) => r.data),

  /* -------------------------------- recipes ------------------------------- */
  upsertRecipe: (payload: Record<string, unknown>) =>
    apiClient.put<string>("/api/menu/recipes", payload).then((r) => r.data),
};
