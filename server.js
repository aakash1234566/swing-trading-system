import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, 'data');
const JOURNAL_FILE = path.join(DATA_DIR, 'journal.json');

// Ensure data folder and journal file exist
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(JOURNAL_FILE)) {
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
} catch (e) {
  console.warn('Filesystem init warning:', e.message);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Technical Indicator calculation helpers
function calculateSMA(data, period) {
  const sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
      continue;
    }
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
    sma.push(sum / period);
  }
  return sma;
}

function calculateEMA(prices, period) {
  const ema = [];
  const k = 2 / (period + 1);
  let prevEma = null;

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      ema.push(null);
      continue;
    }
    if (prevEma === null) {
      // First EMA is simple average
      const sum = prices.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
      prevEma = sum / period;
      ema.push(Number(prevEma.toFixed(2)));
    } else {
      const currentEma = (prices[i] - prevEma) * k + prevEma;
      prevEma = currentEma;
      ema.push(Number(currentEma.toFixed(2)));
    }
  }
  return ema;
}

function calculateRSI(closes, period = 14) {
  const rsi = [];
  const gains = [];
  const losses = [];

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      rsi.push(null);
      continue;
    }
    const diff = closes[i] - closes[i - 1];
    gains.push(Math.max(0, diff));
    losses.push(Math.max(0, -diff));

    if (i < period) {
      rsi.push(null);
      continue;
    }

    if (i === period) {
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      let val = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
      rsi.push(Number(val.toFixed(2)));
    } else {
      // Wilder's smoothing
      const prevRsiIdx = rsi.length - 1;
      const prevAvgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const prevAvgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const curGain = gains[gains.length - 1];
      const curLoss = losses[losses.length - 1];
      const avgGain = (prevAvgGain * (period - 1) + curGain) / period;
      const avgLoss = (prevAvgLoss * (period - 1) + curLoss) / period;
      let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      let val = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
      rsi.push(Number(val.toFixed(2)));
    }
  }
  return rsi;
}

function calculateATR(highs, lows, closes, period = 14) {
  const atr = [];
  const tr = [];

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      tr.push(highs[i] - lows[i]);
      atr.push(null);
      continue;
    }
    const currentHigh = highs[i];
    const currentLow = lows[i];
    const prevClose = closes[i - 1];

    const currentTR = Math.max(
      currentHigh - currentLow,
      Math.abs(currentHigh - prevClose),
      Math.abs(currentLow - prevClose)
    );
    tr.push(currentTR);

    if (i < period - 1) {
      atr.push(null);
      continue;
    }

    if (i === period - 1) {
      const initialATR = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
      atr.push(Number(initialATR.toFixed(2)));
    } else {
      const prevATR = atr[atr.length - 1];
      const currentATR = (prevATR * (period - 1) + currentTR) / period;
      atr.push(Number(currentATR.toFixed(2)));
    }
  }
  return atr;
}

// Find key Swing Lows & Highs over lookback
function findSwingLevels(candles, lookback = 30) {
  const slice = candles.slice(-lookback);
  let swingLows = [];
  let swingHighs = [];

  for (let i = 2; i < slice.length - 2; i++) {
    const prev2 = slice[i - 2].low;
    const prev1 = slice[i - 1].low;
    const curr = slice[i].low;
    const next1 = slice[i + 1].low;
    const next2 = slice[i + 2].low;

    if (curr <= prev1 && curr <= prev2 && curr <= next1 && curr <= next2) {
      swingLows.push(curr);
    }

    const hPrev2 = slice[i - 2].high;
    const hPrev1 = slice[i - 1].high;
    const hCurr = slice[i].high;
    const hNext1 = slice[i + 1].high;
    const hNext2 = slice[i + 2].high;

    if (hCurr >= hPrev1 && hCurr >= hPrev2 && hCurr >= hNext1 && hCurr >= hNext2) {
      swingHighs.push(hCurr);
    }
  }

  return { swingLows, swingHighs };
}

