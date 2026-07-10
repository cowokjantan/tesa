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
  const ledgerContainer = document.getElementById('ledger-container');
  const rpcStatus = document.getElementById('rpc-status');
  const statusDot = document.getElementById('status-dot');
  const tickerText = document.getElementById('live-ticker-text');
  const furnaceTotalBurned = document.getElementById('furnace-total-burned');

  // 1. UI HYDRATION & SOCIAL MEDIA INTERCEPTOR
  if (caValue) caValue.textContent = `${CONFIG.tokenAddress.slice(0, 6)}...${CONFIG.tokenAddress.slice(-4)}`;
  if (footerCaText) footerCaText.textContent = CONFIG.tokenAddress;
  if (btnBuy) btnBuy.setAttribute('href', `https://fun.noxa.fi/robinhood/token/${CONFIG.tokenAddress}`);

  // Menangani semua klik sosial media di satu tempat
  document.querySelectorAll('.social-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Logika klik sosial media terpusat di sini
      console.log("Social Channel Accessed:", btn.getAttribute('href'));
    });
  });

  // 2. HELPER ENGINE
  const formatMicroPrice = (val) => {
    const n = parseFloat(val);
    return isNaN(n) || n === 0 ? "$0.00" : (n >= 0.0001 ? `$${n.toFixed(4)}` : `$${n.toFixed(8)}`);
  };

  // 3. CORE TELEMETRY ENGINES
  async function fetchMarketTelemetry() {
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/robinhood/${CONFIG.pairAddress.toLowerCase()}`);
      const json = await res.json();
      if (json.pairs) {
        const elPrice = document.getElementById('mkt-price-usd');
        if (elPrice) elPrice.textContent = formatMicroPrice(json.pairs[0].priceUsd);
      }
    } catch (e) { console.warn("Market Sync Interrupted"); }
  }

  async function queryOnChainStateByAPI() {
    try {
      const [supplyRes, burnRes] = await Promise.all([
        fetch(`${CONFIG.explorerApiUrl}?module=token&action=gettoken&contractaddress=${CONFIG.tokenAddress}`),
        fetch(`${CONFIG.explorerApiUrl}?module=account&action=tokenbalance&contractaddress=${CONFIG.tokenAddress}&address=${CONFIG.burnAddress}`)
      ]);
      const [supplyData, burnData] = await Promise.all([supplyRes.json(), burnRes.json()]);
      
      const burned = parseFloat(burnData.result || "0") / Math.pow(10, 18);
      if (furnaceTotalBurned) furnaceTotalBurned.innerHTML = `${burned.toLocaleString()} <span class="ticker-suffix">OXID</span>`;
      
      if (statusDot) statusDot.style.backgroundColor = "#00ff00";
      if (rpcStatus) rpcStatus.textContent = "Indexer Synced";
    } catch (e) {
      if (statusDot) statusDot.style.backgroundColor = "#ff0000";
      if (rpcStatus) rpcStatus.textContent = "Indexer Lag";
    }
  }

  async function fetchLedgerHistoryByAPI() {
    try {
      const res = await fetch(`${CONFIG.explorerApiUrl}?module=account&action=tokentx&contractaddress=${CONFIG.tokenAddress}&address=${CONFIG.burnAddress}&page=1&offset=5&sort=desc`);
      const json = await res.json();
      if (ledgerContainer && json.result) {
        ledgerContainer.innerHTML = json.result.map(tx => `
          <div class="ledger-row">
            <span>Tx: ${tx.hash.slice(0,6)}...</span>
            <span class="text-green">${(parseFloat(tx.value)/1e18).toFixed(2)} OXID</span>
          </div>`).join('');
      }
    } catch (e) { console.warn("Ledger Offline"); }
  }

  // 4. RUNTIME & POLLING
  [fetchMarketTelemetry, queryOnChainStateByAPI, fetchLedgerHistoryByAPI].forEach(fn => fn());
  
  setInterval(fetchMarketTelemetry, 15000);
  setInterval(queryOnChainStateByAPI, 30000);
  setInterval(fetchLedgerHistoryByAPI, 30000);
});
