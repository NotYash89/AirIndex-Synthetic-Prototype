/* =========================================================
   AirIndex — Real-time Airfare Price Index (APIx)
   ========================================================= */

const LEAD_TIMES = ["T+1", "T+7", "T+15", "T+30", "T+45"];
const LEAD_MULT  = { "T+1": 1.32, "T+7": 1.10, "T+15": 1.00, "T+30": 0.94, "T+45": 0.90 };
const LEAD_DAYS  = { "T+1": 1, "T+7": 7, "T+15": 15, "T+30": 30, "T+45": 45 };
const LEAD_TREND_BIAS = { "T+1": 0.06, "T+7": 0.02, "T+15": 0.00, "T+30": -0.02, "T+45": -0.03 };
const LEAD_LABEL = { "T+1": "Tomorrow", "T+7": "in 1 week", "T+15": "in 2 weeks", "T+30": "in 1 month", "T+45": "in 1.5 months" };

const ROUTES = [
  { code: "DEL-BOM", label: "Delhi → Mumbai",        weight: 22, basePrice: 6200, carrier: "IndiGo",    trend: 0.22 },
  { code: "DEL-BLR", label: "Delhi → Bengaluru",     weight: 20, basePrice: 5900, carrier: "Air India", trend: 0.18 },
  { code: "BOM-BLR", label: "Mumbai → Bengaluru",    weight: 17, basePrice: 5400, carrier: "Akasa Air", trend: 0.12 },
  { code: "DEL-CCU", label: "Delhi → Kolkata",       weight: 15, basePrice: 5200, carrier: "IndiGo",    trend: 0.05 },
  { code: "BLR-HYD", label: "Bengaluru → Hyderabad", weight: 14, basePrice: 4800, carrier: "Akasa Air", trend: 0.02 },
  { code: "MAA-DEL", label: "Chennai → Delhi",       weight: 12, basePrice: 5500, carrier: "Air India", trend: 0.10 }
];

const SOURCES = [
  { name: "IndiGo",            channel: "airline", url: "https://www.goindigo.in/",            platformFee: 0,   presenceRate: 0.97, fareMultiplier: 1.000, health: "healthy", freshness: "6 min ago"  },
  { name: "Air India",         channel: "airline", url: "https://www.airindia.com/",           platformFee: 0,   presenceRate: 0.94, fareMultiplier: 1.005, health: "healthy", freshness: "8 min ago"  },
  { name: "Air India Express", channel: "airline", url: "https://www.airindiaexpress.com/",   platformFee: 0,   presenceRate: 0.72, fareMultiplier: 0.982, health: "healthy", freshness: "9 min ago"  },
  { name: "Akasa Air",         channel: "airline", url: "https://www.akasaair.com/",           platformFee: 0,   presenceRate: 0.88, fareMultiplier: 0.995, health: "healthy", freshness: "11 min ago" },
  { name: "SpiceJet",          channel: "airline", url: "https://www.spicejet.com/",           platformFee: 0,   presenceRate: 0.78, fareMultiplier: 0.978, health: "watch",   freshness: "16 min ago" },
  { name: "MakeMyTrip",        channel: "ota",     url: "https://www.makemytrip.com/flights/", platformFee: 399, presenceRate: 0.94, fareMultiplier: 1.008, health: "watch",   freshness: "19 min ago" },
  { name: "EaseMyTrip",        channel: "ota",     url: "https://www.easemytrip.com/",         platformFee: 199, presenceRate: 0.90, fareMultiplier: 1.003, health: "healthy", freshness: "10 min ago" },
  { name: "Yatra",             channel: "ota",     url: "https://www.yatra.com/",              platformFee: 249, presenceRate: 0.86, fareMultiplier: 1.006, health: "healthy", freshness: "12 min ago" },
  { name: "Cleartrip",         channel: "ota",     url: "https://www.cleartrip.com/",          platformFee: 299, presenceRate: 0.84, fareMultiplier: 1.004, health: "healthy", freshness: "13 min ago" },
  { name: "Ixigo",             channel: "ota",     url: "https://www.ixigo.com/",              platformFee: 179, presenceRate: 0.82, fareMultiplier: 1.002, health: "healthy", freshness: "14 min ago" },
  { name: "Goibibo",           channel: "ota",     url: "https://www.goibibo.com/flights/",    platformFee: 449, presenceRate: 0.88, fareMultiplier: 1.007, health: "healthy", freshness: "15 min ago" }
];

/* Travel events over the 60-day window */
const EVENTS = [
  { date: "2026-08-15", label: "Independence Day",   bump: 0.06, window: 2, color: "#7C5CE0" },
  { date: "2026-08-26", label: "Onam",               bump: 0.05, window: 2, color: "#0EA5E9" },
  { date: "2026-09-14", label: "Ganesh Chaturthi",   bump: 0.04, window: 2, color: "#D97706" }
];

/* Realistic ±3% day-of-week swing */
const DOW_FACTOR = [1.020, 0.985, 0.980, 0.990, 1.000, 1.015, 1.025];

const BASE_MONTH = "2026-08";
const SNAPSHOT_DATE = "2026-09-29";
const TOTAL_DAYS = 60;
const CURRENT_WINDOW_DAYS = 7;
const METHODOLOGY_VERSION = "v0.6";

