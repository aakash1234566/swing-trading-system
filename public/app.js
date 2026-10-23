// State Management
let currentAnalysis = null;
let currentCurrency = '$';
let chartInstance = null;
let candleSeries = null;
let lineEma20 = null;
let lineEma50 = null;
let lineEma200 = null;
let entryPriceLine = null;
let stopPriceLine = null;
let target1PriceLine = null;
let target2PriceLine = null;

// DOM Elements
const tickerInput = document.getElementById('ticker-input');
const searchForm = document.getElementById('search-form');
const searchBtn = document.getElementById('search-btn');
const searchBtnText = document.getElementById('search-btn-text');
const loadingState = document.getElementById('loading-state');
const errorBanner = document.getElementById('error-banner');
const errorMessage = document.getElementById('error-message');
const contentArea = document.getElementById('content-area');

// Currency Buttons
const currUsdBtn = document.getElementById('curr-usd');
const currInrBtn = document.getElementById('curr-inr');

// Watchlist Container
const quickWatchlist = document.getElementById('quick-watchlist');

// Calculator Inputs
const accountSizeInput = document.getElementById('account-size');
const riskPercentVal = document.getElementById('risk-percent-val');
const riskButtons = document.querySelectorAll('.risk-btn');
const inputEntry = document.getElementById('input-entry');
const inputStop = document.getElementById('input-stop');
const allowedRiskDollars = document.getElementById('allowed-risk-dollars');

// Calculator Outputs
const outputShares = document.getElementById('output-shares');
const outputCapital = document.getElementById('output-capital');
const outputCapitalPct = document.getElementById('output-capital-pct');
const outputMaxLoss = document.getElementById('output-maxloss');
const outputTarget1Profit = document.getElementById('output-target1-profit');
const outputTarget2Profit = document.getElementById('output-target2-profit');
const capitalWarning = document.getElementById('capital-warning');

// Checklist & Logging
const checklistItems = document.querySelectorAll('.chk-item');
const checklistCounter = document.getElementById('checklist-counter');
const logTradeBtn = document.getElementById('log-trade-btn');
const tradeNotesInput = document.getElementById('trade-notes');

// Journal Table & Stats
const journalTbody = document.getElementById('journal-tbody');
const statTotalTrades = document.getElementById('stat-total-trades');
const statWinRate = document.getElementById('stat-win-rate');
const statNetPnl = document.getElementById('stat-net-pnl');

// Modal Elements
const closeModal = document.getElementById('close-modal');
const modalTradeId = document.getElementById('modal-trade-id');
const modalTradeStatus = document.getElementById('modal-trade-status');
const modalExitPrice = document.getElementById('modal-exit-price');
const modalTradeNotes = document.getElementById('modal-trade-notes');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalSaveBtn = document.getElementById('modal-save-btn');

// Scanner DOM Elements
const scanMarketIn = document.getElementById('scan-market-in');
const scanMarketUs = document.getElementById('scan-market-us');
const runScannerBtn = document.getElementById('run-scanner-btn');
const scannerSpinIcon = document.getElementById('scanner-spin-icon');
const scannerBtnLabel = document.getElementById('scanner-btn-label');
const topPickCard = document.getElementById('top-pick-card');
const topPickSymbol = document.getElementById('top-pick-symbol');
const topPickName = document.getElementById('top-pick-name');
const topPickScore = document.getElementById('top-pick-score');
const topPickReason = document.getElementById('top-pick-reason');
const topPickLoadBtn = document.getElementById('top-pick-load-btn');
const topPickGrowwBtn = document.getElementById('top-pick-groww-btn');
const toggleScannerTableBtn = document.getElementById('toggle-scanner-table-btn');
const scannerTableWrapper = document.getElementById('scanner-table-wrapper');
const scannerTableChevron = document.getElementById('scanner-table-chevron');
const scannerTbody = document.getElementById('scanner-tbody');
const scanCountBadge = document.getElementById('scan-count-badge');

// Groww Modal Elements
const copyGrowwCalcBtn = document.getElementById('copy-groww-calc-btn');
const growwModal = document.getElementById('groww-modal');
const growwOrderText = document.getElementById('groww-order-text');
const growwModalCloseBtn = document.getElementById('groww-modal-close-btn');
const growwModalOkBtn = document.getElementById('groww-modal-ok-btn');

let activeScanMarket = 'india';
let latestScanResults = [];
let topRankedStock = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadWatchlist();
  loadJournal();

  // Default to Indian Market (INR ₹) for Groww user
  switchCurrency('₹');
  analyzeTicker('KOTAKBANK.NS');
  runMarketScanner('india');
});

