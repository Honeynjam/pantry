"use client";

import { createContext, useContext } from "react";

/** Product strings for the showcase, passed in by the app (they live only in backend's brand.ts). */
export type DesignBrand = { name: string; defaultKey: string; tokenPrefix: string };

const DesignBrandContext = createContext<DesignBrand>({ name: "App", defaultKey: "APP", tokenPrefix: "app_" });

export const DesignBrandProvider = DesignBrandContext;
export const useDesignBrand = () => useContext(DesignBrandContext);
