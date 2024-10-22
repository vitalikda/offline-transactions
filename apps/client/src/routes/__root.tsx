import { Button } from "@/components/ui/button";
import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { QueryProvider } from "../components/QueryClientProvider";
import { SolanaProvider } from "../components/SolanaProvider";
import { WalletConnect } from "../components/WalletConnect";

export const Route = createRootRoute({
  component: () => (
    <QueryProvider>
      <SolanaProvider>
        <WalletConnect>
          <div className="p-4 flex flex-col gap-8">
            <nav className="p-2 flex gap-2">
              <Button variant="ghost" asChild>
                <Link to="/" className="[&.active]:font-bold">
                  Client Only
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/async" className="[&.active]:font-bold">
                  Client + Server
                </Link>
              </Button>
            </nav>
            <main>
              <Outlet />
            </main>
          </div>
        </WalletConnect>
      </SolanaProvider>
    </QueryProvider>
  ),
});
