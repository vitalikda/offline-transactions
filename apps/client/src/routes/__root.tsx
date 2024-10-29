import { Outlet, createRootRoute } from "@tanstack/react-router";
import { QueryProvider } from "../components/QueryClientProvider";

export const Route = createRootRoute({
  component: () => (
    <QueryProvider>
      <Outlet />
    </QueryProvider>
  ),
});
