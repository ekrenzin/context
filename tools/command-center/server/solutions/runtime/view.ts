interface DynamicView {
  name: string;
  path: string;
  label: string;
}

const views = new Map<string, DynamicView>();

export function registerDynamicView(name: string, routePath: string, label: string): void {
  views.set(name, { name, path: routePath, label });
}

export function unregisterDynamicView(name: string): void {
  views.delete(name);
}

export function getDynamicViews(): Array<{ name: string; path: string; label: string }> {
  return Array.from(views.values());
}
