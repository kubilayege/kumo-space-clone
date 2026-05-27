import { Suspense } from "react";
import { SpaceRoom } from "@/components/SpaceRoom";

interface SpacePageProps {
  params: Promise<{ id: string }>;
}

export default async function SpacePage({ params }: SpacePageProps) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--paper)] text-[var(--ink-soft)]">
          Loading space...
        </div>
      }
    >
      <SpaceRoom spaceId={decodeURIComponent(id)} />
    </Suspense>
  );
}
