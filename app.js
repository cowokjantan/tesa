document.addEventListener('DOMContentLoaded', () => {

  // PRODUCTION HARDWARE CONFIGURATION
  const CONFIG = {
    tokenAddress: "0x0c978fcf859782619556201919ba8f946db5ba75",
    burnAddress: "0x000000000000000000000000000000000000dEaD",
    pairAddress: "0xf5329a8115ac7784b37d1a0d560b43b027270677",
    explorerApiUrl: "https://robinhoodchain.blockscout.com/api"
  };

  // DOM CACHING
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

  // UI HYDRATION
  if (caValue) caValue.textContent = `${CONFIG.tokenAddress.slice(0, 6)}...${CONFIG.tokenAddress.slice(-4)}`;
  if (footerCaText) footerCaText.textContent = CONFIG.tokenAddress;
  if (btnBuy) btnBuy.setAttribute('href', `https://fun.noxa.fi/robinhood/token/${CONFIG.tokenAddress}`);

  // GLOBAL STATE
  let burnChartInstance = null;
  let chartLabels = [];
  let chartDataPoints = [];
  const decimals = 18;
  const symbol = "OXID";

  // SOCIAL MEDIA INTERCEPTOR (COMING SOON)
  const socialBtns = document.querySelectorAll('.social-btn');
  socialBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      alert("Community channels are coming soon. Stay tuned!");
    });
  });

  // HELPER ENGINES
  function formatMicroPrice(value) {
    const num = parseFloat(value);
    if (isNaN(num) || num === 0) return "$0.00";
    if (num >= 0.0001) return `$${num.toFixed(4)}`;
    const str = num.toFixed(20); 
    const match = str.match(/^0\.(0+)([1-9]\d*)$/);
    if (match) {
      const zeroCount = match[1].length;
      const significantDigits = match[2].slice(0, 4);
      const subscriptMap = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
      const subZeroes = zeroCount.toString().split('').map(d => subscriptMap[d]).join('');
      return `$0.0${subZeroes}${significantDigits}`;
    }
    return `$${num.toFixed(8)}`;
  }

  function initChart() {
    const el = document.getElementById('oxideBurnChart');
    if (!el) return;
    burnChartInstance = new Chart(el.getContext('2d'), {
      type: 'line',
      data: { labels: chartLabels, datasets: [{ borderColor: '#ff4500', backgroundColor: 'rgba(255, 69, 0, 0.03)', borderWidth: 2, pointBackgroundColor: '#ff9f00', data: chartDataPoints, tension: 0.15, fill: true }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#141a24' }, ticks: { color: '#8191ad', font: { family: 'Courier New', size: 11 } } }, y: { grid: { color: '#141a24' }, ticks: { color: '#8191ad', font: { family: 'Courier New', size: 11 } } } } }
    });
  }

  // 1. DEXSCREENER TELEMETRY
  async function fetchMarketTelemetry() {
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/robinhood/${CONFIG.pairAddress.toLowerCase()}`);
      const json = await res.json();
      if (!json.pairs?.length) return;
      const p = json.pairs[0];
      const elPriceUsd = document.getElementById('mkt-price-usd');
      if (elPriceUsd) elPriceUsd.textContent = formatMicroPrice(p.priceUsd);
    } catch (err) { console.warn("DexScreener:", err.message); }
  }

  // 2. BLOCKSCOUT INDEXER
  async function queryOnChainStateByAPI() {
    try {
      const [sRes, bRes] = await Promise.all([
        fetch(`${CONFIG.explorerApiUrl}?module=token&action=gettoken&contractaddress=${CONFIG.tokenAddress}`),
        fetch(`${CONFIG.explorerApiUrl}?module=account&action=tokenbalance&contractaddress=${CONFIG.tokenAddress}&address=${CONFIG.burnAddress}`)
      ]);
      const [sData, bData] = await Promise.all([sRes.json(), bRes.json()]);
      const supply = parseFloat(sData.result?.totalSupply || 0) / 1e18;
      const burned = parseFloat(bData.result || 0) / 1e18;
      
      if (furnaceTotalBurned) furnaceTotalBurned.innerHTML = `${burned.toLocaleString()} <span class="ticker-suffix">${symbol}</span>`;
      if (furnacePctBurned) furnacePctBurned.textContent = `${((burned / supply) * 100).toFixed(4)}%`;
      if (furnaceTimestamp) furnaceTimestamp.textContent = `Last Indexer Sync: ${new Date().toLocaleTimeString()}`;
      
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (chartLabels.length > 7) { chartLabels.shift(); chartDataPoints.shift(); }
      chartLabels.push(time); chartDataPoints.push(burned);
      if (!burnChartInstance) initChart(); else burnChartInstance.update();
      
      if (statusDot) statusDot.style.backgroundColor = "var(--neon-green)";
      if (tickerText) tickerText.textContent = `⚡ HIGH-SPEED INDEXING SYSTEM ACTIVE`;
    } catch (e) { 
        if (statusDot) statusDot.style.backgroundColor = "var(--neon-red)";
        console.error("Indexer Error:", e); 
    }
  }

  // 3. LEDGER HISTORY
  async function fetchLedgerHistoryByAPI() {
    try {
      const res = await fetch(`${CONFIG.explorerApiUrl}?module=account&action=tokentx&contractaddress=${CONFIG.tokenAddress}&address=${CONFIG.burnAddress}&page=1&offset=5&sort=desc`);
      const json = await res.json();
      if (ledgerContainer && json.result) {
        ledgerContainer.innerHTML = json.result.map(tx => `
          <div class="ledger-row">
            <span>Block #${tx.blockNumber} · <a href="https://robinhoodchain.blockscout.com/tx/${tx.hash}" target="_blank">View ↗</a></span>
            <span class="text-green">${(parseFloat(tx.value)/1e18).toLocaleString()} ${symbol}</span>
          </div>`).join('');
      }
    } catch (e) { console.warn("Ledger Error:", e); }
  }

  // INITIALIZATION
  fetchMarketTelemetry();
  queryOnChainStateByAPI();
  fetchLedgerHistoryByAPI();
  
  setInterval(fetchMarketTelemetry, 15000);
  setInterval(queryOnChainStateByAPI, 30000);
  setInterval(fetchLedgerHistoryByAPI, 30000);
});
