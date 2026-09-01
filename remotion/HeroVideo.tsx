import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

/* ============================================================================
   EG Stores: hero showcase (seamless 8s loop @ 30fps).
   All motion is periodic; periods divide the 8s duration so it loops cleanly.
   Pure inline styles (no Tailwind dependency inside the Remotion bundle).
   ========================================================================== */

const INDIGO = "#4f46e5";
const VIOLET = "#7c3aed";
const CYAN = "#06b6d4";
const INK = "#0c0a1e";
const PANEL = "rgba(255,255,255,0.04)";
const GLASS_BORDER = "rgba(255,255,255,0.12)";
const TEXT = "#f4f4fb";
const SUBTLE = "rgba(244,244,251,0.62)";
const FONT = "'Outfit', 'Work Sans', -apple-system, system-ui, sans-serif";

// Sine oscillator that completes `cycles` full cycles over the whole loop,
// guaranteeing a seamless wrap. Returns -1..1.
const useLoop = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames; // 0..1 across the loop
  return { t, frame, total: durationInFrames };
};

const osc = (t: number, cycles: number, phase = 0) =>
  Math.sin((t * cycles + phase) * Math.PI * 2);

/* --------------------------------- Aurora -------------------------------- */
const Blob: React.FC<{
  t: number;
  color: string;
  size: number;
  x: number;
  y: number;
  cycles: number;
  phase: number;
}> = ({ t, color, size, x, y, cycles, phase }) => {
  const dx = osc(t, cycles, phase) * 90;
  const dy = osc(t, cycles, phase + 0.25) * 70;
  const scale = 1 + osc(t, cycles, phase) * 0.12;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 68%)`,
        filter: "blur(70px)",
        transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
        opacity: 0.75,
      }}
    />
  );
};

/* ------------------------------- Stat tile ------------------------------- */
const StatTile: React.FC<{
  label: string;
  value: string;
  delta: string;
  accent: string;
  t: number;
  phase: number;
}> = ({ label, value, delta, accent, t, phase }) => {
  const pulse = 0.5 + 0.5 * osc(t, 2, phase);
  return (
    <div
      style={{
        flex: 1,
        background: PANEL,
        border: `1px solid ${GLASS_BORDER}`,
        borderRadius: 18,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: accent,
            boxShadow: `0 0 ${6 + pulse * 10}px ${accent}`,
          }}
        />
        <span style={{ color: SUBTLE, fontSize: 18, letterSpacing: 0.3 }}>{label}</span>
      </div>
      <span style={{ color: TEXT, fontSize: 38, fontWeight: 700, letterSpacing: -0.5 }}>
        {value}
      </span>
      <span style={{ color: accent, fontSize: 17, fontWeight: 600 }}>{delta}</span>
    </div>
  );
};

/* ------------------------------- Bar chart ------------------------------- */
const BarChart: React.FC<{ t: number }> = ({ t }) => {
  const bars = [0.55, 0.72, 0.48, 0.86, 0.64, 0.93, 0.7, 0.82, 0.6, 0.95, 0.74, 0.88];
  return (
    <div
      style={{
        flex: 1.4,
        background: PANEL,
        border: `1px solid ${GLASS_BORDER}`,
        borderRadius: 18,
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: TEXT, fontSize: 20, fontWeight: 600 }}>Revenue by category</span>
        <span style={{ color: SUBTLE, fontSize: 16 }}>Last 12 weeks</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 150 }}>
        {bars.map((b, i) => {
          const h = b + osc(t, 1, i * 0.08) * 0.08;
          const clamped = Math.max(0.12, Math.min(1, h));
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${clamped * 100}%`,
                borderRadius: 8,
                background: `linear-gradient(180deg, ${CYAN} 0%, ${INDIGO} 100%)`,
                opacity: 0.92,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------- Scrolling sparkline --------------------------- */
const Sparkline: React.FC<{ t: number }> = ({ t }) => {
  const w = 520;
  const h = 150;
  const pts = 24;
  // Build a smooth repeating wave path (two tiles wide for seamless scroll).
  const sample = (i: number) =>
    h * 0.55 -
    Math.sin(i * 0.55) * h * 0.22 -
    Math.sin(i * 0.21 + 1.3) * h * 0.14;
  let d = `M 0 ${sample(0).toFixed(1)}`;
  for (let i = 1; i <= pts * 2; i++) {
    const x = (i / pts) * (w / 2);
    d += ` L ${x.toFixed(1)} ${sample(i).toFixed(1)}`;
  }
  const shift = -((t % 1) * (w / 2));
  return (
    <div
      style={{
        flex: 1,
        background: PANEL,
        border: `1px solid ${GLASS_BORDER}`,
        borderRadius: 18,
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: TEXT, fontSize: 20, fontWeight: 600 }}>Live sales</span>
        <span style={{ color: CYAN, fontSize: 16, fontWeight: 600 }}>● realtime</span>
      </div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CYAN} stopOpacity="0.35" />
            <stop offset="100%" stopColor={CYAN} stopOpacity="0" />
          </linearGradient>
        </defs>
        <g transform={`translate(${shift},0)`}>
          <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill="url(#spark)" />
          <path d={d} fill="none" stroke={CYAN} strokeWidth={3} strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
};

