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
  const rsi = new Array(closes.length).fill(null);
  if (closes.length <= period) return rsi;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum -= diff;
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  const toRsi = () => (avgLoss === 0 ? 100 : Number((100 - (100 / (1 + avgGain / avgLoss))).toFixed(2)));
  rsi[period] = toRsi();

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = toRsi();
  }
  return rsi;
}

function calculateADX(highs, lows, closes, period = 14) {
  const len = closes.length;
  const adx = new Array(len).fill(null);
  if (len < period * 2 + 1) return adx;

  const tr = new Array(len).fill(0);
  const plusDM = new Array(len).fill(0);
  const minusDM = new Array(len).fill(0);

  for (let i = 1; i < len; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    tr[i] = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
  }

  let trS = 0;
  let pS = 0;
  let mS = 0;
  for (let i = 1; i <= period; i++) {
    trS += tr[i];
    pS += plusDM[i];
    mS += minusDM[i];
  }

  const dx = new Array(len).fill(null);
  const wilder = (prev, value) => prev - (prev / period) + value;
  for (let i = period; i < len; i++) {
    if (i > period) {
      trS = wilder(trS, tr[i]);
      pS = wilder(pS, plusDM[i]);
      mS = wilder(mS, minusDM[i]);
    }
    const plusDI = trS === 0 ? 0 : (100 * pS) / trS;
    const minusDI = trS === 0 ? 0 : (100 * mS) / trS;
    const diSum = plusDI + minusDI;
    dx[i] = diSum === 0 ? 0 : (100 * Math.abs(plusDI - minusDI)) / diSum;
  }

  const adxStart = period * 2 - 1;
  if (dx[adxStart] == null) return adx;
  let adxSum = 0;
  for (let i = period; i <= adxStart; i++) adxSum += dx[i] || 0;
  let adxVal = adxSum / period;
  adx[adxStart] = Number(adxVal.toFixed(1));
  for (let i = adxStart + 1; i < len; i++) {
    adxVal = ((adxVal * (period - 1)) + dx[i]) / period;
    adx[i] = Number(adxVal.toFixed(1));
  }
  return adx;
}

