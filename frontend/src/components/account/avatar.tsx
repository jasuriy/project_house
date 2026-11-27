// A person's round picture: their photo, or the first letter of their name on the badge colour
// (as on the profile design) when there is none. Email accounts start without a photo.

const SIZES = {
  24: "h-[24px] w-[24px] text-cap", // feed card footer
  36: "h-[36px] w-[36px] text-body", // header account menu
  40: "h-[40px] w-[40px] text-h", // project page byline
  96: "h-[96px] w-[96px] text-title", // profile page
} as const;

export function Avatar({ name, src, size, className = "" }: { name: string; src: string | null; size: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-badge font-semibold text-primary-ink ${SIZES[size]} ${className}`}
    >
      {src ? (
        // A plain img: the photo may live on another site (GitHub, step 4) that next/image would
        // first have to be told about.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        Array.from(name.trim())[0]?.toUpperCase() // a whole character, even an emoji
      )}
    </span>
  );
}
