import { SolanaProvider } from "@/components/SolanaProvider";
import { Button } from "@/components/ui/button";
import { HomeIcon } from "@radix-ui/react-icons";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sol")({
  component: () => (
    <SolanaProvider>
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
              to="/sol"
              activeProps={{ className: "font-bold bg-accent" }}
              activeOptions={{ exact: true }}
            >
              Client Only
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link
              to="/sol/async"
              activeProps={{ className: "font-bold bg-accent" }}
              activeOptions={{ exact: true }}
            >
              Client + Server
            </Link>
          </Button>
        </nav>
        <main>
          <Outlet />
        </main>
      </div>
    </SolanaProvider>
  ),
});
