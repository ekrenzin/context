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
    path: "/solutions",
    label: "Solutions",
    icon: "Lightbulb",
    component: lazy(() => import("./Solutions")),
  },
  {
    path: "/projects",
    label: "Projects",
    icon: "Folder",
    component: lazy(() => import("./Projects")),
  },
  {
    path: "/session-logs",
    label: "Session Logs",
    icon: "History",
    component: lazy(() => import("./SessionLogs")),
  },
  {
    path: "/insights",
    label: "Insights",
    icon: "TipsAndUpdates",
    component: lazy(() => import("./Insights")),
  },
  {
    path: "/processes",
    label: "Processes",
    icon: "Memory",
    component: lazy(() => import("./Processes")),
  },
  {
    path: "/settings",
    label: "Settings",
    icon: "Settings",
    component: lazy(() => import("./Settings")),
  },
];
