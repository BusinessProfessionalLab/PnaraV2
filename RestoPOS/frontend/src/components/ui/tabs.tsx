"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

export const Tabs = TabsPrimitive.Root;
export const TabsList = ({ className, ...props }: TabsPrimitive.TabsListProps) => (
  <TabsPrimitive.List
    className={cn(
      "inline-flex flex-wrap items-center gap-1 rounded-xl bg-muted p-1",
      className,
    )}
    {...props}
  />
);
export const TabsTrigger = ({ className, ...props }: TabsPrimitive.TabsTriggerProps) => (
  <TabsPrimitive.Trigger
    className={cn(
      "rounded-lg px-3.5 py-1.5 text-[13px] font-semibold text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
);
export const TabsContent = TabsPrimitive.Content;
