import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";

export interface ViewEntry {
  path: string;
  label: string;
  icon: string;
  component: LazyExoticComponent<ComponentType>;
}

export const views: ViewEntry[] = [
  {
    path: "/workspace",
    label: "Workspace",
    icon: "Workspaces",
    component: lazy(() => import("./Workspace")),
  },
  {
    path: "/dashboard",
    label: "Dashboard",
    icon: "Analytics",
    component: lazy(() => import("./Insights")),
  },
  {
    path: "/ai",
    label: "Dispatch",
    icon: "RocketLaunch",
    component: lazy(() => import("./Dispatch")),
  },
  {
    path: "/tools",
    label: "Tools",
    icon: "Extension",
    component: lazy(() => import("./Tools")),
  },
  {
    path: "/settings",
    label: "Settings",
    icon: "Settings",
    component: lazy(() => import("./Settings")),
  },
];
