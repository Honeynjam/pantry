"use client";

import dynamic from "next/dynamic";

// The app is a client-only SPA over Convex (the same screens ship in the Tauri app), so skip SSR.
export const ClientRoot = dynamic(() => import("./client-app"), { ssr: false });
