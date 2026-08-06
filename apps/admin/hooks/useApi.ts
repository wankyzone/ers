import { useMemo } from "react";
import { createApiClient } from "@/lib/api";

export function useApi() {
  return useMemo(() => createApiClient(), []);
}
