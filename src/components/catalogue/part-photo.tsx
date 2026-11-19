import { ImageIcon } from "lucide-react";
import { cn } from "cn";

const SIZES = { sm: "size-9", md: "size-12", lg: "size-40" } as const;

/**
 * A part's photo in a small white square, or a faint placeholder when it has none.
 * Photos come from the catalogue on a white background, so the square stays white
 * in both themes.
 */
export function PartPhoto({
  photo,
  size = "sm",
  className,
}: {
  photo: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const box = cn("shrink-0 overflow-hidden rounded-md border", SIZES[size], className);
  if (!photo) {
    return (
      <span className={cn(box, "flex items-center justify-center border-dashed text-muted-foreground/50")} aria-hidden>
        <ImageIcon className={size === "lg" ? "size-8" : "size-4"} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- private, signed-in image; next/image would proxy and cache it publicly
    <img
      src={`/photos/${photo}`}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn(box, "bg-white object-contain p-0.5")}
    />
  );
}
