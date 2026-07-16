"use client";

function chipColor(amount: number): { ring: string; face: string; edge: string } {
  if (amount < 25) return { ring: "#e5e7eb", face: "#f8fafc", edge: "#94a3b8" };
  if (amount < 100) return { ring: "#dc2626", face: "#ef4444", edge: "#7f1d1d" };
  if (amount < 500) return { ring: "#059669", face: "#10b981", edge: "#064e3b" };
  if (amount < 2000) return { ring: "#1e293b", face: "#334155", edge: "#020617" };
  return { ring: "#7c3aed", face: "#a78bfa", edge: "#4c1d95" };
}

function ChipCoin({ amount, size }: { amount: number; size: number }) {
  const c = chipColor(amount);
  return (
    <div
      className="relative rounded-full shadow-md"
      style={{
        width: size,
        height: size,
        background: `repeating-conic-gradient(${c.ring} 0deg 22.5deg, ${c.face} 22.5deg 45deg)`,
        border: `2px solid ${c.edge}`,
      }}
    >
      <div
        className="absolute rounded-full"
        style={{
          inset: size * 0.16,
          background: c.face,
          border: `1px solid ${c.edge}66`,
        }}
      />
    </div>
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
