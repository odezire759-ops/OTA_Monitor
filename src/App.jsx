import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

// ===== CONFIG =====
// เปลี่ยน URL นี้หลัง Deploy Apps Script เป็น Web App
const API_URL = "https://script.google.com/macros/s/AKfycbzroJhaCPNKiaVFFLzDhvESVvriR5MM-bM-c5PbMs07d_n0eMF7l2uByt4bmH4ozyj_bg/execS";

const AGODA_COLOR = "#FF6B35";
const TRAVELOKA_COLOR = "#0EA5E9";

const THEMES = {
  dark: {
    bg: "linear-gradient(135deg,#0a0f1e 0%,#0d1b2a 50%,#0a1628 100%)",
    headerBg: "rgba(255,255,255,0.03)",
    headerBorder: "rgba(212,168,83,0.2)",
    cardBg: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(255,255,255,0.07)",
    text: "#f1f5f9",
    subText: "#64748b",
    mutedText: "#475569",
    tooltipBg: "rgba(10,15,30,0.97)",
    tooltipBorder: "rgba(212,168,83,0.3)",
    gold: "#D4A853",
    monthBtn: "rgba(255,255,255,0.1)",
    monthBtnText: "#94a3b8",
    hintBg: "rgba(255,255,255,0.03)",
    hintText: "#475569",
    gridStroke: "rgba(255,255,255,0.05)",
    toggleBg: "rgba(255,255,255,0.08)",
    toggleBorder: "rgba(255,255,255,0.15)",
    tableBorder: "rgba(255,255,255,0.07)",
    tableHeadText: "#64748b",
    cancelRowBg: "rgba(248,113,113,0.05)",
    rowStripe: "rgba(255,255,255,0.015)",
  },
  light: {
    bg: "linear-gradient(135deg,#eef2ff 0%,#e0f2fe 50%,#f0fdf4 100%)",
    headerBg: "rgba(255,255,255,0.88)",
    headerBorder: "rgba(180,130,20,0.2)",
    cardBg: "rgba(255,255,255,0.88)",
    cardBorder: "rgba(0,0,0,0.07)",
    text: "#1e293b",
    subText: "#64748b",
    mutedText: "#94a3b8",
    tooltipBg: "rgba(255,255,255,0.98)",
    tooltipBorder: "rgba(180,130,20,0.3)",
    gold: "#b8860b",
    monthBtn: "rgba(0,0,0,0.07)",
    monthBtnText: "#64748b",
    hintBg: "rgba(0,0,0,0.03)",
    hintText: "#94a3b8",
    gridStroke: "rgba(0,0,0,0.06)",
    toggleBg: "rgba(0,0,0,0.06)",
    toggleBorder: "rgba(0,0,0,0.12)",
    tableBorder: "rgba(0,0,0,0.06)",
    tableHeadText: "#94a3b8",
    cancelRowBg: "rgba(239,68,68,0.05)",
    rowStripe: "rgba(0,0,0,0.015)",
  }
};

// ===== HELPER: แปลง dd/MM/yyyy → Date object =====
function parseDate(str) {
  if (!str) return null;
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  return new Date(+parts[2], +parts[1] - 1, +parts[0]);
}

// ===== HELPER: สร้าง month key เช่น "2026-03" =====
function getMonthKey(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ===== HELPER: แปลง month key เป็นชื่อเดือนไทย =====
const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
function monthKeyToThai(key) {
  const [y, m] = key.split("-");
  const buddhistYear = (+y + 543) % 100;
  return `${THAI_MONTHS[+m - 1]} ${buddhistYear}`;
}

// ===== HELPER: สร้าง heatmap จาก check-in dates =====
function buildHeatmap(bookings, yearMonth) {
  const counts = {};
  bookings.forEach(b => {
    const d = parseDate(b.checkIn);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key !== yearMonth) return;
    const day = d.getDate();
    counts[day] = (counts[day] || 0) + 1;
  });
  const daysInMonth = new Date(+yearMonth.split("-")[0], +yearMonth.split("-")[1], 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    count: counts[i + 1] || 0,
  }));
}

