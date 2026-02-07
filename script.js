// --- 1. TAILWIND CONFIGURATION ---
tailwind.config = {
    theme: {
        extend: {
            fontFamily: { sans: ['Inter', 'sans-serif'] },
            colors: {
                brand: { 500: '#ff0050', 600: '#00f2ea' },
                dark: { 900: '#121212', 800: '#1e1e1e', 700: '#2c2c2c' }
            },
            animation: {
                'spin-slow': 'spin 4s linear infinite',
                'fade-in': 'fadeIn 0.3s ease-in-out'
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                }
            }
        }
    }
}

// --- 2. CONFIG & INIT (SUPABASE) ---
const log = (msg) => { console.log(msg); try { document.getElementById('debugLog').innerText = msg; } catch(e){} };

// YOUR SUPABASE KEYS
const SUPABASE_URL = "https://ubjfirquvrvughaxneyo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViamZpcnF1dnJ2dWdoYXhuZXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MTMxOTYsImV4cCI6MjA4NTA4OTE5Nn0.T9wxE4vFLGQC-_gv_50fixnbAiHIvqHe40f0txuCyrQ"; 

const BUCKET_VIDEOS = 'videos';
const BUCKET_ASSETS = 'assets';
const BUCKET_PROFILE = 'profile_pics';

const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// STATE VARIABLES
let currentUser = null;
let activeVideoId = null;
let currentChatUser = null;
let myFollowingIds = new Set();
let watchedAds = new Set(); 
let storeAdUrl = null; 
let currentStoreCategory = 'all'; 
let pendingDownload = { id: null, url: null };

// 🔥 CONFIGURATION STATE
let appAdConfig = {
    feed: { top: '', bottom: '' },
    store: { top: '', bottom: '' },
    profile: { top: '', bottom: '' }
};

let appSettings = {
    minWithdrawal: 5, 
    adFrequencyStart: 5, 
    adFrequencyNext: 15  
};

// 💰 EARNINGS RATES
let appRates = {
    videoView: 0.001,       
    assetDownload: 0.02,    
    watchReward: 0.0005     
};

// --- 3. AUTHENTICATION LOGIC ---
async function forceStartApp(user) {
    log("Starting App for: " + user.email);
    currentUser = user;
    
    // Inject Modals & Ad Containers
    injectInAppBrowser(); 
    injectStoreAdModal();
    injectPaymentModal();
    injectCashoutModal();
    injectBannerContainers();

    // Fix Main App Layout for Mobile Chrome (dvh fix)
    const appEl = document.getElementById('app');
    if(appEl) {
        appEl.classList.remove('h-screen');
        appEl.classList.add('h-[100dvh]', 'overflow-hidden'); // 🔥 FIX: Mobile Browser Height
    }

    // Fetch Global Config
    await fetchAppConfig();

    let safeName = "User";
    try {
        const { data: userData } = await sb.from('users').select('username').eq('uid', currentUser.id).single();
        if (userData && userData.username) safeName = userData.username;
        else if (currentUser.email) safeName = currentUser.email.split('@')[0];
        
        const { data: follows } = await sb.from('follows').select('following_id').eq('follower_id', currentUser.id);
        if(follows) follows.forEach(f => myFollowingIds.add(f.following_id));
        
    } catch(e) { console.log("User load error"); }

    currentUser.displayName = safeName;
    startMessageListener();

    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    
    updateProfileUI();
    loadVideos(); 
    loadAssets('all'); 
    
    renderPageAds('feedScreen');

    if(currentUser.email === "admin@gmail.com") document.getElementById('adminBtn').classList.remove('hidden');
}

// --- 4. APP CONFIG ---
async function fetchAppConfig() {
    try {
        const { data: settings } = await sb.from('app_config').select('key, value');
        if (settings) {
            settings.forEach(item => {
                if (item.key === 'store_ad_url' && item.value.length > 5) storeAdUrl = item.value;
                if (item.key === 'rate_video_view') appRates.videoView = parseFloat(item.value);
                if (item.key === 'rate_asset_download') appRates.assetDownload = parseFloat(item.value);
                if (item.key === 'rate_watch_reward') appRates.watchReward = parseFloat(item.value);
                if (item.key === 'min_withdrawal') appSettings.minWithdrawal = parseFloat(item.value);

                if (item.key === 'ad_feed_top') appAdConfig.feed.top = item.value;
                if (item.key === 'ad_feed_bottom') appAdConfig.feed.bottom = item.value;
                if (item.key === 'ad_store_top') appAdConfig.store.top = item.value;
                if (item.key === 'ad_store_bottom') appAdConfig.store.bottom = item.value;
                if (item.key === 'ad_profile_top') appAdConfig.profile.top = item.value;
                if (item.key === 'ad_profile_bottom') appAdConfig.profile.bottom = item.value;
            });
        }
    } catch (e) { console.log("Config Fetch Error", e); }
}

function injectBannerContainers() {
    if(document.getElementById('appBannerTop')) return;
    const topDiv = document.createElement('div');
    topDiv.id = 'appBannerTop';
    // 🔥 FIX: Added safe-area padding and z-index adjustments
    topDiv.className = 'fixed top-0 left-0 w-full z-[45] flex justify-center items-start pointer-events-none hidden pt-safe mt-2';
    topDiv.innerHTML = `<div class="bg-transparent pointer-events-auto relative flex flex-col items-center"><div class="relative"><button onclick="document.getElementById('appBannerTop').classList.add('hidden')" class="absolute -bottom-6 right-0 bg-gray-900 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] border border-gray-600 shadow-md z-50"><i class="fas fa-times"></i></button><div id="bannerContentTop" class="min-w-[300px] min-h-[50px] flex justify-center items-center overflow-hidden bg-gray-800/80 backdrop-blur-sm rounded-md border border-gray-700 shadow-lg pointer-events-auto"></div></div></div>`;
    document.body.appendChild(topDiv);

    const botDiv = document.createElement('div');
    botDiv.id = 'appBannerBottom';
    // 🔥 FIX: Adjusted bottom position to respect navbar (approx 65px + safe area)
    botDiv.className = 'fixed bottom-[70px] left-0 w-full z-[40] flex justify-center items-end pointer-events-none hidden pb-safe mb-2';
    botDiv.innerHTML = `<div class="bg-transparent pointer-events-auto relative flex flex-col items-center"><div class="relative"><button onclick="document.getElementById('appBannerBottom').classList.add('hidden')" class="absolute -top-6 right-0 bg-gray-900 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] border border-gray-600 shadow-md z-50"><i class="fas fa-times"></i></button><div id="bannerContentBottom" class="min-w-[300px] min-h-[50px] flex justify-center items-center overflow-hidden bg-gray-800/80 backdrop-blur-sm rounded-md border border-gray-700 shadow-lg pointer-events-auto"></div></div></div>`;
    document.body.appendChild(botDiv);
}

function renderPageAds(screenId) {
    const topContainer = document.getElementById('appBannerTop');
    const botContainer = document.getElementById('appBannerBottom');
    const topContent = document.getElementById('bannerContentTop');
    const botContent = document.getElementById('bannerContentBottom');

    topContainer.classList.add('hidden');
    botContainer.classList.add('hidden');
    topContent.innerHTML = '';
    botContent.innerHTML = '';

    if (screenId === 'authScreen' || screenId === 'cameraScreen') return;

    let targetConfig = { top: null, bottom: null };
    if (screenId === 'feedScreen') targetConfig = appAdConfig.feed;
    else if (screenId === 'storeScreen') targetConfig = appAdConfig.store;
    else if (screenId === 'profileScreen' || screenId === 'publicProfileScreen') targetConfig = appAdConfig.profile;
    
    if (targetConfig.top && targetConfig.top.trim() !== "") {
        topContainer.classList.remove('hidden');
        setAndExecuteScript(topContent, targetConfig.top);
    }
    if (targetConfig.bottom && targetConfig.bottom.trim() !== "") {
        botContainer.classList.remove('hidden');
        setAndExecuteScript(botContent, targetConfig.bottom);
    }
}

function setAndExecuteScript(container, html) {
    container.innerHTML = html;
    const scripts = container.querySelectorAll("script");
    scripts.forEach((oldScript) => {
        const newScript = document.createElement("script");
        Array.from(oldScript.attributes).forEach((attr) => newScript.setAttribute(attr.name, attr.value));
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
    });
}

