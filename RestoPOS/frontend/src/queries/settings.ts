import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsService } from "@/services/settings.service";
import { settingsKeys } from "./keys";

export interface UseSettingsOptions {
  enabled?: boolean;
}

/** Current store settings (shared by admin, POS header and theme engine). */
export function useSettings(options?: UseSettingsOptions) {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: settingsService.get,
    enabled: options?.enabled,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsService.update,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}