// ===== HELPER: หา first day of week ของเดือน =====
function getFirstDayOfWeek(yearMonth) {
  const [y, m] = yearMonth.split("-");
  return new Date(+y, +m - 1, 1).getDay(); // 0=Sun
}

// ===== HELPER: ชื่อเดือนเต็มภาษาไทย =====
const THAI_MONTHS_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
function monthKeyToFullThai(key) {
  const [y, m] = key.split("-");
  return `${THAI_MONTHS_FULL[+m - 1]} ${y}`;
}

export default function Dashboard() {
  const [mode, setMode] = useState("dark");
  const [activeMonthKey, setActiveMonthKey] = useState(null);
  const [viewMode, setViewMode] = useState("revenue");
  const [hoveredDay, setHoveredDay] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const T = THEMES[mode];
  const isDark = mode === "dark";

  // ===== FETCH DATA =====
  useEffect(() => {
    fetchData();
    // auto-refresh ทุก 5 นาที
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await fetch(API_URL);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "API Error");
      setRawData(json);
      setLastUpdate(json.timestamp);
      setError(null);
    } catch (e) {
      setError(e.message);
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }

  // ===== PROCESS DATA =====
  const allBookings = useMemo(() => {
    if (!rawData) return [];
    return [...(rawData.agoda || []), ...(rawData.traveloka || [])];
  }, [rawData]);

  // สร้าง monthly stats
  const monthlyData = useMemo(() => {
    if (!allBookings.length) return [];
    const map = {};
    allBookings.forEach(b => {
      const mk = getMonthKey(b.checkIn);
      if (!mk) return;
      if (!map[mk]) {
        map[mk] = { monthKey: mk, agoda: 0, traveloka: 0, agodaCount: 0, travelokaCount: 0, agodaCancel: 0, travelokaCancel: 0 };
      }
      const isCancel = (b.status || "").toUpperCase().includes("CANCEL");
      const src = (b.source || "").toLowerCase();
      if (src.includes("agoda")) {
        map[mk].agodaCount++;
        if (isCancel) map[mk].agodaCancel++;
        else map[mk].agoda += b.totalAmount || 0;
      } else {
        map[mk].travelokaCount++;
        if (isCancel) map[mk].travelokaCancel++;
        else map[mk].traveloka += b.totalAmount || 0;
      }
    });
    return Object.values(map)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map(m => ({ ...m, month: monthKeyToThai(m.monthKey) }));
  }, [allBookings]);

  // เลือก active month (default = เดือนล่าสุด)
  useEffect(() => {
    if (monthlyData.length && !activeMonthKey) {
      setActiveMonthKey(monthlyData[monthlyData.length - 1].monthKey);
    }
  }, [monthlyData, activeMonthKey]);

  const curMonth = monthlyData.find(m => m.monthKey === activeMonthKey) || monthlyData[monthlyData.length - 1] || { agoda: 0, traveloka: 0, agodaCount: 0, travelokaCount: 0, agodaCancel: 0, travelokaCancel: 0 };

  // cancel rate data
  const cancelRateData = useMemo(() => {
    return monthlyData.map(m => {
      const agPct = m.agodaCount ? +((m.agodaCancel / m.agodaCount) * 100).toFixed(1) : 0;
      const tlPct = m.travelokaCount ? +((m.travelokaCancel / m.travelokaCount) * 100).toFixed(1) : 0;
      const total = m.agodaCount + m.travelokaCount;
      const totalPct = total ? +(((m.agodaCancel + m.travelokaCancel) / total) * 100).toFixed(1) : 0;
      return { month: m.month, monthKey: m.monthKey, "Agoda %": agPct, "Traveloka %": tlPct, "รวม %": totalPct };
    });
  }, [monthlyData]);

  const curCR = cancelRateData.find(m => m.monthKey === activeMonthKey) || { "Agoda %": 0, "Traveloka %": 0, "รวม %": 0 };

  // platform totals
  const platformData = useMemo(() => {
    let agTotal = 0, agCount = 0, tlTotal = 0, tlCount = 0;
    allBookings.forEach(b => {
      const isCancel = (b.status || "").toUpperCase().includes("CANCEL");
      if (isCancel) return;
      const src = (b.source || "").toLowerCase();
      if (src.includes("agoda")) { agTotal += b.totalAmount || 0; agCount++; }
      else { tlTotal += b.totalAmount || 0; tlCount++; }
    });
    return [
      { name: "Agoda", value: Math.round(agTotal), count: agCount },
      { name: "Traveloka", value: Math.round(tlTotal), count: tlCount },
    ];
  }, [allBookings]);

  // recent bookings (ล่าสุด 10 รายการ)
  const recentBookings = useMemo(() => {
    return [...allBookings]
      .sort((a, b) => {
        const da = parseDate(a.checkIn);
        const db = parseDate(b.checkIn);
        if (!da || !db) return 0;
        return db - da;
      })
      .slice(0, 10);
  }, [allBookings]);

  // heatmap
  const heatmapData = useMemo(() => {
    if (!activeMonthKey) return [];
    return buildHeatmap(allBookings, activeMonthKey);
  }, [allBookings, activeMonthKey]);

  const maxHeat = Math.max(...heatmapData.map(d => d.count), 1);
  const firstDayOffset = activeMonthKey ? getFirstDayOfWeek(activeMonthKey) : 0;

  const getHeatColor = (count) => {
    if (!count) return isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
    const r = count / maxHeat;
    if (r < 0.3) return isDark ? "rgba(14,165,233,0.25)" : "rgba(14,165,233,0.22)";
    if (r < 0.6) return isDark ? "rgba(14,165,233,0.5)" : "rgba(14,165,233,0.48)";
    if (r < 0.85) return isDark ? "rgba(212,168,83,0.6)" : "rgba(180,130,20,0.55)";
    return isDark ? "rgba(255,107,53,0.85)" : "rgba(255,107,53,0.9)";
  };

  const getHeatText = (count) => {
    if (!count) return isDark ? "#475569" : "#94a3b8";
    return count / maxHeat > 0.5 ? (isDark ? "#fff" : "#0f172a") : (isDark ? "#cbd5e1" : "#334155");
  };

  const Tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: T.tooltipBg, border: `1px solid ${T.tooltipBorder}`, borderRadius: 8, padding: "10px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
        <p style={{ color: T.gold, fontSize: 12, marginBottom: 6, fontWeight: 600 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, fontSize: 12, margin: "2px 0" }}>
            {p.name}: {p.value > 100 ? "฿" + p.value.toLocaleString() : p.value + (String(p.name).includes("%") ? "%" : "")}
          </p>
        ))}
      </div>
    );
  };

  const Card = ({ children, style = {} }) => (
    <div style={{
      background: T.cardBg, border: `1px solid ${T.cardBorder}`,
      borderRadius: 14, padding: "18px 20px",
      backdropFilter: "blur(10px)",
      boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.3)" : "0 2px 16px rgba(0,0,0,0.07)",
      transition: "background 0.35s, border 0.35s, box-shadow 0.35s",
      ...style
    }}>{children}</div>
  );

  // ===== LOADING STATE =====
  if (loading && !rawData) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans','Sarabun',sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: "pulse 1.5s infinite" }}>🏨</div>
          <div style={{ color: T.gold, fontSize: 18, fontWeight: 600 }}>J.Residence</div>
          <div style={{ color: T.subText, fontSize: 13, marginTop: 8 }}>กำลังโหลดข้อมูลการจอง...</div>
          <style>{`@keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.6; transform:scale(1.08); } }`}</style>
        </div>
      </div>
    );
  }

  // ===== ERROR STATE =====
  if (error && !rawData) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans','Sarabun',sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ color: "#f87171", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>โหลดข้อมูลไม่สำเร็จ</div>
          <div style={{ color: T.subText, fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>{error}</div>
          <button onClick={fetchData} style={{
            padding: "8px 20px", borderRadius: 8, border: `1px solid ${T.gold}`,
            background: `${T.gold}22`, color: T.gold, fontSize: 13, cursor: "pointer",
          }}>ลองใหม่</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'DM Sans','Sarabun',sans-serif", color: T.text, transition: "all 0.35s ease" }}>

      {/* ===== HEADER ===== */}
      <div style={{
        background: T.headerBg, borderBottom: `1px solid ${T.headerBorder}`,
        padding: "15px 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
        backdropFilter: "blur(14px)", position: "sticky", top: 0, zIndex: 100,
        transition: "background 0.35s", flexWrap: "wrap", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg,${T.gold},#b8860b)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: `0 4px 12px ${T.gold}50` }}>🏨</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>J.Residence</div>
            <div style={{ fontSize: 11, color: T.subText }}>
              Hotel Booking Dashboard
              {lastUpdate && <span style={{ marginLeft: 8, color: T.mutedText }}>อัปเดต: {lastUpdate}</span>}
              {loading && <span style={{ marginLeft: 6, color: T.gold }}>⟳</span>}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {monthlyData.map(m => (
              <button key={m.monthKey} onClick={() => setActiveMonthKey(m.monthKey)} style={{
                padding: "4px 10px", borderRadius: 20, border: "1px solid",
                borderColor: activeMonthKey === m.monthKey ? T.gold : T.monthBtn,
                background: activeMonthKey === m.monthKey ? `${T.gold}22` : "transparent",
                color: activeMonthKey === m.monthKey ? T.gold : T.monthBtnText,
                fontSize: 11, cursor: "pointer", transition: "all 0.2s",
              }}>{m.month}</button>
            ))}
          </div>

          {/* Refresh button */}
          <button onClick={fetchData} style={{
            padding: "4px 10px", borderRadius: 20, border: `1px solid ${T.monthBtn}`,
            background: "transparent", color: T.subText, fontSize: 11, cursor: "pointer",
          }} title="รีเฟรชข้อมูล">🔄</button>

          {/* Toggle Switch */}
          <div
            onClick={() => setMode(isDark ? "light" : "dark")}
            style={{
              display: "flex", alignItems: "center", gap: 0,
              borderRadius: 24, overflow: "hidden", cursor: "pointer",
              border: `1px solid ${T.toggleBorder}`,
              background: T.toggleBg, transition: "all 0.3s",
            }}
          >
            {[
              { key: "dark", icon: "🌙", label: "Night" },
              { key: "light", icon: "☀️", label: "Day" },
            ].map(btn => (
              <div key={btn.key} style={{
                padding: "6px 13px", display: "flex", alignItems: "center", gap: 5,
                background: mode === btn.key ? (isDark ? "rgba(212,168,83,0.2)" : "rgba(180,130,20,0.15)") : "transparent",
                color: mode === btn.key ? T.gold : T.subText,
                fontSize: 11, fontWeight: mode === btn.key ? 600 : 400,
                transition: "all 0.25s",
              }}>
                <span style={{ fontSize: 13 }}>{btn.icon}</span>
                {btn.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 28px" }}>

        {/* ===== KPI ===== */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
          {[
            { label: "รายได้รวมเดือนนี้", value: `฿${Math.round(curMonth.agoda + curMonth.traveloka).toLocaleString()}`, sub: `${curMonth.agodaCount + curMonth.travelokaCount} การจอง`, icon: "💰", color: T.gold },
            { label: "Agoda เดือนนี้", value: `฿${Math.round(curMonth.agoda).toLocaleString()}`, sub: `${curMonth.agodaCount} รายการ`, icon: "🔶", color: AGODA_COLOR },
            { label: "Traveloka เดือนนี้", value: `฿${Math.round(curMonth.traveloka).toLocaleString()}`, sub: `${curMonth.travelokaCount} รายการ`, icon: "🔷", color: TRAVELOKA_COLOR },
            { label: "Cancel Rate เดือนนี้", value: `${curCR["รวม %"]}%`, sub: `Agoda ${curCR["Agoda %"]}% · TLK ${curCR["Traveloka %"]}%`, icon: "❌", color: "#f87171" },
          ].map((c, i) => (
            <div key={i} style={{
              background: T.cardBg, border: `1px solid ${c.color}35`,
              borderRadius: 14, padding: "16px 18px",
              position: "relative", overflow: "hidden",
              backdropFilter: "blur(10px)",
              boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.07)",
              transition: "all 0.35s",
            }}>
              <div style={{ position: "absolute", top: -16, right: -16, width: 64, height: 64, borderRadius: "50%", background: `radial-gradient(circle,${c.color}28,transparent)` }} />
              <div style={{ fontSize: 20, marginBottom: 8 }}>{c.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 11, color: T.subText, marginTop: 3 }}>{c.label}</div>
              <div style={{ fontSize: 10, color: T.mutedText, marginTop: 2 }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* ===== REVENUE + DONUT ===== */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>รายได้รายเดือน</div>
                <div style={{ fontSize: 11, color: T.subText }}>แยกตาม Platform</div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {["revenue", "count"].map(m => (
                  <button key={m} onClick={() => setViewMode(m)} style={{
                    padding: "3px 9px", borderRadius: 6, fontSize: 10,
                    border: "1px solid",
                    borderColor: viewMode === m ? T.gold : T.monthBtn,
                    background: viewMode === m ? `${T.gold}22` : "transparent",
                    color: viewMode === m ? T.gold : T.subText, cursor: "pointer",
                  }}>{m === "revenue" ? "รายได้" : "จำนวน"}</button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={185}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={AGODA_COLOR} stopOpacity={0.3} /><stop offset="95%" stopColor={AGODA_COLOR} stopOpacity={0} /></linearGradient>
                  <linearGradient id="tv2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={TRAVELOKA_COLOR} stopOpacity={0.3} /><stop offset="95%" stopColor={TRAVELOKA_COLOR} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.gridStroke} />
                <XAxis dataKey="month" tick={{ fill: T.subText, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.subText, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey={viewMode === "revenue" ? "agoda" : "agodaCount"} name="Agoda" stroke={AGODA_COLOR} fill="url(#ag2)" strokeWidth={2} dot={{ fill: AGODA_COLOR, r: 3 }} />
                <Area type="monotone" dataKey={viewMode === "revenue" ? "traveloka" : "travelokaCount"} name="Traveloka" stroke={TRAVELOKA_COLOR} fill="url(#tv2)" strokeWidth={2} dot={{ fill: TRAVELOKA_COLOR, r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>สัดส่วน Platform</div>
            <div style={{ fontSize: 11, color: T.subText, marginBottom: 8 }}>ยอดสะสมทั้งหมด</div>
            <ResponsiveContainer width="100%" height={128}>
              <PieChart>
                <Pie data={platformData} cx="50%" cy="50%" innerRadius={36} outerRadius={56} dataKey="value" paddingAngle={4}>
                  <Cell fill={AGODA_COLOR} /><Cell fill={TRAVELOKA_COLOR} />
                </Pie>
                <Tooltip content={<Tip />} />
              </PieChart>
            </ResponsiveContainer>
            {platformData.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, padding: "6px 10px", background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: i === 0 ? AGODA_COLOR : TRAVELOKA_COLOR }} />
                  <span style={{ fontSize: 12, color: T.text }}>{p.name}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: i === 0 ? AGODA_COLOR : TRAVELOKA_COLOR }}>฿{p.value.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: T.subText }}>{p.count} รายการ</div>
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* ===== HEATMAP + CANCEL ===== */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Occupancy Calendar</div>
                <div style={{ fontSize: 11, color: T.subText }}>{activeMonthKey ? monthKeyToFullThai(activeMonthKey) : ""} — Check-in per day</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 9, color: T.subText }}>น้อย</span>
                {[0, 2, 4, 6, 8].map((v, i) => <div key={i} style={{ width: 11, height: 11, borderRadius: 3, background: getHeatColor(v), border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}` }} />)}
                <span style={{ fontSize: 9, color: T.subText }}>เยอะ</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 3 }}>
              {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map(d => <div key={d} style={{ textAlign: "center", fontSize: 9, color: T.subText }}>{d}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
              {/* เว้นช่องว่างก่อนวันที่ 1 */}
              {Array.from({ length: firstDayOffset }, (_, i) => (
                <div key={`empty-${i}`} style={{ height: 33 }} />
              ))}
              {heatmapData.map((cell, i) => (
                <div key={i}
                  onMouseEnter={() => setHoveredDay(cell)}
                  onMouseLeave={() => setHoveredDay(null)}
                  style={{
                    height: 33, borderRadius: 5,
                    background: getHeatColor(cell.count),
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", transition: "transform 0.12s",
                    transform: hoveredDay?.day === cell.day ? "scale(1.15)" : "scale(1)",
                  }}>
                  <span style={{ fontSize: 10, color: getHeatText(cell.count), lineHeight: 1 }}>{cell.day}</span>
                  {cell.count > 0 && <span style={{ fontSize: 8, color: getHeatText(cell.count), opacity: 0.85 }}>{cell.count}</span>}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: "7px 12px", background: hoveredDay ? `${T.gold}14` : T.hintBg, borderRadius: 8, border: `1px solid ${hoveredDay ? T.gold + "28" : "transparent"}`, fontSize: 12, color: hoveredDay ? T.gold : T.hintText, transition: "all 0.2s" }}>
              {hoveredDay ? `📅 ${hoveredDay.day} ${activeMonthKey ? monthKeyToFullThai(activeMonthKey) : ""} — ${hoveredDay.count} การจอง${hoveredDay.count === maxHeat ? " 🔥 สูงสุด" : ""}` : "👆 Hover วันที่เพื่อดูรายละเอียด"}
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>Cancellation Rate</div>
            <div style={{ fontSize: 11, color: T.subText, marginBottom: 12 }}>% การยกเลิกต่อเดือน แยก Platform</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[
                { label: "Agoda", value: `${curCR["Agoda %"]}%`, color: AGODA_COLOR },
                { label: "Traveloka", value: `${curCR["Traveloka %"]}%`, color: TRAVELOKA_COLOR },
                { label: "รวม", value: `${curCR["รวม %"]}%`, color: "#f87171" },
              ].map((b, i) => (
                <div key={i} style={{ flex: 1, padding: "8px 10px", borderRadius: 10, background: `${b.color}14`, border: `1px solid ${b.color}28`, textAlign: "center" }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: b.color }}>{b.value}</div>
                  <div style={{ fontSize: 10, color: T.subText, marginTop: 2 }}>{b.label}</div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={165}>
              <BarChart data={cancelRateData} barSize={11} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.gridStroke} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: T.subText, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.subText, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v + "%"} domain={[0, "auto"]} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="Agoda %" fill={AGODA_COLOR} radius={[4, 4, 0, 0]} fillOpacity={0.85} />
                <Bar dataKey="Traveloka %" fill={TRAVELOKA_COLOR} radius={[4, 4, 0, 0]} fillOpacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ===== ADR + COUNT ===== */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>ADR — รายได้เฉลี่ยต่อการจอง</div>
            <div style={{ fontSize: 11, color: T.subText, marginBottom: 12 }}>Average Daily Rate</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={monthlyData.map(m => ({
                month: m.month,
                "Agoda ADR": m.agodaCount - m.agodaCancel > 0 ? Math.round(m.agoda / (m.agodaCount - m.agodaCancel)) : 0,
                "Traveloka ADR": m.travelokaCount - m.travelokaCancel > 0 ? Math.round(m.traveloka / (m.travelokaCount - m.travelokaCancel)) : 0,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.gridStroke} />
                <XAxis dataKey="month" tick={{ fill: T.subText, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.subText, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <Line type="monotone" dataKey="Agoda ADR" stroke={AGODA_COLOR} strokeWidth={2} dot={{ fill: AGODA_COLOR, r: 4 }} />
                <Line type="monotone" dataKey="Traveloka ADR" stroke={TRAVELOKA_COLOR} strokeWidth={2} dot={{ fill: TRAVELOKA_COLOR, r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>จำนวนการจองรายเดือน</div>
            <div style={{ fontSize: 11, color: T.subText, marginBottom: 12 }}>Agoda vs Traveloka</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={monthlyData} barSize={13} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.gridStroke} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: T.subText, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.subText, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="agodaCount" name="Agoda" fill={AGODA_COLOR} radius={[4, 4, 0, 0]} fillOpacity={0.85} />
                <Bar dataKey="travelokaCount" name="Traveloka" fill={TRAVELOKA_COLOR} radius={[4, 4, 0, 0]} fillOpacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ===== TABLE ===== */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>การจองล่าสุด</div>
            <div style={{ fontSize: 11, color: T.mutedText }}>ทั้งหมด {allBookings.length} รายการ</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
              <thead>
                <tr>
                  {["Booking ID", "Platform", "ลูกค้า", "โรงแรม", "Check-in", "Check-out", "ยอด (THB)", "Commission", "สถานะ"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontSize: 11, color: T.tableHeadText, borderBottom: `1px solid ${T.tableBorder}`, fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b, i) => {
                  const isCancel = (b.status || "").toUpperCase().includes("CANCEL");
                  return (
                    <tr key={b.bookingId + "-" + i} style={{ borderBottom: `1px solid ${T.tableBorder}`, background: isCancel ? T.cancelRowBg : i % 2 === 0 ? "transparent" : T.rowStripe, transition: "background 0.2s" }}>
                      <td style={{ padding: "9px 10px", fontSize: 11, color: T.subText, fontFamily: "monospace" }}>{(b.bookingId || "").slice(-8)}</td>
                      <td style={{ padding: "9px 10px" }}>
                        <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, fontWeight: 600, background: (b.source || "").includes("Agoda") ? "rgba(255,107,53,0.15)" : "rgba(14,165,233,0.15)", color: (b.source || "").includes("Agoda") ? AGODA_COLOR : TRAVELOKA_COLOR }}>{b.source}</span>
                      </td>
                      <td style={{ padding: "9px 10px", fontSize: 12, color: isCancel ? T.subText : T.text, textDecoration: isCancel ? "line-through" : "none" }}>{b.guestName}</td>
                      <td style={{ padding: "9px 10px", fontSize: 11, color: T.subText }}>{b.hotelName}</td>
                      <td style={{ padding: "9px 10px", fontSize: 11, color: T.subText }}>{b.checkIn}</td>
                      <td style={{ padding: "9px 10px", fontSize: 11, color: T.subText }}>{b.checkOut}</td>
                      <td style={{ padding: "9px 10px", fontSize: 13, fontWeight: 600, color: isCancel ? T.mutedText : T.gold }}>
                        {isCancel ? <s>฿{(b.totalAmount || 0).toLocaleString()}</s> : `฿${(b.totalAmount || 0).toLocaleString()}`}
                      </td>
                      <td style={{ padding: "9px 10px", fontSize: 11, color: T.subText }}>฿{(b.commission || 0).toLocaleString()}</td>
                      <td style={{ padding: "9px 10px" }}>
                        <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: isCancel ? "rgba(248,113,113,0.15)" : "rgba(34,197,94,0.15)", color: isCancel ? "#f87171" : "#22c55e" }}>
                          {isCancel ? "❌ ยกเลิก" : "✓ " + (b.status || "").split("-")[0]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ===== FOOTER ===== */}
        <div style={{ textAlign: "center", padding: "20px 0 10px", fontSize: 11, color: T.mutedText }}>
          ข้อมูลจาก Google Sheets · อัปเดตอัตโนมัติทุก 5 นาที
        </div>
      </div>
    </div>
  );
}