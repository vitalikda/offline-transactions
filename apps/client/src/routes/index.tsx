import { Button } from "@/components/ui/button";
import { Link, createFileRoute, linkOptions } from "@tanstack/react-router";

const options = [
  linkOptions({
    to: "/sol",
    label: "Solana",
  }),
  linkOptions({
    to: "/eth",
    label: "Ethereum",
  }),
];

function IndexPage() {
  return (
    <div className="p-4 flex flex-wrap gap-4">
      {options.map((item) => (
        <Button
          key={item.label}
          variant="secondary"
          size="icon"
          asChild
          className="w-48 h-48"
        >
          <Link to={item.to}>
            <h2 className="text-2xl font-bold text-center">{item.label}</h2>
          </Link>
        </Button>
      ))}
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: IndexPage,
});
