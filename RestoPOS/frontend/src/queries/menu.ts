import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { menuService } from "@/services/menu.service";
import type {
  AddOptionToGroupRequest,
  CategoryOrderItem,
  CreateCategoryRequest,
  CreateMenuItemRequest,
  CreateModifierGroupRequest,
  CreateModifierRequest,
  UpdateCategoryRequest,
  UpdateMenuItemRequest,
  UpdateModifierGroupRequest,
  UpdateModifierRequest,
  UpsertRecipeRequest,
} from "@/services/menu.service";
import type { MenuItemDto } from "@/lib/types";
import { categoryKeys, menuItemKeys, modifierGroupKeys, recipeKeys } from "./keys";

/* --------------------------------- reads --------------------------------- */

export function useCategories(includeHidden = false) {
  return useQuery({
    queryKey: categoryKeys.list(includeHidden),
    queryFn: () => menuService.categories(includeHidden),
  });
}

export function useMenuItems(activeOnly = true) {
  return useQuery({
    queryKey: menuItemKeys.list(activeOnly),
    queryFn: () => menuService.menuItems(activeOnly),
  });
}

export function useMenuItem(id: string | null) {
  return useQuery({
    queryKey: menuItemKeys.detail(id ?? "none"),
    queryFn: () => menuService.menuItem(id as string),
    enabled: Boolean(id),
  });
}

export function useModifierGroups(menuItemId: string | null) {
  return useQuery({
    queryKey: modifierGroupKeys.byItem(menuItemId ?? "none"),
    queryFn: () => menuService.modifierGroups(menuItemId as string),
    enabled: Boolean(menuItemId),
  });
}

export function useRecipe(menuItemId: string | null) {
  return useQuery({
    queryKey: recipeKeys.byItem(menuItemId ?? "none"),
    queryFn: () => menuService.recipe(menuItemId as string),
    enabled: Boolean(menuItemId),
  });
}

/* ------------------------------ invalidation ------------------------------ */

function invalidateCategoriesAndMenu(queryClient: QueryClient) {
  return () => {
    queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    queryClient.invalidateQueries({ queryKey: menuItemKeys.all });
  };
}

function invalidateMenuItems(queryClient: QueryClient) {
  return () => {
    queryClient.invalidateQueries({ queryKey: menuItemKeys.all });
    queryClient.invalidateQueries({ queryKey: modifierGroupKeys.all });
  };
}

/* ------------------------------- categories ------------------------------ */

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const invalidate = invalidateCategoriesAndMenu(queryClient);
  return useMutation({
    mutationFn: (payload: CreateCategoryRequest) => menuService.createCategory(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const invalidate = invalidateCategoriesAndMenu(queryClient);
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Omit<UpdateCategoryRequest, "id">;
    }) => menuService.updateCategory(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const invalidate = invalidateCategoriesAndMenu(queryClient);
  return useMutation({
    mutationFn: menuService.deleteCategory,
    onSuccess: invalidate,
  });
}

/** Persists the dragged order; index becomes the 1-based display priority. */
export function useReorderCategories() {
  const queryClient = useQueryClient();
  const invalidate = invalidateCategoriesAndMenu(queryClient);
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      menuService.reorderCategories(
        orderedIds.map((id, index) => ({ id, displayPriority: index + 1 }) satisfies CategoryOrderItem),
      ),
    onSuccess: invalidate,
  });
}

/* -------------------------------- menu items ----------------------------- */

export function useCreateMenuItem() {
  const queryClient = useQueryClient();
  const invalidate = invalidateCategoriesAndMenu(queryClient);
  return useMutation({
    mutationFn: (payload: CreateMenuItemRequest) => menuService.createMenuItem(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient();
  const invalidate = invalidateCategoriesAndMenu(queryClient);
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Omit<UpdateMenuItemRequest, "id">;
    }) => menuService.updateMenuItem(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteMenuItem() {
  const queryClient = useQueryClient();
  const invalidate = invalidateCategoriesAndMenu(queryClient);
  return useMutation({
    mutationFn: menuService.deleteMenuItem,
    onSuccess: invalidate,
  });
}

export function useReorderMenuItems() {
  const queryClient = useQueryClient();
  const invalidate = invalidateCategoriesAndMenu(queryClient);
  return useMutation({
    mutationFn: (items: MenuItemDto[]) => menuService.reorderMenuItems(items),
    onSuccess: invalidate,
  });
}

/** Kitchen/bar availability switch used during service. */
export function useToggleSoldOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isSoldOut }: { id: string; isSoldOut: boolean }) =>
      menuService.toggleSoldOut(id, isSoldOut),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: menuItemKeys.all }),
  });
}

/* -------------------------------- modifiers ------------------------------ */

export function useCreateModifier() {
  const queryClient = useQueryClient();
  const invalidate = invalidateMenuItems(queryClient);
  return useMutation({
    mutationFn: (payload: CreateModifierRequest) => menuService.createModifier(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateModifier() {
  const queryClient = useQueryClient();
  const invalidate = invalidateMenuItems(queryClient);
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Omit<UpdateModifierRequest, "id">;
    }) => menuService.updateModifier(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteModifier() {
  const queryClient = useQueryClient();
  const invalidate = invalidateMenuItems(queryClient);
  return useMutation({
    mutationFn: menuService.deleteModifier,
    onSuccess: invalidate,
  });
}

/* ----------------------------- add-on groups ----------------------------- */

export function useCreateModifierGroup() {
  const queryClient = useQueryClient();
  const invalidate = invalidateMenuItems(queryClient);
  return useMutation({
    mutationFn: (payload: CreateModifierGroupRequest) => menuService.createModifierGroup(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateModifierGroup() {
  const queryClient = useQueryClient();
  const invalidate = invalidateMenuItems(queryClient);
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Omit<UpdateModifierGroupRequest, "id">;
    }) => menuService.updateModifierGroup(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteModifierGroup() {
  const queryClient = useQueryClient();
  const invalidate = invalidateMenuItems(queryClient);
  return useMutation({
    mutationFn: menuService.deleteModifierGroup,
    onSuccess: invalidate,
  });
}

export function useAddOptionToGroup() {
  const queryClient = useQueryClient();
  const invalidate = invalidateMenuItems(queryClient);
  return useMutation({
    mutationFn: ({ groupId, payload }: { groupId: string; payload: AddOptionToGroupRequest }) =>
      menuService.addOptionToGroup(groupId, payload),
    onSuccess: invalidate,
  });
}

/* --------------------------------- recipe -------------------------------- */

export function useUpsertRecipe() {
  const queryClient = useQueryClient();
  const invalidate = invalidateMenuItems(queryClient);
  return useMutation({
    mutationFn: (payload: UpsertRecipeRequest) => menuService.upsertRecipe(payload),
    onSuccess: invalidate,
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  const invalidate = invalidateMenuItems(queryClient);
  return useMutation({
    mutationFn: menuService.deleteRecipe,
    onSuccess: invalidate,
  });
}
