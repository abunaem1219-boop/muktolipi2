// --- navbar.js (Fixed Free Icons & Professional Opacity Design) ---
document.addEventListener("DOMContentLoaded", function() {
    const navStyle = document.createElement('style');
    navStyle.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap');

        body { 
            animation: pageFadeIn 0.25s cubic-bezier(0.25, 1, 0.5, 1) forwards; 
            opacity: 0; 
            padding-top: 104px !important; 
            padding-bottom: 0 !important;
            font-family: 'Inter', 'Hind Siliguri', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        body.page-exit { animation: pageFadeOut 0.15s ease-in forwards; }
        @keyframes pageFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pageFadeOut { from { opacity: 1; } to { opacity: 0; } }

        /* হেডার কন্টেইনার */
        .fb-header-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            z-index: 99999;
            background: #ffffff;
            border-bottom: 1px solid #e5e5e5;
            transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        
        /* ডার্ক থিম সাপোর্ট */
        .dark-theme .fb-header-container,
        .dark .fb-header-container,
        [data-theme="dark"] .fb-header-container {
            background: #18191a;
            border-bottom: 1px solid #2f3031;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }
        
        .fb-header-container.header-hide {
            transform: translateY(-56px); 
        }

        /* প্রথম সারি */
        .fb-top-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 56px;
            padding: 0 16px;
            position: relative;
        }
        
        /* ব্র্যান্ড লোগো */
        .fb-brand-logo {
            font-family: 'Hind Siliguri', 'Inter', sans-serif;
            font-size: 26px;
            color: #1877f2;
            text-decoration: none;
            font-weight: 700;
            letter-spacing: -0.5px;
            user-select: none;
            transition: opacity 0.15s;
        }
        
        .dark-theme .fb-brand-logo,
        .dark .fb-brand-logo,
        [data-theme="dark"] .fb-brand-logo {
            color: #ffffff;
        }
        
        .fb-brand-logo:active {
            opacity: 0.8;
        }
        
        .fb-action-buttons {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        /* সার্কেল বাটনসমূহ */
        .fb-circle-btn {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #e4e6eb;
            border: none;
            color: #050505;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            position: relative;
            outline: none;
            -webkit-tap-highlight-color: transparent;
            transition: background 0.15s, transform 0.1s;
        }
        
        .dark-theme .fb-circle-btn,
        .dark .fb-circle-btn,
        [data-theme="dark"] .fb-circle-btn {
            background: #3a3b3c;
            color: #e4e6eb;
        }
        
        .fb-circle-btn:active {
            transform: scale(0.90);
        }
        
        .fb-circle-btn:hover {
            background: #d8dadf;
        }
        
        .dark-theme .fb-circle-btn:hover,
        .dark .fb-circle-btn:hover,
        [data-theme="dark"] .fb-circle-btn:hover {
            background: #4e4f50;
        }
        
        /* নোটিফিকেশন ব্যাজ */
        .fb-badge {
            position: absolute;
            top: -3px;
            right: -3px;
            background: #e41e3f;
            color: white;
            border-radius: 50%;
            min-width: 19px;
            height: 19px;
            font-size: 11px;
            font-weight: 700;
            display: none; 
            align-items: center;
            justify-content: center;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.15);
            padding: 0 4px;
            box-sizing: border-box;
        }
        
        .dark-theme .fb-badge,
        .dark .fb-badge,
        [data-theme="dark"] .fb-badge {
            border: 2px solid #18191a;
        }
        
        .fb-badge.active {
            display: flex !important;
            animation: popBadge 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.3);
        }
        
        @keyframes popBadge {
            0% { transform: scale(0.4); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }

        /* দ্বিতীয় সারি: ট্যাব বার */
        .fb-tab-row {
            display: flex;
            height: 48px;
            width: 100%;
            position: relative;
        }
        
        .fb-tab-item {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            background: none;
            border: none;
            color: #65676b; /* সাধারণ ধূসর রঙ */
            opacity: 0.65; /* নিষ্ক্রিয় ট্যাবের জন্য অপাসিটি */
            cursor: pointer;
            position: relative;
            height: 100%;
            outline: none;
            -webkit-tap-highlight-color: transparent;
            padding: 0;
            z-index: 2;
            transition: color 0.2s ease, opacity 0.2s ease;
        }
        
        .dark-theme .fb-tab-item,
        .dark .fb-tab-item,
        [data-theme="dark"] .fb-tab-item {
            color: #b0b3b8;
            opacity: 0.7;
        }
        
        .fb-tab-item i {
            font-size: 22px; 
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.2);
        }
        
        .fb-tab-item:active i {
            transform: scale(0.85);
        }
        
        .fb-tab-item:hover {
            color: #050505;
            opacity: 1;
        }
        
        .dark-theme .fb-tab-item:hover,
        .dark .fb-tab-item:hover,
        [data-theme="dark"] .fb-tab-item:hover {
            color: #e4e6eb;
            opacity: 1;
        }
        
        /* একটিভ ট্যাব স্টাইল */
        .fb-tab-item.active {
            color: #1877f2 !important;
            opacity: 1 !important;
        }
        
        .dark-theme .fb-tab-item.active,
        .dark .fb-tab-item.active,
        [data-theme="dark"] .fb-tab-item.active {
            color: #ffffff !important;
            opacity: 1 !important;
        }
        
        .fb-active-indicator {
            position: absolute;
            bottom: 0;
            height: 3px;
            background: #1877f2;
            border-radius: 4px 4px 0 0;
            z-index: 1;
            transition: left 0.25s cubic-bezier(0.1, 0.8, 0.2, 1), width 0.25s cubic-bezier(0.1, 0.8, 0.2, 1);
            pointer-events: none;
            will-change: transform, left, width;
        }
        
        .dark-theme .fb-active-indicator,
        .dark .fb-active-indicator,
        [data-theme="dark"] .fb-active-indicator {
            background: #ffffff;
        }
        
        .fb-tab-item::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0);
            width: 48px;
            height: 36px;
            border-radius: 8px;
            background: rgba(0, 0, 0, 0.05);
            transition: transform 0.2s ease;
            z-index: -1;
        }
        
        .dark-theme .fb-tab-item::after,
        .dark .fb-tab-item::after,
        [data-theme="dark"] .fb-tab-item::after {
            background: rgba(255, 255, 255, 0.08);
        }
        
        .fb-tab-item:hover::after {
            transform: translate(-50%, -50%) scale(1);
        }
        
        .fb-tab-item.active::after {
            display: none;
        }

        /* --- ফেসবুক স্টাইল প্রফেশনাল ডার্ক ড্রপডাউন --- */
        .fb-create-dropdown {
            position: absolute;
            top: 54px;
            right: 16px;
            width: 210px;
            background: #242526; 
            border-radius: 14px;
            box-shadow: 0 12px 28px 0 rgba(0, 0, 0, 0.35), 0 2px 4px 0 rgba(0, 0, 0, 0.1);
            display: none;
            flex-direction: column;
            padding: 6px;
            z-index: 100005;
            border: 1px solid rgba(255, 255, 255, 0.08);
            transform-origin: top right;
            transition: opacity 0.15s ease, transform 0.15s ease;
            opacity: 0;
            transform: scale(0.9);
        }
        .fb-create-dropdown.show {
            display: flex;
            opacity: 1;
            transform: scale(1);
        }
        .fb-dropdown-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            background: transparent;
            border: none;
            color: #e4e6eb; 
            font-size: 15px;
            font-weight: 600;
            text-align: left;
            cursor: pointer;
            width: 100%;
            transition: background-color 0.15s;
            outline: none;
            font-family: 'Inter', 'Hind Siliguri', sans-serif;
            border-radius: 8px;
        }
        .fb-dropdown-item:hover, .fb-dropdown-item:active {
            background-color: rgba(255, 255, 255, 0.08);
        }
        .fb-dropdown-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            color: #e4e6eb;
            width: 24px;
            height: 24px;
            flex-shrink: 0;
        }
    `;
    document.head.appendChild(navStyle);

    const path = window.location.pathname.split('/').pop() || 'index.html';
    const params = new URLSearchParams(window.location.search);
    const isProfile = params.get('page') === 'profile';

    const isHome = path === 'index.html' && !isProfile;
    const isFriends = path === 'friends.html';
    const isStore = path === 'appstore.html';
    const isReels = path === 'reels.html';
    const isNotifications = path === 'notifications.html';

    const fbHeader = document.createElement('div');
    fbHeader.className = 'fb-header-container';
    fbHeader.id = 'fbHeaderContainer';

    fbHeader.innerHTML = `
        <!-- প্রথম সারি (Brand & Actions) -->
        <div class="fb-top-row">
            <a href="javascript:void(0)" onclick="smoothNavigate('index.html')" class="fb-brand-logo">মুক্তলিপি</a>
            <div class="fb-action-buttons">
                <!-- প্লাস আইকন -->
                <button class="fb-circle-btn" onclick="handlePlusAction(event)" title="তৈরি করুন">
                    <i class="fa-solid fa-plus" style="font-size: 18px;"></i>
                </button>
                <!-- সার্চ আইকন -->
                <button class="fb-circle-btn" onclick="handleSearchAction()" title="খুঁজুন">
                    <i class="fa-solid fa-magnifying-glass" style="font-size: 16px;"></i>
                </button>
                <!-- মেসেঞ্জার বাটন -->
                <button class="fb-circle-btn" onclick="smoothNavigate('chat.html')" title="মেসেজ">
                    <i class="fa-brands fa-facebook-messenger" style="font-size: 18px;"></i>
                    <span id="msgBadge" class="fb-badge">0</span>
                </button>
            </div>

            <!-- ড্রপডাউন পপআপ সরাসরি হেডারে ইনজেক্ট করা হলো -->
            <div id="fbCreateDropdown" class="fb-create-dropdown">
                <button class="fb-dropdown-item" onclick="handleMenuClick('post')">
                    <div class="fb-dropdown-icon">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </div>
                    <span>Post</span>
                </button>
                <button class="fb-dropdown-item" onclick="handleMenuClick('story')">
                    <div class="fb-dropdown-icon">
                        <i class="fa-solid fa-circle-plus"></i>
                    </div>
                    <span>Story</span>
                </button>
                <button class="fb-dropdown-item" onclick="handleMenuClick('reel')">
                    <div class="fb-dropdown-icon">
                        <i class="fa-solid fa-clapperboard"></i>
                    </div>
                    <span>Reel</span>
                </button>
                <button class="fb-dropdown-item" onclick="handleMenuClick('live')">
                    <div class="fb-dropdown-icon">
                        <i class="fa-solid fa-video"></i>
                    </div>
                    <span>Live</span>
                </button>
                <button class="fb-dropdown-item" onclick="handleMenuClick('note')">
                    <div class="fb-dropdown-icon">
                        <i class="fa-solid fa-comment-dots"></i>
                    </div>
                    <span>Note</span>
                </button>
            </div>
        </div>
        
        <!-- দ্বিতীয় সারি (Navigation Tabs - 100% Free Icons) -->
        <div class="fb-tab-row" id="fbTabRow">
            <!-- হোম ট্যাব (Solid Version For Both, Opacity Handled) -->
            <button class="fb-tab-item ${isHome ? 'active' : ''}" data-tab="home" onclick="handleTabClick(this, 'index.html')" title="হোম">
                <i class="fa-solid fa-house"></i>
            </button>

            <!-- রিলস ট্যাব (Regular/Solid Free Both Available) -->
            <!-- রিলস ট্যাব -->
            <button class="fb-tab-item ${isReels ? 'active' : ''}" data-tab="reels" onclick="handleTabClick(this, 'reels.html')" title="রিলস">
                <i class="fa-solid fa-circle-play"></i>
            </button>

            <!-- অ্যাপ স্টোর ট্যাব (Solid Version For Both, Opacity Handled) -->