function percentChange(values, days) {
  if (!values || values.length <= days) return null;
  const last = values[values.length - 1];
  const prev = values[values.length - 1 - days];
  if (!prev) return null;
  return Number((((last - prev) / prev) * 100).toFixed(2));
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
    'ADANI ENTERPRISES': 'ADANIENT.NS',
    'ZOMATO': 'ETERNAL.NS',
    'ZOMATO.NS': 'ETERNAL.NS',
    'ETERNAL': 'ETERNAL.NS'
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
async function fetchMarketData(ticker, { resolve = true } = {}) {
  let symbol = ticker.trim().toUpperCase();

  // Try smart resolving company name or un-suffixed symbol
  if (resolve) {
    const resolved = await resolveSymbol(ticker);
    if (resolved && resolved !== symbol) {
      symbol = resolved;
    }
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
    throw new Error(`Could not find ${symbol}. You do not need to search. Invest only in the stock named in Today's order.`);
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
function analyzeSwingSetup(stockData, benchmark = null) {
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
  const isAbove200EMA = lastEma200 ? lastClose >= lastEma200 : false;
  const trend200DiffPct = lastEma200 ? Number((((lastClose - lastEma200) / lastEma200) * 100).toFixed(1)) : 0;

  // 2. Check Moving Average Alignment (20 EMA > 50 EMA)
  const isAlignmentBullish = (lastEma20 && lastEma50) ? lastEma20 >= lastEma50 : false;

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

  const adx14 = calculateADX(highs, lows, closes, 14);
  const lastADX = adx14[lastIdx];
  const atrPct = Number(((lastATR / lastClose) * 100).toFixed(2));
  const atrFitsBeginner = atrPct >= 0.8 && atrPct <= 3.8;
  const atrTooWild = atrPct > 4.5;

  const stockRet20 = percentChange(closes, 20);
  const indexRet20 = benchmark?.change20 ?? null;
  const relativeStrength = (stockRet20 != null && indexRet20 != null)
    ? Number((stockRet20 - indexRet20).toFixed(2))
    : null;

  const recentLow = Math.min(...lows.slice(-10));
  const priorLow = lows.length >= 20 ? Math.min(...lows.slice(-20, -10)) : recentLow;
  const recentHigh = Math.max(...highs.slice(-10));
  const priorHigh = highs.length >= 20 ? Math.max(...highs.slice(-20, -10)) : recentHigh;
  const structureUp = recentLow > priorLow && recentHigh >= priorHigh;

  const avg20Turnover = avg20Volume * lastClose;
  const minTurnover = currency === 'INR' ? 5e7 : 2e7;
  const turnoverOk = avg20Turnover >= minTurnover;

  let gapPct = 0;
  const gapStart = Math.max(1, candles.length - 20);
  for (let i = gapStart; i < candles.length; i++) {
    const prev = candles[i - 1].close;
    if (!prev) continue;
    gapPct = Math.max(gapPct, Math.abs(candles[i].open - prev) / prev * 100);
  }
  gapPct = Number(gapPct.toFixed(2));

  const { swingLows } = findSwingLevels(candles, 35);
  const recentSwingLow = swingLows.filter(l => l < lastClose).pop();
  const swingStop = recentSwingLow ? Number((recentSwingLow * 0.995).toFixed(2)) : null;
  const atrStop = Number((lastClose - (lastATR * 1.5)).toFixed(2));
  let suggestedStop = atrStop;
  let stopIsReal = true;
  if (swingStop && swingStop < lastClose) {
    const swingDist = ((lastClose - swingStop) / lastClose) * 100;
    if (swingDist >= 2 && swingDist <= 8) suggestedStop = swingStop;
  }
  let naturalStopPct = ((lastClose - suggestedStop) / lastClose) * 100;
  if (naturalStopPct < 2) {
    suggestedStop = Number((lastClose * 0.98).toFixed(2));
    naturalStopPct = 2;
    stopIsReal = false;
  }
  suggestedStop = Number(suggestedStop.toFixed(2));
  const stopTooWide = naturalStopPct > 8;

  const resistancePool = highs.slice(-40, -1);
  const resistance = resistancePool.length ? Math.max(...resistancePool) : null;
  const resistanceAbove = resistance && resistance > lastClose * 1.005 ? resistance : null;
  const roomPct = resistanceAbove
    ? Number((((resistanceAbove - lastClose) / lastClose) * 100).toFixed(2))
    : null;

  // Calculate Setup Score (0 - 100)
  let score = 0;
  const ruleBreakdown = [];

  // Rule 1: Above 200 EMA (+18)
  if (isAbove200EMA) {
    score += 18;
    ruleBreakdown.push({
      rule: 'Primary Trend: Price is above 200 EMA',
      pass: true,
      points: 18,
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

  // Rule 2: 20 EMA > 50 EMA (+12)
  if (isAlignmentBullish) {
    score += 12;
    ruleBreakdown.push({
      rule: 'Trend Structure: 20 EMA is above 50 EMA',
      pass: true,
      points: 12,
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

  // Rule 3: Entry Zone (+16)
  if (isHealthyPullback) {
    score += 16;
    ruleBreakdown.push({
      rule: 'Sweet Spot Entry: Near 20 EMA Support',
      pass: true,
      points: 16,
      detail: `Price is ${distFrom20EmaPct}% from 20 EMA. Ideal entry zone without chasing.`
    });
  } else if (isOverextended) {
    ruleBreakdown.push({
      rule: 'Sweet Spot Entry: Overextended from Moving Averages',
      pass: false,
      points: 0,
      detail: `Price is extended ${distFrom20EmaPct}% above 20 EMA. High risk of immediate pullback. Wait for dip.`
    });
  } else {
    score += 8;
    ruleBreakdown.push({
      rule: 'Sweet Spot Entry: Moderate distance',
      pass: true,
      points: 8,
      detail: `Price is ${distFrom20EmaPct}% from 20 EMA.`
    });
  }

  // Rule 4: RSI Momentum (+10)
  if (isRsiOptimal) {
    score += 10;
    ruleBreakdown.push({
      rule: 'RSI Health: Healthy Momentum (42 - 65)',
      pass: true,
      points: 10,
      detail: `RSI is ${lastRSI}. Room to run upwards before hitting overbought levels.`
    });
  } else if (isRsiOverbought) {
    ruleBreakdown.push({
      rule: 'RSI Health: Overbought (> 70)',
      pass: false,
      points: 0,
      detail: `RSI is ${lastRSI}. Asset is overheated; risk of quick profit-taking.`
    });
  } else {
    score += 3;
    ruleBreakdown.push({
      rule: 'RSI Health: Subdued / Neutral (< 42)',
      pass: false,
      points: 3,
      detail: `RSI is ${lastRSI}. Buying pressure is still subdued.`
    });
  }

  // Rule 5: Volume (+8)
  if (isVolumeSound) {
    score += 8;
    ruleBreakdown.push({
      rule: 'Volume Confirmation: Healthy Participation',
      pass: true,
      points: 8,
      detail: 'Volume activity supports ongoing price stability.'
    });
  } else {
    score += 2;
    ruleBreakdown.push({
      rule: 'Volume Confirmation: Below average activity',
      pass: false,
      points: 2,
      detail: 'Volume is light. Awaiting stronger institutional volume.'
    });
  }

  const riskPctNow = ((lastClose - suggestedStop) / lastClose) * 100;
  const roomOk = roomPct == null || roomPct >= riskPctNow * 1.5;

  if (lastADX != null && lastADX >= 22) {
    score += 8;
    ruleBreakdown.push({
      rule: 'Trend Strength: ADX shows a real trend',
      pass: true,
      points: 8,
      detail: `ADX is ${lastADX}. The move has direction, so a swing stop is more meaningful.`
    });
  } else if (lastADX != null && lastADX >= 16) {
    score += 3;
    ruleBreakdown.push({
      rule: 'Trend Strength: ADX is only moderate',
      pass: false,
      points: 3,
      detail: `ADX is ${lastADX}. The trend is not strong. Choppy markets hit stops more often.`
    });
  } else {
    ruleBreakdown.push({
      rule: 'Trend Strength: Market is choppy',
      pass: false,
      points: 0,
      detail: `ADX is ${lastADX ?? 'n/a'}. Price is swinging without a clear trend. Beginners should stand aside.`
    });
  }

  if (atrFitsBeginner) {
    score += 8;
    ruleBreakdown.push({
      rule: 'Volatility: Daily swing fits a small account',
      pass: true,
      points: 8,
      detail: `Average daily range is ${atrPct}% of price. The stop can stay small.`
    });
  } else if (!atrTooWild) {
    score += 3;
    ruleBreakdown.push({
      rule: 'Volatility: A bit wide for a beginner',
      pass: false,
      points: 3,
      detail: `Average daily range is ${atrPct}% of price. Use the smaller 0.5% risk setting.`
    });
  } else {
    ruleBreakdown.push({
      rule: 'Volatility: Too wild for a beginner',
      pass: false,
      points: 0,
      detail: `Average daily range is ${atrPct}% of price. One bad day can be a large loss.`
    });
  }

  if (relativeStrength != null && relativeStrength >= 0) {
    score += 8;
    ruleBreakdown.push({
      rule: 'Relative Strength: Beating the market',
      pass: true,
      points: 8,
      detail: `This stock is ${relativeStrength}% ahead of ${benchmark.shortName || 'the index'} over 20 days. Leaders hold up better.`
    });
  } else if (relativeStrength != null) {
    ruleBreakdown.push({
      rule: 'Relative Strength: Lagging the market',
      pass: false,
      points: 0,
      detail: `This stock is ${Math.abs(relativeStrength)}% behind ${benchmark.shortName || 'the index'} over 20 days. Prefer a leader.`
    });
  } else {
    score += 2;
    ruleBreakdown.push({
      rule: 'Relative Strength: Index comparison unavailable',
      pass: false,
      points: 2,
      detail: 'The market index could not be compared, so this factor is incomplete.'
    });
  }

  if (structureUp) {
    score += 6;
    ruleBreakdown.push({
      rule: 'Price Structure: Higher highs and higher lows',
      pass: true,
      points: 6,
      detail: 'The last two weeks are still stepping up. That is the pattern swing traders buy.'
    });
  } else {
    ruleBreakdown.push({
      rule: 'Price Structure: Not making higher lows',
      pass: false,
      points: 0,
      detail: 'Recent dips are falling, or the bounce is weak. Wait for the structure to turn up.'
    });
  }

  if (roomOk) {
    score += 6;
    ruleBreakdown.push({
      rule: 'Room to Target: Resistance is far enough',
      pass: true,
      points: 6,
      detail: roomPct == null
        ? 'No ceiling in the last 40 days, so the 1:2 target is not blocked nearby.'
        : `Nearest resistance is ${roomPct}% above price, enough room for the first target.`
    });
  } else {
    ruleBreakdown.push({
      rule: 'Room to Target: Resistance is too close',
      pass: false,
      points: 0,
      detail: `Nearest resistance is only ${roomPct}% away. The target may stall before it pays 2x the risk.`
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  // Determine Grade
  let grade = 'C';
  let gradeLabel = 'Caution / Avoid';
  let badgeColor = 'rose';

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

  const vetoes = [];
  if (!isAbove200EMA) {
    vetoes.push('Price is below the 200-day average. That is a downtrend, and beginners should not buy it.');
  }
  if (benchmark?.regime === 'RISK_OFF') {
    vetoes.push('The overall market is weak. New buys fail more often until the index is back above its 200-day average.');
  }
  if (atrTooWild) {
    vetoes.push(`Daily swings average ${atrPct}%. That is too large for a small stop.`);
  }
  if (stopTooWide) {
    vetoes.push(`The real stop is ${naturalStopPct.toFixed(1)}% away. Losing that much on one trade is too big.`);
  }
  if (!turnoverOk) {
    const turnoverLabel = currency === 'INR'
      ? `₹${(avg20Turnover / 1e7).toFixed(1)} Cr`
      : `$${(avg20Turnover / 1e6).toFixed(1)}M`;
    vetoes.push(`Average daily trading value is only ${turnoverLabel}. Thin stocks are hard to exit at the stop.`);
  }
  if (gapPct > 6) {
    vetoes.push(`A recent gap was ${gapPct}%. Price can jump over the stop while the market is closed.`);
  }

  let action = 'SPEND';
  let actionLabel = 'Spend a small amount';
  let actionReason = 'Trend, pullback, risk, and the overall market line up. Buy only the quantity shown, and place the stop the same day.';

  if (vetoes.length) {
    action = 'SKIP';
    actionLabel = 'Do not buy';
    actionReason = vetoes[0];
  } else if (!benchmark || benchmark.regime === 'UNKNOWN') {
    action = 'WAIT';
    actionLabel = 'Do not spend yet';
    actionReason = 'The market check is unavailable, so this stock is not cleared for money.';
  } else if (isOverextended || distFrom20EmaPct > 4.5) {
    action = 'WAIT';
    actionLabel = 'Wait for a dip';
    actionReason = `Price is ${distFrom20EmaPct}% above the 20-day average. Chasing here is how beginners buy the top. Wait for price to come back near that average.`;
  } else if (isRsiOverbought) {
    action = 'WAIT';
    actionLabel = 'Wait for a cooldown';
    actionReason = `RSI is ${lastRSI}. The move is stretched. Wait until RSI cools below 65.`;
  } else if (!roomOk) {
    action = 'WAIT';
    actionLabel = 'Wait for a clearer path';
    actionReason = 'Nearby resistance can block the target. Do not spend until price breaks that level or pulls back.';
  } else if (!isAlignmentBullish || (lastADX != null && lastADX < 16) || !structureUp) {
    action = 'WAIT';
    actionLabel = 'Wait for the trend to confirm';
    actionReason = 'The short-term trend is not clean enough. Wait for the 20-day average to stay above the 50-day average and for higher lows.';
  } else if (benchmark.regime === 'CAUTION' && score < 85) {
    action = 'WAIT';
    actionLabel = 'Market is mixed';
    actionReason = 'The index is above its long-term average but slipping short term. Only an exceptional setup is worth money today, and this one is not there yet.';
  } else if (relativeStrength != null && relativeStrength < -3) {
    action = 'WAIT';
    actionLabel = 'This stock is lagging';
    actionReason = 'The market has stronger stocks than this one. Spend on a leader, not a laggard.';
  } else if (score < 75) {
    action = 'WAIT';
    actionLabel = 'Do not spend yet';
    actionReason = 'The setup score is below 75. Keep it on the watchlist until more rules pass.';
  }

  if (action === 'SPEND' && benchmark?.regime === 'CAUTION') {
    actionReason = `The wider market is mixed, but this stock scored ${score}, so it clears that bar. Buy only the quantity shown, and place the stop the same day.`;
  }

  if (action !== 'SPEND') {
    gradeLabel = action === 'SKIP'
      ? `${gradeLabel} — do not spend`
      : `${gradeLabel} — wait, do not spend yet`;
  }

  const riskPerShare = Number((lastClose - suggestedStop).toFixed(2));
  const target1 = Number((lastClose + (riskPerShare * 2)).toFixed(2));
  const target2 = Number((lastClose + (riskPerShare * 3)).toFixed(2));

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
      atrPct,
      adx: lastADX,
      distFrom20EmaPct
    },
    scenario: {
      regime: benchmark?.regime || 'UNKNOWN',
      regimeLabel: benchmark?.label || 'Market check unavailable',
      indexSymbol: benchmark?.symbol || null,
      indexName: benchmark?.shortName || null,
      indexPrice: benchmark?.price || null,
      indexChange20: indexRet20,
      stockChange20: stockRet20,
      relativeStrength,
      turnoverOk,
      avgTurnover: Number(avg20Turnover.toFixed(0)),
      structureUp,
      roomPct,
      resistance: resistanceAbove ? Number(resistanceAbove.toFixed(2)) : null,
      gapPct,
      vetoes
    },
    setup: {
      score,
      grade,
      gradeLabel,
      badgeColor,
      ruleBreakdown,
      action,
      actionLabel,
      actionReason,
      beginnerSafe: action === 'SPEND',
      suggestedEntry: lastClose,
      suggestedStop,
      riskPerShare,
      riskPct: Number(naturalStopPct.toFixed(2)),
      target1,
      target2,
      target1GainPct: Number((((target1 - lastClose) / lastClose) * 100).toFixed(2)),
      target2GainPct: Number((((target2 - lastClose) / lastClose) * 100).toFixed(2)),
      stopIsReal
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
function marketKeyForSymbol(symbol) {
  const s = String(symbol || '').toUpperCase();
  if (s.endsWith('.NS') || s.endsWith('.BO') || s === '^NSEI' || s === '^BSESN') return 'india';
  return 'us';
}

function summarizeBenchmark(stockData) {
  const closes = stockData.candles.map(c => c.close);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const rsi14 = calculateRSI(closes, 14);
  const last = closes[closes.length - 1];
  const lastEma50 = ema50[ema50.length - 1];
  const lastEma200 = ema200[ema200.length - 1];
  const above200 = !!(lastEma200 && last >= lastEma200);
  const above50 = !!(lastEma50 && last >= lastEma50);
  const change20 = percentChange(closes, 20);
  let regime = 'UNKNOWN';
  let label = 'Market check unavailable';
  if (lastEma200) {
    if (above200 && above50) {
      regime = 'RISK_ON';
      label = 'Market is healthy. New buys are allowed.';
    } else if (above200) {
      regime = 'CAUTION';
      label = 'Market is mixed. Only the strongest setups are worth money.';
    } else {
      regime = 'RISK_OFF';
      label = 'Market is weak. Keep cash until the index recovers.';
    }
  }
  return {
    symbol: stockData.symbol,
    shortName: stockData.shortName,
    price: last,
    above200,
    above50,
    change20,
    rsi: rsi14[rsi14.length - 1],
    regime,
    label,
    ema50: lastEma50,
    ema200: lastEma200
  };
}

const benchmarkCache = {
  india: { at: 0, data: null },
  us: { at: 0, data: null }
};

async function getBenchmark(market) {
  const key = market === 'us' ? 'us' : 'india';
  const now = Date.now();
  if (benchmarkCache[key].data && now - benchmarkCache[key].at < 10 * 60 * 1000) {
    return benchmarkCache[key].data;
  }
  const symbol = key === 'india' ? '^NSEI' : 'SPY';
  try {
    const stockData = await fetchMarketData(symbol, { resolve: false });
    const summary = summarizeBenchmark(stockData);
    benchmarkCache[key] = { at: now, data: summary };
    return summary;
  } catch (err) {
    console.warn('Benchmark fetch failed:', err.message);
    return benchmarkCache[key].data;
  }
}

app.get('/api/analysis/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker;
    const stockData = await fetchMarketData(ticker);
    const benchmark = await getBenchmark(marketKeyForSymbol(stockData.symbol));
    const analysis = analyzeSwingSetup(stockData, benchmark);
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
  india: { timestamp: 0, results: [], benchmark: null },
  us: { timestamp: 0, results: [], benchmark: null }
};

async function runMarketScan(market = 'india', force = false) {
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache
  const now = Date.now();
  if (!force && scanCache[market] && (now - scanCache[market].timestamp < CACHE_TTL) && scanCache[market].results.length > 0) {
    return scanCache[market].results;
  }

  const basket = market === 'india' ? NIFTY_SCAN_BASKET : US_SCAN_BASKET;
  const benchmark = await getBenchmark(market);
  const results = [];

  // Batch in chunks of 4 to avoid rate limiting
  const chunkSize = 4;
  for (let i = 0; i < basket.length; i += chunkSize) {
    const chunk = basket.slice(i, i + chunkSize);
    const chunkPromises = chunk.map(async (ticker) => {
      try {
        const stockData = await fetchMarketData(ticker);
        const analysis = analyzeSwingSetup(stockData, benchmark);
        return {
          symbol: analysis.symbol,
          shortName: analysis.shortName,
          currentPrice: analysis.currentPrice,
          priceChangePct: analysis.priceChangePct,
          score: analysis.setup.score,
          grade: analysis.setup.grade,
          gradeLabel: analysis.setup.gradeLabel,
          badgeColor: analysis.setup.badgeColor,
          action: analysis.setup.action,
          actionLabel: analysis.setup.actionLabel,
          actionReason: analysis.setup.actionReason,
          beginnerSafe: analysis.setup.beginnerSafe,
          entry: analysis.setup.suggestedEntry,
          stopLoss: analysis.setup.suggestedStop,
          riskPct: analysis.setup.riskPct,
          target1: analysis.setup.target1,
          target1GainPct: analysis.setup.target1GainPct,
          target2: analysis.setup.target2,
          rsi: analysis.indicators.rsi,
          adx: analysis.indicators.adx,
          atrPct: analysis.indicators.atrPct,
          relativeStrength: analysis.scenario.relativeStrength,
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

  const actionRank = { SPEND: 0, WAIT: 1, SKIP: 2 };
  results.sort((a, b) => {
    const byAction = (actionRank[a.action] ?? 3) - (actionRank[b.action] ?? 3);
    if (byAction !== 0) return byAction;
    return b.score - a.score;
  });

  scanCache[market] = {
    timestamp: now,
    results,
    benchmark
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
      spendCount: scanResults.filter(r => r.action === 'SPEND').length,
      waitCount: scanResults.filter(r => r.action === 'WAIT').length,
      skipCount: scanResults.filter(r => r.action === 'SKIP').length,
      benchmark: scanCache[market].benchmark,
      results: scanResults
    });
  } catch (err) {
    console.error('Scan error:', err.message);
    res.status(500).json({ error: 'Failed to run market scan' });
  }
});


const notifyHits = new Map();

function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}

app.post('/api/notify/whatsapp', async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    const apikey = String(req.body?.apikey || '').trim();
    const message = String(req.body?.message || '').trim();
    if (!phone) {
      return res.status(400).json({ error: 'Enter a valid WhatsApp number. A 10-digit Indian mobile number is enough.' });
    }
    if (!/^[A-Za-z0-9]{4,64}$/.test(apikey)) {
      return res.status(400).json({ error: 'Paste the API key that CallMeBot sends after you allow it. Or use Open in WhatsApp instead.' });
    }
    if (!message || message.length > 1200) {
      return res.status(400).json({ error: 'The alert message is empty or too long.' });
    }

    const now = Date.now();
    const hits = (notifyHits.get(phone) || []).filter(t => now - t < 60 * 60 * 1000);
    if (hits.length >= 8) {
      return res.status(429).json({ error: 'Too many WhatsApp alerts this hour. Use Open in WhatsApp for now.' });
    }

    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(`+${phone}`)}&apikey=${encodeURIComponent(apikey)}&text=${encodeURIComponent(message)}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'SwingGuard/1.0' } });
    const body = await response.text();
    const queued = /queued/i.test(body);
    if (!response.ok || !queued) {
      const detail = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220);
      return res.status(400).json({
        error: 'WhatsApp did not accept the alert. Check the number and API key, or use Open in WhatsApp.',
        detail
      });
    }

    hits.push(now);
    notifyHits.set(phone, hits);
    res.json({ ok: true });
  } catch (err) {
    console.error('WhatsApp notify failed:', err.message);
    res.status(500).json({ error: 'Could not reach the WhatsApp service.' });
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
      action: trade.action || '',
      score: trade.score ?? null,
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
