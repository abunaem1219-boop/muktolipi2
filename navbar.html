document.addEventListener("DOMContentLoaded", function() {
    const navStyle = document.createElement('style');
    navStyle.innerHTML = `
        body { animation: pageFadeIn 0.3s ease-out forwards; opacity: 0; padding-bottom: 80px !important; }
        body.page-exit { animation: pageFadeOut 0.2s ease-in forwards; }
        @keyframes pageFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pageFadeOut { from { opacity: 1; } to { opacity: 0; } }

        .universal-bottom-nav { 
            position: fixed !important; bottom: 12px !important; left: 50% !important; transform: translateX(-50%) !important; 
            width: 95% !important; max-width: 500px !important; height: 60px !important; display: flex !important; 
            justify-content: space-around !important; align-items: center !important; z-index: 999999 !important; 
            padding: 0 10px !important; box-sizing: border-box !important; border-radius: 30px !important; 
            background: rgba(255, 255, 255, 0.95) !important; backdrop-filter: blur(20px) !important; 
            border: 1px solid rgba(255,255,255,0.4) !important; box-shadow: 0 10px 30px rgba(0,0,0,0.15) !important; 
        }
        .dark-theme .universal-bottom-nav { background: rgba(36, 37, 38, 0.95) !important; border-color: rgba(255,255,255,0.05) !important; }
        .nav-item-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; color: #65676b; background: none; border: none; font-size: 11px; font-weight:600; cursor: pointer; width: 60px; height: 100%; transition: all 0.3s; font-family: inherit;}
        .dark-theme .nav-item-btn { color: #b0b3b8; }
        .nav-item-btn i { font-size: 20px; margin-bottom: 4px; transition: 0.3s; }
        .nav-item-btn.active { color: #1877f2; }
        .nav-item-btn.active i { transform: translateY(-3px); }
        .dark-theme .nav-item-btn.active { color: #4595ff; }
    `;
    document.head.appendChild(navStyle);

    const path = window.location.pathname.split('/').pop() || 'index.html';
    const params = new URLSearchParams(window.location.search);
    const isProfile = params.get('page') === 'profile';

    const navBar = document.createElement('nav');
    navBar.className = 'universal-bottom-nav';
    navBar.innerHTML = `
        <button class="nav-item-btn ${path === 'index.html' && !isProfile ? 'active' : ''}" onclick="smoothNavigate('index.html')">
            <i class="fas fa-home"></i>হোম
        </button>
        <button class="nav-item-btn ${path === 'friends.html' ? 'active' : ''}" onclick="smoothNavigate('friends.html')">
            <i class="fas fa-user-friends"></i>ফ্রেন্ডস
        </button>
        <button class="nav-item-btn ${path === 'appstore.html' ? 'active' : ''}" onclick="smoothNavigate('appstore.html')">
            <i class="fas fa-store"></i>স্টোর
        </button>
        <button class="nav-item-btn ${isProfile ? 'active' : ''}" onclick="smoothNavigate('index.html?page=profile')">
            <i class="fas fa-user"></i>প্রোফাইল
        </button>
    `;
    document.body.appendChild(navBar);
});

window.smoothNavigate = function(targetUrl) {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const isCurrentlyProfile = new URLSearchParams(window.location.search).get('page') === 'profile';
    const targetIsProfile = targetUrl.includes('page=profile');
    const targetPath = targetUrl.split('?')[0] || 'index.html';

    if ((currentPath === targetPath && isCurrentlyProfile === targetIsProfile)) {
        if(currentPath === 'index.html' && typeof navTo === 'function') navTo(targetIsProfile ? 'profile' : 'home');
        return;
    }
    document.body.classList.add('page-exit');
    setTimeout(() => { window.location.href = targetUrl; }, 200);
};