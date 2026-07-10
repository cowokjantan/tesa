document.addEventListener('DOMContentLoaded', () => {

  // PRODUCTION HARDWARE CONFIGURATION (HYBRID INDEXER ARCHITECTURE)
  const CONFIG = {
    tokenAddress: "0x0c978fcf859782619556201919ba8f946db5ba75", // Verified Production CA
    burnAddress: "0x000000000000000000000000000000000000dEaD",
    pairAddress: "0xf5329a8115ac7784b37d1a0d560b43b027270677", // Uniswap V3 Pool Pair OXID/WETH (Forced Lowercase)
    explorerApiUrl: "https://robinhoodchain.blockscout.com/api"  // Blockscout Core REST API Endpoints
  };

  // DOM Elements Caching Strategy
  const caValue = document.getElementById('ca-value');
  const footerCaText = document.getElementById('footer-ca-text');
  const btnBuy = document.getElementById('btn-buy');
  const tickerText = document.getElementById('live-ticker-text');
  const rpcStatus = document.getElementById('rpc-status');
  const statusDot = document.getElementById('status-dot');
  const furnaceTotalBurned = document.getElementById('furnace-total-burned');
  const furnacePctBurned = document.getElementById('furnace-pct-burned');
  const furnaceTimestamp = document.getElementById('furnace-timestamp');
  const ledgerContainer = document.getElementById('ledger-container');

  // Hard UI Hydration (Instantly Loaded)
  if (caValue) caValue.textContent = `${CONFIG.tokenAddress.slice(0, 6)}...${CONFIG.tokenAddress.slice(-4)}`;
  if (footerCaText) footerCaText.textContent = CONFIG.tokenAddress;
  if (btnBuy) btnBuy.setAttribute('href', `https://fun.noxa.fi/robinhood/token/${CONFIG.tokenAddress}`);

  // SOCIAL MEDIA INTERCEPTOR (INTEGRATED)
  // Menangani klik pada elemen dengan class 'social-btn'
  const socialBtns = document.querySelectorAll('.social-btn');
  socialBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      alert("Community channels (Telegram/Twitter) are coming soon. Stay tuned!");
    });
  });

  let burnChartInstance = null;
  let chartLabels = [];
  let chartDataPoints = [];
  const decimals = 18;
  const symbol = "OXID";

  // HELPER ENGINE: Mengubah angka desimal mikro menjadi format subskrip (Contoh: 0.0₄5230)
  function formatMicroPrice(value) {
    const num = parseFloat(value);
    if (isNaN(num) || num === 0) return "$0.00";
    if (num >= 0.0001) return `$${num.toFixed(4)}`;

    const str = num.toFixed(20); 
    const match = str.match(/^0\.(0+)([1-9]\d*)$/);
    
    if (match) {
      const zeroCount = match[1].length;
      const significantDigits = match[2].slice(0, 4);
      const subscriptMap = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
        '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
      };
      const subscriptZeroes = zeroCount.toString().split('').map(d => subscriptMap[d]).join('');
      return `$0.0${subscriptZeroes}${significantDigits}`;
    }
    return `$${num.toFixed(8)}`;
  }

  // CHART ENGINE INITIALIZATION
  function initChart() {
    const el = document.getElementById('oxideBurnChart');
    if (!el) return;
    const ctx = el.getContext('2d');
    burnChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartLabels,
        datasets: [{
          borderColor: '#ff4500',
          backgroundColor: 'rgba(255, 69, 0, 0.03)',
          borderWidth: 2,
          pointBackgroundColor: '#ff9f00',
          data: chartDataPoints,
          tension: 0.15,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#141a24' }, ticks: { color: '#8191ad', font: { family: 'Courier New', size: 11 } } },
          y: { grid: { color: '#141a24' }, ticks: { color: '#8191ad', font: { family: 'Courier New', size: 11 } } }
        }
      }
    });
  }

  // 1. DYNAMIC PAIR-BASED DEXSCREENER TELEMETRY
  async function fetchMarketTelemetry() {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/robinhood/${CONFIG.pairAddress.toLowerCase()}`);
      if (!response.ok) throw new Error("DexScreener API limits hit");

      const json = await response.json();
      if (!json.pairs || json.pairs.length === 0) throw new Error("Target pool pair not found");

      const primaryPair = json.pairs[0];
      const elPriceUsd = document.getElementById('mkt-price-usd');
      const elPriceWeth = document.getElementById('mkt-price-weth');

      if (elPriceUsd && primaryPair.priceUsd) elPriceUsd.textContent = formatMicroPrice(primaryPair.priceUsd);
      if (elPriceWeth) {
        const wethPrice = parseFloat(primaryPair.priceNative || 0);
        elPriceWeth.textContent = wethPrice < 0.0001 ? `${wethPrice.toFixed(10)} WETH` : `${wethPrice.toFixed(6)} WETH`;
      }

      const formatDexMetric = (value) => {
        const num = parseFloat(value);
        if (isNaN(num) || num === 0) return "$0";
        if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
        return `$${num.toFixed(0)}`;
      };

      const elLiquidity = document.getElementById('mkt-liquidity');
      const elCap = document.getElementById('mkt-cap');
      const elFdv = document.getElementById('mkt-fdv');

      if (elLiquidity) elLiquidity.textContent = formatDexMetric(primaryPair.liquidity?.usd);
      if (elCap) elCap.textContent = formatDexMetric(primaryPair.marketCap || primaryPair.fdv);
      if (elFdv) elFdv.textContent = formatDexMetric(primaryPair.fdv);

      if (primaryPair.priceChange) {
        updateIntervalUI('perf-5m', primaryPair.priceChange.m5);
        updateIntervalUI('perf-1h', primaryPair.priceChange.h1);
        updateIntervalUI('perf-6h', primaryPair.priceChange.h6);
        updateIntervalUI('perf-24h', primaryPair.priceChange.h24);
      }
    } catch (err) {
      console.warn("DexScreener Telemetry Interruption:", err.message);
    }
  }

  function updateIntervalUI(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;
    const numericValue = parseFloat(value || 0);
    element.textContent = `${numericValue >= 0 ? '+' : ''}${numericValue.toFixed(2)}%`;
    element.className = `percentage ${numericValue >= 0 ? 'text-green' : 'text-red'}`;
  }

  // 2. HIGH-SPEED STATE QUERY VIA BLOCKSCOUT REST CORE API
  async function queryOnChainStateByAPI() {
    try {
      const [supplyRes, burnRes] = await Promise.all([
        fetch(`${CONFIG.explorerApiUrl}?module=token&action=gettoken&contractaddress=${CONFIG.tokenAddress}`),
        fetch(`${CONFIG.explorerApiUrl}?module=account&action=tokenbalance&contractaddress=${CONFIG.tokenAddress}&address=${CONFIG.burnAddress}`)
      ]);

      if (!supplyRes.ok || !burnRes.ok) throw new Error("Blockscout Indexer Gateway busy");

      const supplyData = await supplyRes.json();
      const burnData = await burnRes.json();

      const rawTotalSupply = supplyData.result?.totalSupply || "100000000000000000000000000"; 
      const rawDeadBalance = burnData.result || "0";

      const cleanTotalSupply = parseFloat(rawTotalSupply) / Math.pow(10, decimals);
      const cleanDeadBalance = parseFloat(rawDeadBalance) / Math.pow(10, decimals);
      const burnPercentage = cleanTotalSupply > 0 ? (cleanDeadBalance / cleanTotalSupply) * 100 : 0;

      if (furnaceTotalBurned) {
        furnaceTotalBurned.innerHTML = `${cleanDeadBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span class="ticker-suffix">${symbol}</span>`;
      }
      if (furnacePctBurned) furnacePctBurned.textContent = `${burnPercentage.toFixed(4)}%`;
      if (furnaceTimestamp) furnaceTimestamp.textContent = `Last Indexer Sync: ${new Date().toLocaleTimeString()} · Data via Blockscout Core API`;

      const compactTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (chartLabels.length > 7) { chartLabels.shift(); chartDataPoints.shift(); }
      chartLabels.push(compactTime);
      chartDataPoints.push(cleanDeadBalance);
      
      if (!burnChartInstance) initChart();
      else burnChartInstance.update();

      if (statusDot) statusDot.style.backgroundColor = "var(--neon-green)";
      if (rpcStatus) {
        rpcStatus.textContent = "Indexer Synced";
        rpcStatus.className = "text-green";
      }
      if (tickerText) tickerText.textContent = `⚡ HIGH-SPEED INDEXING SYSTEM ACTIVE · Telemetry synced via Blockscout Endpoint`;

    } catch (e) {
      console.error("Blockscout State Bridge Error:", e);
      if (rpcStatus) {
        rpcStatus.textContent = "Indexer Lag";
        rpcStatus.className = "text-red";
      }
      if (statusDot) statusDot.style.backgroundColor = "var(--neon-red)";
    }
  }

  // 3. RETRIEVE HISTORICAL BURN LEDGER FROM BLOCKSCOUT CORE LOGS
  async function fetchLedgerHistoryByAPI() {
    try {
      const response = await fetch(`${CONFIG.explorerApiUrl}?module=account&action=tokentx&contractaddress=${CONFIG.tokenAddress}&address=${CONFIG.burnAddress}&page=1&offset=15&sort=desc`);
      if (!response.ok) return;
      const json = await response.json();
      
      if (ledgerContainer && json.result && Array.isArray(json.result)) {
        const burnLogs = json.result.filter(tx => tx.to.toLowerCase() === CONFIG.burnAddress.toLowerCase());
        
        if (burnLogs.length > 0) {
          ledgerContainer.innerHTML = '';
          burnLogs.slice(0, 5).forEach(tx => {
            const quantity = parseFloat(tx.value) / Math.pow(10, decimals);
            const compactHash = `${tx.hash.slice(0, 6)}...${tx.hash.slice(-4)}`;
            
            const row = document.createElement('div');
            row.className = 'ledger-row';
            row.innerHTML = `
              <div class="ledger-meta">
                <span>Block #${tx.blockNumber} · Transaction: <a href="https://robinhoodchain.blockscout.com/tx/${tx.hash}" target="_blank" style="color:var(--brand-orange); text-decoration:none;">${compactHash} ↗</a></span>
                <span class="ledger-status">✓ On-Chain Verified Ledger</span>
              </div>
              <div class="ledger-data">
                <div class="ledger-step"><span class="l">Sender Origin</span><div class="v" style="color:var(--text-muted); font-size:11px;">${tx.from.slice(0,8)}...${tx.from.slice(-4)}</div></div>
                <div class="ledger-step"><span class="l">Amount Melted</span><div class="v text-green">${quantity.toLocaleString()} ${symbol}</div></div>
              </div>
            `;
            ledgerContainer.appendChild(row);
          });
        } else {
          ledgerContainer.innerHTML = `<div class="loading-text">No burn actions inside indexing window. Standing by...</div>`;
        }
      }
    } catch (err) {
      console.warn("Ledger indexing anomaly:", err);
      if (ledgerContainer) {
        ledgerContainer.innerHTML = `<div class="loading-text" style="color:var(--text-muted);">Ledger temporarily offline. Market metrics still active.</div>`;
      }
    }
  }

  // RUNTIME INITIAL PIPELINE ROUTER EXECUTION
  fetchMarketTelemetry();
  queryOnChainStateByAPI();
  fetchLedgerHistoryByAPI();

  // SECURE LIFECYCLE TIMING POLLING SYSTEM
  setInterval(fetchMarketTelemetry, 15000);   
  setInterval(queryOnChainStateByAPI, 30000);  
  setInterval(fetchLedgerHistoryByAPI, 30000); 
});
