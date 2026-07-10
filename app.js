document.addEventListener('DOMContentLoaded', async () => {

  // CRITICAL PRODUCTION ROBINHOOD CHAIN HARDWARE CONFIGURATION
  const ROBINHOOD_CONFIG = {
    rpcUrls: [
      "https://rpc.mainnet.chain.robinhood.com/",
      "https://rpc.robinhoodchain.com"
    ],
    tokenAddress: "0x0c978fcf859782619556201919ba8f946db5ba75", // Verified Production CA
    burnAddress: "0x000000000000000000000000000000000000dEaD",
    // Pool Pair Address Uniswap V3 untuk OXID/WETH di Robinhood Chain (Bypass standard token cache)
    pairAddress: "0xF5329A8115Ac7784b37d1A0D560b43B027270677" 
  };

  const minERC20ABI = [
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ];

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

  // Hard UI Hydration
  if (caValue) caValue.textContent = `${ROBINHOOD_CONFIG.tokenAddress.slice(0, 6)}...${ROBINHOOD_CONFIG.tokenAddress.slice(-4)}`;
  if (footerCaText) footerCaText.textContent = ROBINHOOD_CONFIG.tokenAddress;
  if (btnBuy) btnBuy.setAttribute('href', `https://fun.noxa.fi/robinhood/token/${ROBINHOOD_CONFIG.tokenAddress}`);

  let burnChartInstance = null;
  let chartLabels = [];
  let chartDataPoints = [];
  let provider = null;
  let tokenContract = null;
  let decimals = 18;
  let symbol = "OXID";
  let initialNetworkBlock = 0;

  // HELPER ENGINE: Mengubah angka desimal mikro menjadi format subskrip (Contoh: 0.0₄5230)
  function formatMicroPrice(value) {
    const num = parseFloat(value);
    if (isNaN(num) || num === 0) return "$0.00";
    if (num >= 0.0001) return `$${num.toFixed(4)}`;

    // Ubah ke string notasi ilmiah untuk mendeteksi jumlah angka nol
    const str = num.toFixed(20); 
    const match = str.match(/^0\.(0+)([1-9]\d*)$/);
    
    if (match) {
      const zeroCount = match[1].length;
      const significantDigits = match[2].slice(0, 4); // Ambil 4 angka penting di belakangnya
      const subscriptMap = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
        '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
      };
      const subscriptZeroes = zeroCount.toString().split('').map(d => subscriptMap[d]).join('');
      return `$0.0${subscriptZeroes}${significantDigits}`;
    }
    return `$${num.toFixed(8)}`;
  }

  // CHART ENGINE INITIALIZATION (Strict Cumulative Linear Pathing)
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

  // 1. DYNAMIC PAIR-BASED DEXSCREENER ENGINE INTERACTION
  async function fetchMarketTelemetry() {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/robinhood-chain/${ROBINHOOD_CONFIG.pairAddress}`);
      if (!response.ok) throw new Error("DexScreener API limits hit or indexer offline");

      const json = await response.json();
      if (!json.pairs || json.pairs.length === 0) throw new Error("Target pool pair not found");

      const primaryPair = json.pairs[0];

      // Formatter UI untuk Harga Menggunakan Subskrip Desimal Mikro
      const elPriceUsd = document.getElementById('mkt-price-usd');
      const elPriceWeth = document.getElementById('mkt-price-weth');

      if (elPriceUsd) elPriceUsd.textContent = formatMicroPrice(primaryPair.priceUsd);
      if (elPriceWeth) {
        const wethPrice = parseFloat(primaryPair.priceNative || 0);
        elPriceWeth.textContent = wethPrice < 0.0001 ? `${wethPrice.toFixed(10)} WETH` : `${wethPrice.toFixed(6)} WETH`;
      }

      // Format Satuan K / M / B untuk Likuiditas & Kapitalisasi Pasar
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

      // Sinkronisasi Indikator Matrix Perubahan Harga 5M, 1H, 6H, dan 24H
      if (primaryPair.priceChange) {
        updateIntervalUI('perf-5m', primaryPair.priceChange.m5);
        updateIntervalUI('perf-1h', primaryPair.priceChange.h1);
        updateIntervalUI('perf-6h', primaryPair.priceChange.h6);
        updateIntervalUI('perf-24h', primaryPair.priceChange.h24);
      }

    } catch (err) {
      console.warn("DexScreener Core Node Engine Error:", err.message);
    }
  }

  function updateIntervalUI(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;
    const numericValue = parseFloat(value || 0);
    element.textContent = `${numericValue >= 0 ? '+' : ''}${numericValue.toFixed(2)}%`;
    element.className = `percentage ${numericValue >= 0 ? 'text-green' : 'text-red'}`;
  }

  // 2. CORE QUERY IMPLEMENTATION
  async function queryOnChainState() {
    if (!tokenContract || !provider) return;
    try {
      const runtimeBlock = await provider.getBlockNumber();
      const rawTotalSupply = await tokenContract.totalSupply();
      const rawDeadBalance = await tokenContract.balanceOf(ROBINHOOD_CONFIG.burnAddress);

      const cleanTotalSupply = parseFloat(ethers.utils.formatUnits(rawTotalSupply, decimals));
      const cleanDeadBalance = parseFloat(ethers.utils.formatUnits(rawDeadBalance, decimals));
      const burnPercentage = cleanTotalSupply > 0 ? (cleanDeadBalance / cleanTotalSupply) * 100 : 0;

      if (furnaceTotalBurned) {
        furnaceTotalBurned.innerHTML = `${cleanDeadBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span class="ticker-suffix">${symbol}</span>`;
      }
      if (furnacePctBurned) furnacePctBurned.textContent = `${burnPercentage.toFixed(4)}%`;
      if (furnaceTimestamp) furnaceTimestamp.textContent = `Last Cryptographic Sync: ${new Date().toLocaleTimeString()} · Block #${runtimeBlock.toLocaleString()}`;

      const compactTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (chartLabels.length > 7) { chartLabels.shift(); chartDataPoints.shift(); }
      chartLabels.push(compactTime);
      chartDataPoints.push(cleanDeadBalance);
      
      if (!burnChartInstance) initChart();
      else burnChartInstance.update();

    } catch (e) {
      console.error("RPC state fetch encounter:", e);
    }
  }

  // 3. CRYPTOGRAPHIC SECURE ON-CHAIN BLOCKCHAIN READ PIPELINE WITH AUTONOMOUS FALLBACKS
  let initialized = false;
  for (let rpcTarget of ROBINHOOD_CONFIG.rpcUrls) {
    if (initialized) break;
    try {
      provider = new ethers.providers.JsonRpcProvider({
        url: rpcTarget,
        headers: { "Accept": "application/json", "Content-Type": "application/json" }
      });
      
      initialNetworkBlock = await provider.getBlockNumber();
      tokenContract = new ethers.Contract(ROBINHOOD_CONFIG.tokenAddress, minERC20ABI, provider);
      
      try {
        decimals = await tokenContract.decimals();
        symbol = await tokenContract.symbol();
      } catch (tokenErr) {
        console.warn("Fallback to default 18 decimals due to contract view constraints.");
      }

      if (statusDot) statusDot.style.backgroundColor = "var(--neon-green)";
      if (rpcStatus) {
        rpcStatus.textContent = "Connected";
        rpcStatus.className = "text-green";
      }
      if (tickerText) tickerText.textContent = `⚡ IMMUTABLE NODE SYNC ACTIVE · Tracking Robinhood Chain Block #${initialNetworkBlock.toLocaleString()}`;
      initialized = true;
      
    } catch (error) {
      console.error(`RPC Handshake rejected by host gateway: ${rpcTarget}`, error);
    }
  }

  // RUNTIME LIFECYCLE ROUTER EXECUTION
  if (initialized) {
    await queryOnChainState();
    await fetchMarketTelemetry();

    setInterval(queryOnChainState, 15000);
    setInterval(fetchMarketTelemetry, 30000);

    try {
      const deadLogFilter = tokenContract.filters.Transfer(null, ROBINHOOD_CONFIG.burnAddress);
      const preloadedLogs = await tokenContract.queryFilter(deadLogFilter, initialNetworkBlock - 150, initialNetworkBlock);
      
      if (ledgerContainer) {
        if (preloadedLogs.length > 0) {
          ledgerContainer.innerHTML = '';
          preloadedLogs.reverse().slice(0, 5).forEach(log => appendLedgerRow(log, decimals, symbol));
        } else {
          ledgerContainer.innerHTML = `<div class="loading-text">No burn actions processed inside indexing window. Standing by...</div>`;
        }
      }

      tokenContract.on(deadLogFilter, (from, to, value, event) => {
        if (ledgerContainer) {
          const loader = ledgerContainer.querySelector('.loading-text');
          if (loader) ledgerContainer.innerHTML = '';
          appendLedgerRow(event, decimals, symbol);
        }
        queryOnChainState(); 
      });
    } catch(logErr) {
      console.warn("Real-time logging paused due to node RPC provider subscription limits.");
    }
  } else {
    if (tickerText) tickerText.textContent = "❌ Node Call Failed. Critical RPC Connection Dropped. Verify Terminal Endpoint Status.";
    if (rpcStatus) {
      rpcStatus.textContent = "Gateway Failure";
      rpcStatus.className = "text-red";
    }
    if (statusDot) statusDot.style.backgroundColor = "var(--neon-red)";
  }

  // Pure DOM Node Generation for Ledger System Rows
  function appendLedgerRow(event, decimals, symbol) {
    if (!ledgerContainer) return;
    let quantity = 0;
    let senderAddress = "0x0000...0000";
    
    if (event.args && event.args.value) {
      quantity = parseFloat(ethers.utils.formatUnits(event.args.value, decimals));
      senderAddress = event.args.from;
    }
    
    const compactHash = `${event.transactionHash.slice(0, 6)}...${event.transactionHash.slice(-4)}`;
    const row = document.createElement('div');
    row.className = 'ledger-row';
    row.innerHTML = `
      <div class="ledger-meta">
        <span>Block #${event.blockNumber} · Transaction: <a href="https://robinhoodchain.blockscout.com/tx/${event.transactionHash}" target="_blank" style="color:var(--brand-orange); text-decoration:none;">${compactHash} ↗</a></span>
        <span class="ledger-status">✓ On-Chain Immutably Signed</span>
      </div>
      <div class="ledger-data">
        <div class="ledger-step"><span class="l">Sender Origin</span><div class="v" style="color:var(--text-muted); font-size:11px;">${senderAddress.slice(0,8)}...${senderAddress.slice(-4)}</div></div>
        <div class="ledger-step"><span class="l">Amount Melted</span><div class="v text-green">${quantity.toLocaleString()} ${symbol}</div></div>
      </div>
    `;

    if (ledgerContainer.firstChild && !ledgerContainer.querySelector('.loading-text')) {
      ledgerContainer.insertBefore(row, ledgerContainer.firstChild);
    } else {
      ledgerContainer.appendChild(row);
    }

    const activeRows = ledgerContainer.querySelectorAll('.ledger-row');
    if (activeRows.length > 5) {
      ledgerContainer.removeChild(activeRows[activeRows.length - 1]);
    }
  }
});
