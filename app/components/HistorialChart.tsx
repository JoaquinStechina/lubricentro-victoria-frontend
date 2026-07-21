"use client";

export type PuntoHistorial = {
  etiqueta: string;
  valor: number;
};

type HistorialChartProps = {
  puntos: PuntoHistorial[];
  formatValor: (valor: number) => string;
};

const W = 600;
const H = 180;
const PAD_X = 24;
const PAD_TOP = 26;
const PAD_BOTTOM = 30;

// Gráfico de línea mínimo en SVG puro (sin dependencia de charts): una sola
// serie en el color primario, texto en tokens de texto (no en el color de la
// serie), grilla recesiva. Los valores exactos van en la tabla que acompaña
// al gráfico en el dialog; acá solo se etiquetan mín/máx y los extremos del
// eje de tiempo, con <title> nativo por punto como tooltip.
export default function HistorialChart({ puntos, formatValor }: HistorialChartProps) {
  if (puntos.length === 0) return null;

  const valores = puntos.map((p) => p.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const span = max - min || 1;

  const x = (i: number) =>
    puntos.length === 1 ? W / 2 : PAD_X + (i * (W - 2 * PAD_X)) / (puntos.length - 1);
  const y = (v: number) => PAD_TOP + (1 - (v - min) / span) * (H - PAD_TOP - PAD_BOTTOM);

  const idxMin = valores.indexOf(min);
  const idxMax = valores.indexOf(max);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Evolución del precio a través de las cargas"
    >
      {/* eje base recesivo */}
      <line
        x1={PAD_X}
        y1={H - PAD_BOTTOM}
        x2={W - PAD_X}
        y2={H - PAD_BOTTOM}
        className="stroke-zinc-200 dark:stroke-zinc-800"
        strokeWidth={1}
      />
      {puntos.length > 1 && (
        <polyline
          points={puntos.map((p, i) => `${x(i)},${y(p.valor)}`).join(" ")}
          fill="none"
          strokeWidth={2}
          className="stroke-primary"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {puntos.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.valor)} r={4} className="fill-primary">
          <title>{`${p.etiqueta}: ${formatValor(p.valor)}`}</title>
        </circle>
      ))}
      {/* labels selectivos: solo máximo y mínimo (uno solo si coinciden) */}
      <text
        x={x(idxMax)}
        y={y(max) - 8}
        textAnchor="middle"
        className="fill-zinc-600 text-[11px] dark:fill-zinc-400"
      >
        {formatValor(max)}
      </text>
      {idxMin !== idxMax && (
        <text
          x={x(idxMin)}
          y={y(min) + 16}
          textAnchor="middle"
          className="fill-zinc-600 text-[11px] dark:fill-zinc-400"
        >
          {formatValor(min)}
        </text>
      )}
      {/* extremos del eje de tiempo */}
      <text
        x={PAD_X}
        y={H - 10}
        textAnchor="start"
        className="fill-zinc-500 text-[10px] dark:fill-zinc-500"
      >
        {puntos[0].etiqueta}
      </text>
      {puntos.length > 1 && (
        <text
          x={W - PAD_X}
          y={H - 10}
          textAnchor="end"
          className="fill-zinc-500 text-[10px] dark:fill-zinc-500"
        >
          {puntos[puntos.length - 1].etiqueta}
        </text>
      )}
    </svg>
  );
}
