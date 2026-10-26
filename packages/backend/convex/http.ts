import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Lazy registration: createAuth only runs per request, so a missing
// BETTER_AUTH_SECRET never breaks `convex deploy`.
authComponent.registerRoutesLazy(http, createAuth);

export default http;