function setupEventListeners() {
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const symbol = tickerInput.value.trim().toUpperCase();
    if (symbol) analyzeTicker(symbol);
  });

  currUsdBtn.addEventListener('click', () => switchCurrency('$'));
  currInrBtn.addEventListener('click', () => switchCurrency('₹'));

  // Risk buttons
  riskButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      riskButtons.forEach(b => b.classList.remove('active-risk'));
      btn.classList.add('active-risk');
      riskPercentVal.value = btn.getAttribute('data-risk');
      recalculateRisk();
    });
  });

  accountSizeInput.addEventListener('input', recalculateRisk);
  inputEntry.addEventListener('input', () => {
    recalculateRisk();
    updateChartPriceLines();
  });
  inputStop.addEventListener('input', () => {
    recalculateRisk();
    updateChartPriceLines();
  });

  // Checklist updates
  checklistItems.forEach(chk => {
    chk.addEventListener('change', updateChecklistProgress);
  });

  // Log trade
  logTradeBtn.addEventListener('click', handleLogTrade);

  // Modal actions
  modalCloseBtn.addEventListener('click', () => closeModal.classList.add('hidden'));
  modalCancelBtn.addEventListener('click', () => closeModal.classList.add('hidden'));
  modalSaveBtn.addEventListener('click', saveTradeUpdate);

  // Scanner actions
  scanMarketIn.addEventListener('click', () => {
    activeScanMarket = 'india';
    scanMarketIn.className = 'px-3 py-1.5 rounded-lg font-bold transition bg-emerald-600 text-white shadow';
    scanMarketUs.className = 'px-3 py-1.5 rounded-lg font-bold transition text-slate-400 hover:text-white';
    switchCurrency('₹');
    runMarketScanner('india');
  });

  scanMarketUs.addEventListener('click', () => {
    activeScanMarket = 'us';
    scanMarketUs.className = 'px-3 py-1.5 rounded-lg font-bold transition bg-emerald-600 text-white shadow';
    scanMarketIn.className = 'px-3 py-1.5 rounded-lg font-bold transition text-slate-400 hover:text-white';
    switchCurrency('$');
    runMarketScanner('us');
  });

  runScannerBtn.addEventListener('click', () => {
    runMarketScanner(activeScanMarket, true);
  });

  toggleScannerTableBtn.addEventListener('click', () => {
    const isHidden = scannerTableWrapper.classList.contains('hidden');
    if (isHidden) {
      scannerTableWrapper.classList.remove('hidden');
      scannerTableChevron.className = 'fa-solid fa-chevron-up text-[10px]';
    } else {
      scannerTableWrapper.classList.add('hidden');
      scannerTableChevron.className = 'fa-solid fa-chevron-down text-[10px]';
    }
  });

  topPickLoadBtn.addEventListener('click', () => {
    if (topRankedStock) {
      tickerInput.value = topRankedStock.symbol;
      analyzeTicker(topRankedStock.symbol);
      window.scrollTo({ top: 400, behavior: 'smooth' });
    }
  });

  topPickGrowwBtn.addEventListener('click', () => {
    if (topRankedStock) {
      showGrowwModalForStock(topRankedStock);
    }
  });

  copyGrowwCalcBtn.addEventListener('click', () => {
    if (currentAnalysis) {
      const shares = Number(outputShares.textContent) || 1;
      const entry = Number(inputEntry.value);
      const stop = Number(inputStop.value);
      const risk = entry - stop;
      const t1 = entry + (risk * 2);
      const t2 = entry + (risk * 3);
      showGrowwModalForCustom(currentAnalysis, shares, entry, stop, t1, t2);
    } else {
      alert('Please analyze a stock first!');
    }
  });

  growwModalCloseBtn.addEventListener('click', () => {
    growwModal.classList.add('hidden');
    growwModal.classList.remove('flex');
  });

  growwModalOkBtn.addEventListener('click', () => {
    growwModal.classList.add('hidden');
    growwModal.classList.remove('flex');
  });
}

function switchCurrency(symbol) {
  currentCurrency = symbol;
  document.querySelectorAll('.currency-symbol').forEach(el => el.textContent = symbol);
  if (symbol === '$') {
    currUsdBtn.className = 'curr-btn px-2.5 py-1 rounded-lg font-medium transition bg-emerald-600 text-white shadow';
    currInrBtn.className = 'curr-btn px-2.5 py-1 rounded-lg font-medium transition text-slate-400 hover:text-white';
    if (Number(accountSizeInput.value) >= 50000) {
      accountSizeInput.value = '5000';
    }
  } else {
    currInrBtn.className = 'curr-btn px-2.5 py-1 rounded-lg font-medium transition bg-emerald-600 text-white shadow';
    currUsdBtn.className = 'curr-btn px-2.5 py-1 rounded-lg font-medium transition text-slate-400 hover:text-white';
    if (Number(accountSizeInput.value) <= 10000) {
      accountSizeInput.value = '100000';
    }
  }
  recalculateRisk();
}