// --- 🔥 IN-APP BROWSER LOGIC (FIXED FOR ADS) ---
function injectInAppBrowser() {
    if(document.getElementById('inAppBrowserModal')) return;
    const modalHtml = `
    <div id="inAppBrowserModal" class="fixed inset-0 z-[100] bg-white hidden flex flex-col animate-fade-in h-[100dvh]">
        <!-- Browser Header -->
        <div class="h-14 bg-gray-900 flex items-center justify-between px-4 border-b border-gray-700 shadow-lg shrink-0 pt-safe-top">
            <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/30">SPONSORED</span>
                <span id="inAppUrlText" class="text-gray-400 text-[10px] truncate max-w-[200px]">Loading...</span>
            </div>
            <div class="flex gap-2">
                 <button onclick="document.getElementById('inAppFrame').src = document.getElementById('inAppFrame').src" class="bg-gray-800 text-white w-8 h-8 rounded-full flex items-center justify-center"><i class="fas fa-redo text-xs"></i></button>
                 <button onclick="closeInAppBrowser()" class="bg-gray-800 hover:bg-gray-700 text-white w-8 h-8 rounded-full flex items-center justify-center transition">
                    <i class="fas fa-times text-sm"></i>
                </button>
            </div>
        </div>
        <!-- Iframe Container - 🔥 FIX: Allowed Forms/Popups/Modals/TopNav -->
        <div class="flex-1 w-full bg-gray-100 relative">
            <div id="inAppLoader" class="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-900">
                <i class="fas fa-spinner fa-spin text-2xl"></i>
            </div>
            <iframe id="inAppFrame" class="w-full h-full border-0" 
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation">
            </iframe>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

window.openInAppBrowser = (url) => {
    if(!url || url === 'null') return;
    console.log("Opening Internal Browser for:", url);
    const modal = document.getElementById('inAppBrowserModal');
    const frame = document.getElementById('inAppFrame');
    const urlText = document.getElementById('inAppUrlText');
    const loader = document.getElementById('inAppLoader');
    
    // Show Modal
    modal.classList.remove('hidden');
    loader.classList.remove('hidden');
    urlText.innerText = url;
    
    // Load URL
    frame.onload = () => { loader.classList.add('hidden'); };
    frame.src = url;
};

window.closeInAppBrowser = () => {
    const modal = document.getElementById('inAppBrowserModal');
    const frame = document.getElementById('inAppFrame');
    modal.classList.add('hidden');
    frame.src = "about:blank"; 
};

// --- 5. CASHOUT & HISTORY ---
function injectCashoutModal() {
    if(document.getElementById('cashoutModal')) return; 
}

window.openCashoutModal = async () => {
    if (!currentUser) return;
    document.getElementById('cashoutModal').classList.remove('hidden');
    document.getElementById('cashoutMinText').innerText = `Minimum withdrawal: $${appSettings.minWithdrawal}`;

    const { data: user } = await sb.from('users').select('balance').eq('uid', currentUser.id).single();
    if (user) {
        document.getElementById('cashoutAvailableDisplay').innerText = `$${(user.balance || 0).toFixed(2)}`;
    }
    loadWithdrawalHistory();
};

window.closeCashoutModal = () => {
    document.getElementById('cashoutModal').classList.add('hidden');
};

window.toggleCashoutFields = () => {
    const method = document.getElementById('cashoutMethod').value;
    if(method === 'upi') {
        document.getElementById('fieldUpi').classList.remove('hidden');
        document.getElementById('fieldPaypal').classList.add('hidden');
    } else {
        document.getElementById('fieldUpi').classList.add('hidden');
        document.getElementById('fieldPaypal').classList.remove('hidden');
    }
};

window.submitCashout = async () => {
    const method = document.getElementById('cashoutMethod').value;
    const amount = parseFloat(document.getElementById('cashoutAmount').value);
    
    if (amount < appSettings.minWithdrawal) return alert(`Minimum withdrawal is $${appSettings.minWithdrawal}`);
    if (isNaN(amount)) return alert("Invalid amount");
    
    const { data } = await sb.from('users').select('balance').eq('uid', currentUser.id).single();
    if (!data || data.balance < amount) return alert("Insufficient Balance!");

    let details = method === 'upi' ? document.getElementById('cashoutUpi').value : document.getElementById('cashoutPaypal').value;
    if (!details || details.length < 5) return alert("Invalid Payment Details");

    try {
        await sb.from('withdrawals').insert({
            user_id: currentUser.id,
            amount: amount,
            method: method,
            account: details,
            status: 'Pending'
        });

        await sb.from('users').update({ balance: data.balance - amount }).eq('uid', currentUser.id);

        alert(`Withdrawal Request Sent for $${amount}!`);
        openCashoutModal(); 
    } catch(e) {
        alert("Error: " + e.message);
    }
};

async function loadWithdrawalHistory() {
    const historyContainer = document.getElementById('cashoutHistoryList');
    
    historyContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-8 space-y-3 opacity-60">
            <div class="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
            <p class="text-[10px] uppercase tracking-widest text-gray-400">Syncing Transactions...</p>
        </div>`;

    const { data: list } = await sb.from('withdrawals')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(20);

    if (list && list.length > 0) {
        let html = '';
        list.forEach(item => {
            let statusBadgeClass = '';
            let statusIcon = '';
            let statusText = item.status; 

            if (item.status === 'Success' || item.status === 'Paid') {
                statusText = 'Success';
                statusBadgeClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                statusIcon = '<i class="fas fa-check-circle mr-1"></i>';
            } 
            else if (item.status === 'Pending') {
                statusBadgeClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                statusIcon = '<i class="fas fa-clock mr-1"></i>';
            } 
            else {
                statusBadgeClass = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                statusIcon = '<i class="fas fa-times-circle mr-1"></i>';
            }

            let methodIconClass = 'fa-university'; 
            let methodBgClass = 'bg-gray-800 text-gray-400';
            
            if (item.method === 'upi') {
                methodIconClass = 'fa-qrcode';
                methodBgClass = 'bg-purple-500/20 text-purple-400';
            } else if (item.method === 'paypal') {
                methodIconClass = 'fa-paypal';
                methodBgClass = 'bg-blue-500/20 text-blue-400';
            }

            const d = new Date(item.created_at);
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); 
            const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); 

            html += `
            <div class="group flex items-center justify-between p-3 mb-2 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-all duration-300">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full ${methodBgClass} flex items-center justify-center border border-white/5 shadow-inner">
                        <i class="fas ${methodIconClass} text-sm"></i>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-xs font-bold text-gray-200 uppercase tracking-wide">${item.method}</span>
                        <span class="text-[10px] text-gray-500 font-mono">${dateStr} • ${timeStr}</span>
                    </div>
                </div>
                <div class="flex flex-col items-end gap-1.5">
                    <span class="text-white font-black text-sm tracking-wide">$${parseFloat(item.amount).toFixed(2)}</span>
                    <div class="px-2 py-[2px] rounded-md flex items-center ${statusBadgeClass} shadow-sm">
                        <span class="text-[8px]">${statusIcon}</span>
                        <span class="text-[9px] font-bold uppercase tracking-wider">${statusText}</span>
                    </div>
                </div>
            </div>`;
        });
        historyContainer.innerHTML = html;
    } else {
        historyContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-10 text-gray-600">
            <div class="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center mb-3">
                <i class="fas fa-receipt text-gray-700 text-xl"></i>
            </div>
            <p class="text-xs font-bold text-gray-500">No transactions found</p>
        </div>`;
    }
}

// --- 6. MODALS & HELPERS (🔥 FIXED AD CLICKS) ---
function injectStoreAdModal() {
    if(document.getElementById('storeAdModal')) return;
    const modalHtml = `
    <div id="storeAdModal" class="fixed inset-0 z-[60] bg-black hidden flex flex-col items-center justify-center h-[100dvh]">
        <div class="absolute top-4 right-4 z-50 pointer-events-none">
             <span class="bg-yellow-500 text-black font-bold text-xs px-2 py-1 rounded shadow-md">SPONSORED AD</span>
        </div>
        
        <!-- 🔥 FIX: Removed overlay that blocked clicks on "Verify" -->
        <!-- The iframe is now directly clickable -->

        <div class="w-full h-full md:w-3/4 md:h-3/4 relative bg-black flex items-center justify-center overflow-hidden pointer-events-auto">
            <!-- 🔥 FIX: Added allow-forms allow-popups for Verify checkbox -->
            <iframe id="storeAdFrame" class="w-full h-full border-0 bg-white" 
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation">
            </iframe>
            <video id="storeAdVideo" class="w-full h-full object-contain hidden" playsinline></video>
        </div>
        
        <div class="absolute bottom-10 right-5 z-50 flex flex-col items-end pointer-events-none">
            <div id="storeAdTimerBox" class="bg-gray-900/80 text-white border border-gray-600 px-6 py-3 rounded-full backdrop-blur-md mb-2 font-bold pointer-events-auto">
                Downloading in <span id="storeAdTimer" class="text-brand-500">10</span>s
            </div>
            <button id="storeAdSkipBtn" class="hidden pointer-events-auto bg-white text-black font-bold px-4 py-2 rounded-full shadow-lg">Skip Ad</button>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function injectPaymentModal() {
    if(document.getElementById('paymentModal')) return;
    const modalHtml = `
    <div id="paymentModal" class="fixed inset-0 z-[70] bg-black/90 hidden flex flex-col items-center justify-center p-4">
        <div class="bg-gray-800 rounded-xl max-w-sm w-full p-6 border border-gray-700 relative">
            <button onclick="closePaymentModal()" class="absolute top-3 right-3 text-gray-400"><i class="fas fa-times"></i></button>
            <h3 class="text-xl font-bold text-white mb-4 text-center">Complete Payment</h3>
            <p class="text-center text-gray-400 text-sm mb-4">Pay to unlock this asset</p>
            <div id="payQrContainer" class="w-48 h-48 bg-white mx-auto rounded-lg overflow-hidden flex items-center justify-center mb-4">
                <img id="payQrImg" class="w-full h-full object-contain" src="" alt="No QR">
                <p id="noQrText" class="text-black text-xs font-bold hidden">No QR Available</p>
            </div>
            <div class="bg-gray-900 p-3 rounded-lg mb-4 flex justify-between items-center border border-gray-700">
                <div>
                    <p class="text-[10px] text-gray-400 uppercase">UPI ID</p>
                    <p id="payUpiText" class="text-white font-mono text-sm font-bold truncate w-40">user@upi</p>
                </div>
                <button onclick="copyUpi()" class="text-brand-500 text-xs font-bold hover:text-white">COPY</button>
            </div>
            <div class="text-center text-yellow-500 text-xs mb-4"><i class="fas fa-exclamation-triangle"></i> Make payment via any UPI App</div>
            <button onclick="confirmPaymentAndDownload()" class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition">I Have Made Payment <i class="fas fa-check-circle ml-1"></i></button>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// --- 7. STANDARD AUTH & HELPERS ---
function startMessageListener() {
    if(!currentUser) return;
    sb.channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if(payload.new.receiver_id === currentUser.id) {
            document.getElementById('inboxBadge').classList.remove('hidden');
            if(!document.getElementById('inboxScreen').classList.contains('hidden')) loadInbox();
        }
    })
    .subscribe();
}

window.toggleAuth = (mode) => {
    document.getElementById('authErrorMsg').innerText = "";
    if(mode === 'register') {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
    } else {
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
    }
};

window.handleAuth = async (type) => {
    const email = document.getElementById(type === 'register' ? 'regEmail' : 'loginEmail').value;
    const pass = document.getElementById(type === 'register' ? 'regPass' : 'loginPass').value;
    const username = type === 'register' ? document.getElementById('regUsername').value : null;
    const errLabel = document.getElementById('authErrorMsg');
    const btn = document.getElementById(type === 'register' ? 'regBtn' : 'loginBtn');

    if (!email || !pass) { errLabel.innerText = "Please fill all fields"; return; }
    errLabel.innerText = "Processing..."; btn.disabled = true; btn.innerText = "Wait...";

    try {
        if(type === 'register') {
            if(!username) { alert("Username required"); btn.disabled = false; return; }
            const { data, error } = await sb.auth.signUp({ email, password: pass });
            if(error) throw error;
            if(data.user) {
                await sb.from('users').insert({ uid: data.user.id, username: username, email: email, followers: 0, following: 0, balance: 0, photo_url: "" });
                alert("Registered! Logging in...");
                const { data: loginData } = await sb.auth.signInWithPassword({ email, password: pass });
                if(loginData.user) forceStartApp(loginData.user);
            }
        } else {
            const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
            if(error) throw error;
            if(data.user) forceStartApp(data.user);
        }
    } catch(e) { errLabel.innerText = e.message; btn.disabled = false; btn.innerText = type === 'register' ? 'Create Account' : 'Log In'; }
};

window.handleLogout = async () => { await sb.auth.signOut(); window.location.reload(); };
sb.auth.onAuthStateChange((event, session) => { if (session?.user && !currentUser) forceStartApp(session.user); });

window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.replace('text-white', 'text-gray-500'));
    const activeBtn = Array.from(document.querySelectorAll('.nav-btn')).find(b => b.getAttribute('onclick').includes(id));
    if(activeBtn) activeBtn.classList.replace('text-gray-500', 'text-white');
    
    if(id === 'feedScreen') setTimeout(setupScrollObserver, 100);
    if(id === 'storeScreen') loadAssets(currentStoreCategory); 
    if(id === 'inboxScreen') { document.getElementById('inboxBadge').classList.add('hidden'); loadInbox(); }
    if(id === 'profileScreen') { loadProfileVideos(currentUser.id, 'profileGrid'); window.switchProfileTab('video'); updateProfileUI(); }

    renderPageAds(id);
};

// --- 8. 🔥 FEED LOGIC (BOOST & ADS) 🔥 ---
function getSeenVideos() {
    try {
        return JSON.parse(localStorage.getItem('seen_videos') || '[]');
    } catch(e) { return []; }
}

function saveSeenVideo(id) {
    let seen = getSeenVideos();
    if(!seen.includes(id)) {
        seen.push(id);
        if(seen.length > 200) seen.shift(); 
        localStorage.setItem('seen_videos', JSON.stringify(seen));
    }
}

async function loadVideos() {
    const container = document.getElementById('reelContainer');
    const { data: allVideos } = await sb.from('videos').select('*').order('created_at', { ascending: false }).limit(100);
    
    if (!allVideos || allVideos.length === 0) {
        container.innerHTML = "<p class='text-center pt-20 text-gray-500'>No videos yet</p>";
        return;
    }

    const seenIds = getSeenVideos();

    // SMART SORT
    const sortedVideos = allVideos.sort((a, b) => {
        const aBoost = a.boost_score || 0;
        const bBoost = b.boost_score || 0;
        const aSeen = seenIds.includes(a.id) ? 1 : 0;
        const bSeen = seenIds.includes(b.id) ? 1 : 0;
        if (aSeen !== bSeen) return aSeen - bSeen; 
        if (aBoost !== bBoost) return bBoost - aBoost;
        return new Date(b.created_at) - new Date(a.created_at);
    });

    // AD INJECTION
    let html = '';
    let videoCount = 0;
    
    let nextAdIndex = Math.floor(Math.random() * (10 - 5 + 1) + 5); 
    let adsShown = 0;

    sortedVideos.forEach((data, index) => {
        if (videoCount === nextAdIndex) {
            if (storeAdUrl && storeAdUrl !== 'null') {
                html += generateAdSlideHtml(`ad_${Date.now()}_${index}`, storeAdUrl);
                videoCount = 0;
                adsShown++;
                nextAdIndex = Math.floor(Math.random() * (20 - 15 + 1) + 15); 
            }
        }
        html += generateVideoHtml(data);
        videoCount++;
    });

    container.innerHTML = html;
    setTimeout(setupScrollObserver, 500);
}

function generateAdSlideHtml(adId, url) {
    const isVideo = url.includes('.mp4') || url.includes('.webm');
    let content = '';
    
    if(isVideo) {
        content = `<video src="${url}" loop playsinline class="h-full w-full object-cover pointer-events-none" autoplay muted controlsList="nodownload"></video>`;
    } else {
        // 🔥 FIX: Allowed interactions in feed ads too
        content = `<iframe src="${url}" class="w-full h-full border-0 bg-white pointer-events-auto" 
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"></iframe>`;
    }

    return `
    <div class="reel-item relative h-full w-full bg-black overflow-hidden flex items-center justify-center border-b-4 border-yellow-500">
        <div class="absolute top-4 right-4 z-50 bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded shadow-lg uppercase pointer-events-none">Sponsored</div>
        
        <!-- 🔥 FIX: Removed overlay that forced click, allowed direct interaction -->
        <!-- If you prefer click-to-open, uncomment the div below but it blocks CAPTCHA -->
        <!-- <div class="absolute inset-0 z-40 bg-transparent cursor-pointer" onclick="openInAppBrowser('${url}')"></div> -->

        <div class="w-full h-full relative z-10 pointer-events-auto">
            ${content}
        </div>
        <div class="absolute bottom-10 w-full text-center z-50 pointer-events-none">
            <p class="text-white font-bold text-shadow bg-black/50 inline-block px-4 py-1 rounded-full">Sponsored Advertisement</p>
        </div>
    </div>
    `;
}

