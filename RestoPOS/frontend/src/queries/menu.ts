import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { menuService } from "@/services/menu.service";
import { addonKeys, categoryKeys, menuItemKeys } from "./keys";

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

export function useAddons(activeOnly = true) {
  return useQuery({
    queryKey: addonKeys.list(activeOnly),
    queryFn: () => menuService.addons(activeOnly),
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
  return () =>
    queryClient.invalidateQueries({ queryKey: menuItemKeys.all });
}

function invalidateAddons(queryClient: QueryClient) {
  return () =>
    queryClient.invalidateQueries({ queryKey: addonKeys.all });
}

/* ------------------------------- categories ------------------------------ */

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const invalidate = invalidateCategoriesAndMenu(queryClient);
  return useMutation({
    mutationFn: menuService.createCategory,
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
      payload: Parameters<typeof menuService.updateCategory>[1];
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

export function useReorderCategories() {
  const queryClient = useQueryClient();
  const invalidate = invalidateCategoriesAndMenu(queryClient);
  return useMutation({
    mutationFn: menuService.reorderCategories,
    onSuccess: invalidate,
  });
}

/* -------------------------------- menu items ----------------------------- */

export function useCreateMenuItem() {
  const queryClient = useQueryClient();
  const invalidate = invalidateCategoriesAndMenu(queryClient);
  return useMutation({
    mutationFn: menuService.createMenuItem,
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
      payload: Parameters<typeof menuService.updateMenuItem>[1];
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
    mutationFn: ({
      categoryId,
      orderedIds,
    }: {
      categoryId: string;
      orderedIds: string[];
    }) => menuService.reorderMenuItems(categoryId, orderedIds),
    onSuccess: invalidate,
  });
}

/* -------------------------------- modifiers ------------------------------ */

export function useCreateModifier() {
  const queryClient = useQueryClient();
  const invalidate = invalidateMenuItems(queryClient);
  return useMutation({
    mutationFn: menuService.createModifier,
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
      payload: Parameters<typeof menuService.updateModifier>[1];
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

/* -------------------------------- add-ons -------------------------------- */

export function useCreateAddon() {
  const queryClient = useQueryClient();
  const invalidate = invalidateAddons(queryClient);
  return useMutation({
    mutationFn: menuService.createAddon,
    onSuccess: invalidate,
  });
}

export function useUpdateAddon() {
  const queryClient = useQueryClient();
  const invalidate = invalidateAddons(queryClient);
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof menuService.updateAddon>[1];
    }) => menuService.updateAddon(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteAddon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: menuService.deleteAddon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addonKeys.all });
      queryClient.invalidateQueries({ queryKey: menuItemKeys.all });
    },
  });
}

export function useAttachAddon() {
  const queryClient = useQueryClient();
  const invalidate = invalidateMenuItems(queryClient);
  return useMutation({
    mutationFn: ({
      menuItemId,
      addonId,
    }: {
      menuItemId: string;
      addonId: string;
    }) => menuService.attachAddon(menuItemId, addonId),
    onSuccess: invalidate,
  });
}

export function useDetachAddon() {
  const queryClient = useQueryClient();
  const invalidate = invalidateMenuItems(queryClient);
  return useMutation({
    mutationFn: ({
      menuItemId,
      addonId,
    }: {
      menuItemId: string;
      addonId: string;
    }) => menuService.detachAddon(menuItemId, addonId),
    onSuccess: invalidate,
  });
}

/* --------------------------------- recipe -------------------------------- */

export function useUpsertRecipe() {
  const queryClient = useQueryClient();
  const invalidate = invalidateMenuItems(queryClient);
  return useMutation({
    mutationFn: menuService.upsertRecipe,
    onSuccess: invalidate,
  });
}
