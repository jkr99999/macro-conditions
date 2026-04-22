import { useState, useEffect, useCallback, useMemo } from "react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine,
    AreaChart, Area,
} from "recharts";

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

const METRICS = [
    {
        id: "VIXCLS", label: "VIX", dispUnit: "", dispScale: 1, chartScale: 1,
        prefix: "", desc: "Market Fear", color: "#ff5252",
        riskDir: 1, normMin: 10, normMax: 60, decimals: 2, category: "risk",
    },
    {
        id: "SOFR", label: "SOFR", dispUnit: "%", dispScale: 1, chartScale: 1,
        prefix: "", desc: "Overnight Rate", color: "#ffd740",
        riskDir: 0, normMin: 0, normMax: 6, decimals: 2, category: "financing",
    },
    {
        id: "BAMLH0A0HYM2", label: "HY Spread", dispUnit: "bps", dispScale: 100, chartScale: 1,
        prefix: "", desc: "Credit Stress", color: "#ff9f43",
        riskDir: 1, normMin: 200, normMax: 900, decimals: 0, category: "financing",
    },
    {
        id: "DCOILWTICO", label: "WTI Oil", dispUnit: "", dispScale: 1, chartScale: 1,
        prefix: "$", desc: "Crude Oil", color: "#4fc3f7",
        riskDir: 0, normMin: 40, normMax: 120, decimals: 2, category: "demand",
    },
    {
        id: "DTWEXBGS", label: "DXY", dispUnit: "", dispScale: 1, chartScale: 1,
        prefix: "", desc: "Dollar Index", color: "#b39ddb",
        riskDir: 0, normMin: 90, normMax: 115, decimals: 2, category: "demand",
    },
    {
        id: "T10Y2Y", label: "10Y−2Y", dispUnit: "%", dispScale: 1, chartScale: 1,
        prefix: "", desc: "Yield Curve", color: "#69f0ae",
        riskDir: -1, normMin: -3, normMax: 3, decimals: 2, category: "risk",
    },
    {
        id: "T5YIE", label: "Breakeven", dispUnit: "%", dispScale: 1, chartScale: 1,
        prefix: "", desc: "5Y Inflation Exp.", color: "#f48fb1",
        riskDir: 1, normMin: 1, normMax: 5, decimals: 2, category: "inflation",
    },
    {
        id: "ICSA", label: "Init. Claims", dispUnit: "K", dispScale: 0.001, chartScale: 0.001,
        prefix: "", desc: "Jobless Claims", color: "#a5d6a7",
        riskDir: 1, normMin: 150, normMax: 700, decimals: 0, category: "labor",
    },
];

const METRICS_BY_ID = Object.fromEntries(METRICS.map((m) => [m.id, m]));

const COMPOSITES = [
    {
        id: "financing", label: "Financing Pressure", icon: "⬡", color: "#ff9f43",
        desc: "Cost & stress in credit markets",
        compute: (v) => {
            const sofr = norm(v.SOFR ?? 5, 0, 6);
            const hy = norm(v.BAMLH0A0HYM2 ?? 400, 200, 900);
            return sofr * 0.4 + hy * 0.6;
        },
    },
    {
        id: "marketRisk", label: "Market Risk", icon: "◈", color: "#ff5252",
        desc: "Equity volatility & yield curve stress",
        compute: (v) => {
            const vix = norm(v.VIXCLS ?? 20, 10, 60);
            const curve = norm(v.T10Y2Y ?? 0, -3, 3, true); // inverted = bad
            return vix * 0.6 + curve * 0.4;
        },
    },
    {
        id: "demand", label: "Consumer Demand", icon: "◇", color: "#4fc3f7",
        desc: "Energy demand & dollar strength signals",
        compute: (v) => {
            const oil = norm(v.DCOILWTICO ?? 75, 40, 120);
            const dxy = norm(v.DTWEXBGS ?? 104, 90, 115, true);
            return oil * 0.65 + dxy * 0.35;
        },
    },
    {
        id: "laborStress", label: "Labor Stress", icon: "◉", color: "#a5d6a7",
        desc: "Employment conditions & inflation expectations",
        compute: (v) => {
            const claims = norm(v.ICSA ?? 220, 150, 700);
            const inf = norm(v.T5YIE ?? 2.5, 1, 5);
            return claims * 0.55 + inf * 0.45;
        },
    },
];

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────
function norm(value, min, max, invert = false) {
    const clamped = Math.min(max, Math.max(min, value));
    const s = ((clamped - min) / (max - min)) * 100;
    return invert ? 100 - s : s;
}