function generateVideoHtml(data) {
    let likeKey = currentUser ? `liked_${data.id}_${currentUser.id}` : null;
    const isLiked = (currentUser && localStorage.getItem(likeKey)) ? 'text-brand-500' : 'text-white';
    const safeUser = data.user || "User";
    
    const hasAd = data.ad_url && data.ad_url.length > 5 && data.ad_url !== 'null';
    
    const isMe = currentUser && data.uid === currentUser.id;
    const isFollowing = myFollowingIds.has(data.uid);
    
    let followBtnHtml = '';
    if (!isMe && !isFollowing) {
        followBtnHtml = `<button id="feed_follow_${data.id}" onclick="followUserFromFeed('${data.uid}', 'feed_follow_${data.id}')" class="reel-follow-btn pointer-events-auto">Follow</button>`;
    }

    return `
        <div class="reel-item relative h-full w-full bg-black overflow-hidden" data-vid-id="${data.id}">
            <video 
                id="main_vid_${data.id}"
                src="${data.url || ''}" 
                loop 
                playsinline 
                class="h-full w-full object-cover"
                ontimeupdate="checkAdTrigger(this, '${data.id}', '${hasAd ? data.ad_url : ''}')"
            ></video>
            
            <div class="absolute inset-0 z-0" onclick="togglePlay(this.parentElement.querySelector('#main_vid_${data.id}'), '${data.id}')"></div>

            <div id="ad_overlay_${data.id}" class="absolute inset-0 z-[60] bg-black hidden flex flex-col justify-center items-center pointer-events-auto">
                <div class="absolute top-2 right-2 bg-yellow-400 text-black text-[10px] font-bold px-2 py-1 rounded shadow z-50 pointer-events-none">SPONSORED</div>
                
                <!-- 🔥 FIX: Removed click blocking overlay for in-video ads too -->
                
                <iframe id="ad_frame_${data.id}" class="w-full h-full border-0 bg-white hidden pointer-events-auto" 
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups">
                </iframe>
                
                <video id="ad_vid_${data.id}" class="w-full h-full object-contain bg-black hidden pointer-events-none"></video>

                <div class="absolute bottom-20 right-4 z-50 flex flex-col items-end pointer-events-none">
                    <div id="ad_timer_box_${data.id}" class="bg-black/60 text-white text-xs px-4 py-2 rounded-full backdrop-blur-md mb-2 pointer-events-auto">
                        Skip in <span id="ad_timer_val_${data.id}">10</span>s
                    </div>
                    <button id="ad_skip_btn_${data.id}" onclick="skipAd('${data.id}')" class="hidden pointer-events-auto bg-white text-black font-bold text-xs px-4 py-2 rounded-full hover:bg-gray-200 transition">
                        Close Ad <i class="fas fa-times ml-1"></i>
                    </button>
                </div>
            </div>

            <div class="absolute inset-0 flex flex-col justify-end p-4 pointer-events-none z-10 pb-[70px]">
                <div class="reel-header-row pointer-events-auto mb-2">
                    <div class="reel-pfp-container" onclick="openPublicProfile('${data.uid}', '${safeUser}')">
                        <div class="w-full h-full rounded-full bg-black flex items-center justify-center font-bold text-sm text-white border-2 border-black">
                            ${safeUser[0].toUpperCase()}
                        </div>
                    </div>
                    <span class="reel-username-text" onclick="openPublicProfile('${data.uid}', '${safeUser}')">${safeUser}</span>
                    ${followBtnHtml}
                </div>

                <div class="mb-2 pointer-events-auto w-3/4">
                    <p class="text-sm text-gray-100 shadow-black drop-shadow-md leading-tight">${data.desc || ''}</p>
                </div>
                
                <div class="absolute right-2 bottom-16 flex flex-col items-center space-y-6 pointer-events-auto pb-4">
                    <button onclick="handleLike(this, '${data.id}', ${data.likes || 0})" class="flex flex-col items-center"><i class="fas fa-heart text-3xl drop-shadow-lg ${isLiked}"></i><span class="text-xs font-bold text-white">${data.likes || 0}</span></button>
                    <button onclick="openComments('${data.id}')" class="flex flex-col items-center"><i class="fas fa-comment-dots text-3xl drop-shadow-lg text-white"></i><span class="text-xs font-bold text-white">Chat</span></button>
                    <button onclick="shareVideo('${data.desc}', '${data.url}')" class="flex flex-col items-center"><i class="fas fa-share text-3xl drop-shadow-lg text-white"></i><span class="text-xs font-bold text-white">Share</span></button>
                </div>
            </div>
        </div>`;
}

window.followUserFromFeed = async (targetUid, btnId) => {
    if (!currentUser) return alert("Please login to follow.");
    const btn = document.getElementById(btnId);
    if(btn) btn.style.display = 'none';

    const { error } = await sb.from('follows').insert({ follower_id: currentUser.id, following_id: targetUid });
    
    if(!error) {
        myFollowingIds.add(targetUid);
        const { data: targetUser } = await sb.from('users').select('followers').eq('uid', targetUid).single();
        if(targetUser) await sb.from('users').update({ followers: (targetUser.followers || 0) + 1 }).eq('uid', targetUid);
        const { data: me } = await sb.from('users').select('following').eq('uid', currentUser.id).single();
        await sb.from('users').update({ following: (me.following || 0) + 1 }).eq('uid', currentUser.id);
    } else {
        if(btn) btn.style.display = 'inline-flex';
        alert("Failed to follow.");
    }
};