// Smart Symbol Resolution (Supports typing company names like "State Bank of India" or short ticker without .NS)
async function resolveSymbol(query) {
  let clean = query.trim().toUpperCase();

  const commonMap = {
    'SBI': 'SBIN.NS',
    'STATE BANK': 'SBIN.NS',
    'STATE BANK OF INDIA': 'SBIN.NS',
    'SBIN': 'SBIN.NS',
    'TATA MOTORS': 'TMCV.NS',
    'TATAMOTORS': 'TMCV.NS',
    'TATAMOTORS.NS': 'TMCV.NS',
    'TMCV': 'TMCV.NS',
    'RELIANCE': 'RELIANCE.NS',
    'RELIANCE INDUSTRIES': 'RELIANCE.NS',
    'TCS': 'TCS.NS',
    'TATA CONSULTANCY': 'TCS.NS',
    'INFOSYS': 'INFY.NS',
    'INFY': 'INFY.NS',
    'HDFC': 'HDFCBANK.NS',
    'HDFC BANK': 'HDFCBANK.NS',
    'HDFCBANK': 'HDFCBANK.NS',
    'ICICI': 'ICICIBANK.NS',
    'ICICI BANK': 'ICICIBANK.NS',
    'KOTAK': 'KOTAKBANK.NS',
    'KOTAK BANK': 'KOTAKBANK.NS',
    'ITC': 'ITC.NS',
    'L&T': 'LT.NS',
    'LT': 'LT.NS',
    'LARSEN': 'LT.NS',
    'LARSEN & TOUBRO': 'LT.NS',
    'BHARTI AIRTEL': 'BHARTIARTL.NS',
    'AIRTEL': 'BHARTIARTL.NS',
    'MARUTI': 'MARUTI.NS',
    'MARUTI SUZUKI': 'MARUTI.NS',
    'BAJAJ FINANCE': 'BAJFINANCE.NS',
    'SUN PHARMA': 'SUNPHARMA.NS',
    'TITAN': 'TITAN.NS',
    'WIPRO': 'WIPRO.NS',
    'ADANI': 'ADANIENT.NS',
    'ADANI ENTERPRISES': 'ADANIENT.NS'
  };

  if (commonMap[clean]) {
    return commonMap[clean];
  }

  // Dynamic search via Yahoo Finance search API
  try {
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (res.ok) {
      const data = await res.json();
      const quotes = data.quotes || [];
      if (quotes.length > 0) {
        // Prefer Indian NSE stock if query looks Indian or quotes include .NS
        const nseQuote = quotes.find(q => q.symbol && (q.symbol.endsWith('.NS') || q.exchange === 'NSI'));
        if (nseQuote) return nseQuote.symbol;

        // Otherwise first valid equity symbol
        const equity = quotes.find(q => q.quoteType === 'EQUITY' || q.quoteType === 'ETF');
        if (equity) return equity.symbol;

        return quotes[0].symbol;
      }
    }
  } catch (err) {
    console.warn('Symbol search resolution failed:', err.message);
  }

  return clean;
}

