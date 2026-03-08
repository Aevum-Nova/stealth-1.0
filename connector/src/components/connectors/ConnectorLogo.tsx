import { useState } from "react";

interface ConnectorLogoProps {
  icon: string;
  alt: string;
  className?: string;
}

export default function ConnectorLogo({ icon, alt, className = "" }: ConnectorLogoProps) {
  const [hasError, setHasError] = useState(false);
  const src = `/connector-icons/${icon}.svg`;

  if (hasError) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-md bg-[var(--surface-brand)] text-xs font-semibold uppercase text-[var(--ink-soft)] ${className}`}
        aria-label={alt}
      >
        {alt.slice(0, 1)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}