<button class="fb-tab-item ${isStore ? 'active' : ''}" data-tab="store" onclick="handleTabClick(this, 'appstore.html')" title="অ্যাপ স্টোর">
    <i class="fa-solid fa-store"></i>
</button>

            <!-- ফ্রেন্ডস ট্যাব (Solid Version For Both, Opacity Handled) -->
<button class="fb-tab-item ${isFriends ? 'active' : ''}" data-tab="friends" onclick="handleTabClick(this, 'friends.html')" title="বন্ধুরা">
    <i class="fa-solid fa-user-group"></i>
</button>

          <!-- নোটিফিকেশন ট্যাব -->
<button class="fb-tab-item ${isNotifications ? 'active' : ''}" data-tab="notifications" onclick="handleTabClick(this, 'notifications.html')" title="নোটিফিকেশন">
    <i class="fa-regular fa-bell" id="notifBellIcon"></i>
    <span id="notifBadge" class="fb-badge">0</span>
</button>

            <!-- মেনু ট্যাব -->
            <button class="fb-tab-item" data-tab="menu" onclick="handleTabClick(this, 'menu'); handleMenuTab();" title="মেনু">
                <i class="fa-solid fa-bars"></i>
            </button>

            <div class="fb-active-indicator" id="fbActiveIndicator"></div>
        </div>
    `;
    
    document.body.insertBefore(fbHeader, document.body.firstChild);

    window.updateIndicator = function() {
        const activeTab = document.querySelector('.fb-tab-item.active');
        const indicator = document.getElementById('fbActiveIndicator');
        const tabRow = document.getElementById('fbTabRow');
        
        if (activeTab && indicator && tabRow) {
            const activeRect = activeTab.getBoundingClientRect();
            const rowRect = tabRow.getBoundingClientRect();
            
            const left = activeRect.left - rowRect.left;
            const width = activeRect.width;
            
            const margin = width * 0.20; 
            indicator.style.left = `${left + margin}px`;
            indicator.style.width = `${width - (margin * 2)}px`;
        }
    };

    setTimeout(window.updateIndicator, 50);

    window.addEventListener('resize', window.updateIndicator);
    window.addEventListener('orientationchange', function() {
        setTimeout(window.updateIndicator, 200);
    });

    let lastScrollTop = 0;
    const headerContainer = document.getElementById('fbHeaderContainer');

    window.addEventListener('scroll', function() {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (scrollTop > lastScrollTop && scrollTop > 60) {
            headerContainer.classList.add('header-hide');
        } else {
            headerContainer.classList.remove('header-hide');
        }
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; 
    }, { passive: true });

    // ক্লিক ছাড়া বাইরে কোথাও স্পর্শ করলে পপআপ যেন বন্ধ হয়ে যায়
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('fbCreateDropdown');
        if (dropdown && dropdown.classList.contains('show')) {
            const plusBtn = document.querySelector('.fb-circle-btn[onclick*="handlePlusAction"]');
            if (plusBtn && !plusBtn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('show');
                setTimeout(() => { dropdown.style.display = 'none'; }, 150);
            }
        }
    });
});

// প্লাস বাটন চাপলে ডাইনামিক মেনু টগল করা
window.handlePlusAction = function(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('fbCreateDropdown');
    if (dropdown) {
        const isClosed = !dropdown.classList.contains('show');
        if (isClosed) {
            dropdown.style.display = 'flex';
            dropdown.offsetHeight; // force reflow for smooth transition
            dropdown.classList.add('show');
        } else {
            dropdown.classList.remove('show');
            setTimeout(() => { dropdown.style.display = 'none'; }, 150);
        }
    }
};

// মেনুর আইটেমে ক্লিকে অ্যাকশন হ্যান্ডলার (মাল্টি-পেজ কম্প্যাটিবিলিটিসহ)
window.handleMenuClick = function(action) {
    const dropdown = document.getElementById('fbCreateDropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
        setTimeout(() => { dropdown.style.display = 'none'; }, 150);
    }

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const isHome = currentPath === 'index.html' && !(new URLSearchParams(window.location.search).get('page') === 'profile');

    if (action === 'post') {
        if (isHome && typeof window.openWriteModal === 'function') {
            window.openWriteModal();
        } else {
            window.location.href = "index.html?action=write";
        }
    } else if (action === 'story') {
        if (isHome && typeof window.openStoryCreator === 'function') {
            window.openStoryCreator();
        } else {
            window.location.href = "index.html?action=story";
        }
    } else if (action === 'reel') {
        window.location.href = "reels.html";
    } else if (action === 'live') {
        Swal.fire({
            title: 'Live ফিচারটি তৈরি হচ্ছে!',
            text: 'খুব শীঘ্রই নতুন আপডেটে লাইভ অপশনটি যুক্ত করা হবে।',
            icon: 'info',
            iconColor: '#1877f2',
            confirmButtonText: 'ঠিক আছে',
            confirmButtonColor: '#1877f2',
        });
    } else if (action === 'note') {
        Swal.fire({
            title: 'Note ফিচারটি তৈরি হচ্ছে!',
            text: 'খুব শীঘ্রই নতুন আপডেটে নোট অপশনটি যুক্ত করা হবে।',
            icon: 'info',
            iconColor: '#1877f2',
            confirmButtonText: 'ঠিক আছে',
            confirmButtonColor: '#1877f2',
        });
    }
};

// ট্যাব পরিবর্তন ও আউটলাইন থেকে সলিড আইকন স্টেট টগল (Fixed for Free version)
window.handleTabClick = function(tabElement, targetUrl) {
    // নিষ্ক্রিয় ট্যাবগুলোর অপাসিটি কমানো এবং বেল আইকন রেগুলার মোডে ফিরিয়ে আনা
    document.querySelectorAll('.fb-tab-item').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const bellIcon = document.getElementById('notifBellIcon');
    if(bellIcon) {
        bellIcon.classList.remove('fa-solid');
        bellIcon.classList.add('fa-regular');
    }
    
    // বর্তমান ক্লিক করা ট্যাব সক্রিয় করা
    tabElement.classList.add('active');
    
    // যদি নোটিফিকেশন ট্যাবে ক্লিক করা হয়, তবে বেল আইকনটি সলিড (Solid) হবে
    if (tabElement.getAttribute('data-tab') === 'notifications' && bellIcon) {
        bellIcon.classList.remove('fa-regular');
        bellIcon.classList.add('fa-solid');
    }
    
    if (typeof window.updateIndicator === 'function') {
        window.updateIndicator();
    }

    // ভুল অংশগুলো ফেলে দিয়ে শুধু এই 'if' কন্ডিশনটুকু রাখবেন:
    if (targetUrl !== 'menu' && targetUrl !== 'notifications') {
        setTimeout(() => {
            window.smoothNavigate(targetUrl);
        }, 200);
    }
}; // এই ব্র্যাকেট দিয়ে ফাংশনটি শেষ হবে

window.smoothNavigate = function(targetUrl) {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const isCurrentlyProfile = new URLSearchParams(window.location.search).get('page') === 'profile';
    const targetIsProfile = targetUrl.includes('page=profile');
    const targetPath = targetUrl.split('?')[0] || 'index.html';

    if ((currentPath === targetPath && isCurrentlyProfile === targetIsProfile)) {
        if(currentPath === 'index.html' && typeof window.navTo === 'function') {
            window.navTo(targetIsProfile ? 'profile' : 'home');
        }
        return;
    }
    document.body.classList.add('page-exit');
    setTimeout(() => { window.location.href = targetUrl; }, 180);
};

window.handleSearchAction = function() {
    if (typeof window.toggleHeaderSearch === 'function') {
        window.toggleHeaderSearch(true);
    } else {
        window.location.href = "index.html?action=search";
    }
};

window.handleNotificationTab = function() {
    if (typeof window.showNotifications === 'function') {
        window.showNotifications();
    } else {
        window.location.href = "index.html?action=notifications";
    }
};

window.handleMenuTab = function() {
    if (typeof window.openDrawer === 'function') {
        window.openDrawer();
    } else {
        window.location.href = "index.html?action=menu";
    }
};
window.showReelsComingSoon = function() {
    Swal.fire({
        title: 'রিলস ফিচারটি তৈরি হচ্ছে!',
        text: 'খুব শীঘ্রই নতুন আপডেটে রিলস অপশনটি যুক্ত করা হবে।',
        icon: 'info',
        iconColor: '#1877f2',
        confirmButtonText: 'ঠিক আছে',
        confirmButtonColor: '#1877f2',
    });
};