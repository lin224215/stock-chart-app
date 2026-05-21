const form = document.querySelector("#queryForm");
const stockCodeInput = document.querySelector("#stockCode");
const startDateInput = document.querySelector("#startDate");
const endDateInput = document.querySelector("#endDate");
const statusEl = document.querySelector("#status");
const priceRows = document.querySelector("#priceRows");
const chart = document.querySelector("#priceChart");
const chartRange = document.querySelector("#chartRange");
const downloadCsvButton = document.querySelector("#downloadCsv");

const metrics = {
  days: document.querySelector("#metricDays"),
  close: document.querySelector("#metricClose"),
  return: document.querySelector("#metricReturn"),
  high: document.querySelector("#metricHigh"),
};

let currentRows = [];

function pad(value) {
  return String(value).padStart(2, "0");
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function monthKeysBetween(start, end) {
  const keys = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    keys.push(`${cursor.getFullYear()}${pad(cursor.getMonth() + 1)}01`);
    cursor = addMonths(cursor, 1);
  }
  return keys;
}

function parseTwseDate(value) {
  const [rocYear, month, day] = value.split("/").map(Number);
  return new Date(rocYear + 1911, month - 1, day);
}

function parseNumber(value) {
  if (!value) return null;
  const clean = String(value).replaceAll(",", "").replace("+", "").replace("X", "").trim();
  if (!clean || clean === "--") return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value, digits = 0) {
  if (value == null) return "-";
  return new Intl.NumberFormat("zh-TW", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPrice(value) {
  return formatNumber(value, 2);
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

async function fetchMonth(stockCode, yyyymmdd) {
  const url = new URL("https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY");
  url.searchParams.set("date", yyyymmdd);
  url.searchParams.set("stockNo", stockCode);
  url.searchParams.set("response", "json");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`資料下載失敗：HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.stat !== "OK") {
    return [];
  }
  return (payload.data || []).map((item) => {
    const date = parseTwseDate(item[0]);
    return {
      date,
      dateText: toIsoDate(date),
      open: parseNumber(item[3]),
      high: parseNumber(item[4]),
      low: parseNumber(item[5]),
      close: parseNumber(item[6]),
      change: parseNumber(item[7]),
      volume: parseNumber(item[1]),
      turnover: parseNumber(item[2]),
      trades: parseNumber(item[8]),
    };
  });
}

async function fetchRange(stockCode, start, end) {
  const monthKeys = monthKeysBetween(start, end);
  const chunks = [];
  for (let index = 0; index < monthKeys.length; index += 1) {
    setStatus(`下載資料中：${index + 1}/${monthKeys.length}`);
    chunks.push(await fetchMonth(stockCode, monthKeys[index]));
  }

  return chunks
    .flat()
    .filter((row) => row.date >= start && row.date <= end)
    .sort((a, b) => a.date - b.date);
}

function renderMetrics(rows) {
  if (!rows.length) {
    metrics.days.textContent = "-";
    metrics.close.textContent = "-";
    metrics.return.textContent = "-";
    metrics.high.textContent = "-";
    return;
  }

  const first = rows[0];
  const last = rows.at(-1);
  const high = rows.reduce((best, row) => (row.close > best.close ? row : best), rows[0]);
  const returnPct = last.close / first.close - 1;

  metrics.days.textContent = `${rows.length}`;
  metrics.close.textContent = formatPrice(last.close);
  metrics.return.textContent = `${(returnPct * 100).toFixed(2)}%`;
  metrics.return.className = returnPct >= 0 ? "up" : "down";
  metrics.high.textContent = `${formatPrice(high.close)} (${high.dateText})`;
}

function renderTable(rows) {
  if (!rows.length) {
    priceRows.innerHTML = '<tr><td colspan="9" class="empty-cell">查無資料</td></tr>';
    return;
  }

  priceRows.innerHTML = rows
    .map((row) => {
      const changeClass = row.change > 0 ? "up" : row.change < 0 ? "down" : "";
      return `
        <tr>
          <td>${row.dateText}</td>
          <td>${formatPrice(row.open)}</td>
          <td>${formatPrice(row.high)}</td>
          <td>${formatPrice(row.low)}</td>
          <td>${formatPrice(row.close)}</td>
          <td class="${changeClass}">${formatPrice(row.change)}</td>
          <td>${formatNumber(row.volume)}</td>
          <td>${formatNumber(row.turnover)}</td>
          <td>${formatNumber(row.trades)}</td>
        </tr>
      `;
    })
    .join("");
}

function drawEmptyChart(message) {
  const ctx = chart.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = chart.getBoundingClientRect();
  chart.width = Math.max(1, Math.floor(rect.width * ratio));
  chart.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#657085";
  ctx.font = "700 16px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(message, rect.width / 2, rect.height / 2);
}

function drawChart(rows) {
  if (!rows.length) {
    drawEmptyChart("尚無資料");
    return;
  }

  const ctx = chart.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = chart.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  chart.width = Math.max(1, Math.floor(width * ratio));
  chart.height = Math.max(1, Math.floor(height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const padding = { top: 28, right: 28, bottom: 48, left: 68 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const closes = rows.map((row) => row.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const yMin = min - span * 0.08;
  const yMax = max + span * 0.08;

  ctx.strokeStyle = "#d8dee9";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#657085";
  ctx.font = "12px system-ui";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (plotHeight / 4) * i;
    const value = yMax - ((yMax - yMin) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(value.toFixed(2), padding.left - 10, y);
  }

  const xFor = (index) => padding.left + (rows.length === 1 ? 0 : (plotWidth * index) / (rows.length - 1));
  const yFor = (value) => padding.top + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;

  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, "rgba(15, 118, 110, 0.22)");
  gradient.addColorStop(1, "rgba(15, 118, 110, 0)");

  ctx.beginPath();
  rows.forEach((row, index) => {
    const x = xFor(index);
    const y = yFor(row.close);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(xFor(rows.length - 1), height - padding.bottom);
  ctx.lineTo(xFor(0), height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  rows.forEach((row, index) => {
    const x = xFor(index);
    const y = yFor(row.close);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = "#0f766e";
  const markerIndexes = [0, rows.length - 1];
  if (rows.length > 8) markerIndexes.push(Math.floor(rows.length / 2));
  markerIndexes.forEach((index) => {
    ctx.beginPath();
    ctx.arc(xFor(index), yFor(rows[index].close), 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#657085";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const labelIndexes = rows.length > 4 ? [0, Math.floor(rows.length / 2), rows.length - 1] : rows.map((_, index) => index);
  labelIndexes.forEach((index) => {
    ctx.fillText(rows[index].dateText, xFor(index), height - padding.bottom + 16);
  });
}

function downloadCsv() {
  if (!currentRows.length) return;
  const headers = ["日期", "開盤", "最高", "最低", "收盤", "漲跌", "成交股數", "成交金額", "成交筆數"];
  const lines = [
    headers.join(","),
    ...currentRows.map((row) =>
      [
        row.dateText,
        row.open,
        row.high,
        row.low,
        row.close,
        row.change,
        row.volume,
        row.turnover,
        row.trades,
      ].join(","),
    ),
  ];
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${stockCodeInput.value.trim()}_${startDateInput.value}_${endDateInput.value}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const stockCode = stockCodeInput.value.trim().toUpperCase();
  const start = new Date(`${startDateInput.value}T00:00:00`);
  const end = new Date(`${endDateInput.value}T23:59:59`);

  if (!/^[0-9A-Z]{4,8}$/.test(stockCode)) {
    setStatus("股票代碼格式不正確。", true);
    return;
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    setStatus("請確認日期區間。", true);
    return;
  }

  form.querySelector("button").disabled = true;
  downloadCsvButton.disabled = true;
  setStatus("準備下載資料...");

  try {
    currentRows = await fetchRange(stockCode, start, end);
    renderMetrics(currentRows);
    renderTable(currentRows);
    drawChart(currentRows);
    downloadCsvButton.disabled = currentRows.length === 0;
    chartRange.textContent = currentRows.length
      ? `${stockCode}｜${currentRows[0].dateText} - ${currentRows.at(-1).dateText}`
      : `${stockCode}｜查無資料`;
    setStatus(currentRows.length ? `完成，共 ${currentRows.length} 筆交易日資料。` : "查無資料，請確認代碼或日期區間。", currentRows.length === 0);
  } catch (error) {
    currentRows = [];
    renderMetrics([]);
    renderTable([]);
    drawEmptyChart("查詢失敗");
    chartRange.textContent = "查詢失敗";
    setStatus(error.message || "查詢失敗。", true);
  } finally {
    form.querySelector("button").disabled = false;
  }
});

downloadCsvButton.addEventListener("click", downloadCsv);
window.addEventListener("resize", () => drawChart(currentRows));

const today = new Date();
const oneYearAgo = new Date(today);
oneYearAgo.setFullYear(today.getFullYear() - 1);
startDateInput.value = toIsoDate(oneYearAgo);
endDateInput.value = toIsoDate(today);
drawEmptyChart("輸入條件後查詢");
