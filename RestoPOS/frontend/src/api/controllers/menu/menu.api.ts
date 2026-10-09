import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/axios";
import { addonKeys, categoryKeys, menuItemKeys } from "@/api/keys";
import type {
  AddonDto,
  CategoryDto,
  MenuItemDto,
  ModifierDto,
  ModifierGroupDto,
  RecipeDto,
} from "@/lib/types";

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

/** MenuController — `api/menu` (categories, items, modifiers, add-ons, recipes). */
export const menuApi = {
  /* ------------------------------ categories ----------------------------- */
  categories: (includeHidden = false) =>
    apiClient
      .get<CategoryDto[]>("/api/menu/categories", { params: { includeHidden } })
      .then((r) => r.data),

  categoryById: (id: string) =>
    apiClient
      .get<CategoryDto>(`/api/menu/categories/${id}`)
      .then((r) => r.data),

  createCategory: (payload: CreateCategoryRequest) =>
    apiClient.post<string>("/api/menu/categories", payload).then((r) => r.data),

  updateCategory: (id: string, payload: UpdateCategoryRequest) =>
    apiClient
      .put<void>(`/api/menu/categories/${id}`, payload)
      .then((r) => r.data),

  deleteCategory: (id: string) =>
    apiClient
      .delete<void>(`/api/menu/categories/${id}`)
      .then((r) => r.data),

  /** Backend route is `categories/reorder` (not `/order`). */
  reorderCategories: (orderedIds: string[]) =>
    apiClient
      .put<void>("/api/menu/categories/reorder", { orderedIds })
      .then((r) => r.data),

  /* ------------------------------- menu items ---------------------------- */
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

  toggleSoldOut: (id: string, isSoldOut: boolean) =>
    apiClient
      .post<void>(`/api/menu/items/${id}/sold-out`, { id, isSoldOut })
      .then((r) => r.data),

  /**
   * NOTE: the backend MenuController has no `items/order` route, so this call
   * currently 404s. Kept as-is to preserve existing behaviour.
   */
  reorderMenuItems: (categoryId: string, orderedIds: string[]) =>
    apiClient
      .put<void>("/api/menu/items/order", { categoryId, orderedIds })
      .then((r) => r.data),

  /* ------------------------------- modifiers ----------------------------- */
  createModifier: (payload: Record<string, unknown>) =>
    apiClient.post<string>("/api/menu/modifiers", payload).then((r) => r.data),

  updateModifier: (id: string, payload: UpdateModifierRequest) =>
    apiClient
      .put<void>(`/api/menu/modifiers/${id}`, { ...payload, id })
      .then((r) => r.data),

  deleteModifier: (id: string) =>
    apiClient.delete<void>(`/api/menu/modifiers/${id}`).then((r) => r.data),

  /* ----------------------------- modifier groups -------------------------- */
  modifierGroups: (menuItemId: string) =>
    apiClient
      .get<ModifierGroupDto[]>(
        `/api/menu/items/${menuItemId}/modifier-groups`,
      )
      .then((r) => r.data),

  createModifierGroup: (payload: Record<string, unknown>) =>
    apiClient
      .post<string>("/api/menu/modifier-groups", payload)
      .then((r) => r.data),

  updateModifierGroup: (id: string, payload: Record<string, unknown>) =>
    apiClient
      .put<void>(`/api/menu/modifier-groups/${id}`, { ...payload, id })
      .then((r) => r.data),

  deleteModifierGroup: (id: string) =>
    apiClient
      .delete<void>(`/api/menu/modifier-groups/${id}`)
      .then((r) => r.data),

  addModifierGroupOption: (groupId: string, payload: Record<string, unknown>) =>
    apiClient
      .post<string>(`/api/menu/modifier-groups/${groupId}/options`, payload)
      .then((r) => r.data),

  /* --------------------------------- recipes ------------------------------ */
  upsertRecipe: (payload: Record<string, unknown>) =>
    apiClient.put<string>("/api/menu/recipes", payload).then((r) => r.data),

  recipe: (menuItemId: string) =>
    apiClient
      .get<RecipeDto | null>(`/api/menu/items/${menuItemId}/recipe`)
      .then((r) => r.data),

  deleteRecipe: (id: string) =>
    apiClient.delete<void>(`/api/menu/recipes/${id}`).then((r) => r.data),

  /* ------------------------------ shared add-ons -------------------------- */
  /**
   * NOTE: the backend has an `Addon` entity but NO `api/menu/addons*` routes,
   * so these calls currently 404. Kept as-is to preserve existing behaviour.
   */
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
};

/* ------------------------------ invalidation ----------------------------- */

function invalidateCategoriesAndMenu(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return () => {
    queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    queryClient.invalidateQueries({ queryKey: menuItemKeys.all });
  };
}

function invalidateMenuItems(queryClient: ReturnType<typeof useQueryClient>) {
  return () =>
    queryClient.invalidateQueries({ queryKey: menuItemKeys.all });
}

function invalidateAddons(queryClient: ReturnType<typeof useQueryClient>) {
  return () => queryClient.invalidateQueries({ queryKey: addonKeys.all });
}

/* --------------------------------- reads --------------------------------- */

export function useCategories(includeHidden = false) {
  return useQuery({
    queryKey: categoryKeys.list(includeHidden),
    queryFn: () => menuApi.categories(includeHidden),
  });
}

