// Plain module (no "use client"): server components import it through `@pantry/app/routes`.
// Values imported from the package root are client references on the server and can't be called.

export const SETTINGS_SECTIONS = ["members", "projects", "labels", "statuses"] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const routes = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  setup: "/setup",
  project: (key: string) => `/projects/${encodeURIComponent(key)}`,
  board: (key: string) => `/projects/${encodeURIComponent(key)}/board`,
  projectSettings: (key: string) => `/projects/${encodeURIComponent(key)}/settings`,
  issue: (key: string) => `/issues/${encodeURIComponent(key)}`,
  settings: (section: SettingsSection = "members") => `/settings/${section}`,
} as const;
