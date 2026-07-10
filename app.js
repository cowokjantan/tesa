document.addEventListener('DOMContentLoaded', async () => {

  // CRITICAL PRODUCTION ROBINHOOD CHAIN HARDWARE CONFIGURATION
  const ROBINHOOD_CONFIG = {
    rpcUrl: "https://rpc.mainnet.chain.robinhood.com/", // URL RPC Resmi Robinhood Chain Mainnet
    tokenAddress: "0x0c978fcf859782619556201919ba8f946db5ba75", // Ganti dengan alamat kontrak asli Anda setelah deploy
    burnAddress: "0x000000000000000000000000000000000000dEaD",
    geckoNetworkId: "robinhood-chain" // Slug ID jaringan resmi untuk GeckoTerminal API
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
  caValue.textContent = `${ROBINHOOD_CONFIG.tokenAddress.slice(0, 6)}...${ROBINHOOD_CONFIG.tokenAddress.slice(-4)}`;
  footerCaText.textContent = ROBINHOOD_CONFIG.tokenAddress;
  btnBuy.setAttribute('href', `https://robinhoodchain.blockscout.com/token/${ROBINHOOD_CONFIG.tokenAddress}`);

  let burnChartInstance = null;
  let chartLabels = [];
  let chartDataPoints = [];

  // CHART ENGINE INITIALIZATION (Strict Cumulative Linear Pathing)
  function initChart() {
    const ctx = document.getElementById('oxideBurnChart').getContext('2d');
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

  // 1. GENUINE GECKOTERMINAL API MARKET ENGINE INTERACTION
  async function fetchMarketTelemetry() {
    try {
      const response = await fetch(`https://api.geckoterminal.com/api/v2/networks/${ROBINHOOD_CONFIG.geckoNetworkId}/tokens/${ROBINHOOD_CONFIG.tokenAddress}`);
      if (!response.ok) throw new Error("API stream limits hit or pool not initialized on DEX router");
      
      const json = await response.json();
      const attr = json.data.attributes;

      // Update Native Market Metrics DOM Fields
      document.getElementById('mkt-price-usd').textContent = `$${parseFloat(attr.price_usd).toFixed(8)}`;
      document.getElementById('mkt-price-weth').textContent = `${parseFloat(attr.price_native).toFixed(10)} WETH`;
      document.getElementById('mkt-liquidity').textContent = `$${parseFloat(attr.total_reserve_in_usd).toLocaleString(undefined, {maximumFractionDigits:0})}`;
      document.getElementById('mkt-cap').textContent = `$${parseFloat(attr.market_cap_usd || attr.fdv_usd).toLocaleString(undefined, {maximumFractionDigits:0})}`;
      document.getElementById('mkt-fdv').textContent = `$${parseFloat(attr.fdv_usd).toLocaleString(undefined, {maximumFractionDigits:0})}`;

      // Cascade Timeframe Interval Matrix Elements
      updateIntervalUI('perf-5m', attr.price_change_percentage.m5);
      updateIntervalUI('perf-1h', attr.price_change_percentage.h1);
      updateIntervalUI('perf-24h', attr.price_change_percentage.h24);

    } catch (err) {
      console.warn("Market metrics currently cooling down or pool awaiting deployment liquidity.");
    }
  }

  function updateIntervalUI(elementId, value) {
    const element = document.getElementById(elementId);
    const numericValue = parseFloat(value || 0);
    element.textContent = `${numericValue >= 0 ? '+' : ''}${numericValue.toFixed(2)}%`;
    element.className = `percentage ${numericValue >= 0 ? 'text-green' : 'text-red'}`;
  }

  // 2. CRYPTOGRAPHIC SECURE ON-CHAIN BLOCKCHAIN READ PIPELINE
  try {
    // Inisialisasi Provider dengan RPC baru yang Anda berikan
    const provider = new ethers.providers.JsonRpcProvider(ROBINHOOD_CONFIG.rpcUrl);
    const initialNetworkBlock = await provider.getBlockNumber();
    
    // Handshake Confirmed
    statusDot.style.backgroundColor = "var(--neon-green)";
    rpcStatus.textContent = "Connected";
    rpcStatus.className = "text-green";
    tickerText.textContent = `⚡ IMMUTABLE NODE SYNC ACTIVE · Tracking Robinhood Chain Block #${initialNetworkBlock.toLocaleString()}`;

    const tokenContract = new ethers.Contract(ROBINHOOD_CONFIG.tokenAddress, minERC20ABI, provider);
    const decimals = await tokenContract.decimals();
    const symbol = await tokenContract.symbol();

    async function queryOnChainState() {
      try {
        const runtimeBlock = await provider.getBlockNumber();
        const rawTotalSupply = await tokenContract.totalSupply();
        const rawDeadBalance = await tokenContract.balanceOf(ROBINHOOD_CONFIG.burnAddress);

        const cleanTotalSupply = parseFloat(ethers.utils.formatUnits(rawTotalSupply, decimals));
        const cleanDeadBalance = parseFloat(ethers.utils.formatUnits(rawDeadBalance, decimals));
        const burnPercentage = cleanTotalSupply > 0 ? (cleanDeadBalance / cleanTotalSupply) * 100 : 0;

        // Render On-Chain Sourced Values to DOM
        furnaceTotalBurned.innerHTML = `${cleanDeadBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span class="ticker-suffix">${symbol}</span>`;
        furnacePctBurned.textContent = `${burnPercentage.toFixed(4)}%`;
        furnaceTimestamp.textContent = `Last Cryptographic Sync: ${new Date().toLocaleTimeString()} · Block #${runtimeBlock.toLocaleString()}`;

        // Append Fresh Analytical Points to Line Array
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

    // Process Initial Core Datastreams
    await queryOnChainState();
    await fetchMarketTelemetry();

    // Setup Deterministic Polling Intervals (15s for Contract state, 30s for API)
    setInterval(queryOnChainState, 15000);
    setInterval(fetchMarketTelemetry, 30000);

    // 3. PERSISTENT BLOCKCHAIN LOG STREAMING (Live WebSocket Alternative Event-Polling)
    const deadLogFilter = tokenContract.filters.Transfer(null, ROBINHOOD_CONFIG.burnAddress);
    
    // Fetch 500 historic blocks on launch to seed the user interface ledger data
    const preloadedLogs = await tokenContract.queryFilter(deadLogFilter, initialNetworkBlock - 500, initialNetworkBlock);
    if (preloadedLogs.length > 0) {
      ledgerContainer.innerHTML = '';
      preloadedLogs.reverse().slice(0, 5).forEach(log => appendLedgerRow(log, decimals, symbol));
    } else {
      ledgerContainer.innerHTML = `<div class="loading-text">No burn actions processed inside indexing window. Standing by...</div>`;
    }

    // Subscribe to incoming live cryptographic events directly from the node interface
    tokenContract.on(deadLogFilter, (from, to, value, event) => {
      const loader = ledgerContainer.querySelector('.loading-text');
      if (loader) ledgerContainer.innerHTML = '';
      
      appendLedgerRow(event, decimals, symbol);
      queryOnChainState(); // Force-trigger an immediate numeric recalculation
    });

  } catch (error) {
    tickerText.textContent = "❌ Node Call Failed. Critical RPC Connection Dropped. Verify Terminal Endpoint Status.";
    rpcStatus.textContent = "Gateway Failure";
    rpcStatus.className = "text-red";
    statusDot.style.backgroundColor = "var(--neon-red)";
  }

  // Pure DOM Node Generation for Ledger System Rows
  function appendLedgerRow(event, decimals, symbol) {
    const quantity = parseFloat(ethers.utils.formatUnits(event.args.value, decimals));
    const compactHash = `${event.transactionHash.slice(0, 6)}...${event.transactionHash.slice(-4)}`;
    
    const row = document.createElement('div');
    row.className = 'ledger-row';
    row.innerHTML = `
      <div class="ledger-meta">
        <span>Block #${event.blockNumber} · Transaction: <a href="https://robinhoodchain.blockscout.com/tx/${event.transactionHash}" target="_blank" style="color:var(--brand-orange); text-decoration:none;">${compactHash} ↗</a></span>
        <span class="ledger-status">✓ On-Chain Immutably Signed</span>
      </div>
      <div class="ledger-data">
        <div class="ledger-step"><span class="l">Sender Origin</span><div class="v" style="color:var(--text-muted); font-size:11px;">${event.args.from.slice(0,8)}...${event.args.from.slice(-4)}</div></div>
        <div class="ledger-step"><span class="l">Amount Melted</span><div class="v text-green">${quantity.toLocaleString()} ${symbol}</div></div>
      </div>
    `;

    if (ledgerContainer.firstChild && !ledgerContainer.querySelector('.loading-text')) {
      ledgerContainer.insertBefore(row, ledgerContainer.firstChild);
    } else {
      ledgerContainer.appendChild(row);
    }

    // Cap DOM footprint to maximum of 5 entries to guarantee peak frame rates
    const activeRows = ledgerContainer.querySelectorAll('.ledger-row');
    if (activeRows.length > 5) {
      ledgerContainer.removeChild(activeRows[activeRows.length - 1]);
    }
  }
});