window.checkAdTrigger = (videoEl, videoId, adUrl) => {
    if (!adUrl || adUrl === 'null' || adUrl.trim() === "" || watchedAds.has(videoId)) return;
    
    if (videoEl.currentTime >= 4) {
        videoEl.pause();
        const overlay = document.getElementById(`ad_overlay_${videoId}`);
        const adVid = document.getElementById(`ad_vid_${videoId}`);
        const adFrame = document.getElementById(`ad_frame_${videoId}`);
        const timerVal = document.getElementById(`ad_timer_val_${videoId}`);
        const skipBtn = document.getElementById(`ad_skip_btn_${videoId}`);
        const timerBox = document.getElementById(`ad_timer_box_${videoId}`);
        
        overlay.classList.remove('hidden');
        
        const isVideoFile = adUrl.endsWith('.mp4') || adUrl.endsWith('.webm');
        if (isVideoFile) {
            adVid.src = adUrl;
            adVid.classList.remove('hidden');
            adFrame.classList.add('hidden');
            adVid.play().catch(e => console.log("Ad Play Error:", e));
            adVid.onended = () => skipAd(videoId);
        } else {
            adFrame.src = adUrl;
            adFrame.classList.remove('hidden');
            adVid.classList.add('hidden');
        }
        
        let timeLeft = 10;
        timerVal.innerText = timeLeft;
        skipBtn.classList.add('hidden');
        timerBox.classList.remove('hidden');

        const timerInterval = setInterval(() => {
            timeLeft--;
            if(timeLeft > 0) { 
                if(timerVal) timerVal.innerText = timeLeft; 
            } else { 
                clearInterval(timerInterval); 
                if(timerBox) timerBox.classList.add('hidden'); 
                if(skipBtn) skipBtn.classList.remove('hidden'); 
            }
        }, 1000);
    }
};

window.skipAd = (videoId) => {
    const overlay = document.getElementById(`ad_overlay_${videoId}`);
    const adVid = document.getElementById(`ad_vid_${videoId}`);
    const adFrame = document.getElementById(`ad_frame_${videoId}`);
    const mainVid = document.getElementById(`main_vid_${videoId}`);
    
    if(adVid) { adVid.pause(); adVid.src=""; }
    if(adFrame) { adFrame.src = "about:blank"; } 
    
    if(overlay) overlay.classList.add('hidden');
    watchedAds.add(videoId);
    if(mainVid) mainVid.play().catch(e => console.log("Resume Error:", e));
    
    rewardViewerForWatching();
};

let observer;
function setupScrollObserver() {
    if (observer) observer.disconnect();
    let options = { root: document.getElementById('reelContainer'), rootMargin: '0px', threshold: 0.6 };
    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('video[id^="main_vid_"]');
            
            const isAdSlide = entry.target.innerHTML.includes("Sponsored");

            if(entry.isIntersecting) {
                if (isAdSlide) {
                    const adVid = entry.target.querySelector('video');
                    if(adVid) adVid.play();
                } else if (video && video.getAttribute('src')) { 
                    video.play().catch(e => console.log("Autoplay blocked/Source error", e)); 
                    const videoId = entry.target.getAttribute('data-vid-id');
                    if(videoId) incrementView(videoId);
                }
            } else { 
                if(video) video.pause(); 
                const adVid = entry.target.querySelector('video');
                if(adVid) adVid.pause();
            }
        });
    }, options);
    document.querySelectorAll('.reel-item').forEach(item => observer.observe(item));
}

// 🔥 REWARD SYSTEM 🔥
async function incrementView(videoId) {
    if(!videoId) return;
    saveSeenVideo(videoId); 

    const viewKey = `viewed_${videoId}`;
    if (!localStorage.getItem(viewKey)) {
        localStorage.setItem(viewKey, "true");
        // 1. Update Video View Count
        const { data } = await sb.from('videos').select('views').eq('id', videoId).single();
        if(data) await sb.from('videos').update({ views: (data.views || 0) + 1 }).eq('id', videoId);
        
        // 2. Reward Viewer
        await rewardViewerForWatching();
    }
}

async function rewardViewerForWatching() {
    if (!currentUser) return;
    let localWatchCount = parseInt(localStorage.getItem(`watch_count_${currentUser.id}`) || '0');
    localWatchCount++;
    localStorage.setItem(`watch_count_${currentUser.id}`, localWatchCount);

    try {
        const { data: user } = await sb.from('users').select('balance').eq('uid', currentUser.id).single();
        if(user) {
            const newBalance = (user.balance || 0) + appRates.watchReward;
            await sb.from('users').update({ balance: newBalance }).eq('uid', currentUser.id);
        }
    } catch(e) { console.error("Reward Error", e); }
}

window.openWatchEarn = async () => {
    if(!currentUser) return alert("Login to access Watch & Earn!");
    document.getElementById('watchEarnModal').classList.remove('hidden');
    const count = localStorage.getItem(`watch_count_${currentUser.id}`) || '0';
    document.getElementById('watchCountDisplay').innerText = count;
    const { data } = await sb.from('users').select('balance').eq('uid', currentUser.id).single();
    if(data) document.getElementById('watchEarningsDisplay').innerText = (data.balance || 0).toFixed(4);
    
    if(window.watchInterval) clearInterval(window.watchInterval);
    window.watchInterval = setInterval(async () => {
        const { data: d } = await sb.from('users').select('balance').eq('uid', currentUser.id).single();
        if(d) document.getElementById('watchEarningsDisplay').innerText = (d.balance || 0).toFixed(4);
        document.getElementById('watchCountDisplay').innerText = localStorage.getItem(`watch_count_${currentUser.id}`) || '0';
    }, 5000);
};

window.closeWatchEarn = () => {
    document.getElementById('watchEarnModal').classList.add('hidden');
    if(window.watchInterval) clearInterval(window.watchInterval);
};

window.togglePlay = (videoEl, videoId) => {
    if(!videoEl) return;
    const overlay = document.getElementById(`ad_overlay_${videoId}`);
    if(overlay && !overlay.classList.contains('hidden')) return;
    if(videoEl.paused) { if(videoEl.getAttribute('src')) { videoEl.play().catch(e => console.log("Play Error:", e)); incrementView(videoId); } } 
    else { videoEl.pause(); }
};

window.handleLike = async (btn, videoId, currentLikes) => {
    if (!currentUser) { alert("Please login to like!"); return; }
    const likeKey = `liked_${videoId}_${currentUser.id}`;
    if (localStorage.getItem(likeKey)) return; 
    const icon = btn.querySelector('i');
    const countSpan = btn.querySelector('span');
    icon.classList.remove('text-white');
    icon.classList.add('text-brand-500', 'heart-bounce');
    const newCount = parseInt(currentLikes) + 1;
    countSpan.innerText = newCount;
    localStorage.setItem(likeKey, "true");
    try {
        const { data: freshData } = await sb.from('videos').select('likes').eq('id', videoId).single();
        const freshLikes = freshData ? freshData.likes : currentLikes;
        await sb.from('videos').update({ likes: freshLikes + 1 }).eq('id', videoId);
    } catch (e) { console.error("Like error", e); }
};

window.shareVideo = async (title, url) => {
    if (navigator.share) { try { await navigator.share({ title: 'CreatorVerse', text: title, url: url }); } catch (err) {} } 
    else { navigator.clipboard.writeText(url); alert("Link copied!"); }
};

// --- 9. COMMENTS, SEARCH & CHAT ---
window.openComments = async (videoId) => {
    activeVideoId = videoId;
    document.getElementById('commentModal').classList.remove('hidden');
    const list = document.getElementById('commentsList');
    list.innerHTML = '<p class="text-center text-gray-500 mt-10">Loading comments...</p>';
    const { data } = await sb.from('videos').select('comments').eq('id', videoId).single();
    const comments = data?.comments || [];
    if(comments.length === 0) { list.innerHTML = '<div class="text-center mt-10"><i class="fas fa-comment-slash text-gray-600 text-4xl mb-2"></i><p class="text-gray-500 text-sm">No comments yet.</p></div>'; } 
    else {
        let html = '';
        comments.forEach(c => { html += `<div class="flex items-start space-x-3 mb-4"><div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center font-bold text-xs text-white">${c.user[0].toUpperCase()}</div><div><span class="font-bold text-gray-400 text-xs block">@${c.user}</span><span class="text-sm text-gray-200">${c.text}</span></div></div>`; });
        list.innerHTML = html;
    }
};
window.closeComments = () => document.getElementById('commentModal').classList.add('hidden');
window.postComment = async () => {
    const text = document.getElementById('commentInput').value;
    if(!text || !activeVideoId) return;
    const { data } = await sb.from('videos').select('comments').eq('id', activeVideoId).single();
    let currentComments = data?.comments || [];
    currentComments.push({ user: currentUser.displayName, text: text, time: Date.now() });
    await sb.from('videos').update({ comments: currentComments }).eq('id', activeVideoId);
    document.getElementById('commentInput').value = '';
    openComments(activeVideoId); 
};


window.searchUsers = async (query) => {
    const section = document.getElementById('searchResultsSection');
    const list = document.getElementById('searchResultsList');
    if(query.length < 2) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    const { data: users } = await sb.from('users').select('*').ilike('username', `%${query}%`).limit(5);
    if(users && users.length > 0) {
        list.innerHTML = users.map(u => `
            <div onclick="openPublicProfile('${u.uid}', '${u.username}')" class="flex items-center space-x-3 bg-gray-900 p-2 rounded-lg cursor-pointer hover:bg-gray-800 transition">
                <div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-sm overflow-hidden border border-gray-600">
                        ${u.photo_url ? `<img src="${u.photo_url}" class="w-full h-full object-cover">` : (u.username ? u.username[0].toUpperCase() : 'U')}
                </div>
                <div>
                    <p class="font-bold text-sm">@${u.username}</p>
                    <p class="text-[10px] text-gray-400">User</p>
                </div>
            </div>
        `).join('');
    } else { list.innerHTML = `<p class="text-gray-500 text-xs text-center py-2">No users found.</p>`; }
};

