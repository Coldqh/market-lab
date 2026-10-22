# MARKET / LAB

Dark, responsive **futures-trading simulator + economic learning laboratory**. It is a standalone static website inspired by professional trading terminals.

### Features
- 8 synthetic futures markets: ES, NQ, RTY, YM, CL, NG, GC and SI
- High-DPI canvas candlestick chart, volume histogram, optional SMA(12), line mode, and candle aggregation
- Long/short positions with contract multipliers, notional exposure, initial margin, commissions, mark-to-market P&L and maintenance margin liquidation
- Market simulation (one candle, ten candles, auto-play) and five macroeconomic stress scenarios
- Position close-out, full trade journal, personal notes, CSV export
- Six objective lessons with worked explanations
- Local persistence via `localStorage`, responsive mobile layout, zero JavaScript dependencies

### Run
Open `index.html` in a modern browser, or serve this directory with any static web server:

```bash
python -m http.server 8080
```

Open http://localhost:8080.

### Deploy to GitHub Pages
Create a repository and upload these files at its root. In **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then `main` / `(root)`. Pages will publish `https://YOUR-USERNAME.github.io/REPO-NAME/`.

### Model boundaries
This is **educational simulation only**, not investment advice. Prices and event impacts are deliberately synthetic and do not represent live market data. The simplified margin model is not a reproduction of exchange- or broker-specific rules. Demo commission is 0.0025% of notional per side; initial margin percentages are illustrative for each instrument. The prototype allows one open position per instrument and has no live order book, networking, or brokerage integration.