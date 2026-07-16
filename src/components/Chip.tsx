"use client";

function chipImage(amount: number): string {
  if (amount < 25) return "/images/chip-white.webp";
  if (amount < 100) return "/images/chip-red.webp";
  if (amount < 500) return "/images/chip-green.webp";
  if (amount < 2000) return "/images/chip-black.webp";
  return "/images/chip-purple.webp";
}

function ChipCoin({ amount, size }: { amount: number; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={chipImage(amount)}
      alt=""
      draggable={false}
      width={size}
      height={size}
      className="pointer-events-none select-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]"
      style={{ width: size, height: size }}
    />
  );
}

export function ChipStack({ amount, size = 16 }: { amount: number; size?: number }) {
  const layers = Math.min(4, 1 + Math.floor(Math.log10(Math.max(amount, 1) + 1)));
  return (
    <div className="relative" style={{ width: size, height: size + (layers - 1) * (size * 0.22) }}>
      {Array.from({ length: layers }).map((_, i) => (
        <div key={i} className="absolute left-0" style={{ bottom: i * size * 0.22 }}>
          <ChipCoin amount={amount} size={size} />
        </div>
      ))}
    </div>
  );
}