async function loadInbox() {
    if(!currentUser) return;
    const list = document.getElementById('followingList');
    list.innerHTML = '<p class="text-center text-gray-500 mt-5">Loading chats...</p>';
    const { data: messages, error } = await sb.from('messages').select('sender_id, receiver_id').or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);
    if (error) { list.innerHTML = '<p class="text-center text-red-500">Error loading chats</p>'; return; }
    let partnerIds = new Set();
    if (messages) { messages.forEach(msg => { if (msg.sender_id === currentUser.id) { partnerIds.add(msg.receiver_id); } else { partnerIds.add(msg.sender_id); } }); }
    if(partnerIds.size === 0) { list.innerHTML = `<div class="text-center py-10"><i class="fas fa-paper-plane text-gray-600 text-4xl mb-3"></i><p class="text-gray-500 text-sm">No messages yet.</p></div>`; return; }
    const { data: users } = await sb.from('users').select('*').in('uid', Array.from(partnerIds));
    if(users) {
        list.innerHTML = users.map(u => `
            <div class="flex items-center justify-between bg-gray-900 p-3 rounded-lg cursor-pointer hover:bg-gray-800 transition border border-gray-800 mb-2" onclick="openChat('${u.uid}', '${u.username}', '${u.photo_url || ''}')">
                <div class="flex items-center space-x-3">
                    <div class="relative">
                        <div class="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center font-bold text-lg overflow-hidden border border-gray-600">
                            ${u.photo_url ? `<img src="${u.photo_url}" class="w-full h-full object-cover">` : (u.username ? u.username[0].toUpperCase() : 'U')}
                        </div>
                        <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>
                    </div>
                    <div>
                        <h4 class="font-bold text-sm">@${u.username}</h4>
                        <p class="text-[10px] text-gray-400">Tap to chat</p>
                    </div>
                </div>
                <button class="bg-gray-800 p-2 rounded-full"><i class="fas fa-comment text-brand-500"></i></button>
            </div>
        `).join('');
    }
}
window.openPublicProfile = async (targetUid, fallbackUsername) => {
    if(targetUid === currentUser.id) { showScreen('profileScreen'); return; }
    document.getElementById('publicProfileScreen').classList.remove('hidden');
    let { data: user } = await sb.from('users').select('*').eq('uid', targetUid).single();
    if (!user) user = { username: fallbackUsername || "User", uid: targetUid, photo_url: null };
    const { count: followingCount } = await sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetUid);
    const { count: followerCount } = await sb.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', targetUid);
    const { data: userVideos } = await sb.from('videos').select('likes').eq('uid', targetUid);
    let totalLikes = 0;
    if(userVideos) userVideos.forEach(v => totalLikes += (v.likes || 0));

    const safeName = user.username || "User";
    document.getElementById('publicProfileName').innerText = "@" + safeName;
    document.getElementById('publicProfileTitle').innerText = "@" + safeName;
    document.getElementById('publicFollowing').innerText = followingCount || 0;
    document.getElementById('publicFollowers').innerText = followerCount || 0;
    document.getElementById('publicLikes').innerText = totalLikes;
    
    const img = document.getElementById('publicProfileImg');
    const init = document.getElementById('publicProfileInit');
    if(user.photo_url) { img.src = user.photo_url; img.classList.remove('hidden'); init.classList.add('hidden'); } 
    else { img.classList.add('hidden'); init.classList.remove('hidden'); init.innerText = safeName[0].toUpperCase(); }

    const followBtn = document.getElementById('publicFollowBtn');
    const { data: check } = await sb.from('follows').select('*').eq('follower_id', currentUser.id).eq('following_id', targetUid).single();
    if(check) setUnfollowState(followBtn, targetUid); else setFollowState(followBtn, targetUid);
    document.getElementById('publicMsgBtn').onclick = () => { openChat(targetUid, safeName, user.photo_url); };
    loadProfileVideos(targetUid, 'publicProfileGrid');

    renderPageAds('publicProfileScreen');
};

function setFollowState(btn, targetUid) {
    btn.innerText = "Follow"; btn.classList.replace('bg-gray-600', 'bg-brand-500'); btn.classList.replace('text-white', 'text-black');
    btn.onclick = () => handleFollow(targetUid, btn);
}

function setUnfollowState(btn, targetUid) {
    btn.innerText = "Following"; btn.classList.replace('bg-brand-500', 'bg-gray-600'); btn.classList.replace('text-black', 'text-white');
    btn.onclick = () => handleUnfollow(targetUid, btn);
}

window.closePublicProfile = () => document.getElementById('publicProfileScreen').classList.add('hidden');

window.handleFollow = async (targetUid, btn) => {
    btn.innerText = "Processing...";
    const { error } = await sb.from('follows').insert({ follower_id: currentUser.id, following_id: targetUid });
    if(!error) {
        myFollowingIds.add(targetUid); 
        const { data: targetUser } = await sb.from('users').select('followers').eq('uid', targetUid).single();
        if(targetUser) await sb.from('users').update({ followers: (targetUser.followers || 0) + 1 }).eq('uid', targetUid);
        const { data: me } = await sb.from('users').select('following').eq('uid', currentUser.id).single();
        await sb.from('users').update({ following: (me.following || 0) + 1 }).eq('uid', currentUser.id);
        const followerEl = document.getElementById('publicFollowers'); followerEl.innerText = (parseInt(followerEl.innerText) || 0) + 1;
        setUnfollowState(btn, targetUid);
    } else { alert("Error following user."); setFollowState(btn, targetUid); }
};

window.handleUnfollow = async (targetUid, btn) => {
    if(!confirm("Unfollow this user?")) return;
    btn.innerText = "Processing...";
    const { error } = await sb.from('follows').delete().match({ follower_id: currentUser.id, following_id: targetUid });
    if(!error) {
        myFollowingIds.delete(targetUid);
        const { data: targetUser } = await sb.from('users').select('followers').eq('uid', targetUid).single();
        if(targetUser) await sb.from('users').update({ followers: Math.max(0, (targetUser.followers || 0) - 1) }).eq('uid', targetUid);
        const { data: me } = await sb.from('users').select('following').eq('uid', currentUser.id).single();
        await sb.from('users').update({ following: Math.max(0, (me.following || 0) - 1) }).eq('uid', currentUser.id);
        const followerEl = document.getElementById('publicFollowers'); followerEl.innerText = Math.max(0, (parseInt(followerEl.innerText) || 0) - 1);
        setFollowState(btn, targetUid);
    } else { alert("Error unfollowing."); setUnfollowState(btn, targetUid); }
};
window.openChat = async (uid, username, photo) => {
    document.getElementById('chatModal').classList.remove('hidden');
    currentChatUser = uid;
    document.getElementById('chatHeaderName').innerText = username || "User";
    const img = document.getElementById('chatHeaderImg'); const init = document.getElementById('chatHeaderInit');
    if(photo && photo !== 'null') { img.src = photo; img.classList.remove('hidden'); init.classList.add('hidden'); } 
    else { img.classList.add('hidden'); init.classList.remove('hidden'); init.innerText = (username || "U")[0].toUpperCase(); }
    loadMessages();
    if(window.chatInterval) clearInterval(window.chatInterval);
    window.chatInterval = setInterval(loadMessages, 3000);
};

window.closeChat = () => {
    document.getElementById('chatModal').classList.add('hidden');
    currentChatUser = null;
    if(window.chatInterval) clearInterval(window.chatInterval);
    loadInbox();
};

async function loadMessages() {
    if(!currentChatUser || !currentUser) return;
    const container = document.getElementById('chatMessages');
    const { data: msgs } = await sb.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${currentChatUser}),and(sender_id.eq.${currentChatUser},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
    if(msgs) {
        container.innerHTML = msgs.map(m => {
            const isMe = m.sender_id === currentUser.id;
            return `<div class="flex ${isMe ? 'justify-end' : 'justify-start'}"><div class="${isMe ? 'bg-brand-600 text-black rounded-tr-none' : 'bg-gray-800 text-white rounded-tl-none'} rounded-xl px-4 py-2 max-w-[75%] text-sm shadow-md">${m.text}</div></div>`;
        }).join('');
        container.scrollTop = container.scrollHeight;
    }
}

window.sendMessage = async () => {
    const input = document.getElementById('messageInput'); const text = input.value.trim();
    if(!text || !currentChatUser) return;
    input.value = ''; 
    await sb.from('messages').insert({ sender_id: currentUser.id, receiver_id: currentChatUser, text: text });
    loadMessages();
};

// --- 10. UPLOAD & STORE ---
function ensureUploadFields() {
    const priceContainer = document.getElementById('priceInputContainer');
    if(priceContainer && !document.getElementById('upiInputContainer')) {
        const extraHtml = `
            <div id="upiInputContainer" class="mt-3 space-y-3">
                <input type="text" id="upiIdInput" placeholder="Enter your UPI ID (e.g. name@upi)" class="w-full bg-gray-900 text-white p-3 rounded border border-gray-700">
                <div class="bg-gray-900 p-3 rounded border border-gray-700">
                    <label class="text-xs text-gray-400 mb-1 block">Upload QR Code (Screenshot)</label>
                    <input type="file" id="qrFileInput" accept="image/*" class="w-full text-xs text-gray-400">
                </div>
            </div>
        `;
        priceContainer.insertAdjacentHTML('beforeend', extraHtml);
    }
}

window.toggleUpload = () => {
    document.getElementById('uploadModal').classList.toggle('hidden');
    ensureUploadFields();
};

window.switchUploadTab = (type) => {
    const vForm = document.getElementById('videoUploadForm'); const aForm = document.getElementById('assetUploadForm');
    const vTab = document.getElementById('tabVideo'); const aTab = document.getElementById('tabAsset');
    if (type === 'video') { vForm.classList.remove('hidden'); aForm.classList.add('hidden'); vTab.className = "flex-1 py-2 text-sm font-bold bg-gray-700 rounded text-white shadow"; aTab.className = "flex-1 py-2 text-sm font-bold text-gray-400 hover:text-white"; } 
    else { vForm.classList.add('hidden'); aForm.classList.remove('hidden'); aTab.className = "flex-1 py-2 text-sm font-bold bg-gray-700 rounded text-white shadow"; vTab.className = "flex-1 py-2 text-sm font-bold text-gray-400 hover:text-white"; }
    ensureUploadFields();
};

