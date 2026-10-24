import type { ReactNode } from "react";

/**
 * Wooden-panel card primitive (ui.md): chunky border + stepped pixel shadow.
 */
export function PixelPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`pixel-shadow border-4 border-wood-dark bg-parchment p-4 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Shared scaffold for the (empty-for-now) route pages so the app runs and looks
 * on-theme at 375×812. Replaced by real screens in later milestones.
 */
export function PlaceholderScreen({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-screen-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <PixelPanel className="w-full">
        <h1 className="font-heading text-3xl text-wood-dark">{title}</h1>
        <p className="mt-2 text-wood-dark/80">{blurb}</p>
      </PixelPanel>
    </section>
  );
}