function scoreColor(s) {
    if (s < 30) return "#69f0ae";
    if (s < 55) return "#ffd740";
    if (s < 72) return "#ff9f43";
    return "#ff5252";
}

function scoreLabel(s) {
    if (s < 30) return "LOW";
    if (s < 55) return "MODERATE";
    if (s < 72) return "ELEVATED";
    return "HIGH";
}

function formatVal(metric, raw) {
    if (raw === null || raw === undefined) return "—";
    const v = raw * (metric.dispScale || 1);
    const s = v.toFixed(metric.decimals ?? 2);
    return metric.prefix ? `${metric.prefix}${s}` : s;
}

// ─────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────
function makeMock(metric) {
    const seeds = {
        VIXCLS: 22, SOFR: 5.31, BAMLH0A0HYM2: 3.42, DCOILWTICO: 78.4,
        DTWEXBGS: 106.2, T10Y2Y: -0.32, T5YIE: 2.48, ICSA: 220000,
    };
    const vols = {
        VIXCLS: 1.4, SOFR: 0.01, BAMLH0A0HYM2: 0.04, DCOILWTICO: 1.2,
        DTWEXBGS: 0.4, T10Y2Y: 0.04, T5YIE: 0.025, ICSA: 4000,
    };
    let v = seeds[metric.id] ?? 50;
    const vol = vols[metric.id] ?? 1;
    const result = [];
    const today = new Date("2024-09-01");
    for (let i = 89; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        v += (Math.random() - 0.48) * vol * 2;
        result.push({ date: d.toISOString().slice(0, 10), value: v });
    }
    return result;
}

// ─────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────
async function fetchSeries(id, apiKey) {
    const p = new URLSearchParams({
        series_id: id, api_key: apiKey,
        file_type: "json", sort_order: "desc", limit: "120",
    });
    const res = await fetch(`${FRED_BASE}?${p}`);
    if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error_message || `HTTP ${res.status}`);
    }
    const json = await res.json();
    return json.observations
        .filter((o) => o.value !== ".")
        .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
        .reverse();
}

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: "#1a1e35", border: "1px solid #2a3050",
            borderRadius: 6, padding: "8px 12px",
        }}>
            <div style={{ fontSize: 10, color: "#4a5578", marginBottom: 4, fontFamily: "Space Mono, monospace" }}>{label}</div>
            {payload.map((p) => {
                const m = METRICS_BY_ID[p.dataKey];
                const unit = m?.dispUnit || "";
                const prefix = m?.prefix || "";
                return (
                    <div key={p.dataKey} style={{ fontSize: 11, color: p.stroke, fontFamily: "Space Mono, monospace" }}>
                        {m?.label || p.dataKey}: {prefix}{Number(p.value).toFixed(2)}{unit === "bps" ? "" : unit}
                    </div>
                );
            })}
        </div>
    );
};