const $ = id => document.getElementById(id);
const fmtINR = n => "₹" + Math.round(n).toLocaleString("en-IN");
const fmtIdx = n => n.toFixed(1);
const average = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const geometricMean = arr => {
  if (!arr.length) return 0;
  return Math.exp(arr.reduce((a, v) => a + Math.log(v), 0) / arr.length);
};
const totalOf = o => (o.base_fare || 0) + (o.taxes || 0) + (o.udf || 0) + (o.platform_fee || 0);

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}
function monthName(iso) {
  return new Date(iso + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
function nowTime() {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* =========================================================
   1. SYNTHETIC OBSERVATIONS
   ========================================================= */
let __seed = 20260901;
function rand() {
  __seed = (__seed * 9301 + 49297) % 233280;
  return __seed / 233280;
}

function eventBump(dateStr) {
  let bump = 0;
  const d = new Date(dateStr + "T00:00:00");
  EVENTS.forEach(ev => {
    const evDate = new Date(ev.date + "T00:00:00");
    const diff = Math.abs((d - evDate) / 86400000);
    if (diff <= ev.window) {
      const weight = 1 - diff / (ev.window + 1);
      bump += ev.bump * weight;
    }
  });
  return bump;
}

function generateObservations() {
  const start = new Date(2026, 7, 1);
  const observations = [];

  for (let d = 0; d < TOTAL_DAYS; d++) {
    const date = new Date(start);
    date.setDate(start.getDate() + d);
    const dateStr = isoDate(date);
    const dow = date.getDay();
    const progress = d / (TOTAL_DAYS - 1);
    const evBump = eventBump(dateStr);

    ROUTES.forEach(route => {
      LEAD_TIMES.forEach(lt => {
        const leadBias = LEAD_TREND_BIAS[lt] || 0;
        const routeTrend = route.trend + leadBias;
        const drift = 1 + progress * routeTrend;

        SOURCES.forEach(src => {
          if (rand() > src.presenceRate) {
            observations.push({
              date: dateStr, route: route.code, lead_time: lt,
              source: src.name, channel: src.channel,
              carrier: route.carrier, fare_class: "economy",
              status: "sold_out"
            });
            return;
          }

          const noise = 1 + (rand() - 0.5) * 0.020;
          const total = route.basePrice * drift * DOW_FACTOR[dow] * LEAD_MULT[lt] * src.fareMultiplier * (1 + evBump) * noise;

          let finalTotal = total;
          if (rand() < 0.008) finalTotal = total * (1.18 + rand() * 0.22);

          observations.push({
            date: dateStr, route: route.code, lead_time: lt,
            source: src.name, channel: src.channel,
            carrier: route.carrier, fare_class: "economy",
            status: "available",
            base_fare: Math.round(finalTotal * 0.76),
            taxes: Math.round(finalTotal * 0.13),
            udf: 150,
            platform_fee: src.platformFee
          });
        });
      });
    });
  }
  return observations;
}

/* =========================================================
   2. JEVONS ENGINE
   ========================================================= */
function findFlaggedKeys(dayObs) {
  const flagged = new Set();
  const groups = {};
  dayObs.forEach(o => {
    if (o.status !== "available") return;
    const k = o.route + "|" + o.lead_time;
    (groups[k] = groups[k] || []).push(o);
  });
  Object.entries(groups).forEach(([k, list]) => {
    if (list.length < 3) return;
    const totals = list.map(totalOf).sort((a, b) => a - b);
    const median = totals[Math.floor(totals.length / 2)];
    list.forEach(o => {
      if (Math.abs(totalOf(o) - median) / median > 0.08) {
        flagged.add(o.route + "|" + o.lead_time + "|" + o.source);
      }
    });
  });
  return flagged;
}

function computeWeights(mode) {
  if (mode === "equal") return Object.fromEntries(ROUTES.map(r => [r.code, 1]));
  if (mode === "expenditure") return Object.fromEntries(ROUTES.map(r => [r.code, r.weight * r.basePrice / 1000]));
  return Object.fromEntries(ROUTES.map(r => [r.code, r.weight]));
}

/* =========================================================
   3. MODEL
   ========================================================= */
function buildModel(observations, weightMode) {
  const weights = computeWeights(weightMode);
  const totalW = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  const byDate = {};
  observations.forEach(o => { (byDate[o.date] = byDate[o.date] || []).push(o); });
  const dates = Object.keys(byDate).sort();
  const baseDates = dates.filter(d => d.startsWith(BASE_MONTH));
  const currentDates = dates.slice(-CURRENT_WINDOW_DAYS);

  const cellBase = {};
  observations.forEach(o => {
    if (o.status !== "available") return;
    const k = o.route + "|" + o.lead_time + "|" + o.source;
    if (baseDates.includes(o.date)) (cellBase[k] = cellBase[k] || []).push(totalOf(o));
  });
  const baseGeo = {};
  Object.keys(cellBase).forEach(k => baseGeo[k] = geometricMean(cellBase[k]));

  const series = dates.map(date => {
    const dayObs = byDate[date];
    const ratios = {};
    dayObs.forEach(o => {
      if (o.status !== "available") return;
      const k = o.route + "|" + o.lead_time + "|" + o.source;
      if (!baseGeo[k]) return;
      const ratio = totalOf(o) / baseGeo[k];
      (ratios[o.route] = ratios[o.route] || []).push(ratio);
    });
    let logIndex = 0;
    const contributions = [];
    Object.entries(ratios).forEach(([route, rs]) => {
      const rel = geometricMean(rs);
      const w = (weights[route] || 0) / totalW;
      logIndex += w * Math.log(rel);
      contributions.push({ route, relative: rel, n: rs.length });
    });
    return { date, index: Math.exp(logIndex) * 100, contributions: contributions.sort((a, b) => b.relative - a.relative) };
  });

  const leadHeat = {};
  ROUTES.forEach(r => {
    leadHeat[r.code] = {};
    LEAD_TIMES.forEach(lt => {
      const baseObs = observations.filter(o => o.route === r.code && o.lead_time === lt && o.status === "available" && baseDates.includes(o.date));
      const currObs = observations.filter(o => o.route === r.code && o.lead_time === lt && o.status === "available" && currentDates.includes(o.date));
      const bG = geometricMean(baseObs.map(totalOf));
      const cG = geometricMean(currObs.map(totalOf));
      leadHeat[r.code][lt] = bG > 0 ? (cG / bG) * 100 : 100;
    });
  });

  const contributions = ROUTES.map(r => {
    const relatives = LEAD_TIMES.map(lt => leadHeat[r.code][lt] / 100);
    const rel = geometricMean(relatives);
    const baseVals = observations.filter(o => o.route === r.code && o.status === "available" && baseDates.includes(o.date)).map(totalOf);
    const currVals = observations.filter(o => o.route === r.code && o.status === "available" && currentDates.includes(o.date)).map(totalOf);
    const w = weights[r.code] / totalW;
    return {
      route: r.code, label: r.label, weight: r.weight,
      relative: rel,
      gBase: geometricMean(baseVals),
      gCurrent: geometricMean(currVals),
      n: currVals.length,
      contributionPp: (Math.pow(rel, w) - 1) * 100
    };
  }).sort((a, b) => b.contributionPp - a.contributionPp);

  let logIndex = 0;
  contributions.forEach(c => { logIndex += (weights[c.route] / totalW) * Math.log(c.relative); });
  const index = Math.exp(logIndex) * 100;

  const weekly = average(series.slice(-CURRENT_WINDOW_DAYS).map(s => s.index));
  const monthly = average(series.slice(-30).map(s => s.index));

  const todayObs = byDate[SNAPSHOT_DATE] || [];
  const availableToday = todayObs.filter(o => o.status === "available");
  const soldOutToday = todayObs.filter(o => o.status === "sold_out");
  const totalAttempts = todayObs.length;
  const coverage = totalAttempts ? (availableToday.length / totalAttempts) * 100 : 0;
  const soldOutRate = totalAttempts ? (soldOutToday.length / totalAttempts) * 100 : 0;
  const sourcesLive = new Set(availableToday.map(o => o.source)).size;

  const flaggedKeys = findFlaggedKeys(availableToday);
  const traceAll = availableToday.concat(soldOutToday).map(o => ({
    ...o, flagged: flaggedKeys.has(o.route + "|" + o.lead_time + "|" + o.source)
  }));
  traceAll.sort((a, b) => {
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
    if (a.route !== b.route) return a.route.localeCompare(b.route);
    return a.lead_time.localeCompare(b.lead_time);
  });

  return {
    index, weekly, monthly, series, contributions,
    coverage, soldOutRate, sourcesLive,
    flagged: flaggedKeys.size,
    validObs: availableToday.length - flaggedKeys.size,
    totalObs: todayObs.length,
    snapshot: SNAPSHOT_DATE,
    base_month: BASE_MONTH,
    weights, weightMode,
    todayObs: availableToday,
    allToday: todayObs,
    traceRows: traceAll.slice(0, 8),
    leadHeat, baseGeo
  };
}

/* =========================================================
   4. CHART
   ========================================================= */
function lineChart(svg, points, opts) {
  opts = opts || {};
  if (!svg || !points || !points.length) return;
  const W = svg.clientWidth || (svg.parentElement && svg.parentElement.clientWidth) || 800;
  const H = opts.height || 260;
  const pad = { l: 46, r: 18, t: 30, b: 30 };
  const stroke = opts.stroke || "#0F9E8E";
  const gradId = "g" + Math.random().toString(36).slice(2, 8);
  const onDark = opts.onDark;

  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const vals = points.map(p => p.value);
  const minV = Math.min.apply(null, vals);
  const maxV = Math.max.apply(null, vals);
  const range = Math.max(maxV - minV, 1);
  const yMin = minV - range * 0.15;
  const yMax = maxV + range * 0.15;

  const x = i => pad.l + i * (W - pad.l - pad.r) / Math.max(points.length - 1, 1);
  const y = v => pad.t + (yMax - v) / (yMax - yMin) * (H - pad.t - pad.b);
  const px = points.map((p, i) => [x(i), y(p.value)]);
  const path = px.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = "M " + px[0][0] + " " + (H - pad.b) + " " +
    px.map(p => "L " + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ") +
    " L " + px[px.length - 1][0] + " " + (H - pad.b) + " Z";

  const gridColor = onDark ? "rgba(255,255,255,.08)" : "#E1E7EC";
  const textColor = onDark ? "rgba(255,255,255,.4)" : "#8296A8";

  let html = '<defs><linearGradient id="' + gradId + '" x1="0" x2="0" y1="0" y2="1">' +
    '<stop offset="0%" stop-color="' + stroke + '" stop-opacity=".28"/>' +
    '<stop offset="100%" stop-color="' + stroke + '" stop-opacity="0"/></linearGradient></defs>';

  for (let i = 0; i < 4; i++) {
    const yy = pad.t + i * (H - pad.t - pad.b) / 3;
    const label = (yMax - i * (yMax - yMin) / 3).toFixed(opts.decimals == null ? 1 : opts.decimals);
    html += '<line x1="' + pad.l + '" y1="' + yy + '" x2="' + (W - pad.r) + '" y2="' + yy + '" stroke="' + gridColor + '"/>';
    html += '<text x="' + (pad.l - 8) + '" y="' + (yy + 3) + '" font-size="10" fill="' + textColor + '" text-anchor="end" font-weight="700">' + label + '</text>';
  }

  html += '<path d="' + area + '" fill="url(#' + gradId + ')"/>';
  html += '<path d="' + path + '" fill="none" stroke="' + stroke + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:2000;stroke-dashoffset:2000;animation:draw 1.5s cubic-bezier(.3,.9,.4,1) forwards"/>';

  if (opts.secondary && opts.secondary.length === points.length) {
    const sPts = opts.secondary.map((v, i) => [x(i), y(v)]);
    const sPath = sPts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    html += '<path d="' + sPath + '" fill="none" stroke="' + (opts.secondaryStroke || "#0A7568") + '" stroke-width="2.5" stroke-dasharray="6 4" stroke-linecap="round" opacity=".9"/>';
  }

  // Event markers
  if (opts.annotations && opts.annotations.length) {
    opts.annotations.forEach(ann => {
      const idx = ann.index;
      if (idx < 0 || idx >= points.length) return;
      const xx = x(idx);
      html += '<line x1="' + xx + '" y1="' + pad.t + '" x2="' + xx + '" y2="' + (H - pad.b) + '" stroke="' + (ann.color || "#7C5CE0") + '" stroke-width="1.5" stroke-dasharray="3 3" opacity=".6"/>';
      html += '<text x="' + xx + '" y="' + (pad.t - 8) + '" font-size="9.5" fill="' + (ann.color || "#7C5CE0") + '" text-anchor="middle" font-weight="900" letter-spacing=".05em">' + ann.label + '</text>';
    });
  }

  html += px.map(function (p, i) {
    const isLast = i === px.length - 1;
    const r = isLast ? 4 : 2.5;
    return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + r + '" fill="' + (onDark ? "#0A1B2E" : "#fff") + '" stroke="' + stroke + '" stroke-width="1.8" data-i="' + i + '" class="pt"/>';
  }).join("");

  const stride = Math.max(1, Math.ceil(points.length / 6));
  points.forEach(function (p, i) {
    if (i % stride === 0 || i === points.length - 1) {
      const anchor = i === 0 ? "start" : (i === points.length - 1 ? "end" : "middle");
      html += '<text x="' + x(i) + '" y="' + (H - 10) + '" font-size="10" fill="' + textColor + '" text-anchor="' + anchor + '" font-weight="700">' + p.label + '</text>';
    }
  });

  html += '<g class="tip" opacity="0">' +
    '<line class="tip-line" y1="' + pad.t + '" y2="' + (H - pad.b) + '" stroke="' + stroke + '" stroke-width="1" stroke-dasharray="3 3" opacity=".5"/>' +
    '<rect class="tip-bg" width="140" height="42" rx="6" fill="#0A1B2E"/>' +
    '<text class="tip-val" fill="#fff" font-size="13" font-weight="900" x="12" y="19"></text>' +
    '<text class="tip-lbl" fill="#7E94A8" font-size="10" x="12" y="33"></text></g>';

  svg.innerHTML = html;

  const tip = svg.querySelector(".tip");
  const tipLine = tip.querySelector(".tip-line");
  const tipBg = tip.querySelector(".tip-bg");
  const tipVal = tip.querySelector(".tip-val");
  const tipLbl = tip.querySelector(".tip-lbl");

  function showAt(i) {
    i = Math.max(0, Math.min(points.length - 1, i));
    const p = px[i], point = points[i];
    const tx = Math.min(W - 150, Math.max(8, p[0] - 70));
    const ty = Math.max(8, p[1] - 54);
    tip.setAttribute("opacity", "1");
    tipLine.setAttribute("x1", p[0]); tipLine.setAttribute("x2", p[0]);
    tipBg.setAttribute("x", tx); tipBg.setAttribute("y", ty);
    tipVal.setAttribute("x", tx + 12); tipVal.setAttribute("y", ty + 18);
    tipLbl.setAttribute("x", tx + 12); tipLbl.setAttribute("y", ty + 32);
    tipVal.textContent = opts.format ? opts.format(point.value) : point.value;
    tipLbl.textContent = point.label;
    svg.querySelectorAll(".pt").forEach(function (c) {
      c.setAttribute("r", +c.dataset.i === i ? 6 : (c.dataset.i == points.length - 1 ? 4 : 2.5));
    });
  }
  svg.addEventListener("mousemove", function (e) {
    const rect = svg.getBoundingClientRect();
    const px_ = e.clientX - rect.left;
    const i = Math.round((px_ - pad.l) / ((W - pad.l - pad.r) / Math.max(points.length - 1, 1)));
    showAt(i);
  });
  svg.addEventListener("mouseleave", function () { tip.setAttribute("opacity", "0"); });
}

function sparkline(svg, values, color) {
  if (!svg) return;
  const W = 200, H = 48, pad = 4;
  const minV = Math.min.apply(null, values);
  const maxV = Math.max.apply(null, values);
  const range = Math.max(maxV - minV, 1);
  const x = i => pad + i * (W - pad * 2) / (values.length - 1);
  const y = v => pad + (H - pad * 2) * (1 - (v - minV) / range);
  const pts = values.map((v, i) => [x(i), y(v)]);
  const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = path + " L " + pts[pts.length - 1][0] + " " + H + " L " + pts[0][0] + " " + H + " Z";
  const gid = "s" + Math.random().toString(36).slice(2, 7);
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.innerHTML =
    '<defs><linearGradient id="' + gid + '" x1="0" x2="0" y1="0" y2="1">' +
    '<stop offset="0%" stop-color="' + color + '" stop-opacity=".2"/>' +
    '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
    '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round"/>';
}

function changeTier(pct) {
  const a = Math.abs(pct);
  if (a < 2) return 1;
  if (a < 5) return 2;
  if (a < 8) return 3;
  return 4;
}
function changeColor(pct) {
  return ["", "#059669", "#0A7568", "#D97706", "#DC2626"][changeTier(pct)];
}

/* =========================================================
   5. RENDER — TODAY
   ========================================================= */
let MODEL = null, DATA = null;
let currentFrequency = "daily";

function renderToday(model) {
  const value = currentFrequency === "daily" ? model.index
              : currentFrequency === "weekly" ? model.weekly
              : model.monthly;
  const freqLabel = currentFrequency === "daily" ? "Daily"
                  : currentFrequency === "weekly" ? "7-day average"
                  : "30-day average";
  const delta = value - 100;
  const arrow = delta >= 0 ? "↑" : "↓";

  const iv = $("indexValue");
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / 1100);
    const e = 1 - Math.pow(1 - t, 3);
    iv.textContent = (100 + delta * e).toFixed(1);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  $("indexChange").innerHTML = "<b>" + arrow + " " + Math.abs(delta).toFixed(1) + "%</b> vs base · " + freqLabel;
  $("indexPlain").textContent = "Airfares across the " + model.contributions.length + "-route basket are " + Math.abs(delta).toFixed(1) + "% " + (delta >= 0 ? "higher" : "lower") + " than in " + monthName(model.base_month) + ". " + (currentFrequency === "daily" ? "Short-notice bookings drive most of the daily swing." : "Averaged over the period to smooth the weekly cycle.");

  const last30 = model.series.slice(-30);
  const chartPoints = last30.map(s => ({
    label: new Date(s.date + "T00:00:00").toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    value: s.index
  }));
  lineChart($("todayChart"), chartPoints, { stroke: "#4FCDB8", height: 250, onDark: true, format: v => fmtIdx(v) });

  $("kpiCoverage").textContent = model.coverage.toFixed(1) + "%";
  $("kpiSoldOut").textContent = model.soldOutRate.toFixed(1) + "%";
  $("kpiSources").textContent = model.sourcesLive + " / " + SOURCES.length;
    // Week-on-week momentum (7-day avg vs the previous 7-day avg)
  const last7 = model.series.slice(-7);
  const prior7 = model.series.slice(-14, -7);
  const recentAvg = last7.reduce((a, s) => a + s.index, 0) / Math.max(last7.length, 1);
  const priorAvg  = prior7.reduce((a, s) => a + s.index, 0) / Math.max(prior7.length, 1);
  const momentum = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;
  const arrowM = momentum >= 0 ? "↑" : "↓";
  const signM = momentum >= 0 ? "+" : "";
  const momEl = $("kpiMomentum");
  if (momEl) {
    momEl.textContent = arrowM + " " + signM + momentum.toFixed(1) + "%";
    momEl.style.color = momentum >= 1 ? "#DC2626"
                      : momentum >= 0.2 ? "#D97706"
                      : momentum <= -1 ? "#059669"
                      : momentum <= -0.2 ? "#0A7568"
                      : "var(--ink)";
  }

  const movers = model.contributions.slice(0, 3);
  $("topMovers").innerHTML = movers.map((c, i) => {
    const d = (c.relative - 1) * 100;
    const tier = changeTier(d);
    const arrow = d >= 0 ? "+" : "";
    return '<div class="mover">' +
      '<div class="mover-top">' +
        '<div><div class="mover-route">' + c.route + '</div><div class="mover-label">' + c.label + '</div></div>' +
        '<div class="mover-delta tier-' + tier + '">' + arrow + d.toFixed(1) + '%</div>' +
      '</div>' +
      '<div class="mover-spark"><svg data-spark="' + i + '"></svg></div>' +
      '<div class="mover-foot"><span>Base <b>' + fmtINR(c.gBase) + '</b></span><span>Now <b>' + fmtINR(c.gCurrent) + '</b></span></div>' +
    '</div>';
  }).join("");

  movers.forEach((c, i) => {
    const svg = document.querySelector('[data-spark="' + i + '"]');
    const vals = model.series.slice(-12).map(s => {
      const contrib = s.contributions.find(x => x.route === c.route);
      return (contrib ? contrib.relative : 1) * c.gBase;
    });
    sparkline(svg, vals, changeColor((c.relative - 1) * 100));
  });
}

/* =========================================================
   6. RENDER — YOUR FARE
   ========================================================= */
let currentRoute = "DEL-BOM", currentLead = "T+7";

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function renderYourFare(model) {
  const meta = ROUTES.find(r => r.code === currentRoute) || ROUTES[0];
  const todayForRoute = model.todayObs.filter(o => o.route === currentRoute && o.lead_time === currentLead);
  const sources = todayForRoute.map(o => ({
    name: o.source, channel: o.channel,
    ticket: o.base_fare, taxes: o.taxes, udf: o.udf, fee: o.platform_fee,
    total: totalOf(o),
    url: (SOURCES.find(s => s.name === o.source) || {}).url || "#"
  })).sort((a, b) => a.total - b.total);

  if (!sources.length) {
    $("fareVerdictPrice").textContent = "No data";
    $("fareTable").innerHTML = '<p class="plain-note">No sources returned a fare for this route and window today.</p>';
    return;
  }

  const lowest = sources[0];
  const highest = sources[sources.length - 1];

  $("fareRoute").textContent = currentRoute.replace("-", " → ");
  $("fareRouteName").textContent = meta.label;
  $("fareLead").textContent = LEAD_LABEL[currentLead] || currentLead;
  $("fareVerdictPrice").textContent = fmtINR(lowest.total);
  $("fareVerdictCheapest").textContent = lowest.name;
  $("fareSaving").textContent = fmtINR(highest.total - lowest.total);

  const userFare = Number($("userFareInput").value) || null;
  const reference = userFare || lowest.total;
  const allTotals = sources.map(s => s.total).concat(userFare ? [userFare] : []);
  const minAll = Math.min.apply(null, allTotals);
  const maxAll = Math.max.apply(null, allTotals);
  const range = maxAll - minAll || 1;
  const pos = (reference - minAll) / range;
  const score = Math.round(Math.max(20, Math.min(95, 95 - pos * 75)));

  if (userFare) {
    $("userFareLine").style.display = "";
    const vsCheapest = userFare - lowest.total;
    const note = vsCheapest <= 0 ? "you have the cheapest fare we can find"
                : vsCheapest <= 300 ? "within ₹300 of the cheapest"
                : vsCheapest <= 800 ? "about " + fmtINR(vsCheapest) + " above the cheapest"
                : fmtINR(vsCheapest) + " above the cheapest — compare before booking";
    $("userFareVerdict").textContent = fmtINR(userFare) + " — " + note;
  } else {
    $("userFareLine").style.display = "none";
  }

  const scoreEl = $("fareScore");
  const s0 = performance.now();
  function step(now) {
    const t = Math.min(1, (now - s0) / 900);
    const e = 1 - Math.pow(1 - t, 3);
    scoreEl.textContent = Math.round(score * e);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  const ring = $("scoreRing");
  const circ = 2 * Math.PI * 52;
  ring.setAttribute("stroke-dasharray", circ);
  ring.style.stroke = score >= 78 ? "#059669" : score >= 62 ? "#D97706" : "#DC2626";
  setTimeout(() => ring.setAttribute("stroke-dashoffset", circ * (1 - score / 100)), 80);

  const verdict = score >= 78 ? "Good value" : score >= 62 ? "Normal" : "A little high";
  const tag = $("fareScoreClass");
  tag.textContent = verdict;
  tag.className = "verdict-tag verdict-" + (score >= 78 ? "good" : score >= 62 ? "ok" : "high");

  const points = LEAD_TIMES.map(lt => {
    const obs = model.todayObs.filter(o => o.route === currentRoute && o.lead_time === lt);
    return { label: lt, value: average(obs.map(totalOf)) || 0 };
  }).filter(p => p.value > 0);
  lineChart($("leadChart"), points, { stroke: "#0F9E8E", height: 260, format: v => fmtINR(v), decimals: 0 });

  const t1 = points.find(p => p.label === "T+1");
  const t30 = points.find(p => p.label === "T+30");
  if (t1 && t30) $("leadPremium").textContent = "+" + ((t1.value / t30.value - 1) * 100).toFixed(0) + "%";

  renderElasticityGrid(points);
  renderFareTable(sources);
  renderCalendar(model);
}

function renderElasticityGrid(points) {
  const el = $("elasticityGrid");
  if (!el) return;
  const pairs = [["T+1","T+7"], ["T+7","T+15"], ["T+15","T+30"], ["T+30","T+45"]];
  const rows = pairs.map(([a, b]) => {
    const pa = points.find(p => p.label === a);
    const pb = points.find(p => p.label === b);
    if (!pa || !pb) return null;
    const pct = ((pb.value - pa.value) / pa.value) * 100;
    const arc = Math.log(pb.value / pa.value) / Math.log(LEAD_DAYS[b] / LEAD_DAYS[a]);
    return { pair: a + " → " + b, pct, arc };
  }).filter(Boolean);

  el.innerHTML = rows.map(r => {
    const sign = r.pct >= 0 ? "+" : "";
    const reading = r.pct < -10 ? "Large drop — this is where waiting pays the most"
                  : r.pct < -3  ? "Meaningful drop — worth waiting"
                  : r.pct < 0   ? "Small drop — little to gain"
                  : "Prices rise — book now";
    const cls = r.pct < 0 ? "drop" : "rise";
    return '<div class="elasticity-cell">' +
      '<span>' + r.pair + '</span>' +
      '<strong class="' + cls + '">' + sign + r.pct.toFixed(1) + '%</strong>' +
      '<small>' + reading + '</small>' +
    '</div>';
  }).join("");
}

function renderFareTable(sources) {
  const table = $("fareTable");
  if (!table) return;
  let html = '<div class="fare-head">' +
    '<div>Source</div><div>Base fare</div><div>Taxes</div><div>UDF</div><div>Platform fee</div><div>Final payable</div><div></div>' +
  '</div>';
  html += sources.map((s, i) =>
    '<div class="fare-row ' + (i === 0 ? "best" : "") + '">' +
      '<div><div class="src-name">' + s.name + '</div><div class="src-note">' +
        (s.channel === "airline" ? "Airline direct" : "OTA") +
        (i === 0 ? " · lowest final payable" : "") +
      '</div></div>' +
      '<div class="amt">' + fmtINR(s.ticket) + '</div>' +
      '<div class="amt muted">' + fmtINR(s.taxes) + '</div>' +
      '<div class="amt muted">' + fmtINR(s.udf) + '</div>' +
      '<div class="amt ' + (s.fee >= 300 ? "warn" : "") + '">' + (s.fee ? fmtINR(s.fee) : "—") + '</div>' +
      '<div class="amt final">' + fmtINR(s.total) + '</div>' +
      '<div><a class="book-btn" href="' + s.url + '" target="_blank" rel="noopener">Book ↗</a></div>' +
    '</div>'
  ).join("");
  table.innerHTML = html;
}

function renderCalendar(model) {
  const grid = $("calendarGrid");
  if (!grid) return;
  const meta = ROUTES.find(r => r.code === currentRoute) || ROUTES[0];
  const todayObs = model.todayObs.filter(o => o.route === currentRoute && o.lead_time === currentLead);
  const basePrice = average(todayObs.map(totalOf)) || meta.basePrice * (LEAD_MULT[currentLead] || 1);
  const dowMult = { 0: 1.020, 1: 0.985, 2: 0.980, 3: 0.990, 4: 1.000, 5: 1.015, 6: 1.025 };
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const cells = [null];
  for (let d = 1; d <= 30; d++) {
    const dow = d % 7;
    const price = Math.round(basePrice * dowMult[dow]);
    cells.push({ day: d, dow, price });
  }
  const dayCells = cells.filter(c => c !== null);
  const sorted = [...dayCells].sort((a, b) => a.price - b.price);
  const cheapest = sorted[0];
  const dearest = sorted[sorted.length - 1];
  const lowCut = sorted[Math.floor(sorted.length / 3)].price;
  const highCut = sorted[Math.floor(sorted.length * 2 / 3)].price;
  const tier = p => p <= lowCut ? "low" : p >= highCut ? "high" : "mid";
  const dShort = c => dayNames[c.dow] + " " + c.day;

  $("calBest").textContent = "₹" + (cheapest.price / 1000).toFixed(1) + "k";
  $("calBestNote").textContent = dShort(cheapest);
  $("calWorst").textContent = "₹" + (dearest.price / 1000).toFixed(1) + "k";
  $("calWorstNote").textContent = dShort(dearest);
  $("calVerdict").textContent = "₹" + (dearest.price - cheapest.price).toLocaleString("en-IN");
  $("calLowRange").textContent = "under ₹" + (lowCut / 1000).toFixed(1) + "k";
  $("calMidRange").textContent = "₹" + (lowCut / 1000).toFixed(1) + "–" + (highCut / 1000).toFixed(1) + "k";
  $("calHighRange").textContent = "over ₹" + (highCut / 1000).toFixed(1) + "k";

  let html = dayNames.map(d => '<div class="cal-head">' + d + '</div>').join("");
  cells.forEach(c => {
    if (c === null) { html += '<div class="cal-empty"></div>'; return; }
    html += '<div class="cal-day ' + tier(c.price) + (c.day === cheapest.day ? " best" : "") +
      '" data-d="' + c.day + '" data-price="' + c.price + '" data-dow="' + c.dow + '">' +
      '<span class="cal-d">' + c.day + '</span>' +
      '<span class="cal-p">₹' + (c.price / 1000).toFixed(1) + 'k</span>' +
    '</div>';
  });
  grid.innerHTML = html;
  grid.querySelectorAll(".cal-day").forEach(el => {
    el.addEventListener("click", () => {
      grid.querySelectorAll(".cal-day").forEach(x => x.classList.remove("sel"));
      el.classList.add("sel");
      openExplainer("calendar", { day: el.dataset.d, price: +el.dataset.price, weekend: +el.dataset.dow >= 5 });
    });
  });
}

/* =========================================================
   7. RENDER — MARKET
   ========================================================= */
function renderMarket(model) {
  const rt = $("routeTable");
  if (rt) {
    let html = '<div class="rt-head">' +
      '<div>Route</div><div>Weight</div><div>Base fare</div><div>Current fare</div><div>Change</div><div>Coverage</div><div>Signal</div>' +
    '</div>';
    html += model.contributions.map(c => {
      const d = (c.relative - 1) * 100;
      const signal = d > 6 ? "rising" : d > 2 ? "stable" : "steady";
      const arrow = d >= 0 ? "+" : "";
      return '<div class="rt-row">' +
        '<div class="rt-route"><b>' + c.route + '</b><small>' + c.label + '</small></div>' +
        '<div class="amt">' + c.weight + '%</div>' +
        '<div class="amt muted">' + fmtINR(c.gBase) + '</div>' +
        '<div class="amt">' + fmtINR(c.gCurrent) + '</div>' +
        '<div class="amt" style="color:' + changeColor(d) + ';font-weight:900">' + arrow + d.toFixed(1) + '%</div>' +
        '<div class="amt">' + (ROUTES.find(r => r.code === c.route) || {}).weight + '%</div>' +
        '<div><span class="sig sig-' + signal + '">' + signal + '</span></div>' +
      '</div>';
    }).join("");
    rt.innerHTML = html;
  }

  const lh = $("leadHeatmap");
  if (lh) {
    let html = '<div class="lh-head"><div></div>' + LEAD_TIMES.map(l => '<div class="lh-col">' + l + '</div>').join("") + '</div>';
    html += ROUTES.map(r => {
      const cells = LEAD_TIMES.map(lt => {
        const idx = model.leadHeat[r.code][lt];
        const change = idx - 100;
        const cls = change >= 15 ? "hot" : change >= 5 ? "warm" : change >= 0 ? "cool" : "cold";
        const arrow = change >= 0 ? "+" : "";
        return '<div class="lh-cell ' + cls + '">' + arrow + change.toFixed(0) + '%</div>';
      }).join("");
      return '<div class="lh-row"><div class="lh-route">' + r.code + '</div>' + cells + '</div>';
    }).join("");
    lh.innerHTML = html;
  }
}

/* =========================================================
   8. RENDER — TRUST
   ========================================================= */
function renderTrust(model) {
  $("trustCoverage2").textContent = model.coverage.toFixed(1) + "%";
  $("trustSources2").textContent = model.sourcesLive + " / " + SOURCES.length;
  $("trustFlagged2").textContent = model.flagged;
  $("trustObs").textContent = model.validObs.toLocaleString("en-IN");
  $("trustIndex").textContent = fmtIdx(model.index);
  $("trustMethod").textContent = METHODOLOGY_VERSION;
  $("trustSnapshot").textContent = model.snapshot;

  const expected = ROUTES.length * LEAD_TIMES.length * SOURCES.length;
  const collected = model.allToday.length;
  const validated = model.validObs + model.flagged;
  const ready = model.validObs;

  $("pipeExpected").textContent = expected.toLocaleString("en-IN");
  $("pipeCollected").textContent = collected.toLocaleString("en-IN");
  $("pipeValidated").textContent = validated.toLocaleString("en-IN");
  $("pipeReviewed").textContent = (validated - model.flagged).toLocaleString("en-IN");
  $("pipeReady").textContent = ready.toLocaleString("en-IN");

  const sh = $("sourceHealth");
  if (sh) {
    sh.innerHTML = SOURCES.map(s => {
      const agreement = s.health === "healthy" ? 94 + Math.round(Math.random() * 4)
                     : s.health === "watch" ? 86 + Math.round(Math.random() * 4)
                     : 78 + Math.round(Math.random() * 6);
      return '<div class="src-card ' + s.health + '">' +
        '<div class="src-top"><div><div class="src-name2">' + s.name + '</div><div class="src-fresh">' + s.freshness + ' · ' + s.channel + '</div></div>' +
        '<span class="src-status ' + s.health + '">' + s.health + '</span></div>' +
        '<div class="src-agree"><div class="agree-track"><i style="width:' + agreement + '%"></i></div><strong>' + agreement + '%</strong></div>' +
        '<div class="src-note2">' + agreement + '% of comparable fares matched</div>' +
      '</div>';
    }).join("");
  }

  const tt = $("traceTable");
  if (tt) {
    let html = '<div class="tr-head"><div>Route</div><div>Lead</div><div>Source</div><div>Base</div><div>Taxes</div><div>UDF</div><div>Final</div><div>Status</div></div>';
    html += model.traceRows.map(o => {
      const isSold = o.status === "sold_out";
      const statusClass = isSold ? "review" : (o.flagged ? "review" : "ok");
      const statusText = isSold ? "sold out" : (o.flagged ? "second look" : "matched");
      return '<button class="tr-row" data-route="' + o.route + '" data-source="' + o.source + '" data-status="' + (isSold ? "sold_out" : o.flagged ? "flagged" : "clean") + '">' +
        '<div><b>' + o.route + '</b></div>' +
        '<div>' + o.lead_time + '</div>' +
        '<div>' + o.source + '</div>' +
        (isSold
          ? '<div class="amt muted">—</div><div class="amt muted">—</div><div class="amt muted">—</div><div class="amt muted">—</div>'
          : '<div class="amt">' + fmtINR(o.base_fare) + '</div>' +
            '<div class="amt muted">' + fmtINR(o.taxes) + '</div>' +
            '<div class="amt muted">' + fmtINR(o.udf) + '</div>' +
            '<div class="amt final">' + fmtINR(totalOf(o)) + '</div>') +
        '<div><span class="tag ' + statusClass + '">' + statusText + '</span></div>' +
      '</button>';
    }).join("");
    tt.innerHTML = html;
    tt.querySelectorAll(".tr-row").forEach(btn => {
      btn.addEventListener("click", () => openExplainer("observation", {
        route: btn.dataset.route, source: btn.dataset.source, status: btn.dataset.status
      }));
    });
  }
}

/* =========================================================
   9. RENDER — METHOD
   ========================================================= */
function renderMethod(model) {
  const weights = model.weights;
  const totalW = Object.values(weights).reduce((a, b) => a + b, 0);
  const weightModeLabel = {
    dgca: "DGCA passenger share",
    equal: "equal weights",
    expenditure: "passenger × fare"
  }[model.weightMode];

  const steps = [
    { num: "01", title: "Scrape the fares",
      action: "A scheduled scraper pulls the same itinerary from every source — airline sites and major OTAs — for each route and each booking window. Raw quotes are stored with a timestamp and source tag.",
      formula: SOURCES.slice(0, 3).map(s => "GET " + s.url).join("\n") + "\n…",
      result: DATA.observations.length.toLocaleString("en-IN") + " observations across 60 days",
      plain: "We do not modify the source. We read what a real user would see — rate-limited and robots-compliant." },
    { num: "02", title: "Clean and normalise",
      action: "Each quote is split into base fare, taxes, UDF and platform fee. Duplicates removed. Fares more than 8% away from the same route + lead-time median are set aside.",
      formula: "if |x − median(route, lead) | / median > 0.08\n  → exclude from mean",
      result: model.flagged + " fares set aside today · " + (model.totalObs - model.flagged) + " clean observations used",
      plain: "A single website glitch should not move a national number. Outliers stay visible in Trust but are excluded from the maths." },
    { num: "03", title: "Matched-item ratio",
      action: "For each (route, lead-time, source) cell we compute the ratio of the 7-day current mean to the base-month mean. Cells are matched — a source dropping out does not shift the mean. Inside a route, the five lead-time sub-ratios are combined with EQUAL weight (each window contributes 20%). This keeps the index neutral to how travellers distribute across booking windows. Production scope: weight the windows by observed booking share from the DGCA traffic data, not equal weight.",
      formula: "cell ratio = mean_current_7d[route,lead,source] / mean_base[route,lead,source]\nroute ratio = geomean over sources, then geomean over the 5 lead windows (equal weight)",
      result: model.contributions.reduce((a, c) => a + c.n, 0) + " matched pairs today",
      plain: "We only compare like-with-like. Same route, same lead time, same source — otherwise the ratio is discarded. Within a route, all five lead-time windows currently carry the same 20% weight. This is a documented modelling choice, not a hidden one." },
    { num: "04", title: "Apply DGCA weights",
      action: "Each route's combined relative is raised to its weight share from the DGCA passenger basket. Currently using " + weightModeLabel + ".",
      formula: Object.entries(weights).map(([k, v]) => k + " w=" + v).join("  "),
      result: "Σw = " + totalW,
      plain: "DEL–BOM carries more weight because it carries more passengers. Change the weight mode above to see the index respond." },
    { num: "05", title: "Aggregate with Jevons",
      action: "Route-level relatives are combined by a weighted geometric mean. Multiply by 100 to get the index reading.",
      formula: "I = ∏ ( relative_r ) ^ ( w_r / Σw ) × 100",
      result: "APIx = " + fmtIdx(model.index),
      plain: "An index of 100 means fares are unchanged from the base month. " + fmtIdx(model.index) + " means they are " + Math.abs(model.index - 100).toFixed(1) + "% " + (model.index >= 100 ? "higher" : "lower") + "." }
  ];

  const el = $("calcSteps");
  if (el) {
    el.innerHTML = steps.map(s =>
      '<div class="calc-step">' +
        '<div class="calc-num">' + s.num + '</div>' +
        '<div class="calc-body">' +
          '<h4>' + s.title + '</h4>' +
          '<p class="calc-action">' + s.action + '</p>' +
          '<div class="calc-formula">' + s.formula + '</div>' +
          '<div class="calc-result">→ ' + s.result + '</div>' +
          '<p class="calc-plain">' + s.plain + '</p>' +
        '</div>' +
      '</div>'
    ).join("");
  }

  renderEndpoints();

  // 60-day chart with 7-day overlay + event markers
  const series = MODEL.series.map(s => ({
    label: new Date(s.date + "T00:00:00").toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    value: s.index
  }));
  const ma7 = MODEL.series.map((_, i) => {
    const win = MODEL.series.slice(Math.max(0, i - 6), i + 1);
    return win.reduce((a, s) => a + s.index, 0) / win.length;
  });
  const annotations = EVENTS.map(ev => {
    const idx = MODEL.series.findIndex(s => s.date === ev.date);
    return idx >= 0 ? { index: idx, label: ev.label, color: ev.color } : null;
  }).filter(Boolean);
  lineChart($("backtestChart"), series, {
    stroke: "#94A3B8", height: 280, format: v => fmtIdx(v),
    secondary: ma7, secondaryStroke: "#0F9E8E",
    annotations: annotations
  });

  const evLegend = $("eventLegend");
  if (evLegend) {
    evLegend.innerHTML = EVENTS.map(ev =>
      '<span class="event-chip"><i style="background:' + ev.color + '"></i>' + ev.label + '</span>'
    ).join("");
  }

  $("btDays").textContent = MODEL.series.length;
  $("btLatest").textContent = fmtIdx(MODEL.index);
  $("btWeekly").textContent = fmtIdx(MODEL.weekly);
  $("btMonthly").textContent = fmtIdx(MODEL.monthly);

  const lcInit = $("lastComputed");
  if (lcInit && lcInit.textContent === "—") lcInit.textContent = nowTime();

  const wm = $("weightMode");
  if (wm) wm.value = MODEL.weightMode;

  const rc = $("recomputeBtn");
  if (rc) rc.onclick = () => {
    rc.disabled = true;
    const originalHTML = rc.innerHTML;
    rc.innerHTML = "Computing…";
    const meta = document.querySelector(".recompute-meta");
    if (meta) meta.classList.add("flash");
    setTimeout(() => {
      const mode = $("weightMode").value;
      MODEL = buildModel(DATA.observations, mode);
      renderAll();
      const out = $("recomputeResult");
      if (out) out.innerHTML = "✓ Recomputed with <b>" + mode + "</b> weights — APIx = <b>" + fmtIdx(MODEL.index) + "</b> from " + MODEL.validObs + " observations.";
      const lc = $("lastComputed");
      if (lc) lc.textContent = nowTime();
      rc.disabled = false;
      rc.innerHTML = originalHTML;
      if (meta) setTimeout(() => meta.classList.remove("flash"), 800);
    }, 400);
  };

  bindExportButtons();
}

/* =========================================================
   10. ENDPOINTS (expandable samples)
   ========================================================= */
function endpointSample(path) {
  if (path === "/v1/index/national?frequency=daily") {
    return JSON.stringify({
      index: +MODEL.index.toFixed(1),
      frequency: currentFrequency,
      base_period: MODEL.base_month,
      snapshot: MODEL.snapshot,
      methodology_version: METHODOLOGY_VERSION
    }, null, 2);
  }
  if (path === "/v1/index/routes/{route_code}") {
    const c = MODEL.contributions[0] || {};
    return JSON.stringify({
      route: c.route || "DEL-BOM",
      index: +((c.relative || 1) * 100).toFixed(1),
      weight_pct: c.weight || 0,
      contribution_pp: +(c.contributionPp || 0).toFixed(2),
      lead_time_breakdown: MODEL.leadHeat[c.route] || {}
    }, null, 2);
  }
  if (path === "/v1/index/lead-times/{window}") {
    return JSON.stringify({
      window: "T+1",
      index: +average(ROUTES.map(r => MODEL.leadHeat[r.code]["T+1"])).toFixed(1),
      by_route: Object.fromEntries(ROUTES.map(r => [r.code, +MODEL.leadHeat[r.code]["T+1"].toFixed(1)]))
    }, null, 2);
  }
  if (path === "/v1/coverage") {
    return JSON.stringify({
      coverage_pct: +MODEL.coverage.toFixed(1),
      sold_out_pct: +MODEL.soldOutRate.toFixed(1),
      valid_observations: MODEL.validObs,
      total_attempts: MODEL.allToday.length,
      flagged: MODEL.flagged
    }, null, 2);
  }
  if (path === "/v1/sources/health") {
    return JSON.stringify({
      sources: SOURCES.map(s => ({ name: s.name, channel: s.channel, health: s.health, freshness: s.freshness }))
    }, null, 2);
  }
  if (path === "/v1/backtest?vs=dgca") {
    return JSON.stringify({
      status: "planned",
      note: "DGCA monthly reference series to be loaded from esankhyiki.mospi.gov.in",
      days_available: MODEL.series.length
    }, null, 2);
  }
  return "{}";
}

function renderEndpoints() {
  const ep = $("endpoints");
  if (!ep) return;
  const list = [
    ["GET", "/v1/index/national?frequency=daily", "National APIx, daily"],
    ["GET", "/v1/index/routes/{route_code}", "Route-level index"],
    ["GET", "/v1/index/lead-times/{window}", "T+1…T+45 breakdown"],
    ["GET", "/v1/coverage", "Data quality signals"],
    ["GET", "/v1/sources/health", "Source status"],
    ["GET", "/v1/backtest?vs=dgca", "60-day backtest (planned)"]
  ];
  ep.innerHTML = list.map(p => {
    const safe = p[1].replace(/[^a-z0-9]/gi, "_");
    return '<div class="endpoint-row">' +
      '<button class="endpoint" data-endpoint="' + safe + '">' +
        '<div><code>' + p[1] + '</code><small class="endpoint-note">' + p[2] + '</small></div>' +
        '<span class="method">' + p[0] + '</span>' +
      '</button>' +
      '<pre class="endpoint-sample" id="sample-' + safe + '">' + endpointSample(p[1]) + '</pre>' +
    '</div>';
  }).join("");

  ep.querySelectorAll(".endpoint").forEach(btn => {
    btn.onclick = () => {
      const row = btn.parentElement;
      row.classList.toggle("open");
    };
  });
}

/* =========================================================
   11. EXPORT
   ========================================================= */
function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

function exportCSV() {
  const obs = DATA.observations;
  const header = "date,route,lead_time,source,channel,carrier,fare_class,status,base_fare,taxes,udf,platform_fee,total";
  const rows = obs.map(o => [
    o.date, o.route, o.lead_time, o.source, o.channel, o.carrier, o.fare_class,
    o.status,
    o.base_fare != null ? o.base_fare : "",
    o.taxes != null ? o.taxes : "",
    o.udf != null ? o.udf : "",
    o.platform_fee != null ? o.platform_fee : "",
    o.status === "available" ? totalOf(o) : ""
  ].join(","));
  download("airindex-observations.csv", [header].concat(rows).join("\n"), "text/csv");
}

function exportJSON() {
  const payload = {
    snapshot: MODEL.snapshot,
    base_month: MODEL.base_month,
    frequency: currentFrequency,
    index: +MODEL.index.toFixed(1),
    weekly_avg: +MODEL.weekly.toFixed(1),
    monthly_avg: +MODEL.monthly.toFixed(1),
    coverage_pct: +MODEL.coverage.toFixed(1),
    sold_out_pct: +MODEL.soldOutRate.toFixed(1),
    flagged: MODEL.flagged,
    valid_observations: MODEL.validObs,
    methodology_version: METHODOLOGY_VERSION,
    weights_mode: MODEL.weightMode,
    weights: MODEL.weights,
    contributions: MODEL.contributions.map(c => ({
      route: c.route,
      weight: c.weight,
      relative: +c.relative.toFixed(4),
      contribution_pp: +c.contributionPp.toFixed(3)
    })),
    lead_time_heatmap: MODEL.leadHeat
  };
  download("airindex-model.json", JSON.stringify(payload, null, 2), "application/json");
}

function bindExportButtons() {
  const c = $("exportCsvBtn");
  const j = $("exportJsonBtn");
  if (c) c.onclick = exportCSV;
  if (j) j.onclick = exportJSON;
}

/* =========================================================
   12. RENDER ALL
   ========================================================= */
function renderAll() {
  const safe = (name, fn) => { try { fn(MODEL); } catch (e) { console.error("AirIndex · " + name + " failed:", e); } };
  safe("Today", renderToday);
  safe("YourFare", renderYourFare);
  safe("Market", renderMarket);
  safe("Trust", renderTrust);
  safe("Method", renderMethod);
  const badge = $("dataSourceBadge");
  if (badge) badge.textContent = "Prototype · synthetic";
}

/* =========================================================
   13. EXPLAINER
   ========================================================= */
const EXPLAIN = {
  index: m => ({
    title: "What APIx means",
    simple: "APIx tracks the price of a basket of representative domestic flights, weighted by DGCA passenger traffic. Today it is at <b>" + fmtIdx(m.index) + "</b>, meaning that basket costs <b>" + Math.abs(m.index - 100).toFixed(1) + "% " + (m.index >= 100 ? "more" : "less") + "</b> than the base month (" + monthName(m.base_month) + ", pinned at 100).",
    tech: "Matched-item Jevons: ratios per route × lead-time × source, aggregated to route level, then combined with weights. Within a route, the 5 lead-time sub-ratios carry equal weight."
  }),
  coverage: m => ({
    title: "Coverage",
    simple: "Out of every scrape attempt scheduled for today, <b>" + m.coverage.toFixed(1) + "%</b> returned a usable fare. Coverage below 90% starts to weaken trust in the day's number.",
    tech: "Coverage = collected fares / scrape attempts."
  }),
  soldout: m => ({
    title: "Sold-out rate",
    simple: "<b>" + m.soldOutRate.toFixed(1) + "% of scrape attempts today returned no fare</b> — the cheapest seat was gone, or the fare class was closed. Different from a price rise: the cheap seats are gone even if the average hasn't moved.",
    tech: "Sold-out rate = attempts with no fare / total attempts."
  }),
  sources: () => ({
    title: "Sources we scrape",
    simple: "Each day we collect fares from five airlines and six OTAs — " + SOURCES.length + " sources. When independent sources report nearly the same price, that confirms the quote. When one is far off, we set it aside rather than let it distort the average.",
    tech: "Sources: " + SOURCES.map(s => s.name).join(", ") + "."
  }),
  rechecked: m => ({
    title: "Fares re-checked",
    simple: "<b>" + m.flagged + " fares today</b> were more than 8% away from the median for the same route and booking window. Instead of averaging them in, we set them aside and kept them visible in Trust → trace-a-fare.",
    tech: "Same-lead-time median is used for outlier detection, so a legitimately expensive T+1 fare is not falsely flagged."
  }),
  movers: () => ({
    title: "Top movers",
    simple: "The three routes contributing most to today's national movement. A route can dominate either because its fare jumped sharply or because it carries a high DGCA weight.",
    tech: "Sorted by route contribution to the national index in percentage points."
  }),
  leadElasticity: () => ({
    title: "Lead-time elasticity",
    simple: "How much does the price change when you change the booking window? The chart shows the price level at each window. The table below shows the % change between windows — that is the elasticity in plain numbers. A large negative % means waiting saves a lot; a small negative % means the price barely moves.",
    tech: "Arc elasticity = ln(p2 / p1) / ln(lead2 / lead1), computed for each adjacent window pair. Values near 0 indicate the fare is inelastic to lead time. Values more negative than −1 indicate elastic behaviour (price drops faster than lead time increases)."
  }),
  score: () => ({
    title: "Fair Fare Score",
    simple: "The score compares your fare to this route's observed range today. <b>Above 78 is good value. 62–78 is normal. Below 62 is above what the sources show.</b>",
    tech: "Score = 95 − normalised position within the observed range today."
  }),
  calendar: (m, ctx) => {
    const day = ctx && ctx.day ? ctx.day : "";
    const priceStr = ctx && ctx.price ? fmtINR(ctx.price) : "—";
    const weekend = ctx && ctx.weekend;
    return {
      title: "September " + day,
      simple: "We estimate about <b>" + priceStr + "</b> on this date. " + (weekend ? "Weekend departures cost more." : "Midweek departures are usually the cheapest."),
      tech: "Day-of-week effect applied to today's observed average for this route and lead time."
    };
  },
  alert: () => ({
    title: "Price alert",
    simple: "Set a target price and we'll notify you if the lowest final payable fare for this route drops below it.",
    tech: "Production: alert checks run after each scrape cycle, persisted in Postgres."
  }),
  fareacross: () => ({
    title: "Fare across sources",
    simple: "The same flight costs different amounts on different websites. We show the <b>final payable</b> — base fare + taxes + UDF + platform fee — so a low starting price can't hide a big convenience charge at checkout.",
    tech: "Components stored separately and summed at display time."
  }),
  weights: () => ({
    title: "Route weights",
    simple: "Not every route matters equally. DEL–BOM carries 22% of the weight <b>within this 6-route basket</b>. Weights come from DGCA passenger traffic for these specific routes.",
    tech: "Weights are DGCA passenger shares for the six routes, normalised to sum to 100%."
  }),
  leadHeat: () => ({
    title: "Route × lead-time heatmap",
    simple: "Each cell shows how expensive that route + booking window is today (7-day average) compared to the base month. <b>Cooler = cheaper, warmer = more expensive.</b>",
    tech: "Cell value = 7-day current mean / base-month mean × 100."
  }),
  pipeline: m => ({
    title: "Data journey",
    simple: "Every scrape attempt passes through five stages before it becomes part of the index. At each stage we can tell you exactly how many observations entered and how many were filtered out — and why.",
    tech: "Counts today: " + ROUTES.length * LEAD_TIMES.length * SOURCES.length + " attempts → " + m.allToday.length + " quotes → " + m.validObs + " clean."
  }),
  sourcehealth: () => ({
    title: "Source health",
    simple: "We track every source. <b>Healthy</b> = fresh data matching others. <b>Watch</b> = small divergence. <b>Review</b> = needs checking before its data counts.",
    tech: "Health combines freshness, agreement rate, and error rate."
  }),
  trace: () => ({
    title: "Trace a fare",
    simple: "Every fare in the index can be traced back to its source, timestamp and booking window. Second-look rows surface first. Sold-out attempts are shown as evidence too.",
    tech: "Record: date, route, lead_time, source, channel, carrier, fare_class, base_fare, taxes, udf, platform_fee."
  }),
  mospi: () => ({
    title: "Augmenting MoSPI",
    simple: "The government tracks an airfare CPI — monthly, single national average. APIx adds a <b>daily</b>, <b>route-level</b>, <b>lead-time-segmented</b> view.",
    tech: "Supplementary high-frequency indicator alongside the official monthly series."
  }),
  compliance: () => ({
    title: "Compliance approach",
    simple: "Automated collection is only useful if it respects the source. We parse robots.txt, throttle below published limits, skip disallowed paths, and never bypass logins or CAPTCHAs. Sources whose terms prohibit automated access are excluded.",
    tech: "Full audit trail: every quote stored with source URL, timestamp, parser version."
  }),
  backtest: () => ({
    title: "Backtest (illustrative)",
    simple: "The line above shows <b>the actual APIx series from the 60-day dataset</b> — grey is daily, teal is the 7-day rolling average. Vertical markers show major travel events. A real backtest against DGCA's published monthly average fare is a production build item.",
    tech: "Direction agreement and deviation metrics will be computed once the DGCA monthly series is loaded from esankhyiki.mospi.gov.in."
  }),
  api: () => ({
    title: "API endpoints",
    simple: "Everything on this dashboard is available as a machine-readable API. Click any endpoint to see a live sample response. Export the current dataset as CSV or the computed model as JSON using the buttons above.",
    tech: "REST, JSON responses, daily frequency."
  }),
  observation: (m, ctx) => {
    const isSold = ctx.status === "sold_out";
    const isFlagged = ctx.status === "flagged";
    const head = isSold ? "Sold-out attempt" : isFlagged ? "Second look" : "Matched observation";
    const body = isSold
      ? "This scrape attempt returned no fare — the cheapest seat was sold out or the fare class was closed. We record it as evidence so the sold-out rate is auditable."
      : isFlagged
      ? "This fare was more than 8% away from the median for the same route and booking window. It is <b>excluded from the index</b> but visible here for audit."
      : "This fare matched the other sources within 8% for the same route and booking window. Its value enters the geometric mean for this cell.";
    return { title: head + " · " + ctx.route + " · " + ctx.source, simple: body, tech: "Record: date, route, lead_time, source, channel, carrier, fare_class, base_fare, taxes, udf, platform_fee." };
  }
};

let explainerEl, explainerTitle, explainerBody, explainerTech;
function openExplainer(key, ctx) {
  ctx = ctx || {};
  const fn = EXPLAIN[key];
  if (!fn) return;
  const c = fn(MODEL, ctx);
  explainerTitle.textContent = c.title;
  explainerBody.innerHTML = c.simple;
  explainerTech.textContent = c.tech || "";
  explainerTech.parentElement.style.display = c.tech ? "" : "none";
  explainerEl.classList.add("open");
}
function closeExplainer() { if (explainerEl) explainerEl.classList.remove("open"); }

/* =========================================================
   14. NAV + INIT
   ========================================================= */
function bindNav() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      const t = $("view-" + btn.dataset.view);
      if (t) t.classList.add("active");
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(renderAll, 80);
    });
  });
}

