# 🛡️ SwingGuard - Smart Swing Trading & Risk Analysis System

An automated, disciplined swing trading workstation designed specifically to protect capital, eliminate emotional trading errors, and maintain positive mathematical expectancy.

---

## 🚀 Quick Start

1. **One-Click Run**: Double-click `start.bat` inside this folder.
2. **Or via Terminal**:
   ```bash
   cd swing-trading-system
   npm install
   node server.js
   ```
3. Open your browser at: **[http://localhost:3000](http://localhost:3000)**

---

## 🌟 Key Features

### 1. Automated Swing Trade Screener & Scorer (0–100%)
* Automatically calculates **20 EMA, 50 EMA, 200 EMA**, **RSI(14)**, and **ATR(14)** for any stock.
* Analyzes setup quality using the **5 Golden Rules of Swing Trading**:
  * **Primary Trend**: Is the stock above the 200 EMA?
  * **Trend Alignment**: Is the 20 EMA above the 50 EMA?
  * **Entry Zone**: Has the stock pulled back safely near the 20/50 EMA (without being overextended)?
  * **RSI Momentum**: Is RSI between 42 and 65 (room to run, not overbought)?
  * **Volume Confirmation**: Healthy institutional participation.
* Outputs a clear classification:
  * **Grade A (80-100)**: High-Probability Swing Setup.
  * **Grade B (60-79)**: Watchlist Setup (await pullback or confirmation).
  * **Grade C (< 60)**: High Risk / Avoid long entries.

### 2. The 1%–2% Mathematical Risk Shield & Position Sizer
* The #1 reason beginners blow up accounts is sizing trades too big.
* Enter your **Total Account Capital** (e.g., $5,000 or ₹1,00,000) and choose your risk limit (**1.0% Conservative**, **1.5% Moderate**, or **2.0% Aggressive**).
* SwingGuard calculates the **exact number of shares to buy** so that even if your stop-loss is triggered, your account cannot lose more than your pre-set dollar/rupee limit.
* Automatically plots:
  * **Stop-Loss** (anchored to recent swing low or 1.5x ATR).
  * **Target 1 (1:2 Risk-Reward)**: Twice the risk distance.
  * **Target 2 (1:3 Risk-Reward)**: Three times the risk distance.

### 3. Interactive Candlestick Charts (Lightweight Charts)
* High-performance candlestick chart with zoom, pan, and crosshairs.
* Color-coded EMA lines:
  * **Cyan**: 20 EMA (Short-term momentum)
  * **Amber**: 50 EMA (Medium-term trend)
  * **Purple**: 200 EMA (Institutional macro trend)
* Visual price lines indicating Entry (Blue), Stop-Loss (Red), and Targets (Green/Teal).

### 4. Pre-Trade Discipline Checklist
* An interactive 5-point checklist ensuring you never pull the trigger without confirming:
  1. Trend Alignment (> 200 EMA)
  2. Strict Position Sizing (<= 2% Risk)
  3. Pre-Set Stop Loss
  4. Minimum 1:2 Risk-to-Reward
  5. Catalyst / Earnings clearance

### 5. Trade Journal & Expectancy Tracker
* Click **"Log Trade to Journal"** to record setups with full entry, stop, target, and risk details.
* Update trade status to `WON`, `LOST`, or `BREAKEVEN` with your realized exit price.
* Automatically computes your **Win Rate %**, **Net P&L**, and trade performance over time.

---

## 📈 Supported Markets
* **US Stocks & ETFs**: Enter standard symbols like `AAPL`, `NVDA`, `MSFT`, `TSLA`, `SPY`, `QQQ`.
* **Indian NSE Stocks**: Append `.NS` to the symbol (e.g. `RELIANCE.NS`, `TCS.NS`, `INFY.NS`, `TATAMOTORS.NS`).
* **Indian BSE Stocks**: Append `.BO` to the symbol.
* **Global Stocks**: Supported using standard Yahoo Finance tickers.