/* ------------------------------ App window ------------------------------- */
const navIcons = ["▦", "◫", "▤", "◑", "⚇", "⚙"];

const AppWindow: React.FC<{ t: number }> = ({ t }) => {
  const sweep = ((t * 2) % 1); // two shimmer passes per loop
  return (
    <div
      style={{
        position: "relative",
        width: 1180,
        borderRadius: 28,
        background: "rgba(18,16,40,0.72)",
        border: `1px solid ${GLASS_BORDER}`,
        boxShadow: "0 50px 120px -30px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08)",
        backdropFilter: "blur(18px)",
        overflow: "hidden",
        display: "flex",
      }}
    >
      {/* shimmer sweep */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: 380,
          left: `${interpolate(sweep, [0, 1], [-30, 130])}%`,
          background: "linear-gradient(105deg, transparent, rgba(255,255,255,0.10), transparent)",
          transform: "skewX(-18deg)",
          pointerEvents: "none",
        }}
      />
      {/* sidebar */}
      <div
        style={{
          width: 86,
          padding: "26px 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
          background: "rgba(255,255,255,0.03)",
          borderRight: `1px solid ${GLASS_BORDER}`,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${INDIGO}, ${VIOLET}, ${CYAN})`,
            boxShadow: `0 10px 24px -6px ${INDIGO}`,
          }}
        />
        {navIcons.map((ic, i) => (
          <div
            key={i}
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              color: i === 0 ? TEXT : SUBTLE,
              background: i === 0 ? "rgba(124,58,237,0.22)" : "transparent",
            }}
          >
            {ic}
          </div>
        ))}
      </div>

      {/* main */}
      <div style={{ flex: 1, padding: 30, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ color: TEXT, fontSize: 26, fontWeight: 700 }}>Dashboard</span>
            <span style={{ color: SUBTLE, fontSize: 16 }}>Tuesday, all systems live</span>
          </div>
          <div
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              background: `linear-gradient(135deg, ${INDIGO}, ${VIOLET})`,
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            + New sale
          </div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <StatTile label="Revenue today" value="Rs 48,250" delta="▲ 12.4%" accent={CYAN} t={t} phase={0} />
          <StatTile label="Orders" value="1,284" delta="▲ 8.1%" accent={VIOLET} t={t} phase={0.33} />
          <StatTile label="Low stock" value="23 items" delta="auto-reorder on" accent="#f59e0b" t={t} phase={0.66} />
          <StatTile label="Staff on shift" value="9 / 12" delta="3 cashiers" accent={INDIGO} t={t} phase={0.5} />
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <BarChart t={t} />
          <Sparkline t={t} />
        </div>
      </div>
    </div>
  );
};

/* ----------------------------- Floating card ----------------------------- */
const FloatCard: React.FC<{
  t: number;
  cycles: number;
  phase: number;
  style: React.CSSProperties;
  children: React.ReactNode;
}> = ({ t, cycles, phase, style, children }) => {
  const dy = osc(t, cycles, phase) * 16;
  const rot = osc(t, cycles, phase + 0.1) * 1.5;
  return (
    <div
      style={{
        position: "absolute",
        transform: `translateY(${dy}px) rotate(${rot}deg)`,
        background: "rgba(20,18,44,0.82)",
        border: `1px solid ${GLASS_BORDER}`,
        borderRadius: 18,
        boxShadow: "0 30px 70px -25px rgba(0,0,0,0.7)",
        backdropFilter: "blur(14px)",
        padding: "16px 20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const Avatar: React.FC<{ c: string; left: number }> = ({ c, left }) => (
  <div
    style={{
      position: "absolute",
      left,
      width: 34,
      height: 34,
      borderRadius: "50%",
      background: c,
      border: "2px solid rgba(20,18,44,0.9)",
    }}
  />
);

/* -------------------------------- Hero ----------------------------------- */
export type HeroVideoProps = {
  showHeadline: boolean;
};

export const HeroVideo: React.FC<HeroVideoProps> = ({ showHeadline }) => {
  const { t } = useLoop();

  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 0%, #1b1740 0%, ${INK} 60%, #07060f 100%)`, fontFamily: FONT }}>
      {/* aurora */}
      <Blob t={t} color={INDIGO} size={780} x={-180} y={-220} cycles={1} phase={0} />
      <Blob t={t} color={VIOLET} size={720} x={1180} y={-160} cycles={1} phase={0.4} />
      <Blob t={t} color={CYAN} size={620} x={760} y={620} cycles={1} phase={0.7} />

      {/* subtle grid */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(120% 90% at 50% 35%, #000 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(120% 90% at 50% 35%, #000 30%, transparent 75%)",
          opacity: 0.5,
        }}
      />

      {/* headline */}
      {showHeadline && (
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 0,
          right: 0,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 18px",
            borderRadius: 999,
            border: `1px solid ${GLASS_BORDER}`,
            background: "rgba(255,255,255,0.05)",
            color: SUBTLE,
            fontSize: 18,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: CYAN }} />
          All-in-one business platform
        </div>
        <div style={{ color: TEXT, fontSize: 74, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>
          Run your whole business
          <br />
          <span
            style={{
              background: `linear-gradient(100deg, ${CYAN}, #a78bfa 55%, ${INDIGO})`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            from one place
          </span>
        </div>
      </div>
      )}

      {/* app window */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: showHeadline ? "flex-end" : "center",
          paddingBottom: showHeadline ? 40 : 0,
        }}
      >
        <div
          style={{
            transform: `translateY(${osc(t, 1, 0) * 8}px) scale(${showHeadline ? 1 : 1.06})`,
          }}
        >
          <AppWindow t={t} />
        </div>
      </AbsoluteFill>

      {/* floating feature cards */}
      <FloatCard t={t} cycles={1} phase={0.1} style={{ left: 90, top: 430, width: 240 }}>
        <div style={{ color: SUBTLE, fontSize: 15, marginBottom: 6 }}>POS · receipt</div>
        <div style={{ color: TEXT, fontSize: 22, fontWeight: 700 }}>Order #4821</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, color: SUBTLE, fontSize: 16 }}>
          <span>3 items</span>
          <span style={{ color: CYAN, fontWeight: 700 }}>Rs 1,840</span>
        </div>
        <div style={{ marginTop: 12, height: 6, borderRadius: 4, background: `linear-gradient(90deg, ${CYAN}, ${INDIGO})` }} />
      </FloatCard>

      <FloatCard t={t} cycles={1} phase={0.55} style={{ right: 96, top: 410, width: 252 }}>
        <div style={{ color: SUBTLE, fontSize: 15, marginBottom: 8 }}>Inventory</div>
        <div style={{ color: TEXT, fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Auto-reorder</div>
        {["Espresso beans", "Oat milk", "Cups 12oz"].map((s, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", color: SUBTLE, fontSize: 15 }}>
            <span>{s}</span>
            <span style={{ color: i === 0 ? "#f59e0b" : "#34d399" }}>{i === 0 ? "low" : "ok"}</span>
          </div>
        ))}
      </FloatCard>

      <FloatCard t={t} cycles={1} phase={0.85} style={{ right: 150, bottom: 70, width: 250 }}>
        <div style={{ color: SUBTLE, fontSize: 15, marginBottom: 10 }}>Staff & roles</div>
        <div style={{ position: "relative", height: 36, marginBottom: 8 }}>
          <Avatar c={INDIGO} left={0} />
          <Avatar c={VIOLET} left={24} />
          <Avatar c={CYAN} left={48} />
          <Avatar c="#f59e0b" left={72} />
          <div style={{ position: "absolute", left: 108, top: 6, color: SUBTLE, fontSize: 15 }}>+5 on shift</div>
        </div>
        <div style={{ color: TEXT, fontSize: 16, fontWeight: 600 }}>Manager · Cashier · Staff</div>
      </FloatCard>

      <FloatCard t={t} cycles={1} phase={0.3} style={{ left: 140, bottom: 80, width: 232 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 10px #34d399" }} />
          <span style={{ color: SUBTLE, fontSize: 15 }}>Storefront</span>
        </div>
        <div style={{ color: TEXT, fontSize: 22, fontWeight: 700 }}>Live online</div>
        <div style={{ color: SUBTLE, fontSize: 15, marginTop: 6 }}>yourshop.com</div>
      </FloatCard>
    </AbsoluteFill>
  );
};
