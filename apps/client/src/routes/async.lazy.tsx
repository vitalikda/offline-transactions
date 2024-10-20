import { createLazyFileRoute } from "@tanstack/react-router";

function AsyncPage() {
  return (
    <div className="flex gap-4">
      <div className="p-8 bg-zinc-900 shadow-md max-w-fit">
        <h1 className="text-2xl font-bold">TODO</h1>
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute("/async")({
  component: AsyncPage,
});