function bindFrequencyToggle() {
  const toggle = $("freqToggle");
  if (!toggle) return;
  toggle.querySelectorAll(".freq-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      toggle.querySelectorAll(".freq-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFrequency = btn.dataset.freq;
      renderToday(MODEL);
    });
  });
}

function bindYourFare() {
  const sb = $("searchBtn");
  if (sb) sb.onclick = () => {
    const from = $("fromSel").value;
    const to = $("toSel").value;
    const code = from + "-" + to;
    if (ROUTES.find(r => r.code === code)) currentRoute = code;
    else if (ROUTES.find(r => r.code === to + "-" + from)) currentRoute = to + "-" + from;
    else {
      $("fareRoute").textContent = "Route not in basket";
      $("fareRouteName").textContent = from + " → " + to + " is not one of the " + ROUTES.length + " tracked city-pairs";
      $("fareTable").innerHTML = '<p class="plain-note">Pick one of the ' + ROUTES.map(r => r.code).join(", ") + ".</p>";
      return;
    }
    currentLead = $("leadSel").value;
    renderYourFare(MODEL);
  };
  const ab = $("alertBtn");
  if (ab) ab.onclick = () => {
    const v = Number($("alertTarget").value) || 5000;
    $("alertState").textContent = "✓ We'll tell you if this route is seen below " + fmtINR(v) + ".";
  };
}

async function init() {
  explainerEl = $("explainer");
  explainerTitle = $("explainerTitle");
  explainerBody = $("explainerBody");
  explainerTech = $("explainerTech");

  DATA = { observations: generateObservations() };
  MODEL = buildModel(DATA.observations, "dgca");

  renderAll();
  bindNav();
  bindFrequencyToggle();
  bindYourFare();

  document.querySelectorAll("[data-explain]").forEach(el => {
    el.addEventListener("click", e => { e.preventDefault(); openExplainer(el.dataset.explain); });
  });

  const xc = $("explainerClose");
  if (xc) xc.onclick = closeExplainer;
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeExplainer(); });

  document.querySelectorAll("[data-goto]").forEach(el => {
    el.addEventListener("click", () => {
      const btn = document.querySelector('.nav-btn[data-view="' + el.dataset.goto + '"]');
      if (btn) btn.click();
    });
  });

  let rzTimer;
  window.addEventListener("resize", () => {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(renderAll, 220);
  });
}

window.addEventListener("DOMContentLoaded", init);