window.togglePriceInput = () => {
    const isPaid = document.getElementById('paidToggle').checked;
    document.getElementById('priceInputContainer').classList.toggle('hidden', !isPaid);
    ensureUploadFields(); 
};

window.uploadFile = async (type) => {
    if (!currentUser) { alert("Please login first!"); return; }
    
    const fileInput = document.getElementById(type === 'video' ? 'videoFileInput' : 'assetFileInput');
    const file = fileInput.files[0];
    const caption = type === 'video' ? document.getElementById('videoCaption').value : document.getElementById('assetName').value;
    const uploadBtn = document.getElementById(type === 'video' ? 'vidUploadBtn' : 'assetUploadBtn');
    
    if(!file) return alert("Select File");

    // ASSET VALIDATION
    let price = 0;
    let upiId = "";
    let qrUrl = "";
    let category = "emoji"; // default

    if (type !== 'video') {
        const catSelect = document.getElementById('assetCategory');
        if(catSelect) category = catSelect.value;

        if(document.getElementById('paidToggle').checked) {
            price = Number(document.getElementById('assetPrice').value);
            upiId = document.getElementById('upiIdInput').value;
            const qrFile = document.getElementById('qrFileInput').files[0];
            
            if (price <= 0) return alert("Enter valid price");
            if (!upiId && !qrFile) return alert("Please provide UPI ID or QR Code for payment.");

            if(qrFile) {
                document.getElementById('uploadProgressContainer').classList.remove('hidden');
                const qrName = `qr_${currentUser.id}_${Date.now()}`;
                const { error } = await sb.storage.from(BUCKET_ASSETS).upload(qrName, qrFile);
                if(!error) {
                    const { data: qrData } = sb.storage.from(BUCKET_ASSETS).getPublicUrl(qrName);
                    qrUrl = qrData.publicUrl;
                }
            }
        }
    }

    document.getElementById('uploadProgressContainer').classList.remove('hidden');
    document.getElementById('progressBar').style.width = '30%'; 
    uploadBtn.disabled = true;
    
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const bucketName = type === 'video' ? BUCKET_VIDEOS : BUCKET_ASSETS;

    try {
        const { error } = await sb.storage.from(bucketName).upload(fileName, file);
        if (error) throw error; 
        
        document.getElementById('progressBar').style.width = '100%';
        const { data: publicData } = sb.storage.from(bucketName).getPublicUrl(fileName);
        
        const table = type === 'video' ? 'videos' : 'assets';
        const safeUserName = currentUser.displayName || "User";
        
        const row = { 
            url: publicData.publicUrl, 
            desc: caption || "", 
            user: safeUserName, 
            uid: currentUser.id, 
            created_at: new Date().toISOString() 
        };

        if(type === 'video') { 
            row.likes = 0; row.views = 0; row.comments = []; 
        } else { 
            row.price = price; 
            row.downloads = 0;
            row.category = category; 
            
            if(price > 0) {
                row.upi_id = upiId;
                row.qr_code_url = qrUrl;
            }
        }
        
        await sb.from(table).insert(row);
        alert("Upload Success!");
        fileInput.value = ''; toggleUpload();
        document.getElementById('uploadProgressContainer').classList.add('hidden'); uploadBtn.disabled = false;
        
        if(type === 'video') loadVideos(); else loadAssets(currentStoreCategory);

    } catch (err) { 
        alert("Upload Failed: " + err.message); 
        document.getElementById('uploadProgressContainer').classList.add('hidden'); 
        uploadBtn.disabled = false; 
    }
};

window.previewVideo = (input) => { if (input.files[0]) { const vid = document.getElementById('videoPreview'); vid.src = URL.createObjectURL(input.files[0]); vid.classList.remove('hidden'); document.getElementById('videoPlaceholder').classList.add('hidden'); } }
window.previewAsset = (input) => { if (input.files[0]) { const img = document.getElementById('assetPreview'); img.src = URL.createObjectURL(input.files[0]); img.classList.remove('hidden'); document.getElementById('assetPlaceholder').classList.add('hidden'); } }


// --- 11. UPDATED ASSET STORE ---
window.filterStore = (category) => {
    currentStoreCategory = category;
    const buttons = ['cat-all', 'cat-emoji', 'cat-thumbnail', 'cat-sticker'];
    buttons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if(!btn) return;
        btn.className = "px-5 py-1.5 rounded-full font-bold text-sm whitespace-nowrap border transition active:scale-95";
        if (btnId === `cat-${category}`) {
            btn.classList.add("bg-white", "text-black", "border-white");
        } else {
            btn.classList.add("bg-gray-800", "text-gray-400", "border-gray-700", "hover:border-gray-500");
        }
    });
    loadAssets(category);
}

async function loadAssets(category = 'all') {
    const grid = document.getElementById('storeGrid');
    grid.innerHTML = `<p class="col-span-2 text-center text-gray-500 mt-10">Loading ${category}...</p>`;

    let query = sb.from('assets').select('*').order('created_at', { ascending: false });
    if (category !== 'all') {
        query = query.eq('category', category);
    }
    const { data: assets } = await query;
    let html = '';
    if(assets && assets.length > 0) {
        assets.forEach(data => {
            html += `
                <div class="bg-gray-800 rounded-xl overflow-hidden group border border-gray-700">
                    <div class="aspect-square bg-gray-700 relative">
                        <img src="${data.url}" class="w-full h-full object-cover">
                        <div class="absolute top-2 right-2 ${data.price > 0 ? 'bg-yellow-500 text-black' : 'bg-green-500 text-white'} text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
                            ${data.price > 0 ? '₹'+data.price : 'Free'}
                        </div>
                    </div>
                    <div class="p-3">
                        <h4 class="font-bold text-sm truncate text-white">${data.desc || ''}</h4>
                        <div class="flex justify-between items-center text-xs text-gray-400 mb-2">
                            <span>@${data.user}</span>
                            <span><i class="fas fa-download text-brand-500"></i> <span id="store_dl_${data.id}">${data.downloads || 0}</span></span>
                        </div>
                        <button onclick="handleAssetDownload('${data.id}', '${data.url}', ${data.price}, '${data.upi_id || ''}', '${data.qr_code_url || ''}')" 
                            class="block text-center w-full py-2 rounded ${data.price > 0 ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-gray-700 hover:bg-white hover:text-black text-white'} text-xs font-bold transition">
                            <i class="fas fa-download mr-1"></i> ${data.price > 0 ? 'Buy & Download' : 'Download'}
                        </button>
                    </div>
                </div>`;
        });
    } else { html = "<p class='col-span-2 text-center text-gray-500 py-10'>No assets found in this category.</p>"; }
    grid.innerHTML = html;
}

window.handleAssetDownload = async (assetId, url, price, upi, qr) => {
    pendingDownload = { id: assetId, url: url };
    
    // 1. Paid Check
    if (price > 0) {
        openPaymentModal(upi, qr);
        return;
    }

    // 2. Ad Check
    if (storeAdUrl && storeAdUrl !== 'null' && storeAdUrl.length > 5) {
        const modal = document.getElementById('storeAdModal');
        const frame = document.getElementById('storeAdFrame');
        const vid = document.getElementById('storeAdVideo');
        const timerBox = document.getElementById('storeAdTimerBox');
        const timerSpan = document.getElementById('storeAdTimer');
        const skipBtn = document.getElementById('storeAdSkipBtn');
        
        modal.classList.remove('hidden');
        timerBox.classList.remove('hidden');
        skipBtn.classList.add('hidden');
        timerSpan.innerText = "10";

        const isVideo = storeAdUrl.toLowerCase().endsWith('.mp4');
        if (isVideo) {
            vid.src = storeAdUrl;
            vid.classList.remove('hidden');
            frame.classList.add('hidden');
            vid.play().catch(e => console.log("Ad Auto-play Error:", e));
        } else {
            frame.src = storeAdUrl;
            frame.classList.remove('hidden');
            vid.classList.add('hidden');
        }

        let timeLeft = 10;
        const interval = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                timerSpan.innerText = timeLeft;
            } else {
                clearInterval(interval);
                skipStoreAdAndDownload(); 
            }
        }, 1000);
    } else {
        triggerRealDownload(assetId, url);
    }
};

window.skipStoreAdAndDownload = () => {
    const modal = document.getElementById('storeAdModal');
    const vid = document.getElementById('storeAdVideo');
    const frame = document.getElementById('storeAdFrame');
    
    vid.pause();
    frame.src = "about:blank"; 
    
    modal.classList.add('hidden');
    
    if (pendingDownload.id && pendingDownload.url) {
        triggerRealDownload(pendingDownload.id, pendingDownload.url);
    }
};

window.openPaymentModal = (upi, qr) => {
    const modal = document.getElementById('paymentModal');
    const qrImg = document.getElementById('payQrImg');
    const noQr = document.getElementById('noQrText');
    const upiText = document.getElementById('payUpiText');

    if(qr && qr !== 'null' && qr.length > 5) {
        qrImg.src = qr;
        qrImg.classList.remove('hidden');
        noQr.classList.add('hidden');
    } else {
        qrImg.classList.add('hidden');
        noQr.classList.remove('hidden');
    }
    upiText.innerText = (upi && upi !== 'null') ? upi : "Not Provided";
    modal.classList.remove('hidden');
};

window.closePaymentModal = () => document.getElementById('paymentModal').classList.add('hidden');

window.copyUpi = () => {
    const text = document.getElementById('payUpiText').innerText;
    navigator.clipboard.writeText(text);
    alert("UPI ID Copied!");
};

window.confirmPaymentAndDownload = () => {
    closePaymentModal();
    alert("Payment Confirmed! Downloading...");
    triggerRealDownload(pendingDownload.id, pendingDownload.url);
};

