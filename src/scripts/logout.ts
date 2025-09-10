// src/scripts/logout.ts
import { EXTERNAL } from "@/constant";
import { logout } from "@/lib/utils";

// Only run in browser
if (typeof window !== "undefined") {
  logout(EXTERNAL.directus_url);
}
