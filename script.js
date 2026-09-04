       import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getDatabase, ref, push, set, onValue, update, remove, get, query, orderByKey, limitToLast, endBefore, equalTo, orderByChild, onChildAdded, onDisconnect, runTransaction, off, startAt, endAt, limitToFirst, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
        import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, updateProfile, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signInWithCredential } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
        // Import External Stories Module
import { initStoriesSystem, openStoryViewer, closeStoryViewer } from "./stories.js";
        const ADMIN_UID = "5tgxvUP6z9bgC2DSRoi1hsDFvzW2"; 

        const firebaseConfig = {
            apiKey: "AIzaSyBZtycgadrngON2WEwvIE7ERPYxdkDVfFM",
            authDomain: "muktolipidiary.firebaseapp.com",
            databaseURL: "https://muktolipidiary-default-rtdb.firebaseio.com",
            projectId: "muktolipidiary",
            storageBucket: "muktolipidiary.firebasestorage.app",
            messagingSenderId: "639103995400",
            appId: "1:639103995400:web:13528e51c0e86080770bbd"
        };

        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);
        const auth = getAuth(app);
        const provider = new GoogleAuthProvider();

        // --- CLOUDINARY CONFIGURATION ---
        // REPLACE THESE WITH YOUR ACTUAL CLOUDINARY CREDENTIALS
        const CLOUDINARY_CLOUD_NAME = "dvvx2frpu"; 
        const CLOUDINARY_UPLOAD_PRESET = "story_upload"; 
