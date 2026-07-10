document.addEventListener('DOMContentLoaded', async () => {

  // CRITICAL PRODUCTION ROBINHOOD CHAIN HARDWARE CONFIGURATION
  const ROBINHOOD_CONFIG = {
    // Primary official endpoint and secondary high-availability public gateway
    rpcUrls: [
      "https://rpc.mainnet.chain.robinhood.com/",
      "https://rpc.robinhoodchain.com"
    ],
    tokenAddress: "0x0c978fcf859782619556201919ba8f946db5ba75", // Verified Production CA
    burnAddress: "0x000000000000000000000000000000000000dEaD",
    geckoNetworkId: "robinhood-chain" 
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
  btnBuy.setAttribute('href', `https://fun.noxa.fi/robinhood/token/${ROBINHOOD_CONFIG.tokenAddress}`);

  let burnChartInstance = null;
  let chartLabels = [];
  let chartDataPoints = [];
  let provider = null;
  let tokenContract = null;
  let decimals = 18;
  let symbol = "OXID";
  let initialNetworkBlock = 0;

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
      if (!json.data) return;
      const attr = json.data.attributes;

      document.getElementById('mkt-price-usd').textContent = `$${parseFloat(attr.price_usd).toFixed(8)}`;
      document.getElementById('mkt-price-weth').textContent = `${parseFloat(attr.price_native).toFixed(10)} WETH`;
      document.getElementById('mkt-liquidity').textContent = `$${parseFloat(attr.total_reserve_in_usd).toLocaleString(undefined, {maximumFractionDigits:0})}`;
      document.getElementById('mkt-cap').textContent = `$${parseFloat(attr.market_cap_usd || attr.fdv_usd).toLocaleString(undefined, {maximumFractionDigits:0})}`;
      document.getElementById('mkt-fdv').textContent = `$${parseFloat(attr.fdv_usd).toLocaleString(undefined, {maximumFractionDigits:0})}`;

      updateIntervalUI('perf-5m', attr.price_change_percentage.m5);
      updateIntervalUI('perf-1h', attr.price_change_percentage.h1);
      updateIntervalUI('perf-24h', attr.price_change_percentage.h24);

    } catch (err) {
      console.warn("Market metrics cooling down or liquidity pool awaiting initialization.");
    }
  }

  function updateIntervalUI(elementId, value) {
    const element = document.getElementById(elementId);
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

      furnaceTotalBurned.innerHTML = `${cleanDeadBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span class="ticker-suffix">${symbol}</span>`;
      furnacePctBurned.textContent = `${burnPercentage.toFixed(4)}%`;
      furnaceTimestamp.textContent = `Last Cryptographic Sync: ${new Date().toLocaleTimeString()} · Block #${runtimeBlock.toLocaleString()}`;

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
      
      // Atomic verification request
      initialNetworkBlock = await provider.getBlockNumber();
      
      tokenContract = new ethers.Contract(ROBINHOOD_CONFIG.tokenAddress, minERC20ABI, provider);
      
      try {
        decimals = await tokenContract.decimals();
        symbol = await tokenContract.symbol();
      } catch (tokenErr) {
        console.warn("Fallback to default 18 decimals due to contract view constraints.");
      }

      // Handshake Confirmed successfully
      statusDot.style.backgroundColor = "var(--neon-green)";
      if (rpcStatus) {
        rpcStatus.textContent = "Connected";
        rpcStatus.className = "text-green";
      }
      tickerText.textContent = `⚡ IMMUTABLE NODE SYNC ACTIVE · Tracking Robinhood Chain Block #${initialNetworkBlock.toLocaleString()}`;
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
      
      // Safe, minimal block range scan to protect standard API rate limits
      const preloadedLogs = await tokenContract.queryFilter(deadLogFilter, initialNetworkBlock - 150, initialNetworkBlock);
      if (preloadedLogs.length > 0) {
        ledgerContainer.innerHTML = '';
        preloadedLogs.reverse().slice(0, 5).forEach(log => appendLedgerRow(log, decimals, symbol));
      } else {
        ledgerContainer.innerHTML = `<div class="loading-text">No burn actions processed inside indexing window. Standing by...</div>`;
      }

      tokenContract.on(deadLogFilter, (from, to, value, event) => {
        const loader = ledgerContainer.querySelector('.loading-text');
        if (loader) ledgerContainer.innerHTML = '';
        appendLedgerRow(event, decimals, symbol);
        queryOnChainState(); 
      });
    } catch(logErr) {
      console.warn("Real-time logging paused due to node RPC provider subscription limits.");
    }
  } else {
    // Ultimate Fallback - Both nodes exhausted or blocked by local client configurations
    tickerText.textContent = "❌ Node Call Failed. Critical RPC Connection Dropped. Verify Terminal Endpoint Status.";
    if (rpcStatus) {
      rpcStatus.textContent = "Gateway Failure";
      rpcStatus.className = "text-red";
    }
    statusDot.style.backgroundColor = "var(--neon-red)";
  }

  // Pure DOM Node Generation for Ledger System Rows
  function appendLedgerRow(event, decimals, symbol) {
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