function Spark({ data, metric }) {
    if (!data?.length) return <div style={{ height: 44 }} />;
    const chartData = data.slice(-30).map((d) => ({
        date: d.date, v: d.value * (metric.chartScale || 1),
    }));
    return (
        <ResponsiveContainer width="100%" height={44}>
            <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                    <linearGradient id={`sg-${metric.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={metric.color} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={metric.color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={metric.color} strokeWidth={1.5}
                    fill={`url(#sg-${metric.id})`} dot={false} isAnimationActive={false} />
                {metric.id === "T10Y2Y" && <ReferenceLine y={0} stroke="#333" strokeDasharray="2 2" />}
            </AreaChart>
        </ResponsiveContainer>
    );
}

function MetricCard({ metric, data }) {
    const latest = data?.length ? data[data.length - 1].value : null;
    const prev = data?.length > 1 ? data[data.length - 2].value : null;
    const dispLatest = latest !== null ? latest * (metric.dispScale || 1) : null;
    const dispPrev = prev !== null ? prev * (metric.dispScale || 1) : null;
    const delta = dispLatest !== null && dispPrev !== null ? dispLatest - dispPrev : null;
    const isUp = delta !== null && delta > 0;
    // riskDir: 1 = higher is bad, -1 = higher is good, 0 = neutral
    const changeColor =
        metric.riskDir === 0
            ? "#8892b0"
            : (metric.riskDir === 1 ? (isUp ? "#ff5252" : "#69f0ae") : (isUp ? "#69f0ae" : "#ff5252"));

    const displayStr = dispLatest !== null
        ? `${metric.prefix}${dispLatest.toFixed(metric.decimals ?? 2)}`
        : "—";
    const deltaStr = delta !== null
        ? `${isUp ? "+" : ""}${delta.toFixed(metric.decimals ?? 2)}${metric.dispUnit === "%" ? "%" : ""}`
        : null;

    return (
        <div style={{
            background: "#141829", border: "1px solid #1e2440",
            borderRadius: 10, padding: "14px 16px", position: "relative", overflow: "hidden",
            animation: "fadein 0.4s ease",
        }}>
            <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: "2px",
                background: `linear-gradient(90deg, ${metric.color}cc, transparent)`,
            }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div>
                    <div style={{ fontSize: 10, color: "#4a5578", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
                        {metric.label}
                    </div>
                    <div style={{ fontSize: 9, color: "#2e3555", marginTop: 1 }}>{metric.desc}</div>
                </div>
                <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: data?.length ? metric.color : "#2e3555",
                    boxShadow: data?.length ? `0 0 6px ${metric.color}88` : "none",
                }} />
            </div>
            <div style={{
                fontSize: 24, fontFamily: "Space Mono, monospace",
                color: "#eaeef8", letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 2,
            }}>
                {displayStr}
                {metric.dispUnit && <span style={{ fontSize: 11, color: "#4a5578", marginLeft: 2 }}>{metric.dispUnit}</span>}
            </div>
            {deltaStr && (
                <div style={{ fontSize: 10, color: changeColor, fontFamily: "Space Mono, monospace", marginBottom: 4 }}>
                    {isUp ? "▲" : "▼"} {Math.abs(delta).toFixed(metric.decimals ?? 2)}{metric.dispUnit === "%" ? "%" : ""}
                </div>
            )}
            <Spark data={data} metric={metric} />
        </div>
    );
}

function ScoreCard({ comp, latestVals }) {
    const score = useMemo(() => comp.compute(latestVals), [comp, latestVals]);
    const color = scoreColor(score);
    const label = scoreLabel(score);

    return (
        <div style={{
            background: "#141829", border: "1px solid #1e2440",
            borderRadius: 10, padding: "18px 20px", position: "relative", overflow: "hidden",
        }}>
            {/* glow bg */}
            <div style={{
                position: "absolute", top: -20, right: -20, width: 80, height: 80,
                borderRadius: "50%", background: `${color}10`, filter: "blur(20px)",
            }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                    <div style={{ fontSize: 11, color: "#8892b0", letterSpacing: "0.04em", marginBottom: 2 }}>
                        {comp.label}
                    </div>
                    <div style={{ fontSize: 9, color: "#3a4565" }}>{comp.desc}</div>
                </div>
                <div style={{ fontSize: 18, opacity: 0.7, color: color }}>{comp.icon}</div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 38, fontFamily: "Space Mono, monospace", color, letterSpacing: "-0.03em", lineHeight: 1 }}>
                    {Math.round(score)}
                </div>
                <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
                    color, border: `1px solid ${color}44`, borderRadius: 3,
                    padding: "2px 5px", fontFamily: "Outfit, sans-serif",
                }}>
                    {label}
                </div>
            </div>
            <div style={{ height: 3, background: "#1e2440", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                    height: "100%", width: `${score}%`,
                    background: `linear-gradient(90deg, #69f0ae44, ${color})`,
                    borderRadius: 2, transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)",
                }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 8, color: "#2e3555", fontFamily: "Space Mono, monospace" }}>0</span>
                <span style={{ fontSize: 8, color: "#2e3555", fontFamily: "Space Mono, monospace" }}>100</span>
            </div>
        </div>
    );
}

