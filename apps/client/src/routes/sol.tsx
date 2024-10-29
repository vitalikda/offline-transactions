import { Button } from "@/components/ui/button";
import { HomeIcon } from "@radix-ui/react-icons";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { SolanaProvider } from "../components/SolanaProvider";
import { WalletConnect } from "../components/WalletConnect";

export const Route = createFileRoute("/sol")({
  component: () => (
    <SolanaProvider>
      <WalletConnect>
        <div className="p-4 flex flex-col gap-8">
          <nav className="p-2 flex gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link
                to="/"
                className="[&.active]:font-bold [&.active]:bg-accent"
              >
                <HomeIcon className="w-4 h-4" />
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link
                to="/sol"
                className="[&.active]:font-bold [&.active]:bg-accent"
              >
                Client Only
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link
                to="/sol/async"
                className="[&.active]:font-bold [&.active]:bg-accent"
              >
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
  ),
});
