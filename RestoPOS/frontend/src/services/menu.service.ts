import { apiClient } from "@/api/client";
import type {
  BaseUnit,
  CategoryDto,
  MenuItemDto,
  ModifierGroupDto,
  RecipeDto,
  TicketStation,
} from "@/lib/types";

export interface CreateCategoryRequest {
  name: string | null;
  nameEn: string | null;
  displayPriority: number;
  isVisible: boolean;
  iconUrl: string | null;
  imageUrl: string | null;
  parentId: string | null;
}

export interface UpdateCategoryRequest extends CreateCategoryRequest {
  id: string;
}

export interface CategoryOrderItem {
  id: string;
  displayPriority: number;
}

export interface CreateMenuItemRequest {
  title: string | null;
  description: string | null;
  basePrice: number;
  taxInclusive: boolean;
  imageUrl: string | null;
  displayPriority: number;
  categoryId: string;
  isActive: boolean;
  ticketStation: TicketStation;
  prepTimeMinutes: number;
}

export interface UpdateMenuItemRequest extends CreateMenuItemRequest {
  id: string;
}

export interface CreateModifierRequest {
  menuItemId: string;
  name: string | null;
  extraPrice: number;
  ticketStation: TicketStation;
  displayPriority: number;
  modifierGroupId: string | null;
}

export interface UpdateModifierRequest {
  id: string;
  name: string | null;
  extraPrice: number;
  ticketStation: TicketStation;
  displayPriority: number;
  isActive: boolean;
  modifierGroupId: string | null;
}

export interface CreateModifierGroupRequest {
  menuItemId: string;
  name: string | null;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  displayPriority: number;
}

export interface UpdateModifierGroupRequest {
  id: string;
  name: string | null;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  displayPriority: number;
  isActive: boolean;
}

export interface AddOptionToGroupRequest {
  modifierGroupId: string;
  name: string | null;
  extraPrice: number;
  ticketStation: TicketStation;
  displayPriority: number;
}

export interface UpsertRecipeRequest {
  menuItemId: string | null;
  menuItemModifierId: string | null;
  name: string | null;
  lines: { inventoryItemId: string; quantity: number; unit: BaseUnit }[];
}

/** Menu domain: categories, products, modifiers, add-on groups, recipes. */
export const menuService = {
  /* ------------------------------ categories ------------------------------ */
  categories: (includeHidden?: boolean) =>
    apiClient
      .get<CategoryDto[]>("/api/menu/categories", {
        params: includeHidden === undefined ? undefined : { includeHidden },
      })
      .then((r) => r.data),

  category: (id: string) =>
    apiClient.get<CategoryDto>(`/api/menu/categories/${id}`).then((r) => r.data),

  createCategory: (payload: CreateCategoryRequest) =>
    apiClient.post<string>("/api/menu/categories", payload).then((r) => r.data),

  updateCategory: (id: string, payload: Omit<UpdateCategoryRequest, "id">) =>
    apiClient
      .put<void>(`/api/menu/categories/${id}`, { ...payload, id } satisfies UpdateCategoryRequest)
      .then((r) => r.data),

  deleteCategory: (id: string) =>
    apiClient.delete<void>(`/api/menu/categories/${id}`).then((r) => r.data),

  /** Persists a new display order: `displayPriority` is 1-based. */
  reorderCategories: (items: CategoryOrderItem[]) =>
    apiClient
      .put<void>("/api/menu/categories/reorder", { items } satisfies {
        items: CategoryOrderItem[];
      })
      .then((r) => r.data),

  /* ------------------------------- menu items ----------------------------- */
  menuItems: (activeOnly = true) =>
    apiClient
      .get<MenuItemDto[]>("/api/menu/items", { params: { activeOnly } })
      .then((r) => r.data),

  menuItem: (id: string) =>
    apiClient.get<MenuItemDto>(`/api/menu/items/${id}`).then((r) => r.data),

  createMenuItem: (payload: CreateMenuItemRequest) =>
    apiClient.post<string>("/api/menu/items", payload).then((r) => r.data),

  updateMenuItem: (id: string, payload: Omit<UpdateMenuItemRequest, "id">) =>
    apiClient
      .put<void>(`/api/menu/items/${id}`, { ...payload, id } satisfies UpdateMenuItemRequest)
      .then((r) => r.data),

  deleteMenuItem: (id: string) =>
    apiClient.delete<void>(`/api/menu/items/${id}`).then((r) => r.data),

  /** Sold-out flag is the only field this endpoint touches. */
  toggleSoldOut: (id: string, isSoldOut: boolean) =>
    apiClient
      .post<void>(`/api/menu/items/${id}/sold-out`, { isSoldOut } satisfies {
        isSoldOut: boolean;
      })
      .then((r) => r.data),

  /* ------------------------------ modifiers ------------------------------- */
  createModifier: (payload: CreateModifierRequest) =>
    apiClient.post<string>("/api/menu/modifiers", payload).then((r) => r.data),

  updateModifier: (id: string, payload: Omit<UpdateModifierRequest, "id">) =>
    apiClient
      .put<void>(`/api/menu/modifiers/${id}`, { ...payload, id } satisfies UpdateModifierRequest)
      .then((r) => r.data),

  deleteModifier: (id: string) =>
    apiClient.delete<void>(`/api/menu/modifiers/${id}`).then((r) => r.data),

  /* --------------------------- modifier groups ---------------------------- */
  modifierGroups: (menuItemId: string) =>
    apiClient
      .get<ModifierGroupDto[]>(`/api/menu/items/${menuItemId}/modifier-groups`)
      .then((r) => r.data),

  createModifierGroup: (payload: CreateModifierGroupRequest) =>
    apiClient.post<string>("/api/menu/modifier-groups", payload).then((r) => r.data),

  updateModifierGroup: (id: string, payload: Omit<UpdateModifierGroupRequest, "id">) =>
    apiClient
      .put<void>(`/api/menu/modifier-groups/${id}`, {
        ...payload,
        id,
      } satisfies UpdateModifierGroupRequest)
      .then((r) => r.data),

  deleteModifierGroup: (id: string) =>
    apiClient.delete<void>(`/api/menu/modifier-groups/${id}`).then((r) => r.data),

  addOptionToGroup: (groupId: string, payload: AddOptionToGroupRequest) =>
    apiClient
      .post<string>(`/api/menu/modifier-groups/${groupId}/options`, payload)
      .then((r) => r.data),

  /* -------------------------------- recipes ------------------------------- */
  upsertRecipe: (payload: UpsertRecipeRequest) =>
    apiClient.put<string>("/api/menu/recipes", payload).then((r) => r.data),

  recipe: (menuItemId: string) =>
    apiClient
      .get<RecipeDto>(`/api/menu/items/${menuItemId}/recipe`)
      .then((r) => r.data),

  deleteRecipe: (id: string) =>
    apiClient.delete<void>(`/api/menu/recipes/${id}`).then((r) => r.data),

  /**
   * Product display order has no bulk endpoint (unlike categories), so each
   * item is re-saved with its new `displayPriority` — 1-based, in list order.
   */
  reorderMenuItems: async (items: MenuItemDto[]) => {
    await Promise.all(
      items.map((item, index) =>
        menuService.updateMenuItem(item.id, {
          title: item.title,
          description: item.description,
          basePrice: item.basePrice,
          taxInclusive: item.taxInclusive,
          imageUrl: item.imageUrl,
          displayPriority: index + 1,
          categoryId: item.categoryId,
          isActive: item.isActive,
          ticketStation: item.ticketStation,
          prepTimeMinutes: item.prepTimeMinutes,
        }),
      ),
    );
  },
};
