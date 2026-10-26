"use client";

// Client-only React screens, hooks and providers. No next/* imports: this package must build
// statically for Tauri (M5). Hosts provide routing through NavigationProvider.
export { NavigationProvider, routes, type LinkProps, type Navigation } from "./navigation";
export { PantryProviders, useAuthClient } from "./providers";
export { createPantryAuthClient, type PantryAuthClient } from "./auth-client";
export { EntryGate, useEntryState, type EntryState } from "./entry";
export { deriveEntryState, type SetupStatus } from "./entry-state";
export { SignInPage } from "./screens/sign-in";
export { SignUpPage } from "./screens/sign-up";
export { SetupPage } from "./screens/setup";
export { HomePage } from "./screens/home";
export { ProjectPage } from "./screens/project";
export { LoadingScreen } from "./screens/loading";
