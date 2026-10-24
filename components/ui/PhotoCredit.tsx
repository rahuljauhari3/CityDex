import type { PhotoCredit as Credit } from "@/lib/db/types";

/** Attribution line for photos that aren't the user's own (CC licenses require it). */
export function PhotoCredit({ credit, className = "" }: { credit: Credit; className?: string }) {
  const external = credit.source.startsWith("http");
  return (
    <p className={`text-[11px] leading-snug text-wood-dark/75 ${className}`}>
      Photo: {credit.author} ·{" "}
      {credit.licenseUrl ? (
        <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">
          {credit.license}
        </a>
      ) : (
        credit.license
      )}
      {external && (
        <>
          {" · "}
          <a href={credit.source} target="_blank" rel="noopener noreferrer" className="underline">
            Wikimedia Commons
          </a>
        </>
      )}
    </p>
  );
}
