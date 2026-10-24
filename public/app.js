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
const topPickAdvice = document.getElementById('top-pick-advice');
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
let latestScanPayload = null;
let topRankedStock = null;
let userChoseSymbol = false;
let suppressOrderRefresh = false;
let latestTrades = [];
const MAX_POSITION_PCT = 15;
const MAX_OPEN_RISK_PCT = 2;
const MAX_OPEN_TRADES = 3;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadWatchlist();
  loadJournal();

  // Default to Indian Market (INR ₹) for Groww user
  switchCurrency('₹');
  const orderCapital = document.getElementById('order-capital');
  if (orderCapital) orderCapital.value = accountSizeInput.value;
  runMarketScanner('india');
});

function setupEventListeners() {
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const symbol = tickerInput.value.trim().toUpperCase();
    if (symbol) {
      userChoseSymbol = true;
      analyzeTicker(symbol);
    }
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

  accountSizeInput.addEventListener('input', () => {
    const orderCapital = document.getElementById('order-capital');
    if (orderCapital && orderCapital.value !== accountSizeInput.value) orderCapital.value = accountSizeInput.value;
    recalculateRisk();
    if (latestScanPayload) renderScannerUI(latestScanPayload);
  });
  document.getElementById('order-capital')?.addEventListener('input', (event) => {
    accountSizeInput.value = event.target.value;
    recalculateRisk();
    if (latestScanPayload) renderScannerUI(latestScanPayload);
  });
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
    userChoseSymbol = false;
    activeScanMarket = 'india';
    scanMarketIn.className = 'px-3 py-1.5 rounded-lg font-bold transition bg-emerald-600 text-white shadow';
    scanMarketUs.className = 'px-3 py-1.5 rounded-lg font-bold transition text-slate-400 hover:text-white';
    switchCurrency('₹');
    runMarketScanner('india');
  });

  scanMarketUs.addEventListener('click', () => {
    userChoseSymbol = false;
    activeScanMarket = 'us';
    scanMarketUs.className = 'px-3 py-1.5 rounded-lg font-bold transition bg-emerald-600 text-white shadow';
    scanMarketIn.className = 'px-3 py-1.5 rounded-lg font-bold transition text-slate-400 hover:text-white';
    switchCurrency('$');
    runMarketScanner('us');
  });

  runScannerBtn.addEventListener('click', () => {
    userChoseSymbol = false;
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
  const orderCapital = document.getElementById('order-capital');
  if (orderCapital) orderCapital.value = accountSizeInput.value;
  if (latestScanPayload && !suppressOrderRefresh) renderScannerUI(latestScanPayload);
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
        userChoseSymbol = true;
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
    const quotedInRupees = data.symbol.endsWith('.NS') || data.symbol.endsWith('.BO') || data.currency === 'INR';
    switchCurrency(quotedInRupees ? '₹' : '$');
    renderAnalysisData(data);
    renderChart(data);
    recalculateRisk();
    autoPopulateChecklist(data);
    if (userChoseSymbol) showSearchedOrder(data);

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

  renderActionBanner(data);
  renderScenarioStrip(data);
}

function actionTone(action) {
  if (action === 'SPEND') {
    return { box: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100', title: 'text-emerald-300' };
  }
  if (action === 'WAIT') {
    return { box: 'bg-amber-500/10 border-amber-500/30 text-amber-50', title: 'text-amber-300' };
  }
  return { box: 'bg-rose-500/10 border-rose-500/30 text-rose-100', title: 'text-rose-300' };
}

function renderActionBanner(data) {
  const banner = document.getElementById('action-banner');
  if (!banner || !data?.setup) return;
  const tone = actionTone(data.setup.action);
  banner.className = `mb-3 rounded-xl border px-3 py-2.5 text-xs ${tone.box}`;
  banner.innerHTML = `
    <div class="font-bold ${tone.title}">${data.setup.actionLabel || data.setup.action}</div>
    <p class="mt-1 leading-relaxed text-slate-200">${data.setup.actionReason || ''}</p>
  `;
}

function renderScenarioStrip(data) {
  const strip = document.getElementById('scenario-strip');
  if (!strip || !data) return;
  const scenario = data.scenario || {};
  const rs = scenario.relativeStrength == null
    ? 'n/a'
    : `${scenario.relativeStrength >= 0 ? '+' : ''}${scenario.relativeStrength}%`;
  let marketText = scenario.regimeLabel || 'Unknown';
  if (data.setup?.action === 'SPEND' && scenario.regime === 'CAUTION') {
    marketText = 'Mixed market, but this score is strong enough to buy.';
  }
  const cells = [
    ['Market', marketText],
    ['ADX', data.indicators.adx ?? 'n/a'],
    ['Daily range', data.indicators.atrPct != null ? `${data.indicators.atrPct}%` : 'n/a'],
    ['Vs index, 20d', rs]
  ];
  strip.innerHTML = cells.map(([label, value]) => `
    <div class="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
      <div class="text-[9px] uppercase tracking-wide text-slate-500 font-bold">${label}</div>
      <div class="text-[11px] text-white font-semibold mt-0.5 leading-snug">${value}</div>
    </div>
  `).join('');
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

function openTradesForCurrency(currency) {
  return latestTrades.filter(t => t.status === 'OPEN' && (t.currency || '$') === currency);
}

function planSpend(price, stop, accountSize, riskPct, currency) {
  const empty = {
    shares: 0,
    capital: 0,
    maxLoss: 0,
    target1Profit: 0,
    target2Profit: 0,
    capitalPct: 0,
    note: '',
    blocked: true
  };
  const riskPerShare = price - stop;
  if (!(price > 0) || !(stop > 0) || riskPerShare <= 0) {
    return { ...empty, note: 'The stop must sit below the buy price.' };
  }

  const open = openTradesForCurrency(currency);
  const openRisk = open.reduce((sum, trade) => sum + (Number(trade.maxRisk) || 0), 0);
  if (open.length >= MAX_OPEN_TRADES) {
    return { ...empty, note: 'You already have 3 open trades. Close one before spending on another stock.' };
  }

  const riskRoom = Math.max(0, (accountSize * MAX_OPEN_RISK_PCT) / 100 - openRisk);
  if (riskRoom <= 0) {
    return { ...empty, note: 'Open trades already risk 2% of the account. Wait for one to finish.' };
  }

  const allowedRisk = Math.min((accountSize * riskPct) / 100, riskRoom);
  const riskShares = Math.floor(allowedRisk / riskPerShare);
  const capitalCapShares = Math.floor((accountSize * MAX_POSITION_PCT) / 100 / price);
  let shares = riskShares;
  const notes = [];
  if (riskShares < 1) {
    shares = 0;
    notes.push(`Only ${currency}${riskRoom.toFixed(0)} of loss room is left, and one share can lose about ${currency}${riskPerShare.toFixed(0)}. Close an open trade before spending again.`);
  } else if (shares > capitalCapShares) {
    shares = capitalCapShares;
    notes.push(shares < 1
      ? 'One share costs more than 15% of the account. Use a lower-priced stock.'
      : 'Quantity was reduced so this one stock uses at most 15% of your money.');
  }

  const capital = shares * price;
  return {
    shares,
    capital,
    maxLoss: shares * riskPerShare,
    target1Profit: shares * riskPerShare * 2,
    target2Profit: shares * riskPerShare * 3,
    capitalPct: accountSize > 0 ? (capital / accountSize) * 100 : 0,
    note: notes.join(' '),
    blocked: shares < 1
  };
}

function formatMoney(currency, value) {
  return `${currency}${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// The Risk Shield Position Sizing Engine
function recalculateRisk() {
  const accountSize = Number(accountSizeInput.value) || 0;
  const riskPct = Number(riskPercentVal.value) || 0.5;
  const entry = Number(inputEntry.value) || 0;
  const stop = Number(inputStop.value) || 0;
  const maxAllowedRisk = (accountSize * riskPct) / 100;
  allowedRiskDollars.textContent = `Max loss on this trade: ${currentCurrency}${maxAllowedRisk.toFixed(2)}`;

  const plan = planSpend(entry, stop, accountSize, riskPct, currentCurrency);
  const stopPct = entry > stop && entry > 0 ? ((entry - stop) / entry) * 100 : 0;

  outputShares.textContent = String(plan.shares);
  outputCapital.textContent = formatMoney(currentCurrency, plan.capital);
  outputCapitalPct.textContent = `(${plan.capitalPct.toFixed(1)}% of account)`;
  outputMaxLoss.textContent = formatMoney(currentCurrency, plan.maxLoss);
  if (outputMaxLoss.nextElementSibling) {
    outputMaxLoss.nextElementSibling.textContent = `(Stop: -${stopPct.toFixed(1)}%)`;
  }
  outputTarget1Profit.textContent = `+${formatMoney(currentCurrency, plan.target1Profit)} (+${(stopPct * 2).toFixed(1)}%)`;
  outputTarget2Profit.textContent = `+${formatMoney(currentCurrency, plan.target2Profit)} (+${(stopPct * 3).toFixed(1)}%)`;

  const warningText = document.getElementById('capital-warning-text');
  if (plan.note) {
    capitalWarning.classList.remove('hidden');
    if (warningText) warningText.textContent = plan.note;
  } else {
    capitalWarning.classList.add('hidden');
  }

  const sizeCheck = document.getElementById('chk-size');
  if (sizeCheck) {
    sizeCheck.checked = plan.shares > 0 && plan.capitalPct <= MAX_POSITION_PCT + 0.05;
    updateChecklistProgress();
  }
}

// Auto-populate checklist rules based on setup analysis
function autoPopulateChecklist(data) {
  const isAbove200 = data.indicators.ema200 ? data.currentPrice >= data.indicators.ema200 : false;
  const marketOk = data.scenario && data.scenario.regime !== 'RISK_OFF' && data.scenario.regime !== 'UNKNOWN';
  const plan = planSpend(
    Number(inputEntry.value),
    Number(inputStop.value),
    Number(accountSizeInput.value) || 0,
    Number(riskPercentVal.value) || 0.5,
    currentCurrency
  );
  document.getElementById('chk-trend').checked = isAbove200;
  document.getElementById('chk-risk').checked = plan.shares > 0;
  document.getElementById('chk-stop').checked = data.setup.action !== 'SKIP';
  document.getElementById('chk-rr').checked = data.setup.action === 'SPEND';
  document.getElementById('chk-catalyst').checked = false;
  document.getElementById('chk-market').checked = !!marketOk;
  document.getElementById('chk-size').checked = plan.shares > 0 && plan.capitalPct <= MAX_POSITION_PCT + 0.05;

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
    latestTrades = Array.isArray(trades) ? trades : [];
    renderJournalTable(latestTrades);
    renderJournalStats(latestTrades);
    recalculateRisk();
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
    alert('There is no safe quantity for this account. Check the stop, or wait until an open trade closes.');
    return;
  }

  const decision = currentAnalysis.setup?.action;
  if (decision === 'SKIP' && !confirm('This stock is marked Do not buy. Save it only as a practice note?')) return;
  if (decision === 'WAIT' && !confirm('This setup says wait, not spend. Save it to the journal anyway?')) return;

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
    action: currentAnalysis.setup?.action || '',
    score: currentAnalysis.setup?.score ?? null,
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

function renderMarketWeather(benchmark, counts = {}) {
  const el = document.getElementById('market-weather');
  if (!el) return;
  const regime = benchmark?.regime || 'UNKNOWN';
  const tone = regime === 'RISK_ON'
    ? 'border-emerald-500/40 text-emerald-100'
    : regime === 'CAUTION'
      ? 'border-amber-500/40 text-amber-50'
      : 'border-rose-500/40 text-rose-100';
  const name = benchmark?.shortName || (activeScanMarket === 'india' ? 'Nifty 50' : 'S&P 500');
  const change = benchmark?.change20 == null ? '' : ` 20-day move ${benchmark.change20}%.`;
  const spend = counts.spendCount || 0;
  el.className = `rounded-xl border bg-slate-950/70 px-3 py-2.5 text-xs ${tone}`;
  el.innerHTML = `
    <span class="font-bold">${name}: ${benchmark?.label || 'Market check unavailable.'}</span>
    <span>${change}</span>
    <span class="block text-slate-400 mt-1">${spend > 0 ? 'One order is ready below.' : 'No order today. Buy nothing.'}</span>
  `;
}

function cleanSymbol(symbol) {
  return String(symbol || '').replace('.NS', '').replace('.BO', '');
}

function stockCurrency(symbol) {
  const value = String(symbol || '');
  return value.endsWith('.NS') || value.endsWith('.BO') ? '₹' : '$';
}

function chooseReadyTrade(results) {
  const accountSize = Number(accountSizeInput.value) || 0;
  const riskPct = Number(riskPercentVal.value) || 0.5;
  for (const stock of results) {
    if (stock.action !== 'SPEND') continue;
    const curr = stockCurrency(stock.symbol);
    const plan = planSpend(stock.currentPrice, stock.stopLoss, accountSize, riskPct, curr);
    if (plan.shares > 0) return { stock, plan, curr };
  }
  return null;
}

function showStandAside(message) {
  document.getElementById('stock-name').textContent = 'No trade today';
  document.getElementById('ticker-badge').textContent = 'CASH';
  document.getElementById('market-badge').textContent = 'WAIT';
  document.getElementById('current-price').textContent = '—';
  document.getElementById('prev-close-text').textContent = 'Buy nothing';
  const changeBadge = document.getElementById('price-change-badge');
  changeBadge.textContent = 'Cash';
  changeBadge.className = 'text-xs font-bold px-2 py-0.5 rounded-lg border bg-slate-800 text-slate-300 border-slate-700';
  document.getElementById('score-grade-title').textContent = 'Stay in cash';
  document.getElementById('score-val').textContent = '—';
  const banner = document.getElementById('action-banner');
  if (banner) {
    banner.className = 'mb-3 rounded-xl border px-3 py-2.5 text-xs bg-rose-500/10 border-rose-500/30 text-rose-100';
    banner.innerHTML = `<div class="font-bold text-rose-300">Do not trade</div><p class="mt-1 text-slate-200">${message}</p>`;
  }
}

function paintTodayOrder(choice, fallbackMessage) {
  const headline = document.getElementById('order-headline');
  const growwBtn = document.getElementById('top-pick-groww-btn');
  topPickCard.classList.remove('border-emerald-500/40', 'border-rose-500/40', 'border-slate-700');

  if (!choice) {
    topRankedStock = null;
    topPickCard.classList.add('border-rose-500/40');
    if (headline) headline.textContent = 'Do not trade today';
    topPickName.textContent = 'Buy nothing. Check again tomorrow.';
    topPickAdvice.textContent = fallbackMessage;
    topPickReason.innerHTML = '';
    if (growwBtn) {
      growwBtn.disabled = true;
      growwBtn.textContent = 'No order today';
    }
    if (!userChoseSymbol) showStandAside(fallbackMessage);
    return;
  }

  const { stock, plan, curr } = choice;
  topRankedStock = stock;
  topPickCard.classList.add('border-emerald-500/40');
  const name = cleanSymbol(stock.symbol);
  if (headline) headline.textContent = `Buy ${plan.shares} shares of ${name}`;
  topPickName.textContent = stock.shortName || name;
  topPickSymbol.textContent = stock.symbol;
  topPickAdvice.textContent = `Buy near ${curr}${stock.currentPrice.toFixed(2)}. Put a stop at ${curr}${stock.stopLoss.toFixed(2)} the same day. First target is ${curr}${stock.target1.toFixed(2)}. If the stop hits, you lose about ${formatMoney(curr, plan.maxLoss)}.`;
  topPickReason.innerHTML = `
    <div class="bg-slate-900 p-3 rounded-xl border border-slate-800">
      <span class="text-[10px] uppercase font-bold text-slate-500">Buy</span>
      <div class="text-lg font-black text-white mt-1">${curr}${stock.currentPrice.toFixed(2)}</div>
    </div>
    <div class="bg-slate-900 p-3 rounded-xl border border-slate-800">
      <span class="text-[10px] uppercase font-bold text-slate-500">Shares</span>
      <div class="text-lg font-black text-white mt-1">${plan.shares}</div>
    </div>
    <div class="bg-slate-900 p-3 rounded-xl border border-rose-500/30">
      <span class="text-[10px] uppercase font-bold text-rose-400">Stop</span>
      <div class="text-lg font-black text-rose-300 mt-1">${curr}${stock.stopLoss.toFixed(2)}</div>
    </div>
    <div class="bg-slate-900 p-3 rounded-xl border border-emerald-500/30">
      <span class="text-[10px] uppercase font-bold text-emerald-400">Target</span>
      <div class="text-lg font-black text-emerald-300 mt-1">${curr}${stock.target1.toFixed(2)}</div>
    </div>
  `;
  if (growwBtn) {
    growwBtn.disabled = false;
    growwBtn.textContent = 'Copy this order';
  }
  if (!userChoseSymbol && currentAnalysis?.symbol !== stock.symbol) {
    suppressOrderRefresh = true;
    tickerInput.value = stock.symbol;
    analyzeTicker(stock.symbol).finally(() => {
      suppressOrderRefresh = false;
    });
  }
}

function showSearchedOrder(data) {
  const stock = {
    symbol: data.symbol,
    shortName: data.shortName,
    currentPrice: data.currentPrice,
    stopLoss: data.setup.suggestedStop,
    target1: data.setup.target1,
    action: data.setup.action,
    actionLabel: data.setup.actionLabel,
    actionReason: data.setup.actionReason
  };
  const curr = stockCurrency(stock.symbol);
  const plan = planSpend(
    stock.currentPrice,
    stock.stopLoss,
    Number(accountSizeInput.value) || 0,
    Number(riskPercentVal.value) || 0.5,
    curr
  );
  if (stock.action === 'SPEND' && plan.shares > 0) {
    paintTodayOrder({ stock, plan, curr }, '');
    return;
  }
  const reason = stock.actionReason || 'This stock is not a buy.';
  paintTodayOrder(null, `${cleanSymbol(stock.symbol)}: ${reason}`);
}

function renderScannerUI(data) {
  latestScanPayload = data;
  const results = data.results || [];
  scanCountBadge.textContent = results.length;
  renderMarketWeather(data.benchmark, data);
  const choice = chooseReadyTrade(results);
  const passed = results.filter(stock => stock.action === 'SPEND');
  let fallback = data.benchmark?.label || 'The market is not safe enough for a new buy.';
  if (!choice && passed.length) {
    fallback = 'A stock passed the market check, but your open trades already use the loss budget. Close one trade, then scan again. Until then, buy nothing.';
  } else if (!choice && results[0]?.actionReason) {
    fallback = results[0].actionReason;
  }
  if (userChoseSymbol && currentAnalysis) showSearchedOrder(currentAnalysis);
  else paintTodayOrder(choice, fallback);

  if (results.length === 0) return;

  // Populate Table
  scannerTbody.innerHTML = '';
  results.forEach((stock, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-900/80 transition';

    const chartTone = stock.action === 'SPEND'
      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
      : 'bg-slate-800 text-slate-400 border-slate-700';
    const gradeBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold border ${chartTone}">Chart ${stock.grade}</span>`;

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
      <td class="py-2.5 px-3 text-[11px] max-w-[220px] ${
        stock.action === 'SPEND' ? 'text-emerald-300' : stock.action === 'WAIT' ? 'text-amber-300' : 'text-rose-300'
      }">
        <div class="font-bold">${stock.action === 'SPEND' ? 'Buy this' : stock.actionLabel || 'Do not buy'}</div>
        <div class="text-[10px] font-normal text-slate-400 mt-0.5 whitespace-normal leading-snug">${stock.actionReason || ''}</div>
      </td>
      <td class="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
        <button class="scan-load-btn px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold transition" data-symbol="${stock.symbol}">
          Chart
        </button>
        ${stock.action === 'SPEND'
          ? `<button class="scan-groww-btn px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition" data-symbol="${stock.symbol}">Order</button>`
          : '<span class="text-[10px] text-slate-500">No order</span>'}
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
  if (stock.action && stock.action !== 'SPEND') {
    const proceed = confirm(`${stock.actionLabel || stock.action}. ${stock.actionReason || ''}\n\nCopy the order text anyway?`);
    if (!proceed) return;
  }
  const curr = stock.symbol.endsWith('.NS') || stock.symbol.endsWith('.BO') ? '₹' : '$';
  const plan = planSpend(
    stock.currentPrice,
    stock.stopLoss,
    Number(accountSizeInput.value) || 0,
    Number(riskPercentVal.value) || 0.5,
    curr
  );
  if (plan.shares < 1) {
    alert(plan.note || 'No safe quantity for this account.');
    return;
  }

  showGrowwModalForCustom(
    stock,
    plan.shares,
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
   Max Loss:    -${curr}${maxLoss} (Risk cap ${riskPercentVal.value}%)

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