export function useCategory(id: string | null) {
  return useQuery({
    queryKey: categoryKeys.detail(id ?? ""),
    queryFn: () => menuApi.categoryById(id as string),
    enabled: Boolean(id),
  });
}

export function useMenuItems(activeOnly = true) {
  return useQuery({
    queryKey: menuItemKeys.list(activeOnly),
    queryFn: () => menuApi.menuItems(activeOnly),
  });
}

export function useMenuItem(id: string | null) {
  return useQuery({
    queryKey: menuItemKeys.detail(id ?? ""),
    queryFn: () => menuApi.menuItem(id as string),
    enabled: Boolean(id),
  });
}

export function useModifierGroups(menuItemId: string | null) {
  return useQuery({
    queryKey: menuItemKeys.groups(menuItemId ?? ""),
    queryFn: () => menuApi.modifierGroups(menuItemId as string),
    enabled: Boolean(menuItemId),
  });
}

export function useRecipe(menuItemId: string | null) {
  return useQuery({
    queryKey: menuItemKeys.recipe(menuItemId ?? ""),
    queryFn: () => menuApi.recipe(menuItemId as string),
    enabled: Boolean(menuItemId),
  });
}

export function useAddons(activeOnly = true) {
  return useQuery({
    queryKey: addonKeys.list(activeOnly),
    queryFn: () => menuApi.addons(activeOnly),
  });
}

/* ------------------------------- categories ------------------------------ */

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: menuApi.createCategory,
    onSuccess: invalidateCategoriesAndMenu(queryClient),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateCategoryRequest;
    }) => menuApi.updateCategory(id, payload),
    onSuccess: invalidateCategoriesAndMenu(queryClient),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: menuApi.deleteCategory,
    onSuccess: invalidateCategoriesAndMenu(queryClient),
  });
}

export function useReorderCategories() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: menuApi.reorderCategories,
    onSuccess: invalidateCategoriesAndMenu(queryClient),
  });
}

/* -------------------------------- menu items ----------------------------- */

export function useCreateMenuItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: menuApi.createMenuItem,
    onSuccess: invalidateCategoriesAndMenu(queryClient),
  });
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateMenuItemRequest;
    }) => menuApi.updateMenuItem(id, payload),
    onSuccess: invalidateCategoriesAndMenu(queryClient),
  });
}

export function useDeleteMenuItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: menuApi.deleteMenuItem,
    onSuccess: invalidateCategoriesAndMenu(queryClient),
  });
}

export function useReorderMenuItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      categoryId,
      orderedIds,
    }: {
      categoryId: string;
      orderedIds: string[];
    }) => menuApi.reorderMenuItems(categoryId, orderedIds),
    onSuccess: invalidateCategoriesAndMenu(queryClient),
  });
}

export function useToggleSoldOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isSoldOut }: { id: string; isSoldOut: boolean }) =>
      menuApi.toggleSoldOut(id, isSoldOut),
    onSuccess: invalidateMenuItems(queryClient),
  });
}

/* -------------------------------- modifiers ------------------------------ */

export function useCreateModifier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: menuApi.createModifier,
    onSuccess: invalidateMenuItems(queryClient),
  });
}

export function useUpdateModifier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateModifierRequest;
    }) => menuApi.updateModifier(id, payload),
    onSuccess: invalidateMenuItems(queryClient),
  });
}

export function useDeleteModifier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: menuApi.deleteModifier,
    onSuccess: invalidateMenuItems(queryClient),
  });
}

export function useCreateModifierGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: menuApi.createModifierGroup,
    onSuccess: invalidateMenuItems(queryClient),
  });
}

export function useUpdateModifierGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => menuApi.updateModifierGroup(id, payload),
    onSuccess: invalidateMenuItems(queryClient),
  });
}

export function useDeleteModifierGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: menuApi.deleteModifierGroup,
    onSuccess: invalidateMenuItems(queryClient),
  });
}

export function useAddModifierGroupOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      payload,
    }: {
      groupId: string;
      payload: Record<string, unknown>;
    }) => menuApi.addModifierGroupOption(groupId, payload),
    onSuccess: invalidateMenuItems(queryClient),
  });
}

/* --------------------------------- add-ons ------------------------------- */

export function useCreateAddon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: menuApi.createAddon,
    onSuccess: invalidateAddons(queryClient),
  });
}

export function useUpdateAddon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => menuApi.updateAddon(id, payload),
    onSuccess: invalidateAddons(queryClient),
  });
}

export function useDeleteAddon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: menuApi.deleteAddon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addonKeys.all });
      queryClient.invalidateQueries({ queryKey: menuItemKeys.all });
    },
  });
}

export function useAttachAddon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      menuItemId,
      addonId,
    }: {
      menuItemId: string;
      addonId: string;
    }) => menuApi.attachAddon(menuItemId, addonId),
    onSuccess: invalidateMenuItems(queryClient),
  });
}

export function useDetachAddon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      menuItemId,
      addonId,
    }: {
      menuItemId: string;
      addonId: string;
    }) => menuApi.detachAddon(menuItemId, addonId),
    onSuccess: invalidateMenuItems(queryClient),
  });
}

/* --------------------------------- recipe -------------------------------- */

export function useUpsertRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: menuApi.upsertRecipe,
    onSuccess: invalidateMenuItems(queryClient),
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: menuApi.deleteRecipe,
    onSuccess: invalidateMenuItems(queryClient),
  });
}