// 🔥 UNIVERSAL DIRECT DOWNLOAD FIX 🔥
async function triggerRealDownload(assetId, url) {
    console.log("Starting download logic for ID:", assetId);

    const btn = document.querySelector(`button[onclick*='${assetId}']`);
    let originalText = "";
    if(btn) {
        originalText = btn.innerHTML;
        btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Saving...";
    }

    try {
        const { data, error: fetchError } = await sb.from('assets').select('downloads').eq('id', assetId).single();
        if (!fetchError) {
            const currentDownloads = data ? (data.downloads || 0) : 0;
            const newDownloads = currentDownloads + 1;
            await sb.from('assets').update({ downloads: newDownloads }).eq('id', assetId);
            
            const storeEl = document.getElementById(`store_dl_${assetId}`);
            if(storeEl) storeEl.innerText = newDownloads;
            const profileEl = document.getElementById(`profile_dl_${assetId}`);
            if(profileEl) profileEl.innerText = newDownloads;
        }
    } catch (e) {
        console.error("DB Update Failed:", e);
    }

    try {
        const downloadUrl = url.includes('?') ? `${url}&download=` : `${url}?download=`;
        window.location.href = downloadUrl;
    } catch (error) {
        console.warn("Download failed", error);
        window.open(url, '_blank');
    } finally {
        if(btn) btn.innerHTML = originalText || "<i class='fas fa-download mr-1'></i> Download";
    }
}

// --- 12. PROFILE, STATS & ADMIN LOGIC ---

window.openStats = async () => {
    document.getElementById('statsModal').classList.remove('hidden');
    const list = document.getElementById('userStatsList');
    list.innerHTML = "<p class='text-center text-gray-500 py-4'>Calculating earnings...</p>";

    const { data: userData } = await sb.from('users').select('balance').eq('uid', currentUser.id).single();
    const walletBalance = userData ? (userData.balance || 0) : 0;
    const { data: videos } = await sb.from('videos').select('*').eq('uid', currentUser.id).order('created_at', { ascending: false });
    const { data: assets } = await sb.from('assets').select('*').eq('uid', currentUser.id).order('created_at', { ascending: false });

    let totalViews = 0;
    let totalDownloads = 0;
    let totalPendingEarnings = 0;
    let html = '';

    if(videos && videos.length > 0) { 
        html += `<h3 class="text-white font-bold mb-2 ml-1">Your Videos</h3>`;
        videos.forEach(v => {
            totalViews += (v.views || 0);
            const vidEarn = (v.views || 0) * appRates.videoView; 
            totalPendingEarnings += vidEarn;
            html += `
            <div class="flex items-start gap-4 mb-4 bg-black/20 p-2 rounded-xl border border-gray-800/50">
                <div class="w-16 h-20 flex-shrink-0 rounded-lg border border-gray-700 bg-gray-800 overflow-hidden relative">
                     <video src="${v.url}#t=0.1" preload="metadata" class="w-full h-full object-cover"></video>
                </div>
                <div class="flex flex-col gap-1 w-full justify-center">
                    <p class="text-xs text-gray-400 truncate">${v.desc || 'Video'}</p>
                    <div class="flex gap-2">
                        <span class="text-xs bg-gray-800 px-2 py-1 rounded text-white border border-gray-700">👁 ${v.views || 0}</span>
                        <span class="text-xs bg-gray-800 px-2 py-1 rounded text-green-400 border border-gray-700">$${vidEarn.toFixed(3)}</span>
                    </div>
                </div>
            </div>`; 
        }); 
    }

    if(assets && assets.length > 0) {
        html += `<h3 class="text-white font-bold mb-2 ml-1 mt-4">Your Assets</h3>`;
        assets.forEach(a => {
            const downloads = a.downloads || 0;
            totalDownloads += downloads;
            const assetEarn = downloads * appRates.assetDownload;
            totalPendingEarnings += assetEarn;
            html += `
            <div class="flex items-start gap-4 mb-4 bg-black/20 p-2 rounded-xl border border-gray-800/50">
                <div class="w-16 h-16 flex-shrink-0 rounded-lg border border-gray-700 bg-gray-800 overflow-hidden relative">
                     <img src="${a.url}" class="w-full h-full object-cover">
                </div>
                <div class="flex flex-col gap-1 w-full justify-center">
                    <p class="text-xs text-gray-400 truncate">${a.desc || 'Asset'}</p>
                    <div class="flex gap-2">
                        <span class="text-xs bg-gray-800 px-2 py-1 rounded text-white border border-gray-700">⬇ ${downloads}</span>
                        <span class="text-xs bg-gray-800 px-2 py-1 rounded text-green-400 border border-gray-700">$${assetEarn.toFixed(3)}</span>
                    </div>
                </div>
            </div>`;
        });
    }

    if(!videos?.length && !assets?.length) html = "<p class='text-gray-500 text-center py-10'>No uploads yet.</p>";
    
    html += `
    <div class="mt-6 border-t border-gray-700 pt-4">
        <button onclick="openCashoutModal()" class="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-3 rounded-lg shadow-lg transform transition active:scale-95">
            Cash Out Now <i class="fas fa-wallet ml-2"></i>
        </button>
        <p class="text-center text-[10px] text-gray-500 mt-2">Only UPI & PayPal Supported</p>
    </div>`;

    list.innerHTML = html;

    document.getElementById('totalViewsStats').innerText = totalViews;
    document.getElementById('totalLikesStats').innerText = totalDownloads;
    document.getElementById('totalAdsClicks').innerText = "0";

    document.getElementById('userBalance').innerHTML = `
        <span class="text-green-400">$${walletBalance.toFixed(2)}</span>
        <span class="text-[10px] text-gray-500 block">Available</span>
        <span class="text-yellow-400 text-xs mt-1 block">+$${totalPendingEarnings.toFixed(2)} Pending</span>
    `;
};

// 🔥 UPDATED ADMIN PANEL 🔥
window.openAdminPanel = async () => {
    document.getElementById('adminPanelModal').classList.remove('hidden');
    
    // 1. App Rates & Ad Inputs
    const rateContainer = document.getElementById('adminRateControl');
    rateContainer.innerHTML = `
        <div class="bg-gray-900 p-4 rounded-lg border border-gray-700 mb-4 space-y-4">
            
            <!-- Rates -->
            <div>
                <h3 class="font-bold text-white mb-2 text-sm">💰 Earning Rates & Limits</h3>
                <div class="flex space-x-2 mb-2">
                    <div class="flex-1">
                        <label class="text-[10px] text-gray-400">$/View (Creator)</label>
                        <input type="number" step="0.0001" id="rateViewInput" value="${appRates.videoView}" class="w-full bg-black text-white p-2 text-xs rounded border border-gray-600">
                    </div>
                    <div class="flex-1">
                        <label class="text-[10px] text-gray-400">$/Download</label>
                        <input type="number" step="0.01" id="rateDlInput" value="${appRates.assetDownload}" class="w-full bg-black text-white p-2 text-xs rounded border border-gray-600">
                    </div>
                </div>
                <div>
                     <label class="text-[10px] text-gray-400 text-brand-500">Min. Withdrawal Amount ($)</label>
                     <input type="number" step="1" id="minWithdrawalInput" value="${appSettings.minWithdrawal}" class="w-full bg-black text-white p-2 text-xs rounded border border-gray-600 border-brand-500">
                </div>
            </div>

            <!-- AD: HOME / FEED -->
            <div>
                <h3 class="font-bold text-brand-500 mb-2 text-sm">🏠 Home / Feed Ads</h3>
                <label class="text-[10px] text-gray-400">Top Banner (Script)</label>
                <textarea id="adFeedTop" class="w-full bg-black text-white p-2 text-xs rounded border border-gray-600 mb-2" rows="2" placeholder="Paste script here...">${appAdConfig.feed.top || ''}</textarea>
                
                <label class="text-[10px] text-gray-400">Bottom Banner (Script)</label>
                <textarea id="adFeedBottom" class="w-full bg-black text-white p-2 text-xs rounded border border-gray-600" rows="2" placeholder="Paste script here...">${appAdConfig.feed.bottom || ''}</textarea>
            </div>

            <!-- AD: STORE -->
            <div>
                <h3 class="font-bold text-green-500 mb-2 text-sm">🛍️ Store Ads</h3>
                <label class="text-[10px] text-gray-400">Top Banner (Script)</label>
                <textarea id="adStoreTop" class="w-full bg-black text-white p-2 text-xs rounded border border-gray-600 mb-2" rows="2" placeholder="Paste script here...">${appAdConfig.store.top || ''}</textarea>
                
                <label class="text-[10px] text-gray-400">Bottom Banner (Script)</label>
                <textarea id="adStoreBottom" class="w-full bg-black text-white p-2 text-xs rounded border border-gray-600" rows="2" placeholder="Paste script here...">${appAdConfig.store.bottom || ''}</textarea>
            </div>

            <!-- AD: PROFILE -->
            <div>
                <h3 class="font-bold text-blue-500 mb-2 text-sm">👤 Profile Ads</h3>
                <label class="text-[10px] text-gray-400">Top Banner (Script)</label>
                <textarea id="adProfileTop" class="w-full bg-black text-white p-2 text-xs rounded border border-gray-600 mb-2" rows="2" placeholder="Paste script here...">${appAdConfig.profile.top || ''}</textarea>
                
                <label class="text-[10px] text-gray-400">Bottom Banner (Script)</label>
                <textarea id="adProfileBottom" class="w-full bg-black text-white p-2 text-xs rounded border border-gray-600" rows="2" placeholder="Paste script here...">${appAdConfig.profile.bottom || ''}</textarea>
            </div>

            <button onclick="updateAppConfigFull()" class="w-full bg-brand-500 hover:bg-brand-600 text-black font-bold py-3 rounded mt-2">SAVE ALL SETTINGS ✅</button>
        </div>
    `;

    // 2. Load Top Videos for Payouts
    const list = document.getElementById('adminVideoList');
    list.innerHTML = "<p class='text-center p-4'>Loading...</p>";
    const { data: videos } = await sb.from('videos').select('*').gte('views', 100).order('views', {ascending: false});
    let html = '';
    if(videos && videos.length > 0) { 
        videos.forEach(v => { 
            html += `
            <div class="bg-gray-800 border border-gray-700 p-4 rounded-xl mb-2">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <p class="font-bold text-brand-500">@${v.user}</p>
                        <p class="text-xs text-gray-400">${v.desc || ''}</p>
                    </div>
                    <span class="bg-yellow-500 text-black px-2 py-1 rounded text-xs font-bold">Views: ${v.views}</span>
                </div>
                <video src="${v.url}" controls class="w-full h-32 object-cover rounded mb-3 bg-black"></video>
                <div class="flex space-x-2">
                    <input type="number" id="pay_${v.id}" placeholder="Amount ($)" class="bg-black border border-gray-600 p-2 rounded w-24 text-sm text-white">
                    <button onclick="sendMoney('${v.uid}', '${v.id}')" class="bg-green-600 px-4 rounded text-sm font-bold flex-1 hover:bg-green-500">Send $</button>
                </div>
            </div>`; 
        }); 
    } else { html = "<p class='text-center text-gray-500 py-10'>No popular videos found.</p>"; }
    list.innerHTML = html;
};