function BigChart({ title, pairs, allData, height = 180 }) {
    const combined = useMemo(() => {
        const map = {};
        pairs.forEach(({ id }) => {
            const m = METRICS_BY_ID[id];
            const cs = m?.chartScale || 1;
            (allData[id] || []).slice(-60).forEach((d) => {
                if (!map[d.date]) map[d.date] = { date: d.date };
                map[d.date][id] = d.value * cs;
            });
        });
        return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
    }, [pairs, allData]);

    const formatX = (d) => (d ? d.slice(5) : "");

    return (
        <div style={{
            background: "#141829", border: "1px solid #1e2440",
            borderRadius: 10, padding: "16px 20px",
        }}>
            <div style={{ fontSize: 11, color: "#8892b0", letterSpacing: "0.06em", marginBottom: 14, fontWeight: 600 }}>
                {title}
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                {pairs.map(({ id }) => {
                    const m = METRICS_BY_ID[id];
                    return (
                        <div key={id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <div style={{ width: 16, height: 2, background: m?.color, borderRadius: 1 }} />
                            <span style={{ fontSize: 9, color: "#4a5578", fontFamily: "Space Mono, monospace" }}>
                                {m?.label} {m?.dispUnit ? `(${m.dispUnit === "bps" ? "%" : m.dispUnit})` : ""}
                            </span>
                        </div>
                    );
                })}
            </div>
            <ResponsiveContainer width="100%" height={height}>
                <LineChart data={combined} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                    <CartesianGrid stroke="#1e2440" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="date" tickFormatter={formatX}
                        tick={{ fontSize: 9, fill: "#3a4565", fontFamily: "Space Mono, monospace" }}
                        tickLine={false} axisLine={false}
                        interval={Math.floor(combined.length / 5)}
                    />
                    <YAxis
                        tick={{ fontSize: 9, fill: "#3a4565", fontFamily: "Space Mono, monospace" }}
                        tickLine={false} axisLine={false} width={36}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#2a3050", strokeWidth: 1 }} />
                    <ReferenceLine y={0} stroke="#2a3050" strokeWidth={1} />
                    {pairs.map(({ id }) => {
                        const m = METRICS_BY_ID[id];
                        return (
                            <Line
                                key={id} type="monotone" dataKey={id}
                                stroke={m?.color} strokeWidth={1.5}
                                dot={false} name={m?.label}
                                isAnimationActive={false}
                            />
                        );
                    })}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

function RecessionIndicator({ latestVals }) {
    const t10y2y = latestVals.T10Y2Y ?? 0;
    const t10y3m = latestVals.T10Y3M ?? 0;
    const inverted = t10y2y < 0;
    const severity = inverted ? Math.min(100, Math.abs(t10y2y) / 3 * 100) : 0;
    const vix = latestVals.VIXCLS ?? 20;
    const hy = latestVals.BAMLH0A0HYM2 ?? 350;

    const riskScore = (
        norm(vix, 10, 60) * 0.3 +
        norm(hy, 200, 900) * 0.4 +
        (inverted ? severity * 0.3 : 0)
    );

    const color = scoreColor(riskScore);

    return (
        <div style={{
            background: "#141829", border: `1px solid ${color}33`,
            borderRadius: 10, padding: "16px 20px",
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        }}>
            <div style={{
                width: 56, height: 56, borderRadius: "50%",
                border: `3px solid ${color}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: `${color}15`, flexShrink: 0,
                boxShadow: `0 0 20px ${color}22`,
            }}>
                <span style={{ fontSize: 11, fontFamily: "Space Mono, monospace", color, fontWeight: 700 }}>
                    {Math.round(riskScore)}
                </span>
            </div>
            <div>
                <div style={{ fontSize: 13, color: "#e8edf5", fontWeight: 600, marginBottom: 3 }}>
                    Macro Stress Index
                </div>
                <div style={{ fontSize: 10, color: "#4a5578", marginBottom: 6 }}>
                    Composite risk gauge · {scoreLabel(riskScore)} stress environment
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {[
                        { label: "Curve", val: `${t10y2y >= 0 ? "+" : ""}${t10y2y.toFixed(2)}%`, ok: t10y2y >= 0 },
                        { label: "VIX", val: vix.toFixed(1), ok: vix < 25 },
                        { label: "HY", val: `${hy.toFixed(0)}bps`, ok: hy < 450 },
                    ].map(({ label, val, ok }) => (
                        <div key={label} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <div style={{ width: 5, height: 5, borderRadius: "50%", background: ok ? "#69f0ae" : "#ff5252" }} />
                            <span style={{ fontSize: 10, color: "#8892b0", fontFamily: "Space Mono, monospace" }}>
                                {label}: <span style={{ color: ok ? "#69f0ae" : "#ff5252" }}>{val}</span>
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
export default function BusinessPulseDashboard() {
    const envKey = import.meta.env.VITE_FRED_API_KEY || "";
    const [apiInput, setApiInput] = useState(envKey);
    const [allData, setAllData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [isMock, setIsMock] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [tick, setTick] = useState(new Date());

    // init: load live if env key present, else mock
    useEffect(() => {
        if (envKey) {
            loadData(envKey);
        } else {
            const d = {};
            METRICS.forEach((m) => { d[m.id] = makeMock(m); });
            setAllData(d);
        }
    }, []);

    // clock tick
    useEffect(() => {
        const t = setInterval(() => setTick(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // auto-refresh live data every 5 min
    const [savedKey, setSavedKey] = useState("");
    useEffect(() => {
        if (!savedKey) return;
        const t = setInterval(() => loadData(savedKey), 5 * 60 * 1000);
        return () => clearInterval(t);
    }, [savedKey]);

    const loadData = useCallback(async (key) => {
        if (!key.trim()) return;
        setLoading(true);
        setError("");
        try {
            const entries = await Promise.all(
                METRICS.map(async (m) => [m.id, await fetchSeries(m.id, key)])
            );
            setAllData(Object.fromEntries(entries));
            setIsMock(false);
            setLastUpdated(new Date());
            setSavedKey(key);
        } catch (e) {
            setError(e.message || "Failed — verify your FRED API key");
        } finally {
            setLoading(false);
        }
    }, []);

    const latestVals = useMemo(() => {
        const v = {};
        METRICS.forEach((m) => {
            const d = allData[m.id];
            if (d?.length) v[m.id] = d[d.length - 1].value * (m.dispScale || 1);
        });
        return v;
    }, [allData]);

    const timeStr = tick.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    return (
        <div style={{
            minHeight: "100vh", background: "#0c1020",
            color: "#e8edf5", fontFamily: "Outfit, sans-serif",
            padding: "20px 24px 32px",
        }}>
            {/* Styles are in index.css and fonts in index.html */}

            {/* ── HEADER ── */}
            <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: isMock ? "#ffd740" : "#69f0ae",
                        animation: "pulseglow 2s infinite",
                        boxShadow: `0 0 10px ${isMock ? "#ffd740" : "#69f0ae"}`,
                        flexShrink: 0,
                    }} />
                    <div>
                        <h1 style={{
                            fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em",
                            margin: 0, color: "#eaeef8",
                        }}>
                            Business Conditions Pulse
                        </h1>
                        <div style={{ fontSize: 10, color: isMock ? "#ffd74099" : "#4a5578", marginTop: 1 }}>
                            {isMock
                                ? "⚠  Demo data · Enter FRED API key for live data"
                                : `Live · FRED · Refreshes every 5 min · Last: ${lastUpdated?.toLocaleTimeString()}`}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                        value={apiInput}
                        onChange={(e) => setApiInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && loadData(apiInput)}
                        placeholder="FRED API key (free at fred.stlouisfed.org)"
                        style={{
                            background: "#141829", border: "1px solid #1e2440",
                            borderRadius: 7, color: "#e8edf5", padding: "7px 12px",
                            fontSize: 11, fontFamily: "Space Mono, monospace", width: 290,
                        }}
                    />
                    <button
                        onClick={() => loadData(apiInput)}
                        disabled={loading}
                        style={{
                            background: loading ? "#1e2440" : "#4fc3f7",
                            color: loading ? "#4a5578" : "#0c1020",
                            border: "none", borderRadius: 7, padding: "7px 14px",
                            fontSize: 11, fontWeight: 700, cursor: loading ? "default" : "pointer",
                            fontFamily: "Outfit, sans-serif", letterSpacing: "0.04em",
                            transition: "background 0.2s",
                        }}
                    >
                        {loading ? "Loading…" : "Load Live →"}
                    </button>
                    <div style={{
                        fontFamily: "Space Mono, monospace", fontSize: 13,
                        color: "#3a4565", letterSpacing: "0.05em", minWidth: 72, textAlign: "right",
                    }}>
                        {timeStr}
                    </div>
                </div>
            </div>

            {/* ── ERROR ── */}
            {error && (
                <div style={{
                    background: "#ff525215", border: "1px solid #ff525244",
                    borderRadius: 8, padding: "10px 14px", marginBottom: 16,
                    fontSize: 11, color: "#ff7070",
                }}>
                    ⚠  {error}
                </div>
            )}

            {/* ── SECTION: PULSE CARDS ── */}
            <div style={{ fontSize: 9, color: "#2e3555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>
                Market Pulse · Real-Time Indicators
            </div>
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 10, marginBottom: 20,
            }}>
                {METRICS.map((m) => (
                    <MetricCard key={m.id} metric={m} data={allData[m.id]} />
                ))}
            </div>

            {/* ── SECTION: COMPOSITE SCORES + MACRO STRESS ── */}
            <div style={{ fontSize: 9, color: "#2e3555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>
                Composite Stress Indicators
            </div>
            <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 10, marginBottom: 10,
            }}>
                {COMPOSITES.map((c) => (
                    <ScoreCard key={c.id} comp={c} latestVals={latestVals} />
                ))}
            </div>
            <div style={{ marginBottom: 20 }}>
                <RecessionIndicator latestVals={latestVals} />
            </div>

            {/* ── SECTION: CHARTS ── */}
            <div style={{ fontSize: 9, color: "#2e3555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>
                60-Day Trend Charts
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <BigChart
                    title="RISK: VIX & HY Spread"
                    pairs={[{ id: "VIXCLS" }, { id: "BAMLH0A0HYM2" }]}
                    allData={allData}
                />
                <BigChart
                    title="RATES: SOFR & 10Y−2Y Yield Curve"
                    pairs={[{ id: "SOFR" }, { id: "T10Y2Y" }]}
                    allData={allData}
                />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
                <BigChart
                    title="COMMODITIES & FX: WTI Oil & DXY"
                    pairs={[{ id: "DCOILWTICO" }, { id: "DTWEXBGS" }]}
                    allData={allData}
                />
                <BigChart
                    title="LABOR & INFLATION: Init. Claims (K) & 5Y Breakeven"
                    pairs={[{ id: "ICSA" }, { id: "T5YIE" }]}
                    allData={allData}
                />
            </div>

            {/* ── DATA TABLE ── */}
            <div style={{ fontSize: 9, color: "#2e3555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>
                Current Readings
            </div>
            <div style={{
                background: "#141829", border: "1px solid #1e2440",
                borderRadius: 10, overflow: "hidden", marginBottom: 24,
            }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "1px solid #1e2440" }}>
                            {["Series", "Description", "Category", "Latest", "Δ 1-day", "Signal"].map((h) => (
                                <th key={h} style={{
                                    padding: "10px 14px", textAlign: "left",
                                    fontSize: 9, color: "#3a4565", letterSpacing: "0.1em",
                                    textTransform: "uppercase", fontWeight: 600,
                                }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {METRICS.map((m, i) => {
                            const d = allData[m.id];
                            const latest = d?.length ? d[d.length - 1].value * (m.dispScale || 1) : null;
                            const prev = d?.length > 1 ? d[d.length - 2].value * (m.dispScale || 1) : null;
                            const delta = latest !== null && prev !== null ? latest - prev : null;
                            const isUp = delta !== null && delta > 0;
                            const changeColor =
                                m.riskDir === 0 ? "#8892b0"
                                    : m.riskDir === 1
                                        ? (isUp ? "#ff5252" : "#69f0ae")
                                        : (isUp ? "#69f0ae" : "#ff5252");

                            const signal = latest === null ? "—"
                                : m.riskDir === 0 ? "Neutral"
                                    : norm(latest, m.normMin, m.normMax) > 65 ? (m.riskDir === 1 ? "Stress" : "Favorable")
                                        : norm(latest, m.normMin, m.normMax) < 35 ? (m.riskDir === 1 ? "Calm" : "Weak")
                                            : "Normal";

                            const sigColor = signal === "Stress" || signal === "Weak" ? "#ff5252"
                                : signal === "Favorable" || signal === "Calm" ? "#69f0ae" : "#ffd740";

                            return (
                                <tr key={m.id} style={{
                                    borderBottom: i < METRICS.length - 1 ? "1px solid #1a1e30" : "none",
                                    background: i % 2 === 0 ? "transparent" : "#0f1322",
                                }}>
                                    <td style={{ padding: "9px 14px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
                                            <span style={{ fontSize: 11, fontFamily: "Space Mono, monospace", color: "#e8edf5" }}>{m.id}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: "9px 14px", fontSize: 10, color: "#4a5578" }}>{m.desc}</td>
                                    <td style={{ padding: "9px 14px", fontSize: 9, color: "#3a4565", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                        {m.category}
                                    </td>
                                    <td style={{ padding: "9px 14px", fontFamily: "Space Mono, monospace", fontSize: 11, color: "#e8edf5" }}>
                                        {latest !== null ? `${m.prefix}${latest.toFixed(m.decimals ?? 2)}${m.dispUnit || ""}` : "—"}
                                    </td>
                                    <td style={{ padding: "9px 14px", fontFamily: "Space Mono, monospace", fontSize: 11, color: changeColor }}>
                                        {delta !== null ? `${isUp ? "+" : ""}${delta.toFixed(m.decimals ?? 2)}` : "—"}
                                    </td>
                                    <td style={{ padding: "9px 14px" }}>
                                        <span style={{
                                            fontSize: 9, color: sigColor, background: `${sigColor}18`,
                                            border: `1px solid ${sigColor}33`, borderRadius: 3,
                                            padding: "2px 7px", letterSpacing: "0.08em", fontWeight: 600,
                                        }}>
                                            {signal}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ── FOOTER ── */}
            <div style={{
                borderTop: "1px solid #1a1e30", paddingTop: 12,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                flexWrap: "wrap", gap: 8,
            }}>
                <span style={{ fontSize: 9, color: "#2e3555" }}>
                    Data: Federal Reserve Economic Data (FRED) · Federal Reserve Bank of St. Louis
                </span>
                <span style={{ fontSize: 9, color: "#2e3555", fontFamily: "Space Mono, monospace" }}>
                    Business Conditions Pulse v1.0 · {isMock ? "DEMO MODE" : "LIVE"}
                </span>
            </div>
        </div>
    );
}