async function loadWatchlist() {
  try {
    const res = await fetch('/api/watchlist');
    const data = await res.json();
    quickWatchlist.innerHTML = '';

    const all = [
      ...data.us.map(s => ({ ...s, market: 'US' })),
      ...data.india.map(s => ({ ...s, market: 'IN' }))
    ];

    all.forEach(item => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1.5 active:scale-95';
      chip.innerHTML = `<span>${item.symbol}</span> <span class="text-[9px] text-slate-500">${item.market}</span>`;
      chip.addEventListener('click', () => {
        tickerInput.value = item.symbol;
        analyzeTicker(item.symbol);
      });
      quickWatchlist.appendChild(chip);
    });
  } catch (err) {
    console.error('Failed to load watchlist chips:', err);
  }
}

async function analyzeTicker(symbol) {
  showLoading(true);
  hideError();

  try {
    const res = await fetch(`/api/analysis/${encodeURIComponent(symbol)}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to analyze ticker');
    }

    currentAnalysis = data;
    renderAnalysisData(data);
    renderChart(data);
    recalculateRisk();
    autoPopulateChecklist(data);

    // Auto-detect currency if ticker is Indian
    if (symbol.endsWith('.NS') || symbol.endsWith('.BO')) {
      switchCurrency('₹');
    }

  } catch (err) {
    showError(err.message);
  } finally {
    showLoading(false);
  }
}

function renderAnalysisData(data) {
  // Ticker info
  document.getElementById('ticker-badge').textContent = data.symbol.replace('.NS', '');
  document.getElementById('market-badge').textContent = data.symbol.endsWith('.NS') ? 'NSE India' : 'US Market';
  document.getElementById('stock-name').textContent = data.shortName;

  const isPositive = data.priceChange >= 0;
  const changeBadge = document.getElementById('price-change-badge');
  changeBadge.textContent = `${isPositive ? '+' : ''}${data.priceChange} (${isPositive ? '+' : ''}${data.priceChangePct}%)`;
  changeBadge.className = `text-xs font-bold px-2.5 py-1 rounded-lg border ${
    isPositive 
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
  }`;

  document.getElementById('current-price').textContent = `${currentCurrency}${data.currentPrice.toFixed(2)}`;
  document.getElementById('prev-close-text').textContent = `Prev Close: ${currentCurrency}${data.previousClose.toFixed(2)}`;

  // Indicators
  document.getElementById('val-ema20').textContent = data.indicators.ema20 ? `${currentCurrency}${data.indicators.ema20.toFixed(2)}` : 'N/A';
  document.getElementById('val-ema50').textContent = data.indicators.ema50 ? `${currentCurrency}${data.indicators.ema50.toFixed(2)}` : 'N/A';
  document.getElementById('val-ema200').textContent = data.indicators.ema200 ? `${currentCurrency}${data.indicators.ema200.toFixed(2)}` : 'N/A';
  document.getElementById('val-rsi').textContent = data.indicators.rsi ? data.indicators.rsi.toFixed(1) : 'N/A';

  const rsiLabel = document.getElementById('val-rsi-label');
  if (data.indicators.rsi > 70) {
    rsiLabel.textContent = 'Overbought (>70)';
    rsiLabel.className = 'text-[10px] text-amber-400 font-semibold';
  } else if (data.indicators.rsi < 35) {
    rsiLabel.textContent = 'Oversold / Weak';
    rsiLabel.className = 'text-[10px] text-rose-400 font-semibold';
  } else {
    rsiLabel.textContent = 'Healthy Momentum';
    rsiLabel.className = 'text-[10px] text-emerald-400 font-semibold';
  }

  // Setup Score & Grade
  const { score, grade, gradeLabel, ruleBreakdown, suggestedEntry, suggestedStop, target1, target2 } = data.setup;
  document.getElementById('score-val').textContent = score;
  document.getElementById('score-grade-title').textContent = gradeLabel;

  const scoreBadge = document.getElementById('score-status-badge');
  const progressBar = document.getElementById('score-progress');

  progressBar.style.width = `${score}%`;

  if (grade === 'A') {
    scoreBadge.className = 'inline-block text-[11px] font-bold px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    scoreBadge.textContent = 'High Probability Setup';
    progressBar.className = 'bg-gradient-to-r from-emerald-500 to-teal-400 h-2.5 rounded-full transition-all duration-700';
    document.getElementById('score-val').className = 'text-emerald-400';
  } else if (grade === 'B') {
    scoreBadge.className = 'inline-block text-[11px] font-bold px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30';
    scoreBadge.textContent = 'Watch for Pullback';
    progressBar.className = 'bg-gradient-to-r from-amber-500 to-yellow-400 h-2.5 rounded-full transition-all duration-700';
    document.getElementById('score-val').className = 'text-amber-400';
  } else {
    scoreBadge.className = 'inline-block text-[11px] font-bold px-2.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30';
    scoreBadge.textContent = 'High Risk / Avoid';
    progressBar.className = 'bg-gradient-to-r from-rose-600 to-red-500 h-2.5 rounded-full transition-all duration-700';
    document.getElementById('score-val').className = 'text-rose-400';
  }

  // Render 5 Golden Rules Breakdown
  const rulesContainer = document.getElementById('rules-container');
  rulesContainer.innerHTML = '';
  ruleBreakdown.forEach(item => {
    const row = document.createElement('div');
    row.className = `flex items-start gap-2.5 p-2 rounded-xl text-xs border ${
      item.pass 
        ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-300' 
        : 'bg-rose-500/5 border-rose-500/20 text-slate-400'
    }`;
    row.innerHTML = `
      <i class="${item.pass ? 'fa-solid fa-circle-check text-emerald-400' : 'fa-solid fa-circle-xmark text-rose-400'} mt-0.5 text-sm"></i>
      <div class="flex-1">
        <div class="flex items-center justify-between">
          <span class="font-bold ${item.pass ? 'text-white' : 'text-slate-300'}">${item.rule}</span>
          <span class="text-[10px] font-mono px-1.5 py-0.2 rounded ${item.pass ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}">+${item.points} pts</span>
        </div>
        <p class="text-[11px] text-slate-400 mt-0.5">${item.detail}</p>
      </div>
    `;
    rulesContainer.appendChild(row);
  });

  // Populate Calculator Inputs
  inputEntry.value = suggestedEntry.toFixed(2);
  inputStop.value = suggestedStop.toFixed(2);

  // Update Legend Values
  document.getElementById('legend-entry').textContent = `${currentCurrency}${suggestedEntry.toFixed(2)}`;
  document.getElementById('legend-stop').textContent = `${currentCurrency}${suggestedStop.toFixed(2)}`;
  document.getElementById('legend-target1').textContent = `${currentCurrency}${target1.toFixed(2)}`;
  document.getElementById('legend-target2').textContent = `${currentCurrency}${target2.toFixed(2)}`;
}

// Candlestick Chart Rendering
function renderChart(data) {
  const container = document.getElementById('chart-container');
  container.innerHTML = '';

  const chart = LightweightCharts.createChart(container, {
    width: container.clientWidth,
    height: 400,
    layout: {
      background: { color: '#090d16' },
      textColor: '#94a3b8',
    },
    grid: {
      vertLines: { color: 'rgba(51, 65, 85, 0.2)' },
      horzLines: { color: 'rgba(51, 65, 85, 0.2)' },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
    rightPriceScale: {
      borderColor: '#1e293b',
    },
    timeScale: {
      borderColor: '#1e293b',
      timeVisible: true,
      secondsVisible: false,
    },
  });

  // Candlestick Series
  candleSeries = chart.addCandlestickSeries({
    upColor: '#10b981',
    downColor: '#ef4444',
    borderVisible: false,
    wickUpColor: '#10b981',
    wickDownColor: '#ef4444',
  });
  candleSeries.setData(data.chartData.candles);

  // EMAs
  lineEma20 = chart.addLineSeries({ color: '#22d3ee', lineWidth: 2, title: '20 EMA' });
  lineEma20.setData(data.chartData.ema20);

  lineEma50 = chart.addLineSeries({ color: '#fbbf24', lineWidth: 2, title: '50 EMA' });
  lineEma50.setData(data.chartData.ema50);

  lineEma200 = chart.addLineSeries({ color: '#c084fc', lineWidth: 2, title: '200 EMA' });
  lineEma200.setData(data.chartData.ema200);

  chartInstance = chart;

  // Add Horizontal Price Lines for Entry, Stop-Loss, Targets
  updateChartPriceLines();

  // Resize listener
  window.addEventListener('resize', () => {
    if (chartInstance && container) {
      chartInstance.applyOptions({ width: container.clientWidth });
    }
  });

  chart.timeScale().fitContent();
}

function updateChartPriceLines() {
  if (!candleSeries) return;

  const entry = Number(inputEntry.value);
  const stop = Number(inputStop.value);

  // Remove existing lines if any
  if (entryPriceLine) candleSeries.removePriceLine(entryPriceLine);
  if (stopPriceLine) candleSeries.removePriceLine(stopPriceLine);
  if (target1PriceLine) candleSeries.removePriceLine(target1PriceLine);
  if (target2PriceLine) candleSeries.removePriceLine(target2PriceLine);

  if (entry && stop && entry > stop) {
    const risk = entry - stop;
    const t1 = entry + (risk * 2);
    const t2 = entry + (risk * 3);

    entryPriceLine = candleSeries.createPriceLine({
      price: entry,
      color: '#3b82f6',
      lineWidth: 2,
      lineStyle: LightweightCharts.LineStyle.Solid,
      axisLabelVisible: true,
      title: 'ENTRY',
    });

    stopPriceLine = candleSeries.createPriceLine({
      price: stop,
      color: '#f43f5e',
      lineWidth: 2,
      lineStyle: LightweightCharts.LineStyle.Solid,
      axisLabelVisible: true,
      title: 'STOP LOSS',
    });

    target1PriceLine = candleSeries.createPriceLine({
      price: t1,
      color: '#10b981',
      lineWidth: 2,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'TARGET 1 (1:2)',
    });

    target2PriceLine = candleSeries.createPriceLine({
      price: t2,
      color: '#14b8a6',
      lineWidth: 2,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'TARGET 2 (1:3)',
    });
  }
}

// The Risk Shield Position Sizing Engine
function recalculateRisk() {
  const accountSize = Number(accountSizeInput.value) || 0;
  const riskPct = Number(riskPercentVal.value) || 1.0;
  const entry = Number(inputEntry.value) || 0;
  const stop = Number(inputStop.value) || 0;

  // Maximum allowed risk in dollars/rupees
  const maxAllowedRisk = (accountSize * riskPct) / 100;
  allowedRiskDollars.textContent = `Max Allowed Risk: ${currentCurrency}${maxAllowedRisk.toFixed(2)}`;

  if (entry <= 0 || stop <= 0 || entry <= stop) {
    outputShares.textContent = '0';
    outputCapital.textContent = `${currentCurrency}0.00`;
    outputCapitalPct.textContent = '(0% of account)';
    outputMaxLoss.textContent = `${currentCurrency}0.00`;
    outputTarget1Profit.textContent = `+${currentCurrency}0.00`;
    outputTarget2Profit.textContent = `+${currentCurrency}0.00`;
    return;
  }

  const riskPerShare = entry - stop;
  const shares = Math.floor(maxAllowedRisk / riskPerShare);
  const totalCapitalRequired = shares * entry;
  const actualMaxRisk = shares * riskPerShare;
  const capitalPct = accountSize > 0 ? (totalCapitalRequired / accountSize) * 100 : 0;

  const target1Price = entry + (riskPerShare * 2);
  const target2Price = entry + (riskPerShare * 3);
  const target1Profit = shares * (riskPerShare * 2);
  const target2Profit = shares * (riskPerShare * 3);

  // Update outputs
  outputShares.textContent = shares;
  outputCapital.textContent = `${currentCurrency}${totalCapitalRequired.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  outputCapitalPct.textContent = `(${capitalPct.toFixed(1)}% of account)`;
  outputMaxLoss.textContent = `${currentCurrency}${actualMaxRisk.toFixed(2)}`;
  
  const stopPct = ((entry - stop) / entry) * 100;
  outputMaxLoss.nextElementSibling.textContent = `(Stop: -${stopPct.toFixed(1)}%)`;

  outputTarget1Profit.textContent = `+${currentCurrency}${target1Profit.toFixed(2)} (+${(stopPct * 2).toFixed(1)}%)`;
  outputTarget2Profit.textContent = `+${currentCurrency}${target2Profit.toFixed(2)} (+${(stopPct * 3).toFixed(1)}%)`;

  // Warning if position requires > 50% of account
  if (capitalPct > 50) {
    capitalWarning.classList.remove('hidden');
  } else {
    capitalWarning.classList.add('hidden');
  }
}

// Auto-populate checklist rules based on setup analysis
function autoPopulateChecklist(data) {
  const isAbove200 = data.indicators.ema200 ? data.currentPrice >= data.indicators.ema200 : true;
  document.getElementById('chk-trend').checked = isAbove200;
  document.getElementById('chk-risk').checked = true; // Sized by calculator
  document.getElementById('chk-stop').checked = true; // Stop identified
  document.getElementById('chk-rr').checked = true; // Target 1:2 verified
  document.getElementById('chk-catalyst').checked = false; // User must verify no immediate earnings

  updateChecklistProgress();
}

function updateChecklistProgress() {
  const total = checklistItems.length;
  const checked = document.querySelectorAll('.chk-item:checked').length;
  checklistCounter.textContent = `${checked} / ${total}`;

  if (checked === total) {
    checklistCounter.className = 'text-[11px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30';
  } else {
    checklistCounter.className = 'text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded';
  }
}

// Journal Operations
async function loadJournal() {
  try {
    const res = await fetch('/api/journal');
    const trades = await res.json();
    renderJournalTable(trades);
    renderJournalStats(trades);
  } catch (err) {
    console.error('Failed to load trade journal:', err);
  }
}

function renderJournalTable(trades) {
  if (!trades || trades.length === 0) {
    journalTbody.innerHTML = `
      <tr>
        <td colspan="10" class="py-8 text-center text-slate-500">
          <i class="fa-regular fa-folder-open text-2xl block mb-2 opacity-50"></i>
          No trades logged yet. Analyze a setup above and click "Log Trade to Journal".
        </td>
      </tr>
    `;
    return;
  }

  journalTbody.innerHTML = '';
  trades.forEach(trade => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-900/60 transition';

    let statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">OPEN</span>';
    if (trade.status === 'WON') {
      statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">WON</span>';
    } else if (trade.status === 'LOST') {
      statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">LOST</span>';
    } else if (trade.status === 'BREAKEVEN') {
      statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">BREAKEVEN</span>';
    }

    let pnlText = '<span class="text-slate-500">-</span>';
    if (trade.realizedPnL !== null && trade.realizedPnL !== undefined) {
      const isPositive = trade.realizedPnL >= 0;
      pnlText = `<span class="font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}">${isPositive ? '+' : ''}${trade.currency || '$'}${trade.realizedPnL.toFixed(2)}</span>`;
    }

    tr.innerHTML = `
      <td class="py-3 px-3 text-slate-400 font-mono text-[11px]">${trade.date}</td>
      <td class="py-3 px-3 font-bold text-white">${trade.symbol}</td>
      <td class="py-3 px-3 font-mono">${trade.currency || '$'}${trade.entry.toFixed(2)}</td>
      <td class="py-3 px-3 font-mono text-rose-400">${trade.currency || '$'}${trade.stopLoss.toFixed(2)}</td>
      <td class="py-3 px-3 font-mono text-emerald-400">${trade.currency || '$'}${trade.target1.toFixed(2)}</td>
      <td class="py-3 px-3 font-bold text-slate-200">${trade.shares}</td>
      <td class="py-3 px-3 font-mono text-rose-300">${trade.currency || '$'}${trade.maxRisk.toFixed(2)}</td>
      <td class="py-3 px-3">${statusBadge}</td>
      <td class="py-3 px-3">${pnlText}</td>
      <td class="py-3 px-3 text-right space-x-1 whitespace-nowrap">
        <button class="edit-trade-btn p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition" title="Update status/exit" data-id="${trade.id}">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="del-trade-btn p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition" title="Delete" data-id="${trade.id}">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    journalTbody.appendChild(tr);
  });

  // Attach listeners to table action buttons
  document.querySelectorAll('.edit-trade-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.getAttribute('data-id'), trades));
  });
  document.querySelectorAll('.del-trade-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTrade(btn.getAttribute('data-id')));
  });
}

function renderJournalStats(trades) {
  statTotalTrades.textContent = trades.length;

  const closedTrades = trades.filter(t => t.status === 'WON' || t.status === 'LOST');
  if (closedTrades.length === 0) {
    statWinRate.textContent = '0%';
    statNetPnl.textContent = `${currentCurrency}0.00`;
    return;
  }

  const wins = closedTrades.filter(t => t.status === 'WON').length;
  const winRate = ((wins / closedTrades.length) * 100).toFixed(0);
  statWinRate.textContent = `${winRate}%`;

  const netPnl = trades.reduce((acc, t) => acc + (t.realizedPnL || 0), 0);
  const isPositive = netPnl >= 0;
  statNetPnl.textContent = `${isPositive ? '+' : ''}${currentCurrency}${netPnl.toFixed(2)}`;
  statNetPnl.className = `font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`;
}

async function handleLogTrade() {
  if (!currentAnalysis) {
    alert('Please analyze a stock first!');
    return;
  }

  const shares = Number(outputShares.textContent);
  if (shares <= 0) {
    alert('Invalid position size. Please ensure Entry and Stop-Loss are configured.');
    return;
  }

  const entry = Number(inputEntry.value);
  const stop = Number(inputStop.value);
  const riskPerShare = entry - stop;
  const target1 = Number((entry + riskPerShare * 2).toFixed(2));
  const maxRisk = Number((shares * riskPerShare).toFixed(2));
  const totalCapital = Number((shares * entry).toFixed(2));

  const checkedCount = document.querySelectorAll('.chk-item:checked').length;
  const isChecked = checkedCount === checklistItems.length;

  const tradeData = {
    symbol: currentAnalysis.symbol,
    entry,
    stopLoss: stop,
    target1,
    shares,
    totalCapital,
    maxRisk,
    currency: currentCurrency,
    notes: tradeNotesInput.value.trim(),
    checklistCompleted: isChecked
  };

  try {
    const res = await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tradeData)
    });

    if (res.ok) {
      tradeNotesInput.value = '';
      await loadJournal();
      // Scroll down gently to journal
      document.querySelector('section:has(#journal-tbody)')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      alert('Failed to save trade.');
    }
  } catch (err) {
    console.error('Error logging trade:', err);
  }
}

function openEditModal(tradeId, trades) {
  const trade = trades.find(t => t.id === tradeId);
  if (!trade) return;

  modalTradeId.value = trade.id;
  modalTradeStatus.value = trade.status;
  modalExitPrice.value = trade.exitPrice || '';
  modalTradeNotes.value = trade.notes || '';
  closeModal.classList.remove('hidden');
  closeModal.classList.add('flex');
}

async function saveTradeUpdate() {
  const id = modalTradeId.value;
  const status = modalTradeStatus.value;
  const exitPrice = modalExitPrice.value ? Number(modalExitPrice.value) : null;
  const notes = modalTradeNotes.value;

  try {
    const res = await fetch(`/api/journal/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, exitPrice, notes })
    });

    if (res.ok) {
      closeModal.classList.add('hidden');
      closeModal.classList.remove('flex');
      await loadJournal();
    }
  } catch (err) {
    console.error('Failed to update trade:', err);
  }
}