// 🔥 NEW FUNCTION TO SAVE ALL ADS AND RATES
window.updateAppConfigFull = async () => {
    const updates = [
        { key: 'rate_video_view', value: document.getElementById('rateViewInput').value },
        { key: 'rate_asset_download', value: document.getElementById('rateDlInput').value },
        { key: 'min_withdrawal', value: document.getElementById('minWithdrawalInput').value }, // 🔥 SAVE MIN LIMIT
        
        { key: 'ad_feed_top', value: document.getElementById('adFeedTop').value },
        { key: 'ad_feed_bottom', value: document.getElementById('adFeedBottom').value },
        
        { key: 'ad_store_top', value: document.getElementById('adStoreTop').value },
        { key: 'ad_store_bottom', value: document.getElementById('adStoreBottom').value },
        
        { key: 'ad_profile_top', value: document.getElementById('adProfileTop').value },
        { key: 'ad_profile_bottom', value: document.getElementById('adProfileBottom').value },
    ];

    try {
        const { error } = await sb.from('app_config').upsert(updates, { onConflict: 'key' });
        if(error) throw error;
        
        alert("Settings Saved Successfully! Reload app to see changes.");
        window.location.reload(); 

    } catch(e) {
        alert("Error saving settings: " + e.message);
        console.error(e);
    }
};

window.sendMoney = async (userId, videoId) => {
    const amount = Number(document.getElementById(`pay_${videoId}`).value);
    if(!amount || amount <= 0) return alert("Enter valid amount");
    const { data: user } = await sb.from('users').select('balance').eq('uid', userId).single();
    if(user) { await sb.from('users').update({ balance: (user.balance || 0) + amount }).eq('uid', userId); alert(`Sent $${amount}!`); openAdminPanel(); }
};

window.uploadProfilePic = async (input) => {
    const file = input.files[0];
    if(!file || !currentUser) return;
    const fileName = `${currentUser.id}_${Date.now()}`;
    const { error } = await sb.storage.from(BUCKET_PROFILE).upload(fileName, file);
    if(error) { alert("Error: " + error.message); return; }
    const { data: publicData } = sb.storage.from(BUCKET_PROFILE).getPublicUrl(fileName);
    await sb.from('users').update({ photo_url: publicData.publicUrl }).eq('uid', currentUser.id);
    alert("Profile Picture Updated!"); updateProfileUI();
};

async function updateProfileUI() {
    if(!currentUser) return;
    document.getElementById('profileHeaderName').innerText = '@' + currentUser.displayName;
    document.getElementById('profileName').innerText = '@' + currentUser.displayName;
    document.getElementById('profileAvatarText').innerText = currentUser.displayName.charAt(0).toUpperCase();
    
    const { data: userData } = await sb.from('users').select('*').eq('uid', currentUser.id).single();
    const { count: followingCount } = await sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', currentUser.id);
    const { count: followerCount } = await sb.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', currentUser.id);
    
    const { data: myVideos } = await sb.from('videos').select('likes').eq('uid', currentUser.id);
    let totalLikes = 0;
    if(myVideos) myVideos.forEach(v => totalLikes += (v.likes || 0));

    document.getElementById('statFollowing').innerText = followingCount || 0;
    document.getElementById('statFollowers').innerText = followerCount || 0;
    document.getElementById('statLikes').innerText = totalLikes;

    if (userData && userData.photo_url) { 
        document.getElementById('profileAvatarImg').src = userData.photo_url; 
        document.getElementById('profileAvatarImg').classList.remove('hidden'); 
        document.getElementById('profileAvatarText').classList.add('hidden'); 
    }
}

window.switchProfileTab = (tab) => {
    const vGrid = document.getElementById('profileGrid'); const aGrid = document.getElementById('profileAssetGrid');
    if (tab === 'video') { document.getElementById('profileTabVideo').classList.replace('text-gray-500', 'text-white'); document.getElementById('profileTabVideo').classList.add('border-b-2'); document.getElementById('profileTabAsset').classList.replace('text-white', 'text-gray-500'); document.getElementById('profileTabAsset').classList.remove('border-b-2'); vGrid.classList.remove('hidden'); aGrid.classList.add('hidden'); loadProfileVideos(currentUser.id, 'profileGrid'); } 
    else { document.getElementById('profileTabAsset').classList.replace('text-gray-500', 'text-white'); document.getElementById('profileTabAsset').classList.add('border-b-2'); document.getElementById('profileTabVideo').classList.replace('text-white', 'text-gray-500'); document.getElementById('profileTabVideo').classList.remove('border-b-2'); aGrid.classList.remove('hidden'); vGrid.classList.add('hidden'); loadProfileAssets(); }
}

async function loadProfileVideos(uid, gridId) {
    const { data: videos } = await sb.from('videos').select('*').eq('uid', uid);
    const grid = document.getElementById(gridId);
    let html = ''; let totalLikes = 0;
    if(videos && videos.length > 0) {
        videos.forEach(data => {
            totalLikes += (data.likes || 0);
            html += `
            <div onclick="openSingleVideo('${data.id}', '${data.url}', '${data.user}', '${data.desc}', ${data.likes}, ${data.views})" 
                    class="aspect-[3/4] bg-black relative group overflow-hidden border border-gray-900 cursor-pointer">
                <video src="${data.url}#t=0.1" preload="metadata" muted playsinline class="w-full h-full object-cover"></video>
                <div class="absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent p-2 flex items-center text-xs font-bold">
                    <i class="fas fa-play text-white mr-1 text-[10px]"></i> ${data.views || 0}
                </div>
            </div>`;
        });
    } else { html = "<p class='col-span-3 text-center text-gray-500 py-10'>No videos yet</p>"; }
    grid.innerHTML = html;
}

window.openSingleVideo = (id, url, user, desc, likes, views) => {
    const modal = document.getElementById('singleVideoModal');
    const container = document.getElementById('singleVideoContainer');
    const isLiked = localStorage.getItem(`liked_${id}_${currentUser.id}`) ? 'text-brand-500' : 'text-white';
    container.innerHTML = `
        <div class="relative w-full h-full flex justify-center bg-black">
            <div class="absolute inset-0 z-10" onclick="togglePlay(this.parentElement.querySelector('video'), '${id}')"></div>
            <video src="${url}" loop playsinline class="h-full w-full object-contain bg-black"></video>
            <div class="absolute inset-0 flex flex-col justify-end p-4 pointer-events-none z-20">
                    <div class="mb-16 pointer-events-auto">
                    <h3 class="font-bold text-lg">@${user}</h3>
                    <p class="text-sm shadow-black drop-shadow-md">${desc}</p>
                </div>
                <div class="absolute right-4 bottom-24 flex flex-col items-center space-y-4 pointer-events-auto">
                        <div class="flex flex-col items-center"><i class="fas fa-heart text-3xl drop-shadow ${isLiked}"></i><span class="text-xs font-bold mt-1">${likes}</span></div>
                    <button onclick="openComments('${id}')" class="flex flex-col items-center"><i class="fas fa-comment-dots text-3xl drop-shadow text-white"></i><span class="text-xs font-bold mt-1">Chat</span></button>
                </div>
            </div>
        </div>`;
    modal.classList.remove('hidden');
    const vid = container.querySelector('video');
    if(vid) vid.play().catch(e => console.log("Single video play error", e));
};

window.closeSingleVideo = () => { document.getElementById('singleVideoModal').classList.add('hidden'); const vid = document.querySelector('#singleVideoContainer video'); if(vid) vid.pause(); };

async function loadProfileAssets() {
    if(!currentUser) return;
    const { data: assets } = await sb.from('assets').select('*').eq('uid', currentUser.id);
    const grid = document.getElementById('profileAssetGrid');
    let html = '';
    if(assets && assets.length > 0) { 
        assets.forEach(data => { 
            html += `
            <div class="bg-gray-800 rounded-lg overflow-hidden border border-gray-800">
                <div class="aspect-square">
                    <img src="${data.url}" class="w-full h-full object-cover">
                </div>
                <div class="p-2 text-center text-xs font-bold bg-gray-900 text-gray-400">
                        <i class="fas fa-download text-brand-500 mr-1"></i> <span id="profile_dl_${data.id}">${data.downloads || 0}</span> Downloads
                </div>
            </div>`; 
        }); 
    } 
    else { html = "<p class='col-span-2 text-center text-gray-500 py-10'>No assets</p>"; }
    grid.innerHTML = html;
}

window.saveProfileName = async () => {
    const nameInput = document.getElementById('editNameInput');
    const newName = nameInput.value.trim();

    if (!newName) return alert("Name cannot be empty");
    if (!currentUser) return alert("Please login first");

    const saveBtn = document.querySelector('#editProfileModal button:last-child');
    const originalText = saveBtn.innerText;
    saveBtn.innerText = "Saving...";
    saveBtn.disabled = true;

    try {
        const { error } = await sb.from('users').update({ username: newName }).eq('uid', currentUser.id);
        if (error) throw error;
        currentUser.displayName = newName;
        document.getElementById('profileName').innerText = newName; 
        document.getElementById('profileHeaderName').innerText = '@' + newName;
        const publicTitle = document.getElementById('publicProfileTitle');
        if(publicTitle) publicTitle.innerText = '@' + newName;
        alert("Profile Name Saved Successfully! ✅");
        closeEditProfile();
    } catch (e) {
        console.error("Save Error:", e);
        alert("Error saving name: " + e.message);
    } finally {
        saveBtn.innerText = originalText;
        saveBtn.disabled = false;
    }
};
