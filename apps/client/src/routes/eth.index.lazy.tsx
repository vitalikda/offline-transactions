import { createLazyFileRoute } from "@tanstack/react-router";

function IndexPage() {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="p-8 bg-zinc-900 shadow-md w-full md:w-1/3">WIP</div>
    </div>
  );
}

export const Route = createLazyFileRoute("/eth/")({
  component: IndexPage,
});
