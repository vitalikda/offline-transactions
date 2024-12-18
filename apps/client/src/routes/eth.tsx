import { EthProvider } from "@/components/EthProvider";
import { Button } from "@/components/ui/button";
import { HomeIcon } from "@radix-ui/react-icons";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/eth")({
  component: () => (
    <EthProvider>
      <div className="p-4 flex flex-col gap-8">
        <nav className="p-2 flex gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link
              to="/"
              activeProps={{ className: "font-bold bg-accent" }}
              activeOptions={{ exact: true }}
            >
              <HomeIcon className="w-4 h-4" />
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link
              to="/eth"
              activeProps={{ className: "font-bold bg-accent" }}
              activeOptions={{ exact: true }}
            >
              Client Only
            </Link>
          </Button>
          <Button variant="ghost" disabled>
            Client + Server
          </Button>
        </nav>
        <main>
          <Outlet />
        </main>
      </div>
    </EthProvider>
  ),
});