async function deleteTrade(id) {
  if (!confirm('Are you sure you want to remove this trade from your journal?')) return;
  try {
    const res = await fetch(`/api/journal/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await loadJournal();
    }
  } catch (err) {
    console.error('Failed to delete trade:', err);
  }
}

function showLoading(show) {
  if (show) {
    loadingState.classList.remove('hidden');
    contentArea.classList.add('opacity-40', 'pointer-events-none');
    searchBtn.disabled = true;
    searchBtnText.textContent = 'Analyzing...';
  } else {
    loadingState.classList.add('hidden');
    contentArea.classList.remove('opacity-40', 'pointer-events-none');
    searchBtn.disabled = false;
    searchBtnText.textContent = 'Analyze';
  }
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorBanner.classList.remove('hidden');
}

function hideError() {
  errorBanner.classList.add('hidden');
}

// ==========================================
// Market Auto-Scanner & Groww GTT Engine
// ==========================================

async function runMarketScanner(market = 'india', force = false) {
  try {
    scannerSpinIcon.classList.add('animate-spin');
    scannerBtnLabel.textContent = 'Scanning Market...';
    runScannerBtn.disabled = true;

    const res = await fetch(`/api/scan?market=${market}&force=${force}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to scan market');

    latestScanResults = data.results || [];
    renderScannerUI(data);

  } catch (err) {
    console.error('Market scanner error:', err);
  } finally {
    scannerSpinIcon.classList.remove('animate-spin');
    scannerBtnLabel.textContent = 'Auto-Scan Market';
    runScannerBtn.disabled = false;
  }
}

function renderScannerUI(data) {
  const results = data.results;
  scanCountBadge.textContent = results.length;

  if (results.length === 0) return;

  // #1 Top Pick
  topRankedStock = results[0];
  topPickSymbol.textContent = topRankedStock.symbol;
  topPickName.textContent = topRankedStock.shortName;
  topPickScore.textContent = `${topRankedStock.score}/100 (Grade ${topRankedStock.grade})`;
  
  const curr = topRankedStock.symbol.endsWith('.NS') ? '₹' : '$';
  topPickReason.innerHTML = `
    <div class="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
      <span class="text-[9px] text-slate-400 block font-bold uppercase">Price</span>
      <span class="font-extrabold text-white text-xs sm:text-sm font-mono">${curr}${topRankedStock.currentPrice.toFixed(2)}</span>
    </div>
    <div class="bg-slate-900/80 p-2 rounded-lg border border-rose-500/20">
      <span class="text-[9px] text-rose-400 block font-bold uppercase">Stop-Loss</span>
      <span class="font-extrabold text-rose-300 text-xs sm:text-sm font-mono">${curr}${topRankedStock.stopLoss.toFixed(2)} <span class="text-[9px] text-slate-400">(-${topRankedStock.riskPct}%)</span></span>
    </div>
    <div class="bg-slate-900/80 p-2 rounded-lg border border-emerald-500/20">
      <span class="text-[9px] text-emerald-400 block font-bold uppercase">Target 1 (1:2)</span>
      <span class="font-extrabold text-emerald-300 text-xs sm:text-sm font-mono">${curr}${topRankedStock.target1.toFixed(2)} <span class="text-[9px] text-emerald-400">(+${topRankedStock.target1GainPct}%)</span></span>
    </div>
    <div class="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
      <span class="text-[9px] text-slate-400 block font-bold uppercase">RSI (14)</span>
      <span class="font-extrabold text-white text-xs sm:text-sm font-mono">${topRankedStock.rsi} <span class="text-[9px] text-emerald-400 font-normal">Optimal</span></span>
    </div>
  `;

  // Populate Table
  scannerTbody.innerHTML = '';
  results.forEach((stock, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-900/80 transition';

    let gradeBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">GRADE A</span>';
    if (stock.grade === 'B') {
      gradeBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">GRADE B</span>';
    } else if (stock.grade === 'C') {
      gradeBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">GRADE C</span>';
    }

    const sCurr = stock.symbol.endsWith('.NS') ? '₹' : '$';

    tr.innerHTML = `
      <td class="py-2.5 px-3">
        <div class="flex items-center gap-2">
          <span class="w-5 text-slate-500 font-mono text-[11px] font-bold">#${idx + 1}</span>
          <div>
            <div class="font-bold text-white text-xs">${stock.symbol}</div>
            <div class="text-[10px] text-slate-400 truncate max-w-[130px]">${stock.shortName}</div>
          </div>
        </div>
      </td>
      <td class="py-2.5 px-3 font-mono font-bold text-white text-xs">
        ${sCurr}${stock.currentPrice.toFixed(2)}
        <span class="text-[10px] block ${stock.priceChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
          ${stock.priceChangePct >= 0 ? '+' : ''}${stock.priceChangePct}%
        </span>
      </td>
      <td class="py-2.5 px-3">
        ${gradeBadge}
        <span class="text-[11px] font-bold text-slate-300 ml-1.5">${stock.score}/100</span>
      </td>
      <td class="py-2.5 px-3 font-mono text-rose-400 text-xs">
        ${sCurr}${stock.stopLoss.toFixed(2)}
        <span class="text-[10px] text-slate-500 block">(-${stock.riskPct}%)</span>
      </td>
      <td class="py-2.5 px-3 font-mono text-emerald-400 text-xs">
        ${sCurr}${stock.target1.toFixed(2)}
        <span class="text-[10px] text-emerald-500 block">(+${stock.target1GainPct}%)</span>
      </td>
      <td class="py-2.5 px-3 font-mono text-slate-300 text-xs">${stock.rsi}</td>
      <td class="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
        <button class="scan-load-btn px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-[11px] font-bold transition" data-symbol="${stock.symbol}">
          Load
        </button>
        <button class="scan-groww-btn px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-bold transition" data-symbol="${stock.symbol}">
          Groww
        </button>
      </td>
    `;
    scannerTbody.appendChild(tr);
  });

  // Table row actions
  document.querySelectorAll('.scan-load-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sym = btn.getAttribute('data-symbol');
      tickerInput.value = sym;
      analyzeTicker(sym);
      window.scrollTo({ top: 400, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('.scan-groww-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sym = btn.getAttribute('data-symbol');
      const stock = results.find(s => s.symbol === sym);
      if (stock) showGrowwModalForStock(stock);
    });
  });
}

function showGrowwModalForStock(stock) {
  const accountSize = Number(accountSizeInput.value) || 50000;
  const riskPct = Number(riskPercentVal.value) || 1.0;
  const maxAllowedRisk = (accountSize * riskPct) / 100;

  const riskPerShare = stock.currentPrice - stock.stopLoss;
  const shares = riskPerShare > 0 ? Math.max(1, Math.floor(maxAllowedRisk / riskPerShare)) : 1;

  showGrowwModalForCustom(
    stock,
    shares,
    stock.currentPrice,
    stock.stopLoss,
    stock.target1,
    stock.target2
  );
}

function showGrowwModalForCustom(stock, shares, entry, stop, t1, t2) {
  const isIndian = stock.symbol.endsWith('.NS') || stock.symbol.endsWith('.BO');
  const cleanSymbol = stock.symbol.replace('.NS', '').replace('.BO', '');
  const curr = isIndian ? '₹' : '$';
  const totalCapital = (shares * entry).toFixed(2);
  const maxLoss = (shares * (entry - stop)).toFixed(2);
  const profitT1 = (shares * (t1 - entry)).toFixed(2);

  const text = 
`==============================================
📌 GROWW GTT SWING TRADE SETUP
==============================================
Stock Name:   ${stock.shortName || cleanSymbol}
Groww Symbol: ${cleanSymbol}
Order Type:   DELIVERY (CNC) - Normal
Quantity:     ${shares} Shares

1. BUY ORDER:
   Order Type:  Limit Order
   Buy Price:   ${curr}${entry.toFixed(2)}
   Total Funds: ${curr}${totalCapital}

2. GTT STOP-LOSS (Risk Protection):
   Trigger:     ${curr}${stop.toFixed(2)}
   Max Loss:    -${curr}${maxLoss} (Capped at 1%)

3. GTT TARGET (Profit Booking):
   Target 1:    ${curr}${t1.toFixed(2)} (Gain: +${curr}${profitT1})
   Target 2:    ${curr}${t2.toFixed(2)}
==============================================
Tip: Groww me GTT order 365 din tak active rehta hai.
Stop-loss ya Target hit hote hi apne aap order execute ho jayega!`;

  growwOrderText.textContent = text;

  // Copy to clipboard
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(err => console.log('Clipboard error:', err));
  }

  growwModal.classList.remove('hidden');
  growwModal.classList.add('flex');
}