// Fetch historical market data from Yahoo Finance
async function fetchMarketData(ticker) {
  let symbol = ticker.trim().toUpperCase();

  // Try smart resolving company name or un-suffixed symbol
  const resolved = await resolveSymbol(ticker);
  if (resolved && resolved !== symbol) {
    symbol = resolved;
  }

  let url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`;

  let response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  // If failed and doesn't have .NS, attempt automatic fallback to NSE
  if (!response.ok && !symbol.includes('.')) {
    const nseSymbol = `${symbol}.NS`;
    const nseUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(nseSymbol)}?interval=1d&range=1y`;
    const nseRes = await fetch(nseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (nseRes.ok) {
      response = nseRes;
      symbol = nseSymbol;
    }
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch data for symbol ${symbol}: Not Found`);
  }

  const data = await response.json();
  const result = data.chart?.result?.[0];

  if (!result || !result.timestamp || result.timestamp.length === 0) {
    throw new Error(`No chart data found for symbol "${symbol}". Check spelling or market extension (e.g. RELIANCE.NS).`);
  }

  const meta = result.meta;
  const quote = result.indicators.quote[0];
  const timestamps = result.timestamp;

  const candles = [];
  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open[i];
    const high = quote.high[i];
    const low = quote.low[i];
    const close = quote.close[i];
    const volume = quote.volume[i];

    // Filter out incomplete or null candle days
    if (open != null && high != null && low != null && close != null) {
      const date = new Date(timestamps[i] * 1000);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');

      candles.push({
        time: `${year}-${month}-${day}`,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: volume || 0
      });
    }
  }

  return {
    meta,
    symbol,
    currency: meta.currency || 'USD',
    shortName: meta.shortName || meta.symbol || symbol,
    currentPrice: meta.regularMarketPrice || candles[candles.length - 1].close,
    previousClose: meta.chartPreviousClose || meta.previousClose || candles[candles.length - 2]?.close,
    candles
  };
}

// Full Swing Analysis Engine
function analyzeSwingSetup(stockData) {
  const { candles, currentPrice, symbol, currency, shortName } = stockData;

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const rsi14 = calculateRSI(closes, 14);
  const atr14 = calculateATR(highs, lows, closes, 14);

  const lastIdx = candles.length - 1;
  const lastClose = closes[lastIdx];
  const lastEma20 = ema20[lastIdx];
  const lastEma50 = ema50[lastIdx];
  const lastEma200 = ema200[lastIdx];
  const lastRSI = rsi14[lastIdx] ?? 50;
  const lastATR = atr14[lastIdx] ?? (lastClose * 0.02);

  // 1. Check Primary Trend (Price > 200 EMA)
  const isAbove200EMA = lastEma200 ? lastClose >= lastEma200 : true;
  const trend200DiffPct = lastEma200 ? Number((((lastClose - lastEma200) / lastEma200) * 100).toFixed(1)) : 0;

  // 2. Check Moving Average Alignment (20 EMA > 50 EMA)
  const isAlignmentBullish = (lastEma20 && lastEma50) ? lastEma20 >= lastEma50 : true;

  // 3. Check Pullback vs Overextension (Distance from 20 EMA)
  const distFrom20EmaPct = lastEma20 ? Number((((lastClose - lastEma20) / lastEma20) * 100).toFixed(1)) : 0;
  const isHealthyPullback = distFrom20EmaPct >= -2.0 && distFrom20EmaPct <= 3.5;
  const isOverextended = distFrom20EmaPct > 6.0;

  // 4. RSI Momentum Check
  const isRsiOptimal = lastRSI >= 42 && lastRSI <= 65;
  const isRsiOverbought = lastRSI > 70;
  const isRsiWeak = lastRSI < 38;

  // 5. Volume check (is recent 5-day volume healthy)
  const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const avg20Volume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const isVolumeSound = recentVolume >= avg20Volume * 0.8;

  // Calculate Setup Score (0 - 100)
  let score = 0;
  const ruleBreakdown = [];

  // Rule 1: Above 200 EMA (+25)
  if (isAbove200EMA) {
    score += 25;
    ruleBreakdown.push({
      rule: 'Primary Trend: Price is above 200 EMA',
      pass: true,
      points: 25,
      detail: `Current price is ${trend200DiffPct}% above the 200 EMA (Institutional support).`
    });
  } else {
    ruleBreakdown.push({
      rule: 'Primary Trend: Price is below 200 EMA',
      pass: false,
      points: 0,
      detail: `Stock is in a macro downtrend (${Math.abs(trend200DiffPct)}% below 200 EMA). High risk of failure.`
    });
  }

  // Rule 2: 20 EMA > 50 EMA (+20)
  if (isAlignmentBullish) {
    score += 20;
    ruleBreakdown.push({
      rule: 'Trend Structure: 20 EMA is above 50 EMA',
      pass: true,
      points: 20,
      detail: 'Short-term momentum confirms the medium-term uptrend.'
    });
  } else {
    ruleBreakdown.push({
      rule: 'Trend Structure: 20 EMA is below 50 EMA',
      pass: false,
      points: 0,
      detail: 'Momentum is flat or inverted. Wait for 20 EMA to cross over 50 EMA.'
    });
  }

  // Rule 3: Entry Zone (+25)
  if (isHealthyPullback) {
    score += 25;
    ruleBreakdown.push({
      rule: 'Sweet Spot Entry: Near 20 EMA Support',
      pass: true,
      points: 25,
      detail: `Price is ${distFrom20EmaPct}% from 20 EMA. Ideal entry zone without chasing.`
    });
  } else if (isOverextended) {
    score += 5;
    ruleBreakdown.push({
      rule: 'Sweet Spot Entry: Overextended from Moving Averages',
      pass: false,
      points: 5,
      detail: `Price is extended ${distFrom20EmaPct}% above 20 EMA. High risk of immediate pullback. Wait for dip.`
    });
  } else {
    score += 15;
    ruleBreakdown.push({
      rule: 'Sweet Spot Entry: Moderate distance',
      pass: true,
      points: 15,
      detail: `Price is ${distFrom20EmaPct}% from 20 EMA.`
    });
  }

  // Rule 4: RSI Momentum (+15)
  if (isRsiOptimal) {
    score += 15;
    ruleBreakdown.push({
      rule: 'RSI Health: Healthy Momentum (42 - 65)',
      pass: true,
      points: 15,
      detail: `RSI is ${lastRSI}. Room to run upwards before hitting overbought levels.`
    });
  } else if (isRsiOverbought) {
    score += 3;
    ruleBreakdown.push({
      rule: 'RSI Health: Overbought (> 70)',
      pass: false,
      points: 3,
      detail: `RSI is ${lastRSI}. Asset is overheated; risk of quick profit-taking.`
    });
  } else {
    score += 5;
    ruleBreakdown.push({
      rule: 'RSI Health: Subdued / Neutral (< 42)',
      pass: false,
      points: 5,
      detail: `RSI is ${lastRSI}. Buying pressure is still subdued.`
    });
  }

  // Rule 5: Volume & Volatility (+15)
  if (isVolumeSound) {
    score += 15;
    ruleBreakdown.push({
      rule: 'Volume Confirmation: Healthy Participation',
      pass: true,
      points: 15,
      detail: 'Volume activity supports ongoing price stability.'
    });
  } else {
    score += 8;
    ruleBreakdown.push({
      rule: 'Volume Confirmation: Below average activity',
      pass: false,
      points: 8,
      detail: 'Volume is light. Awaiting stronger institutional volume.'
    });
  }

  // Determine Grade
  let grade = 'C';
  let gradeLabel = 'Caution / Avoid';
  let badgeColor = 'red';

  if (score >= 80) {
    grade = 'A';
    gradeLabel = 'Grade A: High-Probability Swing Setup';
    badgeColor = 'emerald';
  } else if (score >= 60) {
    grade = 'B';
    gradeLabel = 'Grade B: Moderate Setup (Watch closely)';
    badgeColor = 'amber';
  } else {
    grade = 'C';
    gradeLabel = 'Grade C: Poor Risk/Reward (Avoid long entries)';
    badgeColor = 'rose';
  }

  // Suggested Entry, Stop-Loss, and Targets
  const { swingLows } = findSwingLevels(candles, 35);
  const recentSwingLow = swingLows.filter(l => l < lastClose).pop();

  // Natural Stop Loss: either recent swing low or 1.5x ATR
  let suggestedStop = recentSwingLow
    ? Math.max(recentSwingLow * 0.995, lastClose - (lastATR * 1.5))
    : lastClose - (lastATR * 1.5);

  // Guard against unrealistic stops (keep stop between 2.5% and 7.5% for typical swing)
  const stopDistPct = ((lastClose - suggestedStop) / lastClose) * 100;
  if (stopDistPct < 2.0) {
    suggestedStop = lastClose * 0.975; // min 2.5% stop
  } else if (stopDistPct > 8.0) {
    suggestedStop = lastClose * 0.94; // max 6% stop
  }
  suggestedStop = Number(suggestedStop.toFixed(2));

  const riskPerShare = Number((lastClose - suggestedStop).toFixed(2));
  const target1 = Number((lastClose + (riskPerShare * 2)).toFixed(2)); // 1:2 R:R
  const target2 = Number((lastClose + (riskPerShare * 3)).toFixed(2)); // 1:3 R:R

  // Assemble Lightweight Chart candle series + indicators
  const chartCandles = candles.slice(-180); // Last ~6 months
  const chartOffset = candles.length - chartCandles.length;

  const chartEma20 = [];
  const chartEma50 = [];
  const chartEma200 = [];

  for (let i = 0; i < chartCandles.length; i++) {
    const fullIdx = chartOffset + i;
    const time = chartCandles[i].time;
    if (ema20[fullIdx] != null) chartEma20.push({ time, value: ema20[fullIdx] });
    if (ema50[fullIdx] != null) chartEma50.push({ time, value: ema50[fullIdx] });
    if (ema200[fullIdx] != null) chartEma200.push({ time, value: ema200[fullIdx] });
  }

  return {
    symbol,
    shortName,
    currency,
    currentPrice: lastClose,
    previousClose: stockData.previousClose,
    priceChange: Number((lastClose - stockData.previousClose).toFixed(2)),
    priceChangePct: Number((((lastClose - stockData.previousClose) / stockData.previousClose) * 100).toFixed(2)),
    indicators: {
      ema20: lastEma20,
      ema50: lastEma50,
      ema200: lastEma200,
      rsi: lastRSI,
      atr: lastATR,
      distFrom20EmaPct
    },
    setup: {
      score,
      grade,
      gradeLabel,
      badgeColor,
      ruleBreakdown,
      suggestedEntry: lastClose,
      suggestedStop,
      riskPerShare,
      riskPct: Number((((lastClose - suggestedStop) / lastClose) * 100).toFixed(2)),
      target1,
      target2,
      target1GainPct: Number((((target1 - lastClose) / lastClose) * 100).toFixed(2)),
      target2GainPct: Number((((target2 - lastClose) / lastClose) * 100).toFixed(2))
    },
    chartData: {
      candles: chartCandles,
      ema20: chartEma20,
      ema50: chartEma50,
      ema200: chartEma200
    }
  };
}

// Routes
// 1. Get Setup Analysis
app.get('/api/analysis/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker;
    const stockData = await fetchMarketData(ticker);
    const analysis = analyzeSwingSetup(stockData);
    res.json(analysis);
  } catch (err) {
    console.error('Error analyzing ticker:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// 2. Pre-curated Popular Watchlist
app.get('/api/watchlist', (req, res) => {
  res.json({
    us: [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'NVDA', name: 'NVIDIA Corp.' },
      { symbol: 'MSFT', name: 'Microsoft Corp.' },
      { symbol: 'AMZN', name: 'Amazon.com' },
      { symbol: 'TSLA', name: 'Tesla Inc.' },
      { symbol: 'SPY', name: 'S&P 500 ETF' }
    ],
    india: [
      { symbol: 'SBIN.NS', name: 'State Bank of India' },
      { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
      { symbol: 'TCS.NS', name: 'Tata Consultancy Services' },
      { symbol: 'INFY.NS', name: 'Infosys Ltd' },
      { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
      { symbol: 'TMCV.NS', name: 'Tata Motors' },
      { symbol: 'ICICIBANK.NS', name: 'ICICI Bank' },
      { symbol: 'KOTAKBANK.NS', name: 'Kotak Bank' }
    ]
  });
});

// Market Baskets for Auto-Scanner
const NIFTY_SCAN_BASKET = [
  'SBIN.NS', 'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
  'TMCV.NS', 'BHARTIARTL.NS', 'ITC.NS', 'LT.NS',
  'HINDUNILVR.NS', 'BAJFINANCE.NS', 'MARUTI.NS', 'SUNPHARMA.NS', 'TITAN.NS',
  'AXISBANK.NS', 'NTPC.NS', 'POWERGRID.NS', 'M&M.NS', 'KOTAKBANK.NS',
  'TATASTEEL.NS', 'ADANIENT.NS', 'COALINDIA.NS', 'WIPRO.NS', 'ASIANPAINT.NS'
];

const US_SCAN_BASKET = [
  'AAPL', 'NVDA', 'MSFT', 'AMZN', 'TSLA',
  'GOOGL', 'META', 'AMD', 'SPY', 'QQQ',
  'NFLX', 'AVGO', 'INTC', 'JPM', 'PLTR'
];

const scanCache = {
  india: { timestamp: 0, results: [] },
  us: { timestamp: 0, results: [] }
};

async function runMarketScan(market = 'india', force = false) {
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache
  const now = Date.now();
  if (!force && scanCache[market] && (now - scanCache[market].timestamp < CACHE_TTL) && scanCache[market].results.length > 0) {
    return scanCache[market].results;
  }

  const basket = market === 'india' ? NIFTY_SCAN_BASKET : US_SCAN_BASKET;
  const results = [];

  // Batch in chunks of 4 to avoid rate limiting
  const chunkSize = 4;
  for (let i = 0; i < basket.length; i += chunkSize) {
    const chunk = basket.slice(i, i + chunkSize);
    const chunkPromises = chunk.map(async (ticker) => {
      try {
        const stockData = await fetchMarketData(ticker);
        const analysis = analyzeSwingSetup(stockData);
        return {
          symbol: analysis.symbol,
          shortName: analysis.shortName,
          currentPrice: analysis.currentPrice,
          priceChangePct: analysis.priceChangePct,
          score: analysis.setup.score,
          grade: analysis.setup.grade,
          gradeLabel: analysis.setup.gradeLabel,
          badgeColor: analysis.setup.badgeColor,
          entry: analysis.setup.suggestedEntry,
          stopLoss: analysis.setup.suggestedStop,
          riskPct: analysis.setup.riskPct,
          target1: analysis.setup.target1,
          target1GainPct: analysis.setup.target1GainPct,
          target2: analysis.setup.target2,
          rsi: analysis.indicators.rsi,
          distFrom20EmaPct: analysis.indicators.distFrom20EmaPct,
          isAbove200EMA: analysis.currentPrice >= (analysis.indicators.ema200 || 0)
        };
      } catch (e) {
        console.error(`Failed to scan ${ticker}:`, e.message);
        return null;
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults.filter(Boolean));
  }

  // Sort by score descending (Top setups on top)
  results.sort((a, b) => b.score - a.score);

  scanCache[market] = {
    timestamp: now,
    results
  };

  return results;
}

// 3. Market Auto-Scanner Endpoint
app.get('/api/scan', async (req, res) => {
  try {
    const market = req.query.market === 'us' ? 'us' : 'india';
    const force = req.query.force === 'true';
    const scanResults = await runMarketScan(market, force);
    res.json({
      market,
      scannedAt: new Date(scanCache[market].timestamp).toISOString(),
      count: scanResults.length,
      gradeACount: scanResults.filter(r => r.grade === 'A').length,
      gradeBCount: scanResults.filter(r => r.grade === 'B').length,
      results: scanResults
    });
  } catch (err) {
    console.error('Scan error:', err.message);
    res.status(500).json({ error: 'Failed to run market scan' });
  }
});


// 3. Trade Journal Endpoints
app.get('/api/journal', (req, res) => {
  try {
    const data = fs.readFileSync(JOURNAL_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read journal data' });
  }
});

app.post('/api/journal', (req, res) => {
  try {
    const trade = req.body;
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));

    const newTrade = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      symbol: trade.symbol,
      entry: Number(trade.entry),
      stopLoss: Number(trade.stopLoss),
      target1: Number(trade.target1),
      shares: Number(trade.shares),
      totalCapital: Number(trade.totalCapital),
      maxRisk: Number(trade.maxRisk),
      currency: trade.currency || '$',
      status: 'OPEN', // OPEN, WON, LOST, BREAKEVEN
      exitPrice: null,
      realizedPnL: null,
      notes: trade.notes || '',
      checklistCompleted: trade.checklistCompleted || false
    };

    data.unshift(newTrade);
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2), 'utf-8');
    res.status(201).json(newTrade);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save trade to journal' });
  }
});

app.put('/api/journal/:id', (req, res) => {
  try {
    const id = req.params.id;
    const update = req.body;
    let data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));

    const tradeIdx = data.findIndex(t => t.id === id);
    if (tradeIdx === -1) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    const trade = data[tradeIdx];
    if (update.status) trade.status = update.status;
    if (update.exitPrice !== undefined) {
      trade.exitPrice = Number(update.exitPrice);
      trade.realizedPnL = Number(((trade.exitPrice - trade.entry) * trade.shares).toFixed(2));
    }
    if (update.notes !== undefined) trade.notes = update.notes;

    data[tradeIdx] = trade;
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2), 'utf-8');
    res.json(trade);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update trade' });
  }
});

app.delete('/api/journal/:id', (req, res) => {
  try {
    const id = req.params.id;
    let data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    data = data.filter(t => t.id !== id);
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete trade' });
  }
});

export default app;

if (!process.env.VERCEL && process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(` SwingGuard System running at: http://localhost:${PORT}`);
    console.log(` Ready for US & Indian Stock Swing Analysis!`);
    console.log(`=================================================`);
  });
}
