import { ImageResponse } from "next/og";

// PWA icons generated at build time with ImageResponse (no extra dependencies), drawn from the
// same book glyph as src/app/icon.svg. "icon-*" has rounded corners (purpose "any"); "maskable-*"
// is full bleed with the glyph inside the 80% safe zone so any launcher mask keeps it visible.
const files = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "maskable-192.png": { size: 192, maskable: true },
  "maskable-512.png": { size: 512, maskable: true },
} as const;

type IconFile = keyof typeof files;

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return (Object.keys(files) as IconFile[]).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const spec = Object.hasOwn(files, file) ? files[file as IconFile] : null;
  if (!spec) return new Response("Not found", { status: 404 });

  const { size, maskable } = spec;
  // The glyph spans 10..54 of the 64-unit viewBox of icon.svg; scale it down for the safe zone.
  const glyph = Math.round(size * (maskable ? 0.56 : 0.72));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1d595d",
          borderRadius: maskable ? 0 : Math.round(size / 4),
        }}
      >
        <svg width={glyph} height={glyph} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M32 20c-7-4-14-4-19-2v28c6-2 12-1 19 3 7-4 13-5 19-3V18c-5-2-12-2-19 2Zm0 0v29"
            fill="none"
            stroke="#faf7f0"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
