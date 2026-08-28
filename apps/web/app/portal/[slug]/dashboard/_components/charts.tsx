"use client";
// apps/web/app/portal/[slug]/dashboard/_components/charts.tsx
// Chart.js canvases for the Pro dashboard analytics (client components).
// Mockup data is passed in from the server component; these only render.
import {
  Chart as ChartJS,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  type ChartOptions,
  type Plugin,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(BarElement, ArcElement, CategoryScale, LinearScale, Tooltip);

// --- Submission activity (vertical bars, 30 days) -------------------------

export function ActivityBarChart({
  values,
  barColor = "#23537a",
  peakColor = "#4a9edd",
}: {
  values: number[];
  barColor?: string;
  peakColor?: string;
}) {
  const peak = values.indexOf(Math.max(...values));
  const labels = values.map((_, i) => i + 1);
  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: "rgba(255,255,255,0.35)",
          font: { size: 10 },
          autoSkip: false,
          maxRotation: 0,
          callback: (_v, i) => ([0, 7, 14, 21, 29].includes(i) ? labels[i] : ""),
        },
      },
      y: { display: false, beginAtZero: true },
    },
  };
  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: values.map((_, i) => (i === peak ? peakColor : barColor)),
        borderRadius: 2,
        borderSkipped: false as const,
        categoryPercentage: 0.85,
        barPercentage: 0.9,
      },
    ],
  };
  return (
    <div className="relative min-h-[160px] flex-1">
      <Bar options={options} data={data} />
    </div>
  );
}

// --- Level distribution (doughnut) ----------------------------------------

export function LevelDonutChart({
  segments,
}: {
  segments: { pct: number; color: string }[];
}) {
  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };
  const data = {
    labels: segments.map((_, i) => i),
    datasets: [
      {
        data: segments.map((s) => s.pct),
        backgroundColor: segments.map((s) => s.color),
        borderWidth: 0,
        spacing: 3,
      },
    ],
  };
  return (
    <div className="relative" style={{ width: 132, height: 132 }}>
      <Doughnut options={options} data={data} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-bold leading-none text-white">84</span>
        <span className="text-[11px] text-white/45">Total</span>
      </div>
    </div>
  );
}

// --- Top frequencies (horizontal bars w/ track + value labels) ------------

// Faint full-width track drawn behind each bar.
const trackPlugin: Plugin<"bar"> = {
  id: "freqTrack",
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    const meta = chart.getDatasetMeta(0);
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    meta.data.forEach((bar) => {
      const h = (bar as unknown as { height: number }).height;
      const y = bar.y - h / 2;
      const r = h / 2;
      const x = chartArea.left;
      const w = chartArea.right - chartArea.left;
      ctx.beginPath();
      // rounded rect
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    });
    ctx.restore();
  },
};

// Percentage value drawn at the right edge of each row.
const valueLabelPlugin: Plugin<"bar"> = {
  id: "freqValue",
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    const meta = chart.getDatasetMeta(0);
    const values = chart.data.datasets[0].data as number[];
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "600 12px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    meta.data.forEach((bar, i) => {
      ctx.fillText(`${values[i]}%`, chartArea.right + 34, bar.y);
    });
    ctx.restore();
  },
};

export function FrequencyBarChart({
  items,
}: {
  items: { label: string; pct: number; color: string }[];
}) {
  const options: ChartOptions<"bar"> = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 40 } },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false, min: 0, max: 100 },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: "rgba(255,255,255,0.6)", font: { size: 12 }, crossAlign: "far" },
      },
    },
  };
  const data = {
    labels: items.map((f) => f.label),
    datasets: [
      {
        data: items.map((f) => f.pct),
        backgroundColor: items.map((f) => f.color),
        borderRadius: 999,
        borderSkipped: false as const,
        barThickness: 8,
      },
    ],
  };
  return (
    <div className="relative min-h-[200px] flex-1">
      <Bar options={options} data={data} plugins={[trackPlugin, valueLabelPlugin]} />
    </div>
  );
}