// ক্লাউডিনারি এপিআই আপলোডার ফাংশন
        window.uploadToCloudinary = async function(fileOrBlob) {
            const formData = new FormData();
            formData.append('file', fileOrBlob);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Cloudinary upload failed');
            }

            const data = await response.json();
            return data.secure_url; // এটি ইমেজটির সিকিউর HTTPS লিঙ্ক রিটার্ন করবে
        };
        window.allPosts = []; 
        window.allComments = {}; 
        window.db = db; window.ref = ref; window.push = push; window.set = set; window.update = update; window.remove = remove; window.runTransaction = runTransaction;
        window.currentUser = null;
        window.blockedUsers = []; 
        window.userVerificationCache = {}; 
        window.mentionedUids = []; 

        // --- NEW REACTION CONSTANTS ---
        window.reactionEmojiMap = {
            like: "👍",
            love: "❤️",
            care: "😘",
            haha: "😂", 
            wow: "😮",  
            sad: "😢",
            angry: "😡"
        };

        const reactionAssets = {
            like: 'emoji/like.gif',
            love: 'emoji/love.gif',
            care: 'emoji/care.gif',
            haha: 'emoji/haha.gif', 
            wow: 'emoji/wow.gif',   
            sad: 'emoji/sad.gif',
            angry: 'emoji/angry.gif',

            staticLike: 'far fa-thumbs-up', 
            solidLike: 'fas fa-thumbs-up'
        };

        const BAD_WORDS = ["খারাপ", "গালাগালি", "অশ্লীল", "কুত্তা", "শয়তান", "ফালতু", "haram", "kharap", "gali"];

        const DEVICE_ID = localStorage.getItem('USER_DEVICE_ID') || 'u_' + Date.now();
        localStorage.setItem('USER_DEVICE_ID', DEVICE_ID);

        let lastLoadedKey = null;
        let isLoadingPosts = false;
        let reachedEnd = false;
        let activeCategoryFilter = 'সব';
        let currentlyViewingUid = null;
        let replyingToCommentId = null;

        // --- CHAT VARIABLES ---
        let activeChatId = null;
        let activeChatPartnerUid = null;
        let typingTimeout = null;

        // --- COMMENT REACTION VARIABLES ---
        let commentPressTimer = null;
        let isCommentLongPress = false;

        window.imgError = function(image) {
            image.onerror = ""; 
            const type = image.getAttribute('data-type') || 'like';
            const fallbacks = {
                like: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Facebook_Like_2016.svg/100px-Facebook_Like_2016.svg.png',
                love: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Facebook_Love_2016.svg/100px-Facebook_Love_2016.svg.png',
                care: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Facebook_Care_Reaction.png/100px-Facebook_Care_Reaction.png',
                haha: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Facebook_Haha_2016.svg/100px-Facebook_Haha_2016.svg.png', 
                wow: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Facebook_Wow_2016.svg/100px-Facebook_Wow_2016.svg.png',
                sad: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Facebook_Sad_2016.svg/100px-Facebook_Sad_2016.svg.png',
                angry: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Facebook_Angry_2016.svg/100px-Facebook_Angry_2016.svg.png'
            };
            image.src = fallbacks[type] || fallbacks.like;
            image.style.transform = "scale(0.8)";
            return true;
        };

        window.formatPostContent = function(text) {
            if (!text) return '';
            let formatted = text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" style="color:var(--primary-color); text-decoration:underline;" onclick="event.stopPropagation()">$1</a>');
            formatted = formatted.replace(/#(\w+)/g, '<span class="hashtag" onclick="event.stopPropagation(); filterPosts(\'#$1\')">#$1</span>');
            formatted = formatted.replace(/@([\w\u0980-\u09FF\s]+)/g, function(match, name) {
                return `<span class="mentioned-link">${match}</span>`;
            });
            return formatted;
        };

        window.compressImage = function(file) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 1200;
                        let width = img.width;
                        let height = img.height;
                        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                        canvas.width = width; canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        canvas.toBlob((blob) => { resolve(new File([blob], file.name, {type:'image/jpeg', lastModified:Date.now()})); }, 'image/jpeg', 0.8); 
                    };
                    img.onerror = () => resolve(file); 
                };
                reader.onerror = () => resolve(file); 
            });
        };

        window.getVerifiedBadge = function(isVerified) {
            return isVerified ? `<i class="fas fa-certificate verified-badge" style="color: #1877f2; position: relative;">
                <i class="fas fa-check" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 10px; color: white;"></i>
            </i>` : '';
        };

        window.fetchBlockedUsers = function(uid) {
            return get(ref(db, `users/${uid}/blockedUsers`)).then(snap => {
                if(snap.exists()) {
                    window.blockedUsers = Object.keys(snap.val());
                } else {
                    window.blockedUsers = [];
                }
            }).catch(err => {
                console.error("Error fetching blocked users:", err);
                window.blockedUsers = [];
            });
        };

 // --- AUTH & INIT ---
        onAuthStateChanged(auth, async (user) => {
            window.currentUser = user;

            if (user) {
    // ১. অ্যান্ড্রয়েড অ্যাপে ওয়ানসিগন্যাল লগইন সিগন্যাল পাঠানো
    if (window.AndroidInterface) {
        window.AndroidInterface.loginOneSignal(user.uid);
    }

    // ----- এই নতুন ব্যাকআপ কোডটুকু এখানে যুক্ত করুন -----
    setTimeout(() => {
        if (window.AndroidInterface) {
            window.AndroidInterface.loginOneSignal(user.uid);
        }
    }, 2000);

                // ২. রাইট বক্সের প্রোফাইল পিকচার সেট করা
                const writeAvatar = document.getElementById('writeBoxAvatar');
                if (writeAvatar) {
                    writeAvatar.src = user.photoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
                }

                // ৩. ওয়ানসিগন্যাল ওয়েব লগইন
                window.OneSignalDeferred.push(function(OneSignal) {
                    OneSignal.login(user.uid);
                });

                await fetchBlockedUsers(user.uid);
                syncUserProfile(user);
                document.getElementById('loginModal').style.display = 'none';
                initNotificationListener(user.uid);
                initChatListener(user.uid); 

                // --- PRESENCE SYSTEM (ONLINE STATUS) ---
                const connectedRef = ref(db, '.info/connected');
                const myStatusRef = ref(db, 'status/' + user.uid);
                const myPresenceRef = ref(db, 'presence/' + user.uid);

                onValue(connectedRef, (snap) => {
                    if (snap.val() === true) {
                        onDisconnect(myStatusRef).remove();
                        set(myStatusRef, { state: 'online', last_changed: Date.now() });

                        set(myPresenceRef, { online: true, lastSeen: serverTimestamp() });
                        onDisconnect(myPresenceRef).set({ online: false, lastSeen: serverTimestamp() });
                    }
                });

               // গুগলের আনব্লকড ও সুপার-ফাস্ট ডিফল্ট প্রোফাইল ইমেজ ব্যবহার
const userPhoto = user.photoURL || 'https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png';

if (writeAvatar) {
    writeAvatar.src = userPhoto;
}

if (document.getElementById('yourStoryBg')) {
     document.getElementById('yourStoryBg').style.backgroundImage = `url('${userPhoto}')`;
}
// এক্সটার্নাল স্টোরি মডিউল শুরু ও লোড করা
initStoriesSystem(db, auth);

                const urlParams = new URLSearchParams(window.location.search);
                const targetUid = urlParams.get('uid');
                if(targetUid) {
                    window.location.href = `profile.html?uid=${targetUid}`;
                    return;
                }

            } else {
                // ৪. অ্যান্ড্রয়েড অ্যাপ থেকে ওয়ানসিগন্যাল লগআউট সিগন্যাল পাঠানো
                if (window.AndroidInterface) {
                    window.AndroidInterface.logoutOneSignal();
                }

                // ৫. ওয়ানসিগন্যাল ওয়েব লগআউট
                window.OneSignalDeferred.push(function(OneSignal) {
                    OneSignal.logout();
                });

                window.blockedUsers = [];
                localStorage.removeItem('IS_ADMIN');

                // লগআউট হলে নোটিফিকেশন ব্যাজ বন্ধ করা
                const notifBadge = document.getElementById('notifBadge');
                const msgBadge = document.getElementById('msgBadge');
                if (notifBadge) notifBadge.classList.remove('active');
                if (msgBadge) msgBadge.classList.remove('active');
            }

            updateAuthUI(user);
        });

        window.performLogin = () => {
    if (window.AndroidInterface) {
        // মোবাইল আইডিই অ্যাপে থাকলে নেটিভ গুগল লগইন উইন্ডো সচল করবে
        window.AndroidInterface.triggerGoogleLogin();
    } else {
        // পিসি বা সাধারণ ব্রাউজার থেকে চললে আগের ফায়ারবেস পপ-আপ কাজ করবে
        signInWithPopup(auth, provider).catch(console.error);
    }
};

        window.logoutFunc = () => signOut(auth).then(() => { showToast("লগআউট হয়েছে"); window.location.href = window.location.origin; });

        function updateAuthUI(user) {
            const drawerLogout = document.getElementById('drawerLogoutBtn');
            if(user) {
                document.getElementById('userAvatar').src = user.photoURL;
                document.getElementById('userName').innerText = user.displayName;
                document.getElementById('submitBtn').disabled = false;
                if(drawerLogout) drawerLogout.style.display = 'flex';
            } else {
                if(drawerLogout) drawerLogout.style.display = 'none';
            }
        }


        window.loadAuthBanners = function() {
            const bannerUrl = localStorage.getItem('my_banner2.jpg');
            if (bannerUrl) {
                const loginBanner = document.getElementById('loginBanner');
                if (loginBanner) {
                    loginBanner.style.backgroundImage = `url(${bannerUrl})`;
                    loginBanner.style.backgroundSize = 'cover'; loginBanner.style.backgroundPosition = 'center';
                }
                const signupBanner = document.getElementById('signupBanner');
                if (signupBanner) {
                    signupBanner.style.backgroundImage = `url(${bannerUrl})`;
                    signupBanner.style.backgroundSize = 'cover'; signupBanner.style.backgroundPosition = 'center';
                }
            }
        }
        document.addEventListener('DOMContentLoaded', loadAuthBanners);

        window.togglePasswordVisibility = function(inputId) {
            const input = document.getElementById(inputId);
            const icon = input.nextElementSibling.querySelector('i');
            if (input.type === 'password') { input.type = 'text'; icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); } 
            else { input.type = 'password'; icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
        }

        window.handleEmailLogin = async function() {
            const username = document.getElementById('loginEmailUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            if (!username || !password) { Swal.fire({icon: 'warning', title: 'সতর্কতা!', text: 'দয়া করে সকল তথ্য পূরণ করুন', confirmButtonText: 'ঠিক আছে'}); return; }
            const email = `${username}@gmail.com`;
            Swal.fire({title: 'লগইন করা হচ্ছে...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
            try {
                await signInWithEmailAndPassword(auth, email, password);
                Swal.fire({icon: 'success', title: 'সফল!', text: 'লগইন সফল হয়েছে', timer: 1500, showConfirmButton: false});
                setTimeout(() => { window.location.reload(); }, 1500);
            } catch (error) {
                Swal.fire({icon: 'error', title: 'লগইন ব্যর্থ', text: 'সঠিক তথ্য দিন অথবা ইন্টারনেট সংযোগ পরীক্ষা করুন', confirmButtonText: 'আবার চেষ্টা করুন'});
            }
        }

        window.handleForgotPassword = async function() {
            const { value: username } = await Swal.fire({title: 'পাসওয়ার্ড রিসেট', input: 'text', inputLabel: 'আপনার ইমেইল (শুধুমাত্র @gmail.com এর আগের অংশ)', inputPlaceholder: 'উদাহরণ: yourusername', showCancelButton: true, confirmButtonText: 'রিসেট লিংক পাঠান', cancelButtonText: 'বাতিল'});
            if (username) {
                const email = `${username}@gmail.com`;
                try { await sendPasswordResetEmail(auth, email); Swal.fire('সফল!', 'পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে', 'success'); } 
                catch (error) { Swal.fire('ত্রুটি', 'পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে।', 'error'); }
            }
        }

        window.showSignupModal = function() { document.getElementById('signupModal').style.display = 'flex'; document.getElementById('loginModal').style.display = 'none'; }
        window.closeSignupModal = function() { document.getElementById('signupModal').style.display = 'none'; }
        window.showLoginModal = function() { closeSignupModal(); document.getElementById('loginModal').style.display = 'flex'; }

        window.handleEmailSignup = async function() {
            const name = document.getElementById('signupName').value.trim();
            const username = document.getElementById('signupEmailUsername').value.trim();
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('signupConfirmPassword').value;
            if (!name || !username || !password || !confirmPassword) { Swal.fire({icon: 'warning', title: 'সতর্কতা!', text: 'সকল তথ্য পূরণ করুন', confirmButtonText: 'ঠিক আছে'}); return; }
            if (password.length < 6) { Swal.fire({icon: 'warning', title: 'দুর্বল পাসওয়ার্ড', text: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', confirmButtonText: 'ঠিক আছে'}); return; }
            if (password !== confirmPassword) { Swal.fire({icon: 'error', title: 'ত্রুটি', text: 'পাসওয়ার্ড মিলছে না', confirmButtonText: 'ঠিক আছে'}); return; }

            const email = `${username}@gmail.com`;
            Swal.fire({title: 'একাউন্ট তৈরি করা হচ্ছে...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                await updateProfile(user, { displayName: name });
                await set(ref(db, `users/${user.uid}`), { displayName: name, email: email, photoURL: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', createdAt: new Date().toISOString(), isVerified: false });
                closeSignupModal();
                Swal.fire({icon: 'success', title: 'স্বাগতম!', text: 'একাউন্ট তৈরি সফল হয়েছে', confirmButtonText: 'প্রোফাইল আপডেট করুন', showCancelButton: true, cancelButtonText: 'পরে'}).then((r) => { if(r.isConfirmed) openProfileEdit(); else window.location.reload(); });
            } catch (error) { Swal.fire({icon: 'error', title: 'ত্রুটি', text: 'একাউন্ট তৈরি ব্যর্থ। ইমেইলটি ব্যবহৃত হতে পারে।', confirmButtonText: 'চেষ্টা করুন'}); }
        }

        window.handleGoogleSignup = async function() {
            Swal.fire({title: 'Google সাইনআপ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
            try {
                const result = await signInWithPopup(auth, provider);
                const user = result.user;
                const userRef = ref(db, `users/${user.uid}`);
                const snap = await get(userRef);
                if(!snap.exists()) {
                    await set(userRef, { displayName: user.displayName, email: user.email, photoURL: user.photoURL, createdAt: new Date().toISOString(), isVerified: false });
                    closeSignupModal();
                    Swal.fire({icon: 'success', title: 'স্বাগতম!', confirmButtonText: 'প্রোফাইল আপডেট', showCancelButton: true}).then((r) => { if(r.isConfirmed) openProfileEdit(); else window.location.reload(); });
                } else {
                    Swal.fire({icon: 'success', title: 'সফল!', text: 'লগইন সফল', timer:1500, showConfirmButton:false});
                    setTimeout(() => window.location.reload(), 1500);
                }
            } catch (error) { Swal.fire({icon: 'error', title: 'ত্রুটি', text: 'Google সাইনআপ ব্যর্থ'}); }
        }

        // --- PROFILE EDIT FUNCTIONS (NEW) ---
        let selectedProfilePhoto = null;
        let selectedCoverPhoto = null;

        window.openProfileEdit = async function() {
            const user = auth.currentUser;
            if(!user) return;
            const snap = await get(ref(db, `users/${user.uid}`));
            if(snap.exists()){
                const d = snap.val();
                document.getElementById('editName').value = d.displayName || '';
                document.getElementById('editBio').value = d.bio || '';
                document.getElementById('editFacebook').value = d.socialLinks?.facebook || '';
                document.getElementById('editYoutube').value = d.socialLinks?.youtube || '';
                document.getElementById('editTiktok').value = d.socialLinks?.tiktok || '';
                document.getElementById('editWhatsapp').value = d.socialLinks?.whatsapp || '';
                document.getElementById('profilePhotoPreview').src = d.photoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
                document.getElementById('coverPhotoImg').src = d.coverURL || '';
                document.getElementById('bioCharCounter').innerText = (d.bio||'').length + "/150";
            }
            document.getElementById('profileEditModal').style.display = 'flex';
        }
        window.closeProfileEdit = function() { document.getElementById('profileEditModal').style.display = 'none'; selectedProfilePhoto = null; selectedCoverPhoto = null; }

        window.triggerProfileUpload = () => document.getElementById('profilePhotoInput').click();
        window.handleProfilePhotoSelect = (e) => {
            const file = e.target.files[0]; if(!file) return;
            const reader = new FileReader(); reader.onload = (e) => document.getElementById('profilePhotoPreview').src = e.target.result;
            reader.readAsDataURL(file); selectedProfilePhoto = file;
        }
        window.triggerCoverUpload = () => document.getElementById('coverPhotoInput').click();
        window.handleCoverPhotoSelect = (e) => {
            const file = e.target.files[0]; if(!file) return;
            const reader = new FileReader(); reader.onload = (e) => document.getElementById('coverPhotoImg').src = e.target.result;
            reader.readAsDataURL(file); selectedCoverPhoto = file;
        }

        document.getElementById('editBio').addEventListener('input', function() {
            const len = this.value.length;
            const ctr = document.getElementById('bioCharCounter');
            ctr.innerText = len + "/150";
            ctr.style.color = len > 150 ? '#e74c3c' : 'var(--secondary-text)';
        });

        window.uploadToImgbb = async function(file) {
            const compressed = await compressImage(file);
            const fd = new FormData();
            fd.append('image', compressed);
            fd.append('key', '8304af1d699b61abb70d5efe569d4179');
            const res = await fetch('https://api.imgbb.com/1/upload', { method:'POST', body:fd });
            const data = await res.json();
            if(data.success) return data.data.url;
            throw new Error('Upload failed');
        }

        window.saveProfileChanges = async function() {
            const user = auth.currentUser;
            if(!user) return;
            const name = document.getElementById('editName').value.trim();
            const bio = document.getElementById('editBio').value.trim();
            if(!name) { Swal.fire({icon:'warning', title:'সতর্কতা', text:'নাম অবশ্যই পূরণ করতে হবে'}); return; }
            if(bio.length > 150) { Swal.fire({icon:'warning', title:'সতর্কতা', text:'বায়ো ১৫০ অক্ষরের বেশি হতে পারবে না'}); return; }

            Swal.fire({title:'আপডেট করা হচ্ছে...', allowOutsideClick:false, didOpen:()=>Swal.showLoading()});

            try {
                let pUrl = document.getElementById('profilePhotoPreview').src;
                let cUrl = document.getElementById('coverPhotoImg').src;

                if(selectedProfilePhoto) { Swal.update({html:'প্রোফাইল ছবি আপলোড হচ্ছে...'}); pUrl = await uploadToImgbb(selectedProfilePhoto); await updateProfile(user, {photoURL:pUrl}); }
                if(selectedCoverPhoto) { Swal.update({html:'কভার ফটো আপলোড হচ্ছে...'}); cUrl = await uploadToImgbb(selectedCoverPhoto); }
                if(name !== user.displayName) await updateProfile(user, {displayName:name});

                Swal.update({html:'তথ্য সংরক্ষণ করা হচ্ছে...'});
                await update(ref(db, `users/${user.uid}`), {
                    displayName: name, photoURL: pUrl, coverURL: cUrl, bio: bio,
                    'socialLinks/facebook': document.getElementById('editFacebook').value.trim(),
                    'socialLinks/youtube': document.getElementById('editYoutube').value.trim(),
                    'socialLinks/tiktok': document.getElementById('editTiktok').value.trim(),
                    'socialLinks/whatsapp': document.getElementById('editWhatsapp').value.trim(),
                    updatedAt: new Date().toISOString()
                });

                Swal.fire({icon:'success', title:'সফল!', text:'প্রোফাইল আপডেট হয়েছে', timer:1500, showConfirmButton:false});
                closeProfileEdit();
                setTimeout(()=>loadProfile(user.uid), 1500);
            } catch(e) { Swal.fire({icon:'error', title:'ত্রুটি', text:'আপডেট ব্যর্থ হয়েছে'}); }
        }

        window.renderSocialLinks = function(links) {
            const c = document.getElementById('socialLinksDisplay');
            if(!c) return;
            let h = '';
            if(links?.facebook) h += `<a href="${links.facebook}" target="_blank" class="social-link-btn" style="background:#1877f2;"><i class="fab fa-facebook-f"></i></a>`;
            if(links?.youtube) h += `<a href="${links.youtube}" target="_blank" class="social-link-btn" style="background:#ff0000;"><i class="fab fa-youtube"></i></a>`;
            if(links?.tiktok) h += `<a href="${links.tiktok}" target="_blank" class="social-link-btn" style="background:#000000;"><i class="fab fa-tiktok"></i></a>`;
            if(links?.whatsapp) h += `<a href="${links.whatsapp}" target="_blank" class="social-link-btn" style="background:#25d366;"><i class="fab fa-whatsapp"></i></a>`;
            c.innerHTML = h;
        }

        // --- NOTIFICATIONS ---
        function initNotificationListener(uid) {
            onValue(ref(db, `notifications/${uid}`), (snapshot) => {
                const data = snapshot.val();
                let count = 0;
                if(data) count = Object.values(data).filter(n => !n.read).length;
                const badge = document.getElementById('notifBadge');
                // নাল-চেক (Null-check) যুক্ত করে নিশ্চিত করা হলো যাতে এলিমেন্টটি না থাকলে ক্র্যাশ না করে
                if (badge) {
                    if(count > 0) { 
                        badge.innerText = count > 9 ? '9+' : count; 
                        badge.classList.add('active'); 
                    } else { 
                        badge.classList.remove('active'); 
                    }
                }
            });
        }

        function sendNotification(targetUid, type, postId) {
            if(!window.currentUser || targetUid === window.currentUser.uid) return;
            let messageText = "আপনার প্রোফাইলে নতুন অ্যাক্টিভিটি";
            if(type === 'like') messageText = `${window.currentUser.displayName} আপনার পোস্টে লাইক দিয়েছেন ❤️`;
            else if(type === 'comment') messageText = `${window.currentUser.displayName} আপনার পোস্টে মন্তব্য করেছেন 💬`;
            else if(type === 'reply') messageText = `${window.currentUser.displayName} আপনার মন্তব্যের উত্তর দিয়েছেন ↩️`;
            else if(type === 'mention') messageText = `${window.currentUser.displayName} আপনাকে একটি কমেন্টে মেনশন করেছেন 🔔`;

            push(ref(db, `notifications/${targetUid}`), { 
                type: type, 
                postId: postId, 
                sender: window.currentUser.displayName, 
                senderImg: window.currentUser.photoURL, 
                read: false, 
                timestamp: Date.now() 
            });

            const options = {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: 'Basic os_v2_app_2jdqafko2fbhjfv5czkpq3fvjiqp5yq2byzeeemgeysttodrzyklib3ykxct6c7k6tmdequnkrba5ercnk7kdn6wrsonxnywj2kna5q'
                },
                body: JSON.stringify({
                    app_id: "d2470015-4ed1-4274-96bd-1654f86cb54a",
                    include_aliases: { external_id: [targetUid] },
                    target_channel: "push",
                    contents: { en: messageText },
                    headings: { en: "মুক্তলিপি ডায়েরি" },
                    url: window.location.origin + "?post=" + postId
                })
            };

            // fetch লাইনের বদলে নিচে দেওয়া এই কন্ডিশনটি বসিয়ে দিন
    if (window.AndroidInterface) {
        // অ্যান্ড্রয়েডের নেটিভ জাভা কোড দিয়ে নোটিফিকেশন পাঠানো হবে (CORS এড়াতে)
        window.AndroidInterface.sendPushNotificationJava(targetUid, messageText, postId);
    } else {
        // সাধারণ কম্পিউটার বা মোবাইলের ব্রাউজার থেকে চললে
        fetch('https://onesignal.com/api/v1/notifications', options).catch(err => console.error(err));
    }
}

        window.showNotifications = function() {
            if(!checkAuth()) return;
            document.getElementById('sheetTitle').innerText = 'নোটিফিকেশন';
            document.getElementById('sheetFooter').style.display = 'none';
            document.getElementById('universalBottomSheet').classList.add('active');
            const listRef = ref(db, `notifications/${window.currentUser.uid}`);
            get(query(listRef, limitToLast(20))).then(snap => {
                const data = snap.val();
                if(!data) { document.getElementById('sheetBody').innerHTML = '<div style="text-align:center; color:#888; padding:20px;">কোনো নোটিফিকেশন নেই</div>'; return; }
                const notifs = Object.entries(data).map(([k,v]) => ({key:k, ...v})).reverse();
                const html = notifs.map(n => {
                    let text = "অ্যাক্টিভিটি";
                    if(n.type === 'like') text = `আপনার পোস্টে লাইক দিয়েছেন ❤️`;
                    else if(n.type === 'comment') text = `আপনার পোস্টে মন্তব্য করেছেন 💬`;
                    else if(n.type === 'reply') text = `আপনার মন্তব্যের উত্তর দিয়েছেন ↩️`;
                    else if(n.type === 'mention') text = `আপনাকে একটি কমেন্টে মেনশন করেছেন 🔔`;
                    return `
                    <div class="notif-item ${!n.read ? 'unread' : ''}" onclick="handleNotifClick('${n.key}', '${n.postId}')">
                        <img src="${n.senderImg}" class="notif-avatar">
                        <div class="notif-text"><strong>${n.sender}</strong> ${text}<div class="notif-time">${new Date(n.timestamp).toLocaleDateString()}</div></div>
                    </div>`;
                }).join('');
                document.getElementById('sheetBody').innerHTML = html;
            });
        };
        window.handleNotifClick = function(notifKey, postId) {
            update(ref(db, `notifications/${window.currentUser.uid}/${notifKey}`), { read: true });
            document.getElementById('universalBottomSheet').classList.remove('active');
            const post = window.allPosts.find(p => p.key === postId);
            if(post) openDetailView(postId);
            else get(ref(db, `posts/${postId}`)).then(s => { if(s.exists()) { const p = s.val(); p.key = postId; window.allPosts.push(p); openDetailView(postId); } else showToast('পোস্টটি পাওয়া যায়নি'); });
        };

// --- REAL-TIME CHAT (শুধুমাত্র ম্যাসেজ ব্যাজ নোটিফিকেশনের জন্য) ---
// প্রোফাইল থেকে সরাসরি চ্যাট পেজে যাওয়ার ফাংশন
        window.initChatFromProfile = function() {
            if(!checkAuth()) return;
            const targetUid = currentlyViewingUid;
            if(targetUid === window.currentUser.uid) return;
            window.location.href = 'chat.html?targetUid=' + targetUid;
        };
        function initChatListener(uid) {
            onValue(ref(db, `user_chats/${uid}`), (snap) => {
                const data = snap.val();
                const badge = document.getElementById('msgBadge');
                // চ্যাট নোটিফিকেশন ব্যাজ এলিমেন্ট ডমে লোড হওয়া নিশ্চিত করতে নাল-চেক
                if (!badge) return;

                if(!data) {
                     badge.classList.remove('active');
                     return;
                }
                let totalUnread = 0;
                Object.values(data).forEach(info => {
                    if(info.unseenCount) totalUnread += info.unseenCount;
                });

                if(totalUnread > 0) { 
                    badge.innerText = totalUnread > 9 ? '9+' : totalUnread; 
                    badge.classList.add('active'); 
                } else {
                    badge.classList.remove('active');
                }
            });
        }

        // index.html এ এই ফাংশনটি দিয়ে রিপ্লেস করুন
window.checkAuth = function() {
    if (window.currentUser) return true;

    // লগইন সফল হওয়ার পর ব্যবহারকারী যেন পুনরায় ঠিক একই পেজে ফেরত আসতে পারে
    const currentUrl = encodeURIComponent(window.location.href);
    window.location.href = `auth.html?redirect=${currentUrl}`;
    return false;
};

// স্টোরিগুলোর জন্য এস্কেলেটন রেন্ডার করার ফাংশন
window.renderStorySkeletons = function() {
    const bar = document.getElementById('storiesBar');
    if (!bar) return;

    // প্রথম চাইল্ড (Create Story কার্ড) অক্ষত রেখে বাকি সব চাইল্ড লুপের মাধ্যমে রিমুভ করা হচ্ছে
    while (bar.children.length > 1) {
        bar.lastElementChild.remove();
    }

    // পাশে ৪টি প্রফেশনাল ফেসবুক-স্টাইল স্টোরি এস্কেলেটন কার্ড জেনারেট করা হচ্ছে
    let html = '';
    for(let i=0; i<4; i++) {
        html += `
        <div class="story-skeleton-card">
            <div class="story-skeleton-avatar"></div>
            <div class="story-skeleton-name"></div>
        </div>`;
    }
    bar.insertAdjacentHTML('beforeend', html);
};
        window.renderSkeletons = function() {
            const feed = document.getElementById('feed');
            if (!feed) return; // নিরাপত্তা কুয়েরি (অন্যান্য পেজে ক্র্যাশ এড়াতে)
            let html = '';
            for(let i=0; i<4; i++) {
                html += `<div class="skeleton-card"><div class="sk-header"><div class="skeleton sk-avatar"></div><div class="sk-info"><div class="skeleton sk-name"></div><div class="skeleton sk-date"></div></div></div>${i % 2 === 0 ? '<div class="skeleton sk-img"></div>' : ''}<div class="skeleton sk-title"></div><div class="skeleton sk-line"></div><div class="skeleton sk-line"></div><div class="skeleton sk-line short"></div></div>`;
            }
            feed.innerHTML = html;
        };

        // পেজ লোড হওয়ার সময় উভয় এস্কেলেটন রেন্ডার করানো হচ্ছে
        window.renderStorySkeletons();
        window.renderSkeletons();

        window.loadPostsChunk = function(reset = false) {
            if (isLoadingPosts || (reachedEnd && !reset)) return;
            isLoadingPosts = true;
            const spinner = document.getElementById('loadingSpinner');
            spinner.style.display = 'block';

            if (reset) {
                window.allPosts = []; lastLoadedKey = null; reachedEnd = false;
                document.getElementById('feed').innerHTML = ''; renderSkeletons();
            }

            let postsRef = ref(db, 'posts');
            let postsQuery;

            if (activeCategoryFilter !== 'সব' && activeCategoryFilter !== 'সংরক্ষিত') {
                postsQuery = query(postsRef, orderByChild('category'), equalTo(activeCategoryFilter), limitToLast(20));
            } else {
                if (lastLoadedKey) postsQuery = query(postsRef, orderByKey(), limitToLast(10), endBefore(lastLoadedKey));
                else postsQuery = query(postsRef, orderByKey(), limitToLast(10));
            }

            get(postsQuery).then(async (snapshot) => {
                spinner.style.display = 'none';
                const data = snapshot.val();
                if (!data) {
                    reachedEnd = true;
                    if(window.allPosts.length === 0) document.getElementById('feed').innerHTML = '<div style="text-align:center; padding:30px;">কোনো পোস্ট নেই</div>';
                    isLoadingPosts = false;
                    return;
                }

                let newPosts = Object.entries(data).map(([key, val]) => ({ key, ...val }));
                newPosts = newPosts.filter(p => !window.blockedUsers.includes(p.uid));
                newPosts.sort((a, b) => b.timestamp - a.timestamp);
                if (newPosts.length < 10) reachedEnd = true;
                const keys = Object.keys(data).sort();
                lastLoadedKey = keys[0]; 
                window.allPosts = [...window.allPosts, ...newPosts];

                if (activeCategoryFilter === 'সংরক্ষিত') {
                   const savedKeys = JSON.parse(localStorage.getItem('SAVED_POSTS') || '[]');
                   const savedPosts = window.allPosts.filter(p => savedKeys.includes(p.key));
                   renderFeed(savedPosts);
                } else { 
                   renderFeed(window.allPosts); 

                   if (activeCategoryFilter === 'সব' && window.allPosts.length > 0) {
                       localStorage.setItem('MUKTOLIPI_CACHED_POSTS', JSON.stringify(window.allPosts.slice(0, 20)));
                   }
                }

                const uniqueUids = [...new Set(newPosts.map(p => p.uid).filter(uid => uid && !window.userVerificationCache.hasOwnProperty(uid)))];
                if(uniqueUids.length > 0) {
                    Promise.all(uniqueUids.map(uid => 
                        get(ref(db, `users/${uid}/isVerified`)).then(snap => {
                            window.userVerificationCache[uid] = snap.val() === true;
                        }).catch(() => {
                            window.userVerificationCache[uid] = false;
                        })
                    )).then(() => {
                        if (activeCategoryFilter !== 'সংরক্ষিত') renderFeed(window.allPosts);
                        isLoadingPosts = false; 
                    }).catch(() => {
                        isLoadingPosts = false;
                    });
                } else {
                    isLoadingPosts = false; 
                }
            }).catch(err => { 
                spinner.style.display = 'none'; 
                isLoadingPosts = false; 
                console.error(err); 
                if (window.allPosts.length === 0) {
                    document.getElementById('feed').innerHTML = '<div style="text-align:center; padding:30px; color:var(--secondary-text);">পোস্ট লোড করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।</div>';
                }
            });
        };

        window.addEventListener('scroll', () => {
            if(window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
                if (document.getElementById('feedView').style.display !== 'none' && activeCategoryFilter === 'সব') loadPostsChunk();
            }
        });

// --- REACTION LOGIC ---
let pressTimer = null;
let isLongPress = false;

window.startLongPress = function(e, key, btn) {
    if(!checkAuth()) return;
    isLongPress = false;
    pressTimer = setTimeout(() => {
        isLongPress = true;
        if(navigator.vibrate) navigator.vibrate(50);
        showReactions(key, btn);
    }, 500);
};

window.endLongPress = function(e, key, btn) {
    if (pressTimer) clearTimeout(pressTimer);
    if (!isLongPress) {
        document.querySelectorAll('.reaction-box').forEach(b => b.classList.remove('show'));
        toggleReaction(key, 'like');
    }
    isLongPress = false;
};

        window.showReactions = function(key, btnEl) {
    document.querySelectorAll('.reaction-box').forEach(b => b.classList.remove('show'));
    // নতুন পিল-র্যাপার এবং পুরাতন র্যাপার উভয়ই চেক করা হচ্ছে
    const wrapper = btnEl.closest('.fb-pill-btn-wrapper') || btnEl.closest('.action-btn-wrapper');
            const bar = wrapper.querySelector('.reaction-box');
            if(bar) { 
                bar.classList.add('show'); 
                setTimeout(() => { if(!isLongPress) bar.classList.remove('show'); }, 4000);
            }
        };

        window.handleReactionMove = function(e, container) {
            if(!isLongPress && e.type !== 'mousemove') return; 
            e.preventDefault(); 
            const touch = e.touches ? e.touches[0] : e;
            const x = touch.clientX;
            const y = touch.clientY;
            const items = container.querySelectorAll('.reaction-item');
            let activeItem = null;
            items.forEach(item => {
                const rect = item.getBoundingClientRect();
                if (x >= rect.left && x <= rect.right && y >= rect.top - 20 && y <= rect.bottom + 20) {
                    activeItem = item;
                }
            });
            items.forEach(item => {
                if (item === activeItem) {
                    if (!item.classList.contains('active')) {
                        if(navigator.vibrate) navigator.vibrate(10); 
                        item.classList.add('active');
                    }
                } else {
                    item.classList.remove('active');
                }
            });
        };

        window.handleReactionRelease = function(e, key, container) {
            if (pressTimer) clearTimeout(pressTimer);
            const activeItem = container.querySelector('.reaction-item.active');
            if (activeItem) {
                const type = activeItem.dataset.type;
                const src = activeItem.querySelector('img').src;
                performFlyingAnimation(activeItem, key, src);
                toggleReaction(key, type);
                container.classList.remove('show');
                container.querySelectorAll('.reaction-item').forEach(i => i.classList.remove('active'));
            }
            isLongPress = false;
        };

        window.handleReactionClick = function(e, type, key) {
            e.stopPropagation();
            const target = e.currentTarget;
            const src = target.querySelector('img').src;
            performFlyingAnimation(target, key, src);
            toggleReaction(key, type);
            target.closest('.reaction-box').classList.remove('show');
        };

        function performFlyingAnimation(startEl, key, imgSrc) {
    const startRect = startEl.getBoundingClientRect();
    let btn = document.querySelector(`#post-${key} .like-btn`);
            if (!btn) {
                btn = document.querySelector(`#comment-like-btn-${key}`);
            }
            if(!btn) return;

            const endRect = btn.getBoundingClientRect();
            const flyer = document.createElement('img');
            flyer.src = imgSrc;
            flyer.className = 'flying-emoji';
            flyer.style.left = startRect.left + 'px';
            flyer.style.top = startRect.top + 'px';
            document.body.appendChild(flyer);
            flyer.offsetHeight; 
            flyer.style.left = (endRect.left + 10) + 'px';
            flyer.style.top = (endRect.top) + 'px';
            flyer.style.opacity = '0';
            flyer.style.transform = 'scale(0.5)';
            setTimeout(() => {
                flyer.remove();
                btn.classList.add('btn-bounce');
                setTimeout(() => btn.classList.remove('btn-bounce'), 600);
            }, 600);
        }

        function getReactionStyle(type) {
            const map = {
                'like': { text: 'Like', color: '#1877f2', icon: reactionAssets.like }, 
                'love': { text: 'Love', color: '#e74c3c', icon: reactionAssets.love },
                'care': { text: 'Care', color: '#f7b928', icon: reactionAssets.care },
                'haha': { text: 'Haha', color: '#f7b928', icon: reactionAssets.haha }, 
                'wow':  { text: 'Wow',  color: '#f7b928', icon: reactionAssets.wow },  
                'sad':  { text: 'Sad',  color: '#f7b928', icon: reactionAssets.sad },
                'angry':{ text: 'Angry',color: '#e74c3c', icon: reactionAssets.angry }
            };
            return map[type] || { text: 'Like', color: '#1877f2', icon: reactionAssets.like }; 
        }

        window.toggleReaction = function(postId, newType) {
            if(!checkAuth()) return;
            const uid = window.currentUser.uid;
            const userReactionRef = ref(db, `reactions/${postId}/${uid}`);

            get(userReactionRef).then(snap => {
                const currentType = snap.val();

                if (currentType === newType) {
                    remove(userReactionRef);
                    runTransaction(ref(db, `reactionCount/${postId}/${currentType}`), (count) => {
                        return (count || 0) > 0 ? count - 1 : 0;
                    });
                } else {
                    set(userReactionRef, newType);
                    if (currentType) {
                        runTransaction(ref(db, `reactionCount/${postId}/${currentType}`), (count) => {
                            return (count || 0) > 0 ? count - 1 : 0;
                        });
                    } else {
                        const post = window.allPosts.find(p => p.key === postId);
                        if(post && post.uid && post.uid !== uid) { 
                            sendNotification(post.uid, 'like', postId); 
                        }
                    }
                    runTransaction(ref(db, `reactionCount/${postId}/${newType}`), (count) => {
                        return (count || 0) + 1;
                    });
                }
            });
        };

        function listenToPostReactions(postId) {
            if(window.currentUser) {
                const myReactionRef = ref(db, `reactions/${postId}/${window.currentUser.uid}`);
                onValue(myReactionRef, (snap) => {
                    const type = snap.val();
                    updatePostButtonUI(postId, type);
                });
            }

            const countRef = ref(db, `reactionCount/${postId}`);
            onValue(countRef, (snap) => {
                const data = snap.val() || {};
                updatePostSummaryUI(postId, data);
            });
        }

        function updatePostButtonUI(postId, type) {
    const btn = document.querySelector(`#post-${postId} .like-btn`);  
     if(!btn) return;

            if(type) {
                const style = getReactionStyle(type);
                let iconHTML = '';
                if(type === 'like') iconHTML = `<i class="${reactionAssets.solidLike}"></i>`;
                else iconHTML = `<img src="${style.icon}" style="width:18px;height:18px;vertical-align:middle;">`;

                btn.innerHTML = `${iconHTML} <span class="count-text" style="margin-left:4px;">${style.text}</span>`;
                btn.style.color = style.color;
                btn.classList.add('liked');
            } else {
                btn.innerHTML = `<i class="${reactionAssets.staticLike}"></i> <span class="count-text" style="margin-left:4px;">Like</span>`;
                btn.style.color = '';
                btn.classList.remove('liked');
            }
        }

        function updatePostSummaryUI(postId, counts) {
            const summaryContainer = document.querySelector(`#summary-${postId}`);
            if(!summaryContainer) return;

            let total = 0;
            const types = [];
            for (const [type, count] of Object.entries(counts)) {
                if(count > 0) {
                    total += count;
                    types.push({type, count});
                }
            }

            types.sort((a,b) => b.count - a.count);
            const topTypes = types.slice(0, 3); 

            let html = '';
            if (total > 0) {
                html += `<div class="reaction-icons-stack">`;
                topTypes.forEach(t => {
                    const style = getReactionStyle(t.type);
                    html += `<img src="${style.icon}" onerror="this.style.display='none'">`;
                });
                html += `</div>`;
                html += `<span>${total}</span>`;
            }

            summaryContainer.innerHTML = html;
        }

        window.openWhoReactedModal = function(postId) {
            const modal = document.getElementById('whoReactedModal');
            const list = document.getElementById('whoReactedList');
            list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--secondary-text);">Loading...</div>';
            modal.style.display = 'flex';

            get(ref(db, `reactions/${postId}`)).then(async snap => {
                const data = snap.val();
                if(!data) {
                    list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--secondary-text);">No reactions yet.</div>';
                    return;
                }

                const reactionEntries = Object.entries(data);
                let html = '';

                for(const [uid, type] of reactionEntries) {
                    const userSnap = await get(ref(db, `users/${uid}`));
                    const user = userSnap.val() || { displayName: "Unknown User", photoURL: "https://cdn-icons-png.flaticon.com/512/149/149071.png" };
                    const emoji = window.reactionEmojiMap[type] || "👍";

                    html += `
                    <div class="reaction-user-item" onclick="viewUserProfile('${uid}'); document.getElementById('whoReactedModal').style.display='none';">
                        <img src="${user.photoURL}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                        <span style="font-weight:600; font-size:14px;">${user.displayName}</span>
                        <span class="reaction-user-emoji">${emoji}</span>
                    </div>`;
                }
                list.innerHTML = html;
            });
        };

// --- ফেসবুক প্রফেশনাল ফিড রেন্ডারিং ইঞ্জিন (আপডেটেড ও প্রিমিয়াম সংস্করণ) ---
window.renderFeed = function(posts, targetId = 'feed') {
    const feed = document.getElementById(targetId);
    if (!feed) return; // নিরাপত্তা কুয়েরি (ফিড এলিমেন্ট না থাকলে ক্র্যাশ রোধ করবে)
    if(!posts || !posts.length) return feed.innerHTML = '<div style="text-align:center; padding:30px; width:100%;">কোনো পোস্ট নেই</div>';

    feed.innerHTML = posts.map(post => {
        // ১. পোস্ট টেক্সট ফরম্যাটিং ও ট্রানকেশন (...see more)
        let contentHTML = post.content || '';
        let tempDiv = document.createElement("div");
        tempDiv.innerHTML = contentHTML;
        let plainText = tempDiv.textContent || tempDiv.innerText || "";
        let displayContent = "";

        if(plainText.length > 150) {
            let truncated = plainText.substring(0, 150) + "...";
            displayContent = `${formatPostContent(truncated)} <span class="read-more-btn" onclick="openDetailView('${post.key}')" style="color: var(--secondary-text); font-weight: 700; cursor: pointer; margin-left: 4px;">see more</span>`;
        } else {
            displayContent = formatPostContent(contentHTML);
        }

        const authorImg = post.userImg || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        const commentCount = window.allComments[post.key] ? Object.keys(window.allComments[post.key]).length : 0;
        const shareCount = parseInt(localStorage.getItem('SHARE_COUNT_' + post.key) || '0');
        const isVerified = window.userVerificationCache[post.uid] === true;
        const badgeHtml = getVerifiedBadge(isVerified);

        // ২. প্রফেশনাল স্টোরি ট্র্যাকিং নীল রিং লজিক
        const hasStoryClass = window.allStoriesData && window.allStoriesData[post.uid] ? 'has-story' : '';

        setTimeout(() => listenToPostReactions(post.key), 0);

        // ৩. রিয়েল-টাইম রিঅ্যাকশন ডক প্যানেল
        const reactionsHTML = `
        <div class="reaction-box" 
             ontouchmove="handleReactionMove(event, this)" 
             ontouchend="handleReactionRelease(event, '${post.key}', this)"
             onmousemove="handleReactionMove(event, this)"
             onmouseleave="this.classList.remove('show')">
            <div class="reaction-item" data-type="like" onclick="handleReactionClick(event, 'like', '${post.key}')"><img src="${reactionAssets.like}" class="reaction-img" onerror="window.imgError(this)"></div>
            <div class="reaction-item" data-type="love" onclick="handleReactionClick(event, 'love', '${post.key}')"><img src="${reactionAssets.love}" class="reaction-img" onerror="window.imgError(this)"></div>
            <div class="reaction-item" data-type="care" onclick="handleReactionClick(event, 'care', '${post.key}')"><img src="${reactionAssets.care}" class="reaction-img" onerror="window.imgError(this)"></div>
            <div class="reaction-item" data-type="haha" onclick="handleReactionClick(event, 'haha', '${post.key}')"><img src="${reactionAssets.haha}" class="reaction-img" onerror="window.imgError(this)"></div>
            <div class="reaction-item" data-type="wow" onclick="handleReactionClick(event, 'wow', '${post.key}')"><img src="${reactionAssets.wow}" class="reaction-img" onerror="window.imgError(this)"></div>
            <div class="reaction-item" data-type="sad" onclick="handleReactionClick(event, 'sad', '${post.key}')"><img src="${reactionAssets.sad}" class="reaction-img" onerror="window.imgError(this)"></div>
            <div class="reaction-item" data-type="angry" onclick="handleReactionClick(event, 'angry', '${post.key}')"><img src="${reactionAssets.angry}" class="reaction-img" onerror="window.imgError(this)"></div>
        </div>`;

        // ৪. ফেসবুক অফিশিয়াল লেআউট স্ট্রাকচার
        return `
        <div class="fb-post-container" id="post-${post.key}">
            <!-- হেডার (প্রোফাইল পিক, নাম, নীল রিং ও ৩-ডট অপশন) -->
            <div class="fb-post-header">
                <div class="fb-author-wrapper" onclick="event.stopPropagation(); viewUserProfile('${post.uid}')">
                    <div class="fb-avatar-ring ${hasStoryClass}" onclick="event.stopPropagation(); window.allStoriesData && window.allStoriesData['${post.uid}'] ? openStoryViewer('${post.uid}', 0) : viewUserProfile('${post.uid}')">
                        <img src="${authorImg}" class="fb-avatar-img" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'">
                    </div>
                    <div class="fb-author-details">
                        <span class="fb-author-name">${post.author} ${badgeHtml}</span>
                        <span class="fb-post-meta">
                            ${post.date} • <i class="fa-solid fa-earth-americas" style="font-size:11px;"></i>
                        </span>
                    </div>
                </div>
                <div class="fb-post-actions">
                    <i class="fa-solid fa-ellipsis fb-action-icon" onclick="event.stopPropagation(); openPostMenu('${post.key}', '${post.uid}', '${post.author}')"></i>
                </div>
            </div>

            <!-- বডি টেক্সট (ইমেজের ঠিক ওপরে থাকবে) -->
            <div class="fb-post-text" onclick="openDetailView('${post.key}')">${displayContent}</div>
            
            <!-- ফুল-উইডথ ইমেজ সেকশন -->
            ${post.image ? `
            <div class="fb-post-image-box" onclick="openDetailView('${post.key}')">
                <img src="${post.image}" class="fb-post-image" loading="lazy">
            </div>` : ''}

            <!-- লাইক/কমেন্ট সামারি কাউন্টার বার -->
            <div class="fb-summary-bar">
                <div class="fb-summary-left" id="summary-${post.key}" onclick="openWhoReactedModal('${post.key}')">
                    <!-- রিয়েল-টাইম লাইক কাউন্টার ডাইনামিকভাবে লোড হবে -->
                </div>
                <div class="fb-summary-right">
                    <span onclick="openCommentsSheet('${post.key}')" id="comment-count-text-${post.key}" style="cursor:pointer;">${commentCount} comments</span> • 
                    <span style="cursor:pointer;">${shareCount} shares</span>
                </div>
            </div>

            <!-- প্রফেশনাল বাটনসমূহ -->
            <div class="fb-interaction-row">
                <div class="fb-pill-btn-wrapper">
                    ${reactionsHTML}
                    <button class="fb-pill-btn like-btn" 
                        onmousedown="startLongPress(event, '${post.key}', this)" 
                        onmouseup="endLongPress(event, '${post.key}', this)"
                        ontouchstart="startLongPress(event, '${post.key}', this)"
                        ontouchend="endLongPress(event, '${post.key}', this)"
                        oncontextmenu="return false;">
                        <i class="far fa-thumbs-up"></i> <span>Like</span>
                    </button>
                </div>
                <button class="fb-pill-btn" onclick="openCommentsSheet('${post.key}')">
                    <i class="far fa-comment"></i> <span>Comment</span>
                </button>
                <button class="fb-pill-btn" onclick="incrementShare('${post.key}'); openShareSheet('${post.key}');">
                    <i class="fa-solid fa-share"></i> <span>Share</span>
                </button>
            </div>
        </div>`;
    }).join('');
};

        window.openPostMenu = function(postKey, authorUid, authorName) {
            document.getElementById('sheetTitle').innerText = 'অপশন';
            document.getElementById('sheetFooter').style.display = 'none';
            const isMe = window.currentUser && window.currentUser.uid === authorUid;
            const isAdmin = window.currentUser && window.currentUser.uid === ADMIN_UID;

            let html = '';

            // নিজের পোস্ট হলে এডিট ও ডিলিট অপশন থাকবে
            if (isMe) {
                html += `<div class="menu-option" onclick="closeBottomSheet(); showToast('এডিট অপশনটি শীঘ্রই আসছে!')"><i class="fas fa-edit"></i> পোস্ট এডিট করুন</div>`;
                html += `<div class="menu-option danger" onclick="closeBottomSheet(); handleDelete('${postKey}')"><i class="fas fa-trash"></i> পোস্ট ডিলিট করুন</div>`;
            } else {
                // অন্যের পোস্ট হলে রিপোর্ট ও ব্লক অপশন থাকবে
                html += `<div class="menu-option" onclick="closeBottomSheet(); handleReport('${postKey}', '${authorUid}')"><i class="fas fa-exclamation-triangle"></i> রিপোর্ট করুন</div>`;
                html += `<div class="menu-option" onclick="closeBottomSheet(); handleBlock('${authorUid}', '${authorName}')"><i class="fas fa-ban"></i> ব্লক করুন (${authorName})</div>`;
            }

            // অ্যাডমিন হলে যেকোনো পোস্ট ডিলিট করতে পারবে
            if (isAdmin && !isMe) { 
                html += `<div class="menu-option danger" onclick="closeBottomSheet(); handleDelete('${postKey}')"><i class="fas fa-trash"></i> রিমুভ পোস্ট (Admin)</div>`; 
            }

            document.getElementById('sheetBody').innerHTML = html;
            document.getElementById('universalBottomSheet').classList.add('active');
        };
        window.handleReport = async function(postKey, authorUid) {
            if(!checkAuth()) return;
            document.getElementById('universalBottomSheet').classList.remove('active');
            const { value: reason } = await Swal.fire({ title: 'রিপোর্টের কারণ', input: 'select', inputOptions: { 'spam': 'স্প্যাম', 'harassment': 'হয়রানি', 'nudity': 'অশ্লীলতা', 'hate': 'ঘৃণাত্মক বক্তব্য', 'other': 'অন্যান্য' }, inputPlaceholder: 'কারণ নির্বাচন করুন', showCancelButton: true, confirmButtonText: 'জমা দিন' });
            if (reason) { push(ref(db, 'reports'), { postId: postKey, reportedUser: authorUid, reportedBy: window.currentUser.uid, reportedByName: window.currentUser.displayName || "Anonymous", reason: reason, timestamp: Date.now(), status: "pending" }).then(() => { Swal.fire('ধন্যবাদ', 'আপনার রিপোর্ট জমা হয়েছে।', 'success'); }); }
        };
        window.handleBlock = function(targetUid, name) {
            if(!checkAuth()) return;
            document.getElementById('universalBottomSheet').classList.remove('active');
            Swal.fire({ title: 'ব্লক করবেন?', text: `${name}-এর পোস্ট আর দেখা যাবে না।`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#e74c3c', confirmButtonText: 'হ্যাঁ, ব্লক' }).then((result) => { if (result.isConfirmed) { update(ref(db, `users/${window.currentUser.uid}/blockedUsers`), { [targetUid]: true }).then(() => { window.blockedUsers.push(targetUid); showToast("ব্লক করা হয়েছে 🚫"); loadPostsChunk(true); }); } });
        };
        window.handleDelete = function(key) {
            document.getElementById('universalBottomSheet').classList.remove('active');
            Swal.fire({ title: 'ডিলিট করবেন?', text: "এটি ফিরে পাওয়া যাবে না!", icon: 'warning', showCancelButton: true, confirmButtonText: 'হ্যাঁ, ডিলিট' }).then((result) => { if (result.isConfirmed) { remove(ref(db, 'posts/'+key)).then(() => showToast("ডিলিট হয়েছে")); } });
        };

        window.incrementShare = function(key) {
            let count = parseInt(localStorage.getItem('SHARE_COUNT_' + key) || '0');
            count++; localStorage.setItem('SHARE_COUNT_' + key, count);
            const el = document.getElementById('shareCnt-' + key); if(el) el.innerText = count;
        };

        // --- COMMENTS SYSTEM (FB STYLE + NESTING FIX) ---

        function getRelativeTime(timestamp) {
            const now = Date.now();
            const diff = now - timestamp;
            const sec = 1000;
            const min = 60 * sec;
            const hour = 60 * min;
            const day = 24 * hour;

            if (diff < min) return "Just now";
            if (diff < hour) return Math.floor(diff / min) + "m";
            if (diff < day) return Math.floor(diff / hour) + "h";
            if (diff < 7 * day) return Math.floor(diff / day) + "d";
            return new Date(timestamp).toLocaleDateString();
        }

        window.openCommentsSheet = (key) => {
            if(!checkAuth()) return;

            // কমেন্ট বক্স ওপেন হলে মেইন হেডার হাইড হয়ে ট্যাব বার লেগে থাকবে
            if (typeof window.setHeaderMode === 'function') {
                window.setHeaderMode(true);
            }

            document.getElementById('sheetTitle').innerText = 'মন্তব্য';
            document.getElementById('sheetBody').innerHTML = '<p style="text-align:center; padding:20px;">লোড হচ্ছে...</p>';
            document.getElementById('sheetFooter').style.display = 'flex';
            document.getElementById('universalBottomSheet').classList.add('active');

            cancelReply(); 
            window.currentPostId = key;
            window.mentionedUids = []; 
            const inputEl = document.getElementById('sheetInput');
            inputEl.oninput = (e) => window.handleMentionInput(e);

            onValue(ref(db, 'comments/'+key), async snap => {
                const data = snap.val();
                if(!data) { 
                    document.getElementById('sheetBody').innerHTML = '<p style="text-align:center; color:var(--secondary-text); padding:20px;">কোনো মন্তব্য নেই। আপনিই প্রথম মন্তব্য করুন!</p>'; 
                    return; 
                }

                const allComments = Object.entries(data).map(([k,v]) => ({key:k, ...v}));
                window.currentPostComments = allComments; 

                const parents = allComments.filter(c => !c.parentId).sort((a,b) => b.timestamp - a.timestamp);
                const children = allComments.filter(c => c.parentId);

                let html = '<div class="comment-container" style="padding-bottom:80px;">';

                for (const p of parents) {
                    html += await renderCommentBubble(p, false); 
                    const myChildren = children.filter(c => c.parentId === p.key).sort((a,b) => a.timestamp - b.timestamp);
                    if (myChildren.length > 0) {
                        html += `<div id="replies-${p.key}" class="reply-indent" style="display:flex;">`; 
                        for(const child of myChildren) {
                             html += await renderCommentBubble(child, true);
                        }
                        html += `</div>`;
                    }
                }
                html += '</div>';
                document.getElementById('sheetBody').innerHTML = html;
            });

            const sendBtn = document.getElementById('sheetSendBtn');
            const newBtn = sendBtn.cloneNode(true);
            sendBtn.parentNode.replaceChild(newBtn, sendBtn);

            newBtn.onclick = () => {
                const inputEl = document.getElementById('sheetInput');
                const txt = inputEl.value.trim();
                const parentId = inputEl.dataset.parentId || null; 

                if(!txt) return;

                get(ref(db, `users/${window.currentUser.uid}/isVerified`)).then(snap => {
                    const isVerified = snap.val() === true;
                    const myAvatar = window.currentUser.photoURL; 

                    const commentData = { 
                        text: txt, 
                        author: window.currentUser.displayName, 
                        uid: window.currentUser.uid,
                        userImg: myAvatar,
                        timestamp: Date.now(), 
                        parentId: parentId,  
                        isVerified: isVerified,
                        reactions: {}
                    };

                    push(ref(db, 'comments/'+key), commentData);

                    if (window.mentionedUids.length > 0) {
                        window.mentionedUids.forEach(uid => {
                            if(uid !== window.currentUser.uid) {
                                sendNotification(uid, 'mention', key);
                            }
                        });
                        window.mentionedUids = []; 
                    }

                    const post = window.allPosts.find(p => p.key === key);
                    if (parentId) {
                        const parentComm = window.currentPostComments.find(c => c.key === parentId);
                        if(parentComm && parentComm.uid && parentComm.uid !== window.currentUser.uid && !window.mentionedUids.includes(parentComm.uid)) {
                             sendNotification(parentComm.uid, 'reply', key);
                        }
                    } else {
                if(post && post.uid && post.uid !== window.currentUser.uid && !window.mentionedUids.includes(post.uid)) { 
                    sendNotification(post.uid, 'comment', key); 
                }
            }

            // রিয়েল-টাইম কমেন্ট কাউন্ট আপডেট মেকানিজম
            if (!window.allComments[key]) window.allComments[key] = {};
            window.allComments[key][Date.now()] = commentData;

            const countTextEl = document.getElementById(`comment-count-text-${key}`);
            if (countTextEl) {
                const currentCount = Object.keys(window.allComments[key]).length;
                countTextEl.innerText = `${currentCount} comments`;
            }
        });

        cancelReply();
    };
        };

        async function renderCommentBubble(c, isReply) {
            let isVerified = c.isVerified === true;
            const badgeHtml = getVerifiedBadge(isVerified);

            const userImg = c.userImg || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
            const timeAgo = getRelativeTime(c.timestamp);

            let reactionCount = 0;
            let topReactionIcon = '';
            if (c.reactions) {
                const reacts = Object.values(c.reactions);
                reactionCount = reacts.length;
                if(reactionCount > 0) {
                     const type = reacts[reacts.length-1].type; 
                     const style = getReactionStyle(type);
                     if(type === 'like') topReactionIcon = '<i class="fas fa-thumbs-up" style="color:#1877f2"></i>';
                     else topReactionIcon = `<img src="${style.icon}" style="width:10px; height:10px;">`;
                }
            }

            let myReaction = null;
            if(c.reactions && window.currentUser && c.reactions[window.currentUser.uid]) {
                myReaction = c.reactions[window.currentUser.uid];
            }
            let btnText = "Like";
            let btnStyle = "";
            if(myReaction) {
                 const s = getReactionStyle(myReaction.type);
                 btnText = s.text;
                 btnStyle = `color:${s.color};`;
            }

            const wrapperClass = isReply ? 'comment-wrapper reply-style' : 'comment-wrapper';

            const reactionBoxHTML = `
            <div class="reaction-box" 
                 id="reaction-dock-${c.key}"
                 ontouchmove="handleReactionMove(event, this)" 
                 ontouchend="handleCommentReactionRelease(event, '${window.currentPostId}', '${c.key}', this)"
                 onmousemove="handleReactionMove(event, this)"
                 onmouseleave="this.classList.remove('show')">
                <div class="reaction-item" data-type="like" onclick="handleCommentReactionClick(event, 'like', '${window.currentPostId}', '${c.key}')"><img src="${reactionAssets.like}" class="reaction-img"></div>
                <div class="reaction-item" data-type="love" onclick="handleCommentReactionClick(event, 'love', '${window.currentPostId}', '${c.key}')"><img src="${reactionAssets.love}" class="reaction-img"></div>
                <div class="reaction-item" data-type="care" onclick="handleCommentReactionClick(event, 'care', '${window.currentPostId}', '${c.key}')"><img src="${reactionAssets.care}" class="reaction-img"></div>
                <div class="reaction-item" data-type="haha" onclick="handleCommentReactionClick(event, 'haha', '${window.currentPostId}', '${c.key}')"><img src="${reactionAssets.haha}" class="reaction-img"></div>
                <div class="reaction-item" data-type="wow" onclick="handleCommentReactionClick(event, 'wow', '${window.currentPostId}', '${c.key}')"><img src="${reactionAssets.wow}" class="reaction-img"></div>
                <div class="reaction-item" data-type="sad" onclick="handleCommentReactionClick(event, 'sad', '${window.currentPostId}', '${c.key}')"><img src="${reactionAssets.sad}" class="reaction-img"></div>
                <div class="reaction-item" data-type="angry" onclick="handleCommentReactionClick(event, 'angry', '${window.currentPostId}', '${c.key}')"><img src="${reactionAssets.angry}" class="reaction-img"></div>
            </div>`;

            let html = `
            <div class="${wrapperClass}" id="comment-wrap-${c.key}">
                <img src="${userImg}" class="comment-avatar" onclick="closeBottomSheet(); viewUserProfile('${c.uid}')" style="cursor:pointer;">
                
                <div class="comment-content-box">
                    <div class="comment-bubble">
                        <span class="comment-author-name" onclick="closeBottomSheet(); viewUserProfile('${c.uid}')">
                            ${c.author} ${badgeHtml}
                        </span>
                        
                        <span class="comment-text">${formatPostContent(c.text)}</span>
                        ${reactionCount > 0 ? `<div class="comment-reaction-badge">${topReactionIcon} ${reactionCount}</div>` : ''}
                    </div>
                    <div class="comment-actions">
                        <div class="action-btn-wrapper">
                             ${reactionBoxHTML}
                             <button class="c-action-btn" id="comment-like-btn-${c.key}"
                                style="${btnStyle}"
                                onmousedown="startCommentPress(event, '${c.key}', this)" 
                                onmouseup="endCommentPress(event, '${window.currentPostId}', '${c.key}', this)"
                                ontouchstart="startCommentPress(event, '${c.key}', this)" 
                                ontouchend="endCommentPress(event, '${window.currentPostId}', '${c.key}', this)"
                                oncontextmenu="return false;">
                                ${btnText}
                             </button>
                        </div>
                        <button class="c-action-btn" onclick="startReply('${c.key}', '${c.author}')">Reply</button>
                        <span>${timeAgo}</span>
                    </div>
                </div>
            </div>`;

            return html;
        }

        window.toggleReplies = function(parentId) {
            const container = document.getElementById(`replies-${parentId}`);
            const link = document.getElementById(`view-replies-${parentId}`);
            if(!container) return;

            if(container.style.display === 'flex') {
                 container.style.display = 'none';
            } else {
                 container.style.display = 'flex';
                 link.style.display = 'none'; 
            }
        };

        window.startReply = function(commentId, authorName) {
            const input = document.getElementById('sheetInput');
            input.dataset.parentId = commentId; 
            input.placeholder = `Replying to ${authorName}...`;
            input.focus();
            document.getElementById('cancelReplyBtn').style.display = 'block';
        };

        window.cancelReply = function() {
            const input = document.getElementById('sheetInput');
            input.dataset.parentId = ""; 
            input.value = "";
            input.placeholder = "মন্তব্য লিখুন...";
            document.getElementById('cancelReplyBtn').style.display = 'none';
        };

        window.startCommentPress = function(e, commentId, btn) {
            if(!checkAuth()) return;
            isCommentLongPress = false;
            commentPressTimer = setTimeout(() => {
                isCommentLongPress = true;
                if(navigator.vibrate) navigator.vibrate(50);
                const dock = document.getElementById(`reaction-dock-${commentId}`);
                if(dock) dock.classList.add('show');
            }, 500);
        };

        window.endCommentPress = function(e, postId, commentId, btn) {
            if(commentPressTimer) clearTimeout(commentPressTimer);
            if(!isCommentLongPress) {
                const dock = document.getElementById(`reaction-dock-${commentId}`);
                if(dock) dock.classList.remove('show');
                handleCommentLikeToggle(postId, commentId);
            }
            isCommentLongPress = false;
        };

        window.handleCommentReactionRelease = function(e, postId, commentId, container) {
            if(commentPressTimer) clearTimeout(commentPressTimer);
            const activeItem = container.querySelector('.reaction-item.active');
            if(activeItem) {
                const type = activeItem.dataset.type;
                const src = activeItem.querySelector('img').src;
                performFlyingAnimation(activeItem, commentId, src);
                updateCommentReactionDB(postId, commentId, type);
                container.classList.remove('show');
                container.querySelectorAll('.reaction-item').forEach(i => i.classList.remove('active'));
            }
            isCommentLongPress = false;
        };

        window.handleCommentReactionClick = function(e, type, postId, commentId) {
            e.stopPropagation();
            const target = e.currentTarget;
            const src = target.querySelector('img').src;
            performFlyingAnimation(target, commentId, src);
            updateCommentReactionDB(postId, commentId, type);
            const dock = document.getElementById(`reaction-dock-${commentId}`);
            if(dock) dock.classList.remove('show');
        };

        function handleCommentLikeToggle(postId, commentId) {
            const path = `comments/${postId}/${commentId}/reactions/${window.currentUser.uid}`;
            get(ref(db, path)).then(snap => {
                if(snap.exists()) {
                    remove(ref(db, path)); 
                } else {
                    update(ref(db, path), { type: 'like', timestamp: Date.now() });
                }
            });
        }

        function updateCommentReactionDB(postId, commentId, type) {
            const path = `comments/${postId}/${commentId}/reactions/${window.currentUser.uid}`;
            update(ref(db, path), { type: type, timestamp: Date.now() });
        }

        // --- ADMIN MODAL & REPORTS ---
        // --- POST CREATION & IMAGE CROPPER LOGIC ---
        let cropper = null;
        let currentImageDataUrl = null;

        window.openWriteModal = function() {
             if(!checkAuth()) return;
             document.getElementById('adminModalWrapper').style.display = 'flex';

             // ১. ব্যাকগ্রাউন্ড স্ক্রল লক করা (যাতে ব্যাকগ্রাউন্ড পেজ স্ক্রল না হয়)
             document.body.style.overflow = 'hidden';

             // ২. নেভিগেশন হেডার বারটি সাময়িকভাবে হাইড করা
             const header = document.getElementById('fbHeaderContainer');
             if(header) header.style.display = 'none';

             // Reset fields
             document.getElementById('postTitle').value = '';
             document.getElementById('richEditor').innerHTML = '';

             // সংশোধন: সেফলি গ্লোবাল ফাংশন কল করা হলো
             if (typeof window.removeSelectedImage === 'function') {
                 window.removeSelectedImage();
             }

             document.getElementById('submitBtn').disabled = false;
             document.getElementById('submitBtn').innerHTML = 'পোস্ট';

             const isAdmin = window.currentUser.uid === ADMIN_UID;
             const gearBtn = document.getElementById('adminGearBtn');
             if(isAdmin) { gearBtn.style.display = 'flex'; } 
             else { gearBtn.style.display = 'none'; document.getElementById('adminFields').style.display = 'none'; }
        };

        window.toggleAdminFields = function() {
            const adminDiv = document.getElementById('adminFields');
            adminDiv.style.display = adminDiv.style.display === 'none' ? 'block' : 'none';
        };

        window.closeAdminModal = function() {
            const title = document.getElementById('postTitle').value.trim();
            const content = document.getElementById('richEditor').innerText.trim();

            const restorePageScrollAndNav = () => {
                document.body.style.overflow = ''; 
                const header = document.getElementById('fbHeaderContainer');
                if (header) {
                    header.style.display = 'block';
                    if (typeof window.setHeaderMode === 'function') {
                        const isProfile = new URLSearchParams(window.location.search).get('page') === 'profile';
                        const isHome = window.location.pathname.split('/').pop() === 'index.html' && !isProfile;
                        window.setHeaderMode(!isHome);
                    }
                }
                if (typeof window.updateIndicator === 'function') {
                    window.updateIndicator();
                }
            };

            if (title || content || window.currentImageDataUrl) {
                Swal.fire({
                    title: 'লেখাটি সেভ করবেন?', 
                    text: "আপনি কি এটি ড্রাফট হিসেবে রাখতে চান?",
                    icon: 'question', 
                    showCancelButton: true, 
                    showDenyButton: true,
                    confirmButtonText: 'ড্রাফটে সেভ করুন', 
                    denyButtonText: 'মুছে ফেলুন', 
                    cancelButtonText: 'বাতিল'
                }).then((result) => {
                    if (result.isConfirmed) { 
                        saveDraft(); 
                        document.getElementById('adminModalWrapper').style.display = 'none'; 
                        restorePageScrollAndNav();
                    }
                    else if (result.isDenied) { 
                        document.getElementById('adminModalWrapper').style.display = 'none'; 
                        restorePageScrollAndNav();
                    }
                });
            } else {
                document.getElementById('adminModalWrapper').style.display = 'none';
                restorePageScrollAndNav();
            }
        };
        window.switchAdminTab = function(tab) {
            const form = document.getElementById('writeFormContainer');
            const reports = document.getElementById('reportListContainer');
            form.style.display = 'none'; reports.style.display = 'none';
            if(tab === 'new') { form.style.display = 'block'; } 
            else if (tab === 'reports') { reports.style.display = 'block'; renderReportList(); }
        };

        window.renderReportList = function() {
            const feed = document.getElementById('reportFeed');
            feed.innerHTML = '<p style="text-align:center;">লোড হচ্ছে...</p>';
            get(ref(db, 'reports')).then(snap => {
                const data = snap.val();
                if(!data) { feed.innerHTML = '<p style="text-align:center;">কোনো রিপোর্ট নেই</p>'; return; }
                const reports = Object.entries(data).map(([key, val]) => ({ key, ...val })).reverse();
                feed.innerHTML = reports.map(r => {
                    const reporter = r.reportedByName || `UID: ${r.reportedBy.substr(0,5)}...`;
                    return `<div class="pending-item"><div style="font-weight:bold; color:#e74c3c;">${r.reason.toUpperCase()}</div><div style="font-size:12px; color:#666;">Reported By: ${reporter}</div><div style="font-size:11px; color:#999;">${new Date(r.timestamp).toLocaleDateString()}</div><div class="pending-actions"><button class="btn-view" onclick="openDetailView('${r.postId}')">দেখুন</button><button class="btn-reject" onclick="deleteReportedPost('${r.key}', '${r.postId}')">মুছুন</button><button class="btn-dismiss" onclick="dismissReport('${r.key}')">বাতিল</button></div></div>`;
                }).join('');
            });
        };
        window.dismissReport = function(reportKey) { remove(ref(db, `reports/${reportKey}`)).then(() => { showToast("রিপোর্ট বাতিল হয়েছে"); renderReportList(); }); };
        window.deleteReportedPost = function(reportKey, postKey) { if(confirm("পোস্টটি ডিলিট করবেন?")) { remove(ref(db, `posts/${postKey}`)); remove(ref(db, `reports/${reportKey}`)); showToast("পোস্ট ডিলিট করা হয়েছে 🗑️"); renderReportList(); } };

        window.handleSubmission = async function() {
            const title = document.getElementById('postTitle').value.trim();
            const content = document.getElementById('richEditor').innerHTML;
            const category = document.getElementById('postCategory').value.replace(/.*?ক্যাটাগরি:\s*/g, '').trim();
            const privacy = document.getElementById('postPrivacy').value; // নতুন প্রাইভেসি ইনপুট রিড করা হলো

            if (!title || !document.getElementById('richEditor').innerText.trim()) return showToast('❌ শিরোনাম ও লেখা প্রয়োজন');

            const fullText = (title + " " + document.getElementById('richEditor').innerText).toLowerCase();
            const foundBadWord = BAD_WORDS.find(word => fullText.includes(word));
            if (foundBadWord) { Swal.fire({ icon: 'warning', title: 'সতর্কতা', text: 'আপনার পোস্টে আপত্তিকর শব্দ রয়েছে। দয়া করে ভাষা সংযত করুন।', confirmButtonColor: '#e74c3c' }); return; }

            const btn = document.getElementById('submitBtn');
            btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            let finalImageUrl = null;

            // ইমেজ ক্লাউডিনারি সার্ভারে আপলোড করার লজিক
            if(window.currentImageDataUrl) {
                try {
                    Swal.fire({title: 'ছবি আপলোড হচ্ছে...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
                    const res = await fetch(window.currentImageDataUrl);
                    const blob = await res.blob();

                    // ক্লাউডিনারি আপলোড কল করা হলো
                    finalImageUrl = await window.uploadToCloudinary(blob);
                } catch(e) {
                    btn.disabled = false; btn.innerHTML = 'পোস্ট';
                    return Swal.fire('ত্রুটি', 'ছবি আপলোড ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।', 'error');
                }
            }

            Swal.fire({title: 'পোস্ট পাবলিশ হচ্ছে...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

            const postData = {
                title, content, category: category === 'অন্যান্য' ? 'অন্যান্য' : category,
                privacy: privacy, // ডাটাবেজে প্রাইভেসি সেভ করার জন্য পাঠানো হলো
                date: new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }),
                timestamp: Date.now(), deviceId: DEVICE_ID,
                author: window.currentUser ? window.currentUser.displayName : "বেনামী",
                userImg: window.currentUser ? window.currentUser.photoURL : "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                uid: window.currentUser ? window.currentUser.uid : null,
                image: finalImageUrl, likes: 0, views: 0
            };
            const isAdmin = window.currentUser.uid === ADMIN_UID;
            if (isAdmin) { postData.voice = document.getElementById('voiceUrl').value; postData.isPinned = document.getElementById('isPinned').checked; }

            push(ref(db, 'posts'), postData).then(() => { 
                if(window.currentUser) { update(ref(db, 'users/' + window.currentUser.uid), { lastPostTimestamp: Date.now() }); } 
                Swal.close(); showToast("পাবলিশ হয়েছে ✅"); 
                document.getElementById('adminModalWrapper').style.display = 'none'; 

                // নেভিগেশন শো করা এবং স্ক্রল রিলিজ করা
                document.body.style.overflow = '';
                const header = document.getElementById('fbHeaderContainer');
                if(header) header.style.display = 'block';
                if (typeof window.updateIndicator === 'function') window.updateIndicator();
            });
        };

// --- IMAGE CROPPER FUNCTIONALITY ---
        window.cropper = null; 
        window.rawSelectedImageBase64 = null;
        window.currentImageDataUrl = null;

        // ইমেজ সিলেক্ট চেঞ্জ লিসেনার সংশোধন
        document.getElementById('imgInput').addEventListener('change', function(e) {
            if(!this.files[0]) return;
            const file = this.files[0];
            const reader = new FileReader();
            reader.onload = function(event) {
                window.rawSelectedImageBase64 = event.target.result;
                if (typeof window.openCropper === 'function') {
                    window.openCropper(window.rawSelectedImageBase64);
                }
            };
            reader.readAsDataURL(file);
            this.value = ''; // Reset input
        });

        // ক্রপার ওপেন করার লোকাল ও গ্লোবাল ফাংশন
        function openCropper(imageSrc) {
            document.getElementById('cropperModalOverlay').style.display = 'flex';
            const imgEl = document.getElementById('cropperImageSource');
            imgEl.src = imageSrc;

            if(window.cropper) { window.cropper.destroy(); }

            // Initialize Cropper
            setTimeout(() => {
                window.cropper = new Cropper(imgEl, {
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 1,
                    restore: false,
                    guides: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                });
            }, 100);
        }
        window.openCropper = openCropper;

        // ক্রপার আবার ওপেন করার ফাংশন
        function openCropperAgain() {
            if(window.rawSelectedImageBase64) {
                openCropper(window.rawSelectedImageBase64);
            }
        }
        window.openCropperAgain = openCropperAgain;

        // ক্রপ বাতিল করার ফাংশন
        function cancelCrop() {
            document.getElementById('cropperModalOverlay').style.display = 'none';
            if(window.cropper) window.cropper.destroy();
            if(!window.currentImageDataUrl) {
                removeSelectedImage();
            }
        }
        window.cancelCrop = cancelCrop;

        // ক্রপ নিশ্চিত করার ফাংশন
        function confirmCrop() {
            if(!window.cropper) return;
            const canvas = window.cropper.getCroppedCanvas({ maxWidth: 1200, maxHeight: 1200 });
            window.currentImageDataUrl = canvas.toDataURL('image/jpeg', 0.8);

            document.getElementById('cpImagePreview').src = window.currentImageDataUrl;
            document.getElementById('cpImagePreviewContainer').style.display = 'block';

            document.getElementById('cropperModalOverlay').style.display = 'none';
            window.cropper.destroy();
        }
        window.confirmCrop = confirmCrop;

        // সিলেক্টেড ইমেজ রিমুভ করার লোকাল ও গ্লোবাল ফাংশন (একটি সুনির্দিষ্ট ডিক্লেয়ারেশন)
        function removeSelectedImage() {
            window.currentImageDataUrl = null;
            window.rawSelectedImageBase64 = null;
            const previewContainer = document.getElementById('cpImagePreviewContainer');
            const previewImg = document.getElementById('cpImagePreview');
            if (previewContainer) previewContainer.style.display = 'none';
            if (previewImg) previewImg.src = '';
        }
        window.removeSelectedImage = removeSelectedImage;

        // ক্রপার ইমেজ রোটেট করার ফাংশন
        function rotateCropperImage(degree) {
            if(window.cropper) {
                window.cropper.rotate(degree);
            }
        }
        window.rotateCropperImage = rotateCropperImage;

        // --- PROFILE ---
        window.viewUserProfile = function(uid) {
            if (!uid || uid === 'undefined') return;
            if(window.blockedUsers.includes(uid)) { return showToast("You have blocked this user."); }
            // লোকাল প্রোফাইল ওপেন না করে সরাসরি কুয়েরি প্যারামিটারসহ profile.html এ পাঠানো হচ্ছে
            window.location.href = `profile.html?uid=${uid}`;
        };

        window.toggleVerification = function(targetUid, currentStatus) {
            const newStatus = !currentStatus;
            update(ref(db, `users/${targetUid}`), { isVerified: newStatus }).then(() => {
                showToast(newStatus ? "ব্যবহারকারী ভেরিফাইড হয়েছেন ✅" : "ভেরিফিকেশন বাতিল করা হয়েছে ❌");
                loadProfile(targetUid); 
            });
        };

        window.toggleFollow = function() {
            if (!checkAuth()) return;
            const targetUid = currentlyViewingUid;
            const myUid = window.currentUser.uid;
            const btn = document.getElementById('profileFollowBtn');
            const followersStat = document.getElementById('statFollowers');
            if (btn.classList.contains('following')) {
                remove(ref(db, `followers/${targetUid}/${myUid}`));
                remove(ref(db, `following/${myUid}/${targetUid}`));
                btn.classList.remove('following'); btn.innerText = 'Follow';
                followersStat.innerText = Math.max(0, parseInt(followersStat.innerText) - 1);
            } else {
                update(ref(db, `followers/${targetUid}`), { [myUid]: true });
                update(ref(db, `following/${myUid}`), { [targetUid]: { timestamp: Date.now() } }); 
                btn.classList.add('following'); btn.innerText = 'Follow';
                followersStat.innerText = parseInt(followersStat.innerText) + 1;
            }
        };
        window.switchProfileTab = function(tab, btn) {
            document.querySelectorAll('.p-tab-btn').forEach(b => b.classList.remove('active')); if(btn) btn.classList.add('active');
            const feed = document.getElementById('profileContentFeed');
            if(tab === 'posts') { renderFeed(window.currentUserProfilePosts || [], 'profileContentFeed'); }
            else if(tab === 'drafts') {
                const editBtn = document.getElementById('mainProfileEditBtn');
                if(!editBtn || editBtn.style.display === 'none') { feed.innerHTML = '<div style="text-align:center; color:#888;">গোপন তথ্য</div>'; return; }
                const drafts = JSON.parse(localStorage.getItem('MUKTOLIPI_DRAFTS_V2') || '[]');
                feed.innerHTML = drafts.length ? drafts.map(d => `<div class="glass-panel" style="padding:15px; margin-bottom:10px; border-radius:12px;"><div style="font-weight:bold;">${d.title}</div><div style="font-size:12px;">${d.date}</div></div>`).join('') : '<div style="text-align:center;">কোনো ড্রাফট নেই</div>';
            } else if(tab === 'saved') {
                const editBtn = document.getElementById('mainProfileEditBtn');
                if(!editBtn || editBtn.style.display === 'none') { feed.innerHTML = '<div style="text-align:center; color:#888;">গোপন তথ্য</div>'; return; }
                const savedKeys = JSON.parse(localStorage.getItem('SAVED_POSTS') || '[]');
                renderFeed(window.allPosts.filter(p => savedKeys.includes(p.key)), 'profileContentFeed');
            }
        };

        // --- NAVIGATION ---
        // --- NAVIGATION FUNCTION (UPDATED) ---
window.navTo = function(page, btn, addToHistory = true) {
    // ১. হিস্টোরি ম্যানেজমেন্ট
    if (addToHistory && page !== 'profile') {
        window.history.pushState({ page: page }, "", "?page=" + page);
    }

    // হোম রিফ্রেশ লজিক
    if (page === 'home') {
        const feedView = document.getElementById('feedView');
        if (feedView && feedView.style.display === 'block') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
    }

    // প্রোফাইল পেজে ক্লিক করলে সরাসরি profile.html এ রিডাইরেক্ট করবে
    if (page === 'profile') {
        if (!window.currentUser) { performLogin(); return; }
        window.location.href = `profile.html?uid=${window.currentUser.uid}`;
        return;
    }

    // UI আপডেটস
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    else {
        const targetBtn = document.querySelector(`.nav-item[onclick*="'${page}'"]`);
        if(targetBtn) targetBtn.classList.add('active');
    }

    closeDetailView();
    const feedView = document.getElementById('feedView');

    if (feedView) {
        feedView.style.display = 'none';
    }

    if (page === 'home') {
        if (feedView) feedView.style.display = 'block';
        filterCategory('সব', document.querySelector('.cat-btn'));
    } else if (page === 'saved') {
        if (feedView) feedView.style.display = 'block';
        filterCategory('সংরক্ষিত');
    }
};

        window.filterCategory = function(cat, btn) { if(btn) { document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); } document.getElementById('headerSearchBar').value = ''; activeCategoryFilter = cat; loadPostsChunk(true); };
        window.clearSearch = function() { document.getElementById('headerSearchBar').value = ''; filterPosts(''); };

        window.openDetailView = async function(key) {
            window.history.pushState({ modal: 'detail' }, "", "#detail");
            const post = window.allPosts.find(p => p.key === key); if(!post) return;
            // ... (অন্যান্য কোডসমূহ যথানিয়মে থাকবে)
            document.getElementById('detailView').style.display = 'flex';

            // ডিটেইল ভিউ ওপেন হলে হেডার ছোট হয়ে যাবে
            if (typeof window.setHeaderMode === 'function') {
                window.setHeaderMode(true);
            }
        };
        window.closeDetailView = function() { 
            document.getElementById('detailView').style.display = 'none'; 

            // ডিটেইল ভিউ বন্ধ হলে হোমপেজের হেডারটি আবার ফিরে আসবে
            if (typeof window.setHeaderMode === 'function') {
                const isProfile = new URLSearchParams(window.location.search).get('page') === 'profile';
                const currentPath = window.location.pathname.split('/').pop() || '';
                const isHome = (currentPath === 'index.html' || currentPath === '') && !isProfile;
                window.setHeaderMode(!isHome);
            }
        };
        window.toggleSave = function(key, btn) {
            let saved = JSON.parse(localStorage.getItem('SAVED_POSTS') || '[]');
            if(!saved.includes(key)) { saved.push(key); showToast("সেভ হয়েছে ✅"); btn.innerHTML = `<i class="fas fa-bookmark" style="color:#f39c12"></i> <span>সেভড</span>`; }
            else { saved = saved.filter(k => k !== key); showToast("সেভ বাতিল হয়েছে ❌"); btn.innerHTML = `<i class="far fa-bookmark"></i> <span>সেভ</span>`; }
            localStorage.setItem('SAVED_POSTS', JSON.stringify(saved));
        };
        window.openShareSheet = function(key) {
            const post = window.allPosts.find(p => p.key === key);
            document.getElementById('sheetTitle').innerText = 'শেয়ার করুন'; document.getElementById('sheetFooter').style.display = 'none';
            document.getElementById('sheetBody').innerHTML = `<div class="share-grid"><button class="share-item" onclick="copyPostLink('${key}')"><div class="share-icon-circle"><i class="fas fa-link"></i></div><span style="font-size:11px;">কপি লিংক</span></button><button class="share-item" onclick="nativeShare('${post.title}', '${key}')"><div class="share-icon-circle"><i class="fas fa-share-alt"></i></div><span style="font-size:11px;">শেয়ার অ্যাপ</span></button><button class="share-item" onclick="downloadPostImage('${key}')"><div class="share-icon-circle"><i class="fas fa-download"></i></div><span style="font-size:11px;">ডাউনলোড</span></button></div>`;
            document.getElementById('universalBottomSheet').classList.add('active');
        };
        window.copyPostLink = (key) => { 
    const url = window.location.origin + '?post=' + key;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url);
        showToast("লিংক কপি হয়েছে");
    } else {
        // ক্লিপবোর্ড এপিআই কাজ না করলে WebView/HopWeb এর জন্য ডাইনামিক ফলব্যাক
        const tempInput = document.createElement('textarea');
        tempInput.value = url;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        showToast("লিংক কপি হয়েছে");
    }
    document.getElementById('universalBottomSheet').classList.remove('active'); 
};
        window.nativeShare = (title, key) => { if (navigator.share) navigator.share({ title: title, text: 'মুক্তলিপি ডায়েরি - ' + title, url: window.location.origin + '?post=' + key }); else copyPostLink(key); };
        window.downloadPostImage = (key) => {
            const post = window.allPosts.find(p => p.key === key);
            const captureArea = document.getElementById('quote-capture-area');
            captureArea.style.backgroundImage = post.image ? `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url(${post.image})` : 'linear-gradient(135deg, #1877f2 0%, #00c6ff 100%)';
            document.getElementById('q-text').innerText = post.title; document.getElementById('q-author').innerText = '- ' + post.author;
            document.getElementById('universalBottomSheet').classList.remove('active'); showToast("ছবি তৈরি হচ্ছে...");
            html2canvas(captureArea, { scale: 2 }).then(canvas => { const link = document.createElement('a'); link.download = 'Muktolipi_' + Date.now() + '.png'; link.href = canvas.toDataURL(); link.click(); });
        };
        const fontFamilies = ["'Hind Siliguri', sans-serif", "'Noto Serif Bengali', serif", "'Galada', cursive"];
        window.toggleFont = function() {
            let current = localStorage.getItem('userFont') || fontFamilies[0];
            let idx = fontFamilies.indexOf(current);
            let nextIdx = (idx + 1) % fontFamilies.length;
            document.documentElement.style.setProperty('--current-font', fontFamilies[nextIdx]);
            localStorage.setItem('userFont', fontFamilies[nextIdx]); showToast("ফন্ট পরিবর্তন হয়েছে");
        };
        (function initFont() { const savedFont = localStorage.getItem('userFont'); if(savedFont) document.documentElement.style.setProperty('--current-font', savedFont); })();

        window.showToast = (msg) => { const t = document.getElementById('toast'); document.getElementById('toastMsg').innerText = msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2000); };
        window.execCmd = (cmd) => document.execCommand(cmd, false, null);
        window.addLink = () => { const u = prompt('Link:'); if(u) document.execCommand('createLink', false, u); };
        // --- THEME TOGGLE & SAVE LOGIC ---
        window.toggleTheme = () => {
            const isDark = document.body.classList.toggle('dark-theme');
            const themeBtn = document.getElementById('themeToggleBtn');

            // থিম পরিবর্তন হলে বাটনের লেখা ও আইকন পরিবর্তন করা এবং লোকাল স্টোরেজে সেভ করা
            if(isDark) {
                localStorage.setItem('userTheme', 'dark');
                if(themeBtn) themeBtn.innerHTML = '<i class="fas fa-sun"></i> লাইট মোড';
            } else {
                localStorage.setItem('userTheme', 'light');
                if(themeBtn) themeBtn.innerHTML = '<i class="fas fa-moon"></i> ডার্ক মোড';
            }
        };

        // পেজ লোড হওয়ার সময় আগের সেভ করা থিম এবং বাটনের অবস্থা অ্যাপ্লাই করা
        (function initTheme() {
            const savedTheme = localStorage.getItem('userTheme');
            const themeBtn = document.getElementById('themeToggleBtn');

            if(savedTheme === 'dark') {
                document.body.classList.add('dark-theme');
                if(themeBtn) themeBtn.innerHTML = '<i class="fas fa-sun"></i> লাইট মোড';
            } else {
                if(themeBtn) themeBtn.innerHTML = '<i class="fas fa-moon"></i> ডার্ক মোড';
            }
        })();
        window.saveDraft = () => {
             const title = document.getElementById('postTitle').value;
             const drafts = JSON.parse(localStorage.getItem('MUKTOLIPI_DRAFTS_V2') || '[]');
             drafts.unshift({ title: title || 'Untitled', content: document.getElementById('richEditor').innerHTML, date: new Date().toLocaleString() });
             localStorage.setItem('MUKTOLIPI_DRAFTS_V2', JSON.stringify(drafts)); showToast("ড্রাফট সেভ হয়েছে");
        };
window.closeBottomSheet = (e) => { 
            if(!e || e.target === e.currentTarget) {
                document.getElementById('universalBottomSheet').classList.remove('active');

                // কমেন্ট বন্ধ হলে আগের অবস্থায় ফিরে যাবে
                if (typeof window.setHeaderMode === 'function') {
                    const isProfile = new URLSearchParams(window.location.search).get('page') === 'profile';
                    const currentPath = window.location.pathname.split('/').pop() || '';
                    const isHome = (currentPath === 'index.html' || currentPath === '') && !isProfile;
                    window.setHeaderMode(!isHome);
                }
            }
        };
        window.showLibraryToast = () => showToast("লাইব্রেরি শীঘ্রই আসছে...");
        let lastScrollTop = 0;
window.addEventListener('scroll', function() {
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // বটম নেভিগেশন বারটি স্ক্রিনে থাকলেই কেবল ক্লাস পরিবর্তন হবে
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) {
        if (scrollTop > lastScrollTop && scrollTop > 50) {
            bottomNav.classList.add('nav-hidden');
        } else {
            bottomNav.classList.remove('nav-hidden');
        }
    }

    lastScrollTop = scrollTop;

    const readingProgress = document.getElementById("readingProgress");
    if (readingProgress) {
        readingProgress.style.width = (scrollTop / (document.documentElement.scrollHeight - document.documentElement.clientHeight)) * 100 + "%";
    }
});

        // --- NEW DRAWER FUNCTIONS ---
        window.openDrawer = () => {
            document.getElementById('sideDrawer').classList.add('open');
            document.getElementById('drawerOverlay').classList.add('open');
        };
        window.closeDrawer = () => {
            document.getElementById('sideDrawer').classList.remove('open');
            document.getElementById('drawerOverlay').classList.remove('open');
        };

        window.toggleHeaderSearch = function(show) {
            const defaultHead = document.getElementById('defaultHeader');
            const searchHead = document.getElementById('searchHeader');
            const searchInput = document.getElementById('headerSearchBar');

            if (show) {
                defaultHead.style.display = 'none';
                searchHead.style.display = 'flex';
                searchInput.focus(); 
            } else {
                defaultHead.style.display = 'flex';
                searchHead.style.display = 'none';
                searchInput.value = ''; 
                filterPosts(''); 
            }
        };

        window.filterPosts = function(query) {
            if (!query) {
                document.getElementById('headerSearchClearBtn').style.display = 'none';
                renderFeed(window.allPosts);
                return;
            }

            document.getElementById('headerSearchClearBtn').style.display = 'block';

            const q = query.toLowerCase();

            const filtered = window.allPosts.filter(p => {
                const title = (p.title || "").toLowerCase();
                const author = (p.author || "").toLowerCase();
                const content = (p.content || "").replace(/<[^>]*>/g, "").toLowerCase(); 

                return title.includes(q) || author.includes(q) || content.includes(q);
            });

            renderFeed(filtered);
        };

        window.clearSearchHeader = function() {
            const input = document.getElementById('headerSearchBar');
            input.value = '';
            input.focus();
            filterPosts(''); 
        };

const bottomNav = document.querySelector('.bottom-nav');
        const allInputs = document.querySelectorAll('input, textarea');

        allInputs.forEach(input => {
            input.addEventListener('focus', () => {
                if (bottomNav) bottomNav.style.display = 'none'; 
            });

            input.addEventListener('blur', () => {
                setTimeout(() => {
                    if (bottomNav) bottomNav.style.display = 'flex'; 
                }, 200);
            });
        });

        document.addEventListener('focusin', function(e) {
            if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                if (bottomNav) bottomNav.style.display = 'none';
            }
        });

        document.addEventListener('focusout', function(e) {
            if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                setTimeout(() => {
                    if (bottomNav) bottomNav.style.display = 'flex';
                }, 200);
            }
        });

        // --- MENTION SYSTEM LOGIC ---
        let mentionQuery = "";

        window.handleMentionInput = function(e) {
            const input = e.target;
            const text = input.value;
            const cursor = input.selectionStart; 

            const textBeforeCursor = text.slice(0, cursor);
            const words = textBeforeCursor.split(/\s+/);
            const lastWord = words[words.length - 1];

            if (lastWord.startsWith('@')) {
                mentionQuery = lastWord.substring(1); 
                showMentionSuggestions(mentionQuery);
            } else {
                document.getElementById('mentionList').style.display = 'none';
            }
        };

        window.showMentionSuggestions = function(searchText) {
            const list = document.getElementById('mentionList');

            if(!searchText || searchText.length === 0) {
                list.style.display = 'none';
                return;
            }

            const usersRef = ref(db, 'users');

            get(query(usersRef, orderByChild('displayName'), startAt(searchText), endAt(searchText + "\uf8ff"), limitToFirst(10)))
            .then(snap => {
                const data = snap.val();
                if (!data) {
                    list.style.display = 'none';
                    return;
                }

                const matches = Object.entries(data).map(([uid, u]) => ({uid, ...u}));
                const finalMatches = matches.filter(u => 
                    u.displayName && u.displayName.toLowerCase().includes(searchText.toLowerCase())
                );

                if (finalMatches.length > 0) {
                    list.style.display = 'flex';
                    list.innerHTML = finalMatches.map(u => `
                        <div class="mention-item" onclick="selectMention('${u.displayName}', '${u.uid}')">
                            <img src="${u.photoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="mention-avatar">
                            <div style="display:flex; flex-direction:column;">
                                <span class="mention-name">${u.displayName}</span>
                                ${u.isVerified ? '<span style="font-size:10px; color:#1877f2;">Verified</span>' : ''}
                            </div>
                        </div>
                    `).join('');
                } else {
                    list.style.display = 'none';
                }
            }).catch(err => {
                console.error("Error finding users:", err);
            });
        };

        window.selectMention = function(name, uid) {
            const input = document.getElementById('sheetInput');
            const fullText = input.value;
            const cursor = input.selectionStart; 

            const textBefore = fullText.slice(0, cursor);
            const textAfter = fullText.slice(cursor);
            const lastAtPos = textBefore.lastIndexOf('@');

            if (lastAtPos === -1) return;

            const newText = textBefore.substring(0, lastAtPos) + `@${name} ` + textAfter;

            input.value = newText;
            document.getElementById('mentionList').style.display = 'none';

            const newCursorPos = lastAtPos + name.length + 2; 
            input.focus();
            input.setSelectionRange(newCursorPos, newCursorPos);

            if(!window.mentionedUids) window.mentionedUids = [];
            if(!window.mentionedUids.includes(uid)) {
                window.mentionedUids.push(uid);
            }
        };
// ==================================================
// 🔙 ব্যাক বাটন এবং এক্সিট পপ-আপ লজিক (Start)
// ==================================================

// ১. অ্যাপ লোড হলে একটি ফেইক হিস্টোরি তৈরি করি
window.addEventListener('load', () => {
    // বর্তমান স্টেট রিপ্লেস করি
    window.history.replaceState({ page: 'root' }, "", "");
    // এরপর 'home' স্টেট পুশ করি (যাতে ব্যাক করলে root-এ আসে)
    window.history.pushState({ page: 'home' }, "", "#home");
});

// ২. ব্যাক বাটন চাপলে কি হবে
window.addEventListener('popstate', (event) => {

    // ক) যদি কোনো মডাল (Modal) খোলা থাকে, তবে সেটি বন্ধ হবে
    const detailView = document.getElementById('detailView');
    const chatRoomView = document.getElementById('chatRoomView');
    const storyViewer = document.getElementById('storyViewerModal');

    // Story Viewer খোলা থাকলে
    if(storyViewer && storyViewer.style.display === 'flex') {
        closeStoryViewer();
        return; 
    }
    // Chat Room খোলা থাকলে
    if(chatRoomView && chatRoomView.style.display === 'flex') {
        chatRoomView.style.display = 'none';
        return;
    }
    // Detail View খোলা থাকলে
    if(detailView && detailView.style.display === 'flex') {
        closeDetailView();
        document.getElementById('mainHeader').style.display = 'flex';
        return;
    }

    // খ) যদি আমরা অন্য কোনো পেজে (যেমন Profile/ChatList) থাকি, তবে Home এ ফিরে আসব
    const feedView = document.getElementById('feedView');
    if (feedView.style.display === 'none') {
        // ম্যানুয়ালি হোমে নেভিগেট করা (হিস্টোরি পুশ ছাড়া)
        navTo('home', null); 
        // যেহেতু navTo আবার pushState করে, তাই আমরা সেটা আটকাতে পারি না সহজে,
        // তবে ব্যবহারকারীর অভিজ্ঞতায় এটি ন্যাচারাল মনে হবে।
        return;
    }

    // গ) যদি আমরা Home পেজেই থাকি এবং ব্যাক বাটন চাপি (EXIT CONFIRMATION)
    if (feedView.style.display === 'block') {
        // সুইট অ্যালার্ট পপ-আপ দেখানো
        Swal.fire({
            title: 'অ্যাপ থেকে বের হবেন?',
            text: "আপনি কি অ্যাপটি বন্ধ করতে চান?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'হ্যাঁ, বের হবো',
            cancelButtonText: 'না'
        }).then((result) => {
            if (result.isConfirmed) {
                // যদি হ্যাঁ বলে, অ্যাপ বন্ধ করার চেষ্টা করি (হিস্টোরি ২ ধাপ পিছনে)
                window.history.go(-2); 
                // অথবা উইন্ডো ক্লোজ
                // window.close(); 
            } else {
                // যদি না বলে, আবার স্টেট পুশ করে অ্যাপেই রাখি
                window.history.pushState({ page: 'home' }, "", "#home");
            }
        });
    }
});
// ==================================================
        // 🎯 CREATE MENU & APK UPLOAD LOGIC (NEW)
        // ==================================================

        // ১. প্লাস আইকনে ক্লিক করলে মেনু ওপেন/ক্লোজ হবে
        window.toggleCreateMenu = function() {
            document.getElementById('createMenuDropdown').classList.toggle('show');
        };

// বাইরে ক্লিক করলে মেনু অটোমেটিক বন্ধ হবে
document.addEventListener('click', function(e) {
    if(!e.target.closest('.create-menu-wrapper')) {
        const menu = document.getElementById('createMenuDropdown');
        if(menu && menu.classList.contains('show')) menu.classList.remove('show');
    }
});

// ==================================================
// 🎯 INITIAL APP TRIGGER (লোকাল ক্যাশ ও ফায়ারবেস লোড)
// ==================================================
const cachedPostsData = localStorage.getItem('MUKTOLIPI_CACHED_POSTS');
if (cachedPostsData && typeof window.renderFeed === 'function') {
    window.allPosts = JSON.parse(cachedPostsData);
    window.renderFeed(window.allPosts); // চোখের পলকে অফলাইন ক্যাশ রেন্ডার হবে
}

// ফায়ারবেস ক্র্যাশ এড়ানোর জন্য সেফ ফলব্যাক ফাংশন
        function syncUserProfile(user) {
            console.log("ইউজার প্রোফাইল সিঙ্ক হচ্ছে...", user.uid);
        }

        // --- অ্যান্ড্রয়েড অ্যাপ থেকে প্রাপ্ত গুগল আইডি টোকেন দিয়ে লগইন ---
        window.loginWithAndroidGoogleToken = function(idToken) {
            Swal.fire({title: 'লগইন করা হচ্ছে...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

            // মডিউলের ভেতরে থাকার কারণে এখন এটি ফায়ারবেসের 'auth' এবং 'GoogleAuthProvider' সরাসরি অ্যাক্সেস করতে পারবে
            const credential = GoogleAuthProvider.credential(idToken);
            signInWithCredential(auth, credential)
                .then((result) => {
                    Swal.close();
                    Swal.fire({icon: 'success', title: 'সফল লগইন!', timer: 1500, showConfirmButton: false});
                    setTimeout(() => window.location.reload(), 1500);
                })
                .catch(err => {
                    Swal.close();
                    Swal.fire('ত্রুটি', 'গুগল সাইন-ইন করতে ব্যর্থ হয়েছে', 'error');
                });
        };

        // ব্যাকগ্রাউন্ডে ফায়ারবেস থেকে নতুন ডাটা লোড
        loadPostsChunk(true);


        // প্রোফাইল ফটোতে ক্লিক করলে নিজের প্রোফাইলে নিয়ে যাওয়ার লজিক
        window.goToMyProfile = function() {
            if (window.currentUser) {
                // সরাসরি ডেডিকেটেড profile.html ফাইলে রিডাইরেক্ট করবে
                window.location.href = `profile.html?uid=${window.currentUser.uid}`;
            } else {
                checkAuth();
            }
        }; 

        // --- PWA INSTALLATION LOGIC ---
        let deferredPrompt;
        const installBtn = document.getElementById('installAppBtn');

        // 1. Service Worker Register
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(reg => console.log('Service Worker registered!', reg))
                    .catch(err => console.log('SW registration failed: ', err));
            });
        }

        // 2. Capture install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent default mini-infobar
            e.preventDefault();
            // Store event for later use
            deferredPrompt = e;
            // Show the install button
            if(installBtn) {
                installBtn.style.display = 'flex';
                console.log("Install prompt captured, button shown.");
            }
        });

        // 3. Install Function
        async function installPWA() {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);

                // Hide button if accepted
                if (outcome === 'accepted') {
                    if(installBtn) installBtn.style.display = 'none';
                }
                deferredPrompt = null;
            }
        }

        // 4. Hide button if already installed (Standalone mode)
        window.addEventListener('appinstalled', () => {
            if(installBtn) installBtn.style.display = 'none';
            console.log('PWA was installed');
        });

        if (window.matchMedia('(display-mode: standalone)').matches) {
            if(installBtn) installBtn.style.display = 'none';
        }