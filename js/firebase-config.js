import { db, auth, provider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, deleteUser, ref, set, get, onValue, push, child, update, onChildAdded, remove, onDisconnect } from './firebase-config.js';

/* ─── Variables & Caches ─── */
let currentUser = null;
let activeRoomId = null;
let activePeerId = null;
let friendsCache = {}; // { friendUid: { room_id, user_info, lastMsg, lastTime, unread, timestamp } }
let messagesListener = null;
let activePresenceUnsub = null;
let currentMyRole = 'member';
let currentSettings = { sendMsg: true, approveMember: false };
let activeIsGroup = false;
let emojiOpen = false;
let replyTarget = null;
let ctxTargetDoc = null;
let isBlockedByMe = false;
let isBlockingMe = false;
let currentFilter = 'all';

const EMOJIS = ['😀', '😂', '🥰', '😎', '🤩', '😭', '😤', '🥺', '😅', '🤔', '👍', '👎', '❤️', '🔥', '✅', '🎉', '🙏', '💯', '😍', '🤣', '😊', '🥳', '😴', '🤗', '😘', '💪', '🌟', '🚀', '💬', '🎵', '🍕', '☕', '🌹', '🎮', '💻', '🖥️', '📱', '✨', '😋', '🤑'];

/* ─── Toast Notification ─── */
function showToast(msg, isError = false) {
  // Remove existing toasts
  document.querySelectorAll('.app-toast').forEach(t => t.remove());
  
  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    background:${isError ? '#c0392b' : '#2d2d2d'};
    color:#fff; padding:12px 24px; border-radius:10px; font-size:14px;
    font-weight:500; z-index:99999; box-shadow:0 4px 20px rgba(0,0,0,0.3);
    animation:toastIn 0.2s ease; white-space:nowrap; max-width:90vw;
  `;
  document.body.appendChild(toast);
  
  // Add animation keyframes once
  if (!document.querySelector('#toast-style')) {
    const style = document.createElement('style');
    style.id = 'toast-style';
    style.textContent = `
      @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
      @keyframes toastOut { from { opacity:1; } to { opacity:0; } }
    `;
    document.head.appendChild(style);
  }
  
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}


const loginOverlay = document.getElementById('login-overlay');
const loginEmailInput = document.getElementById('login-email');
const loginPwdInput = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const googleLoginBtn = document.getElementById('google-login-btn');

const authLoginBox = document.getElementById('auth-login-box');
const authRegBox = document.getElementById('auth-register-box');
const showRegBtn = document.getElementById('show-register-btn');
const showLoginBtn = document.getElementById('show-login-btn');

const regName = document.getElementById('reg-name');
const regEmail = document.getElementById('reg-email');
const regPwd = document.getElementById('reg-password');
const regPwdConfirm = document.getElementById('reg-password-confirm');
const registerBtn = document.getElementById('register-btn');

const reqLength = document.getElementById('req-length');
const reqSpecial = document.getElementById('req-special');

const idTooltip = document.getElementById('id-tooltip');

const addFriendModal = document.getElementById('add-friend-modal');
const friendIdInput = document.getElementById('friend-id-input');
const friendResult = document.getElementById('friend-search-result');
const addFriendBtn = document.getElementById('add-friend-btn');

const editProfileModal = document.getElementById('edit-profile-modal');

const convList = document.getElementById('conv-list');
const messagesWrap = document.getElementById('messages-wrap');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const emojiPicker = document.getElementById('emoji-picker');
const emojiGrid = document.getElementById('emoji-grid');
const ctxMenu = document.getElementById('ctx-menu');
const chatBackBtn = document.getElementById('chat-back-btn');
const chatArea = document.querySelector('.chat-area');
const searchInput = document.getElementById('search-input');

const scrollBottomBtn = document.getElementById('scroll-bottom-btn');

const myAvatarArea = document.getElementById('my-avatar-area');
const tooltipIdVal = document.getElementById('tooltip-id-val');
const tooltipCopyBtn = document.getElementById('tooltip-copy-btn');
const settingsNameInput = document.getElementById('settings-name-input');
const settingsAvatarInput = document.getElementById('settings-avatar-input');
const settingsSaveBtn = document.getElementById('settings-save-btn');

const settingsModal = document.getElementById('settings-modal');
const navSettings = document.getElementById('nav-settings');
const logoutBtn = document.getElementById('logout-btn');
const settingsClose = document.getElementById('settings-close');
const likeBtn = document.getElementById('like-btn');

const hideConvModal = document.getElementById('hide-conv-modal');
const unlockConvModal = document.getElementById('unlock-conv-modal');

const btnSendImage = document.getElementById('btn-send-image');
const replyPreview = document.getElementById('reply-preview');
const replyPreviewText = document.getElementById('reply-preview-text');
const replyClose = document.getElementById('reply-close');

const nicknameModal = document.getElementById('nickname-modal');
const btnEditNickname = document.getElementById('btn-edit-nickname');
const nicknameClose = document.getElementById('nickname-close');
const nicknameInput = document.getElementById('nickname-input');
const saveNicknameBtn = document.getElementById('save-nickname-btn');

const themeSelect = document.getElementById('theme-select');
const tagSelect = document.getElementById('tag-select');
const blockUserSwitch = document.getElementById('block-user-switch');
const btnUnfriend = document.getElementById('btn-unfriend');

if (btnUnfriend) {
  btnUnfriend.addEventListener('click', async () => {
    if (!activePeerId || activeIsGroup) return;
    if (!confirm('Bạn có chắc chắn muốn hủy kết bạn với người này?')) return;
    try {
      await update(ref(db), {
        [`friends/${currentUser.uid}/${activePeerId}`]: null,
        [`friends/${activePeerId}/${currentUser.uid}`]: null
      });
      alert('Đã hủy kết bạn!');
      chatArea.classList.remove('active');
      activeRoomId = null;
      activePeerId = null;
      renderConvList(searchInput.value);
    } catch (e) {
      alert('Lỗi: ' + e.message);
    }
  });
}

/* ─── Scroll to Bottom Logic ─── */
if (messagesWrap && scrollBottomBtn) {
  messagesWrap.addEventListener('scroll', () => {
    // If scrolled up more than 150px, show button
    const isAtBottom = (messagesWrap.scrollHeight - messagesWrap.scrollTop - messagesWrap.clientHeight) < 150;
    if (!isAtBottom) {
      scrollBottomBtn.style.display = 'flex';
    } else {
      scrollBottomBtn.style.display = 'none';
    }
  });

  scrollBottomBtn.addEventListener('click', () => {
    scrollToBottom();
  });
}

/* ─── Initialization ─── */
let isInitialized = false;
async function initApp() {
  // Use onAuthStateChanged to properly handle auth restore on page refresh
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (isInitialized) return; // Only init once
    if (firebaseUser) {
      // Authenticated - get user data from Firebase
      try {
        const snap = await get(child(ref(db), `users/${firebaseUser.uid}`));
        if (snap.exists()) {
          isInitialized = true;
          currentUser = snap.val();
          localStorage.setItem('talk_user', JSON.stringify(currentUser));
          initChatInterface();
        } else {
          loginOverlay.style.display = 'flex';
        }
      } catch (err) {
        // Fallback to localStorage on network error
        const savedUser = localStorage.getItem('talk_user');
        if (savedUser) {
          isInitialized = true;
          currentUser = JSON.parse(savedUser);
          initChatInterface();
        } else {
          loginOverlay.style.display = 'flex';
        }
      }
    } else {
      // Not authenticated
      localStorage.removeItem('talk_user');
      loginOverlay.style.display = 'flex';
    }
  });
}

// Format time HH:MM
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

function formatOfflineTime(ts) {
  if (!ts) return 'Ngoại tuyến';
  const now = Date.now();
  const diffHours = (now - ts) / (1000 * 60 * 60);
  
  if (diffHours < 24) {
    const diffMins = Math.floor((now - ts) / (1000 * 60));
    if (diffMins < 1) return 'Vừa mới truy cập';
    if (diffMins < 60) return `Hoạt động ${diffMins} phút trước`;
    return `Hoạt động ${Math.floor(diffHours)} giờ trước`;
  } else if (diffHours < 48) {
    return 'Hoạt động hôm qua';
  } else {
    const d = new Date(ts);
    return `Hoạt động ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`;
  }
}

/* ─── Auth / Login UI Toggles ─── */
if (showRegBtn) showRegBtn.addEventListener('click', () => {
  authLoginBox.style.display = 'none';
  authRegBox.style.display = 'block';
});
if (showLoginBtn) showLoginBtn.addEventListener('click', () => {
  authRegBox.style.display = 'none';
  authLoginBox.style.display = 'block';
});

/* ─── Password Validation ─── */
function validatePassword() {
  const pwd = regPwd.value;
  const confirm = regPwdConfirm.value;

  // 8 chars, letters and numbers
  const hasLengthAndNumAlpha = pwd.length >= 8 && /[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd);
  // 1 uppercase, 1 special
  const hasUpperAndSpecial = /[A-Z]/.test(pwd) && /[^a-zA-Z0-9]/.test(pwd);

  reqLength.innerHTML = hasLengthAndNumAlpha
    ? `<span style="color:#22c55e; font-weight:bold;">✓</span> Đủ 8 kí tự bao gồm số và chữ cái`
    : `<span style="color:var(--red); font-weight:bold;">x</span> Đủ 8 kí tự bao gồm số và chữ cái`;

  reqSpecial.innerHTML = hasUpperAndSpecial
    ? `<span style="color:#22c55e; font-weight:bold;">✓</span> Ít nhất 1 chữ in hoa và 1 kí tự đặc biệt`
    : `<span style="color:var(--red); font-weight:bold;">x</span> Ít nhất 1 chữ in hoa và 1 kí tự đặc biệt`;

  if (hasLengthAndNumAlpha && hasUpperAndSpecial && pwd === confirm && pwd !== '') {
    registerBtn.style.opacity = '1';
    registerBtn.style.pointerEvents = 'auto';
  } else {
    registerBtn.style.opacity = '0.5';
    registerBtn.style.pointerEvents = 'none';
  }
}

if (regPwd) regPwd.addEventListener('input', validatePassword);
if (regPwdConfirm) regPwdConfirm.addEventListener('input', validatePassword);

/* ─── Register ─── */
if (registerBtn) registerBtn.addEventListener('click', async () => {
  const name = regName.value.trim();
  const email = regEmail.value.trim();
  const pwd = regPwd.value;
  if (!name || !email) return alert('Vui lòng nhập tên và email!');

  registerBtn.textContent = 'Đang xử lý...';
  registerBtn.disabled = true;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pwd);
    const user = cred.user;
    const uid = user.uid;

    let id4 = "";
    while (true) {
      id4 = Math.floor(1000 + Math.random() * 9000).toString();
      const snap = await get(child(ref(db), `id_map/${id4}`));
      if (!snap.exists()) break;
    }

    const avatar = `https://api.dicebear.com/8.x/notionists/svg?seed=${uid}&backgroundColor=${Math.floor(Math.random() * 16777215).toString(16)}`;
    const userData = { uid, id4, name, avatar, email, last_active: Date.now() };

    const updates = {};
    updates[`id_map/${id4}`] = uid;
    updates[`users/${uid}`] = userData;
    await update(ref(db), updates);

    currentUser = userData;
    localStorage.setItem('talk_user', JSON.stringify(userData));
    loginOverlay.style.display = 'none';
    initChatInterface();
  } catch (err) {
    alert('Lỗi đăng ký: ' + err.message);
    registerBtn.textContent = 'Tạo tài khoản';
    registerBtn.disabled = false;
  }
});

/* ─── Login ─── */
if (loginBtn) loginBtn.addEventListener('click', async () => {
  const email = loginEmailInput.value.trim();
  const pwd = loginPwdInput.value;
  if (!email || !pwd) return alert('Vui lòng nhập email và mật khẩu!');

  loginBtn.textContent = 'Đang xử lý...';
  loginBtn.disabled = true;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pwd);
    const uid = cred.user.uid;
    const snap = await get(child(ref(db), `users/${uid}`));

    if (snap.exists()) {
      currentUser = snap.val();
      // Update last active
      currentUser.last_active = Date.now();
      await update(ref(db, `users/${uid}`), { last_active: Date.now() });

      localStorage.setItem('talk_user', JSON.stringify(currentUser));
      loginOverlay.style.display = 'none';
      initChatInterface();
    } else {
      alert('Không tìm thấy thông tin người dùng trong DB!');
    }
  } catch (err) {
    alert('Lỗi đăng nhập: ' + err.message);
  } finally {
    loginBtn.textContent = 'Đăng nhập';
    loginBtn.disabled = false;
  }
});

googleLoginBtn.addEventListener('click', async () => {
  if (!auth) return alert('Chưa cấu hình Firebase Auth!');
  try {
    googleLoginBtn.textContent = 'Đang xử lý...';
    googleLoginBtn.disabled = true;

    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const uid = user.uid; // Use real firebase uid

    const snap = await get(child(ref(db), `users/${uid}`));
    if (snap.exists()) {
      // User exists
      currentUser = snap.val();
    } else {
      // New user
      let id4 = "";
      while (true) {
        id4 = Math.floor(1000 + Math.random() * 9000).toString();
        const check = await get(child(ref(db), `id_map/${id4}`));
        if (!check.exists()) break;
      }
      const userData = {
        uid: uid,
        id4: id4,
        name: user.displayName || 'Khách',
        avatar: user.photoURL || `https://api.dicebear.com/8.x/notionists/svg?seed=${uid}&backgroundColor=b31a2e`
      };
      const updates = {};
      updates[`id_map/${id4}`] = uid;
      updates[`users/${uid}`] = userData;
      await update(ref(db), updates);
      currentUser = userData;
    }

    localStorage.setItem('talk_user', JSON.stringify(currentUser));
    loginOverlay.style.display = 'none';
    initChatInterface();
  } catch (err) {
    console.error(err);
    alert('Lỗi đăng nhập Google: ' + err.message);
    googleLoginBtn.innerHTML = 'Đăng nhập bằng Google';
    googleLoginBtn.disabled = false;
  }
});

/* ─── Auto Cleanup Data (> 30 days) ─── */
async function cleanupOldData() {
  if (!db || !currentUser) return;
  try {
    const usersSnap = await get(child(ref(db), 'users'));
    if (!usersSnap.exists()) return;

    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    usersSnap.forEach(childSnap => {
      const u = childSnap.val();
      if (u.last_active && (now - u.last_active > THIRTY_DAYS)) {
        // Tương lai: Gọi logic xoá dữ liệu liên quan đến u.uid ở đây
        // VD: remove(ref(db, `messages/${room_id}`));
        console.log("Found inactive user > 30 days:", u.uid);
      }
    });
  } catch (err) {
    console.error("Lỗi dọn dẹp data:", err);
  }
}

function setupPresence() {
  const connectedRef = ref(db, '.info/connected');
  const myStatusRef = ref(db, `status/${currentUser.uid}`);
  onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      onDisconnect(myStatusRef).set({ state: 'offline', ts: Date.now() }).then(() => {
        set(myStatusRef, { state: 'online', ts: Date.now() });
      });
    }
  });
}

/* ─── Main Chat Interface Setup ─── */
function initChatInterface() {
  loginOverlay.style.display = 'none';
  cleanupOldData(); // Chạy dọn dẹp data ngầm

  // Update my profile pic
  const navAvatar = document.querySelector('.nav-avatar img');
  if (navAvatar) navAvatar.src = currentUser.avatar;

  // Update settings dropdown header
  const ddAvatarImg = document.getElementById('dd-avatar-img');
  const ddUserName = document.getElementById('dd-user-name');
  const ddUserId = document.getElementById('dd-user-id');
  if (ddAvatarImg) ddAvatarImg.src = currentUser.avatar;
  if (ddUserName) ddUserName.textContent = currentUser.name;
  if (ddUserId) ddUserId.textContent = 'ID: ' + (currentUser.id4 || '---');

  // Also sync the theme switch state now that DOM is ready
  const sw = document.getElementById('tola-dark-switch');
  if (sw) sw.checked = localStorage.getItem('tola_theme') === 'dark';

  // Setup real-time presence (Zero bandwidth cost approach)
  setupPresence();

  // Load Privacy settings
  const privacyCheck = document.getElementById('privacy-stranger-msg');
  if (privacyCheck) {
    get(child(ref(db), `users/${currentUser.uid}/settings/allow_stranger_msg`)).then(snap => {
      // Mặc định là cho phép (true) nếu chưa có cài đặt
      privacyCheck.checked = snap.exists() ? snap.val() : true;
    });
  }

  // Listen to my friends/chats list
  const friendsRef = ref(db, `friends/${currentUser.uid}`);
  onValue(friendsRef, async (snap) => {
    const list = snap.val() || {};
    console.log("Danh sách bạn bè thô từ Firebase cho UID (" + currentUser.uid + "):", list);
    // { friendUid: room_id }

    let cacheUpdated = false;
    for (const [fuid, roomData] of Object.entries(list)) {
      const data = typeof roomData === 'string' ? { room_id: roomData } : (roomData || {});
      const resolvedRoomId = data.room_id || fuid;

      const usnap = await get(child(ref(db), `users/${fuid}`));
      if (!usnap.exists()) continue;

      const userInfo = usnap.val();
      const tagSnap = await get(child(ref(db), `friends/${currentUser.uid}/${fuid}/tag`));
      const storedTag = tagSnap.val();
      const derivedTag = storedTag && storedTag !== 'none'
        ? storedTag
        : (userInfo.id4 === 'NHOM' || (userInfo.id4 && userInfo.id4.startsWith('gr.')) ? 'group' : 'friend');

      const updatedEntry = {
        uid: fuid,
        room_id: resolvedRoomId,
        user_info: userInfo,
        lastMsg: data.lastMsg || '',
        lastTime: data.lastTime || '',
        ts: Number(data.ts) || 0,
        unread: Number(data.unread) || 0,
        tag: derivedTag
      };

      const prevEntry = friendsCache[fuid];
      const hasChanged = !prevEntry
        || prevEntry.room_id !== updatedEntry.room_id
        || prevEntry.lastMsg !== updatedEntry.lastMsg
        || prevEntry.lastTime !== updatedEntry.lastTime
        || prevEntry.ts !== updatedEntry.ts
        || prevEntry.unread !== updatedEntry.unread
        || prevEntry.tag !== updatedEntry.tag
        || prevEntry.user_info?.name !== updatedEntry.user_info?.name
        || prevEntry.user_info?.avatar !== updatedEntry.user_info?.avatar;

      if (hasChanged) {
        friendsCache[fuid] = updatedEntry;
        cacheUpdated = true;
      }

      if (Number(data.unread) > 0 && activeRoomId === resolvedRoomId) {
        friendsCache[fuid].unread = 0;
        update(ref(db), { [`friends/${currentUser.uid}/${fuid}/unread`]: 0 });
        cacheUpdated = true;
      }
    } // END OF FOR LOOP

    // Remove deleted friends from cache
    for (const fuid of Object.keys(friendsCache)) {
      if (!list[fuid]) {
        delete friendsCache[fuid];
        cacheUpdated = true;
        
        // If the user currently has this chat open, force close it
        if (fuid === activePeerId) {
          alert('Bạn không còn nằm trong cuộc trò chuyện này nữa.');
          chatArea.classList.remove('active');
          activeRoomId = null;
          activePeerId = null;
        }
      }
    }

    if (cacheUpdated) {
      renderConvList(searchInput.value);
      updateContactsList();
    }
  });

  renderContacts();
  initEmojiPicker();
}
/* ─── Avatar Tooltip & Edit Profile ─── */
const settingsDropdown = document.getElementById('settings-dropdown');

// Avatar no longer opens the settings dropdown, you can add profile view logic here if needed.
if (myAvatarArea) {
  myAvatarArea.addEventListener('click', (e) => {
    e.stopPropagation();
    if (settingsDropdown) settingsDropdown.classList.toggle('active');
  });
}
if (tooltipCopyBtn) {
  tooltipCopyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentUser.id4);
    tooltipCopyBtn.textContent = 'Đã Copy!';
    setTimeout(() => { tooltipCopyBtn.textContent = 'Copy ID'; }, 2000);
  });
}
document.addEventListener('click', (e) => {
  if (idTooltip && !e.target.closest('#id-tooltip')) {
    idTooltip.style.display = 'none';
  }
  if (settingsDropdown && settingsDropdown.classList.contains('active') && !e.target.closest('#settings-dropdown') && !e.target.closest('#nav-settings')) {
    settingsDropdown.classList.remove('active');
  }
});

/* ─── Premium Account Info Profile Modal Controller ─── */
async function openProfileModal() {
  if (!currentUser) return;

  // Try fetching latest data from Firebase to be absolute sure it is up to date
  try {
    const snap = await get(child(ref(db), `users/${currentUser.uid}`));
    if (snap.exists()) {
      currentUser = snap.val();
      localStorage.setItem('talk_user', JSON.stringify(currentUser));
    }
  } catch (err) {
    console.error("Error loading user profile:", err);
  }

  // Populate cover & avatar
  document.getElementById('profile-cover-img').src = currentUser.cover || 'https://images.unsplash.com/photo-1707343843437-caacff5cfa74?q=80&w=600';
  document.getElementById('profile-avatar-img-modal').src = currentUser.avatar || 'https://api.dicebear.com/8.x/notionists/svg?seed=Guest';

  // Populate Display Name
  document.getElementById('profile-name-val').textContent = currentUser.name || 'Chưa cập nhật';
  document.getElementById('profile-name-input').value = currentUser.name || '';

  // Populate Business Info
  document.getElementById('profile-business-val').textContent = currentUser.businessInfo || 'Tạo thông tin kinh doanh để khách hàng biết thêm thông tin về bạn';
  document.getElementById('profile-business-input').value = currentUser.businessInfo || '';

  // Populate Personal Info
  document.getElementById('profile-gender-val').textContent = currentUser.gender || 'Chưa cập nhật';
  document.getElementById('profile-gender-input').value = currentUser.gender || 'Chưa cập nhật';

  document.getElementById('profile-birthday-val').textContent = currentUser.birthday || 'Chưa cập nhật';
  document.getElementById('profile-birthday-input').value = currentUser.birthday || '';

  document.getElementById('profile-phone-val').textContent = currentUser.phone || 'Chưa cập nhật';
  document.getElementById('profile-phone-input').value = currentUser.phone || '';

  // Reset toggles (show display states, hide edit states)
  document.getElementById('profile-name-display-row').style.display = 'flex';
  document.getElementById('profile-name-edit-row').style.display = 'none';

  document.getElementById('business-display-body').style.display = 'block';
  document.getElementById('business-edit-body').style.display = 'none';

  document.getElementById('personal-display-body').style.display = 'block';
  document.getElementById('personal-edit-body').style.display = 'none';

  // Open modal
  editProfileModal.classList.add('active');
}

// 1. Close Modal
document.getElementById('edit-profile-close').addEventListener('click', () => {
  editProfileModal.classList.remove('active');
});

// Helper to quickly save user updates to Firebase and sync state
async function saveUserFields(fields) {
  try {
    const updates = {};
    for (const [key, val] of Object.entries(fields)) {
      updates[`users/${currentUser.uid}/${key}`] = val;
    }
    await update(ref(db), updates);

    // Update local cached user info
    currentUser = { ...currentUser, ...fields };
    localStorage.setItem('talk_user', JSON.stringify(currentUser));
    return true;
  } catch (err) {
    alert("Lỗi khi lưu dữ liệu: " + err.message);
    return false;
  }
}

// Helper to sync avatar image elements across the application
function syncAvatarUI(avatarUrl) {
  const avImg = document.getElementById('my-avatar-img');
  if (avImg) avImg.src = avatarUrl;
  const navAv = document.querySelector('.nav-avatar img');
  if (navAv) navAv.src = avatarUrl;
  const ddAv = document.getElementById('dd-avatar-img');
  if (ddAv) ddAv.src = avatarUrl;
}

// 2. Display Name Edit Action
document.getElementById('btn-edit-name-pencil').addEventListener('click', () => {
  document.getElementById('profile-name-display-row').style.display = 'none';
  document.getElementById('profile-name-edit-row').style.display = 'flex';
  document.getElementById('profile-name-input').focus();
});
document.getElementById('btn-cancel-name').addEventListener('click', () => {
  document.getElementById('profile-name-display-row').style.display = 'flex';
  document.getElementById('profile-name-edit-row').style.display = 'none';
  document.getElementById('profile-name-input').value = currentUser.name || '';
});
document.getElementById('btn-save-name').addEventListener('click', async () => {
  const newName = document.getElementById('profile-name-input').value.trim();
  if (!newName) return alert("Vui lòng nhập tên!");

  const ok = await saveUserFields({ name: newName });
  if (ok) {
    document.getElementById('profile-name-val').textContent = newName;
    const nameEl = document.getElementById('dd-user-name');
    if (nameEl) nameEl.textContent = newName;
    document.getElementById('profile-name-display-row').style.display = 'flex';
    document.getElementById('profile-name-edit-row').style.display = 'none';
  }
});

// 3. Edit Cover Photo
document.getElementById('btn-edit-cover').addEventListener('click', async () => {
  const url = prompt("Nhập URL hình nền/ảnh bìa của bạn:", currentUser.cover || "");
  if (url === null) return; // Prompt cancelled
  const finalUrl = url.trim() || 'https://images.unsplash.com/photo-1707343843437-caacff5cfa74?q=80&w=600';

  const ok = await saveUserFields({ cover: finalUrl });
  if (ok) {
    document.getElementById('profile-cover-img').src = finalUrl;
  }
});

// 4. Edit Avatar Photo
document.getElementById('btn-edit-avatar-modal').addEventListener('click', async () => {
  const url = prompt("Nhập URL hình ảnh đại diện mới:", currentUser.avatar || "");
  if (url === null) return; // Prompt cancelled
  const finalUrl = url.trim();
  if (!finalUrl) return alert("Vui lòng nhập URL ảnh đại diện!");

  const ok = await saveUserFields({ avatar: finalUrl });
  if (ok) {
    document.getElementById('profile-avatar-img-modal').src = finalUrl;
    syncAvatarUI(finalUrl);
  }
});

// 5. Business Info Edit Action
document.getElementById('btn-edit-business').addEventListener('click', () => {
  document.getElementById('business-display-body').style.display = 'none';
  document.getElementById('business-edit-body').style.display = 'block';
  document.getElementById('profile-business-input').focus();
});
document.getElementById('btn-cancel-business').addEventListener('click', () => {
  document.getElementById('business-display-body').style.display = 'block';
  document.getElementById('business-edit-body').style.display = 'none';
  document.getElementById('profile-business-input').value = currentUser.businessInfo || '';
});
document.getElementById('btn-save-business').addEventListener('click', async () => {
  const desc = document.getElementById('profile-business-input').value.trim();
  const defaultText = 'Tạo thông tin kinh doanh để khách hàng biết thêm thông tin về bạn';
  const val = desc || defaultText;

  const ok = await saveUserFields({ businessInfo: val });
  if (ok) {
    document.getElementById('profile-business-val').textContent = val;
    document.getElementById('business-display-body').style.display = 'block';
    document.getElementById('business-edit-body').style.display = 'none';
  }
});

// 6. Personal Info Edit Action
document.getElementById('btn-edit-personal').addEventListener('click', () => {
  document.getElementById('personal-display-body').style.display = 'none';
  document.getElementById('personal-edit-body').style.display = 'block';
});
document.getElementById('btn-cancel-personal').addEventListener('click', () => {
  document.getElementById('personal-display-body').style.display = 'block';
  document.getElementById('personal-edit-body').style.display = 'none';

  document.getElementById('profile-gender-input').value = currentUser.gender || 'Chưa cập nhật';
  document.getElementById('profile-birthday-input').value = currentUser.birthday || '';
  document.getElementById('profile-phone-input').value = currentUser.phone || '';
});
document.getElementById('btn-save-personal').addEventListener('click', async () => {
  const gender = document.getElementById('profile-gender-input').value;
  const birthday = document.getElementById('profile-birthday-input').value.trim() || 'Chưa cập nhật';
  const phone = document.getElementById('profile-phone-input').value.trim() || 'Chưa cập nhật';

  const ok = await saveUserFields({ gender, birthday, phone });
  if (ok) {
    document.getElementById('profile-gender-val').textContent = gender;
    document.getElementById('profile-birthday-val').textContent = birthday;
    document.getElementById('profile-phone-val').textContent = phone;

    document.getElementById('personal-display-body').style.display = 'block';
    document.getElementById('personal-edit-body').style.display = 'none';
  }
});

/* ─── Add Friend Feature ─── */
document.getElementById('open-add-friend-btn').addEventListener('click', () => {
  addFriendModal.classList.add('active');
  friendIdInput.value = '';
  friendResult.innerHTML = '';
  addFriendBtn.style.display = 'none';
  addFriendBtn.onclick = null;
});
document.getElementById('friend-modal-close').addEventListener('click', () => {
  addFriendModal.classList.remove('active');
});

// Search by 4 digit
let searchDebounce;
friendIdInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  const id4 = friendIdInput.value.trim();
  friendResult.innerHTML = '';
  addFriendBtn.style.display = 'none';

  if (id4.length === 4 || id4.length === 7) {
    searchDebounce = setTimeout(async () => {
      friendResult.innerHTML = 'Đang tìm...';
      const snap = await get(child(ref(db), `id_map/${id4}`));
      if (snap.exists()) {
        const uid = snap.val();
        if (uid === currentUser.uid) {
          friendResult.innerHTML = 'Đây là ID của bạn!';
          return;
        }
        // Fetch data (can be user or group)
        const uSnap = await get(child(ref(db), `users/${uid}`));
        if (uSnap.exists()) {
          const uData = uSnap.val();
          const isGroup = id4.startsWith('gr.');

          friendResult.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; margin-top:20px; padding:14px; background:var(--bg-input); border-radius:12px; border:1px solid var(--border);">
              <img src="${uData.avatar}" style="width:50px; height:50px; border-radius:50%; object-fit:cover; flex-shrink:0; background:var(--bg-input);">
              <div style="text-align:left; flex:1; min-width:0;">
                <div style="font-weight:700; font-size:15px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${uData.name}</div>
                <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">#${uData.id4}${isGroup ? ' · Nhóm' : ''}</div>
              </div>
            </div>
          `;

          if (isGroup) {
            addFriendBtn.textContent = 'Xin tham gia nhóm';
            addFriendBtn.style.display = 'block';
            addFriendBtn.onclick = async () => {
              addFriendBtn.textContent = 'Đang gửi...';
              addFriendBtn.disabled = true;
              try {
                const requireApproval = uData.settings && (uData.settings.approveMember || uData.settings.require_approval);
                if (requireApproval) {
                  // Add to pending
                  await update(ref(db), {
                    [`users/${uid}/pending/${currentUser.uid}`]: {
                      name: currentUser.name,
                      avatar: currentUser.avatar,
                      ts: Date.now()
                    }
                  });
                  alert('Đã gửi yêu cầu tham gia. Vui lòng chờ quản trị viên duyệt!');
                } else {
                  // Join directly
                  const updates = {};
                  updates[`users/${uid}/members/${currentUser.uid}`] = { role: 'member', ts: Date.now() };
                  updates[`friends/${currentUser.uid}/${uid}/room_id`] = uid;
                  updates[`friends/${currentUser.uid}/${uid}/lastMsg`] = `Bạn đã tham gia nhóm ${uData.name}`;
                  updates[`friends/${currentUser.uid}/${uid}/lastTime`] = formatTime(Date.now());
                  updates[`friends/${currentUser.uid}/${uid}/ts`] = Date.now();
                  await update(ref(db), updates);
                  alert('Bạn đã tham gia nhóm thành công!');
                }
                addFriendModal.classList.remove('active');
              } catch (e) {
                alert('Lỗi: ' + e.message);
              } finally {
                addFriendBtn.textContent = 'Xin tham gia nhóm';
                addFriendBtn.disabled = false;
              }
            };
          } else {
            // Check if already friend
            const alreadyFriend = Object.values(friendsCache).some(f => f && f.user_info && f.user_info.id4 === uData.id4 && !f.user_info.id4?.startsWith('gr.'));
            addFriendBtn.textContent = alreadyFriend ? 'Nhắn tin' : 'Xem hồ sơ';
            addFriendBtn.style.display = 'block';
            addFriendBtn.onclick = () => {
              addFriendModal.classList.remove('active');
              if (alreadyFriend) {
                 const friendConv = Object.values(friendsCache).find(f => f && f.user_info && f.user_info.id4 === uData.id4 && !f.user_info.id4?.startsWith('gr.'));
                 if (friendConv) {
                    selectChat(friendConv);
                 }
              } else {
                currentStrangerId = uid;
                const currentStrangerData = uData;
                document.getElementById('stranger-cover-img').src = currentStrangerData.cover || 'https://images.unsplash.com/photo-1707343843437-caacff5cfa74?q=80&w=600';
                document.getElementById('stranger-avatar-img').src = currentStrangerData.avatar;
                document.getElementById('stranger-name-val').textContent = currentStrangerData.name;
                document.getElementById('stranger-intro-input').value = `Xin chào, mình là ${currentUser.name}. Kết bạn với mình nhé!`;
                strangerProfileModal.classList.add('active');
              }
            };
          }
        }
      } else {
        friendResult.innerHTML = '<span style="color:#ff4466;">Không tìm thấy người dùng mã này!</span>';
      }
    }, 500);
  }
});

async function createChatWith(user) {
  addFriendBtn.textContent = 'Đang kết bạn...';
  addFriendBtn.disabled = true;

  // Create room ID
  const room_id = currentUser.uid < user.uid
    ? `${currentUser.uid}_${user.uid}`
    : `${user.uid}_${currentUser.uid}`;

  // Update friends structure for both
  const updates = {};
  updates[`friends/${currentUser.uid}/${user.uid}/room_id`] = room_id;
  updates[`friends/${user.uid}/${currentUser.uid}/room_id`] = room_id;

  try {
    await update(ref(db), updates);
    addFriendModal.classList.remove('active');
    addFriendBtn.disabled = false;
    addFriendBtn.textContent = 'Kết bạn';
  } catch (err) {
    console.error(err);
    alert('Lỗi: ' + err.message);
  }
}

// Stranger Modal Logic
document.getElementById('stranger-profile-close')?.addEventListener('click', () => {
  document.getElementById('stranger-profile-modal').classList.remove('active');
});

document.getElementById('stranger-add-btn')?.addEventListener('click', async () => {
  if (!currentStrangerId) return;
  const btn = document.getElementById('stranger-add-btn');
  btn.textContent = 'Đang gửi...';
  btn.disabled = true;

  const intro = document.getElementById('stranger-intro-input').value.trim() || `Xin chào, mình là ${currentUser.name}. Kết bạn với mình nhé!`;

  try {
    await update(ref(db), {
      [`friend_requests/${currentStrangerId}/${currentUser.uid}`]: {
        ts: Date.now(),
        intro: intro,
        senderData: {
          name: currentUser.name,
          avatar: currentUser.avatar,
          id4: currentUser.id4
        }
      }
    });
    alert('Đã gửi lời mời kết bạn!');
    document.getElementById('stranger-profile-modal').classList.remove('active');
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btn.textContent = 'Kết bạn';
    btn.disabled = false;
  }
});

document.getElementById('stranger-message-btn')?.addEventListener('click', async () => {
  if (!currentStrangerId) return;
  document.getElementById('stranger-profile-modal').classList.remove('active');

  // Create a room_id for strangers, similar to friends but set tag to stranger
  const room_id = currentUser.uid < currentStrangerId
    ? `${currentUser.uid}_${currentStrangerId}`
    : `${currentStrangerId}_${currentUser.uid}`;

  const updates = {};
  updates[`friends/${currentUser.uid}/${currentStrangerId}/room_id`] = room_id;
  updates[`friends/${currentUser.uid}/${currentStrangerId}/tag`] = 'stranger';

  try {
    await update(ref(db), updates);
    // Open chat
    const snap = await get(child(ref(db), `users/${currentStrangerId}`));
    if (snap.exists()) {
      const uData = snap.val();
      selectChat({
        room_id: room_id,
        uid: currentStrangerId,
        user_info: uData,
        tag: 'stranger'
      });
      document.querySelector('.sidebar').classList.add('mobile-hidden');
      document.querySelector('.chat-area').classList.add('active');
    }
  } catch (e) {
    alert('Lỗi tạo tin nhắn: ' + e.message);
  }
});
let selectedTags = [];

/* ─── Render Conversation List ─── */
function renderConvList(filter = '') {
  convList.innerHTML = '';
  let list = [];
  try {
    list = Object.values(friendsCache)
      .filter(c => c && c.user_info && c.user_info.name)
      .sort((a, b) => b.ts - a.ts);
  } catch (e) {
    console.error('Lỗi khi truy xuất friendsCache:', e, friendsCache);
    list = [];
  }

  const tagLabels = {
    'friend': 'Bạn bè',
    'work': 'Công việc',
    'family': 'Gia đình',
    'stranger': 'Người lạ',
    'group': 'Nhóm'
  };

  let count = 0;
  list.forEach(c => {
    if (!c || !c.user_info) return;
    let isHidden = false;
    let isUnlocked = false;
    let requireUnlockOnClick = false;

    if (typeof isConvHidden === 'function') {
      isHidden = isConvHidden(c.room_id);
      isUnlocked = window._hiddenUnlocked && window._hiddenUnlocked.has(c.room_id);
    }

    let searchMatched = false;
    if (filter) {
      const lower = filter.toLowerCase();
      const matchName = c.user_info.name && c.user_info.name.toLowerCase().includes(lower);
      const matchId = c.user_info.id4 && c.user_info.id4.toLowerCase().includes(lower);
      const matchExactId = c.user_info.id4 && c.user_info.id4.toLowerCase() === lower;
      
      const pin = typeof getConvPin === 'function' ? getConvPin(c.room_id) : null;
      const matchExactPin = isHidden && pin && filter === pin;

      if (matchName || matchId || matchExactPin) {
        searchMatched = true;
      }

      if (isHidden && !isUnlocked) {
        if (matchExactPin) {
          if (!window._hiddenUnlocked) window._hiddenUnlocked = new Set();
          window._hiddenUnlocked.add(c.room_id);
          isUnlocked = true;
        } else if (matchExactId) {
          requireUnlockOnClick = true;
        } else {
          return;
        }
      } else if (!searchMatched) {
        return;
      }
    } else {
      if (isHidden && !isUnlocked) return;
    }

    // Tabs filter
    if (currentFilter === 'unread' && c.unread <= 0) return;
    const isGroup = c.user_info.id4 && (c.user_info.id4 === 'NHOM' || c.user_info.id4.startsWith('gr.'));
    if (currentFilter === 'group' && !isGroup) return;

    // Tag filter
    if (selectedTags.length > 0) {
      const cTag = c.tag || 'none';
      if (!selectedTags.includes(cTag)) return;
    }

    const item = document.createElement('div');
    item.className = 'conv-item' + (c.room_id === activeRoomId ? ' active' : '');
    item.dataset.roomId = c.room_id;

    const badge = c.unread > 0
      ? `<div class="unread-badge">${c.unread > 99 ? '99+' : c.unread}</div>` : '';
    const previewClass = c.unread > 0 ? 'conv-preview unread' : 'conv-preview';

    let tagHtml = '';
    if (c.tag && c.tag !== 'none' && tagLabels[c.tag]) {
      tagHtml = `<span class="conv-tag tag-${c.tag}">${tagLabels[c.tag]}</span>`;
    }

    item.innerHTML = `
      <div class="avatar-wrap">
        <img src="${c.user_info.avatar || ''}" alt="${c.user_info.name || ''}" class="avatar">
        <div class="online-dot" id="online-dot-${c.uid}" style="display:none;"></div>
      </div>
      <div class="conv-info">
        <div class="conv-name">${c.user_info.name || ''}</div>
        <div class="${previewClass}">${tagHtml}${c.lastMsg || 'Bắt đầu trò chuyện...'}</div>
      </div>
      <div class="conv-meta">
        <div class="conv-time">${c.lastTime || ''}</div>
        ${badge}
      </div>
    `;
    item.addEventListener('click', () => {
      if (requireUnlockOnClick) {
        // Temp save target
        convCtxTargetRoomId = c.room_id;
        openUnlockModal(c.room_id, (rId) => {
          // Temporarily unlock for this session only (no DB save)
          if (!window._hiddenUnlocked) window._hiddenUnlocked = new Set();
          window._hiddenUnlocked.add(rId);
          renderConvList(searchInput.value);
          selectChat(c);
        });
      } else {
        selectChat(c);
      }
    });
    convList.appendChild(item);
    count++;
  });

  if (count === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = 'color:var(--text-muted);font-size:15px;text-align:center;padding:32px 0;';
    emptyDiv.textContent = 'Không có hội thoại nào.';
    convList.appendChild(emptyDiv);
  }
}

let searchDebounceMain;
searchInput.addEventListener('input', e => {
  const val = e.target.value.trim();
  
  // Always render filtered list first (by name)
  renderConvList(val);
  
  // If looks like an ID (4 digits or gr.xxxx), also search Firebase
  const isGroupId = val.startsWith('gr.') && val.length >= 5;
  const isUserId = /^\d{4}$/.test(val);
  
  clearTimeout(searchDebounceMain);
  if (isGroupId || isUserId) {
    searchDebounceMain = setTimeout(async () => {
      try {
        const searchVal = val.replace('.', '-');
        const snap = await get(child(ref(db), `id_map/${searchVal}`));
        if (!snap.exists()) return;
        const uid = snap.val();
        if (uid === currentUser.uid) return;
        
        // Skip if already in friendsCache
        if (friendsCache[uid]) return;
        
        const uSnap = await get(child(ref(db), `users/${uid}`));
        if (!uSnap.exists()) return;
        const uData = uSnap.val();
        
        // Show a temporary result card in the conv list
        const convListEl = document.getElementById('conv-list');
        // Remove previous ID search result if any
        const prev = convListEl?.querySelector('.id-search-result');
        if (prev) prev.remove();
        
        const card = document.createElement('div');
        card.className = 'id-search-result';
        const isGroupResult = uData.id4?.startsWith('gr.');
        card.style.cssText = 'padding:12px 16px; border-bottom:1px solid var(--border-light); display:flex; align-items:center; gap:12px; cursor:pointer; background:var(--bg-card);';
        card.innerHTML = `
          <img src="${uData.avatar}" style="width:42px;height:42px;border-radius:50%;object-fit:cover;">
          <div style="flex:1;">
            <div style="font-weight:600;font-size:14px;color:var(--text-primary);">${uData.name}</div>
            <div style="font-size:12px;color:var(--text-secondary);">ID: ${uData.id4} · ${isGroupResult ? 'Nhóm' : 'Người dùng'}</div>
          </div>
          <div style="font-size:12px;color:var(--md-sys-color-primary);font-weight:600;">${isGroupResult ? 'Tham gia' : 'Nhắn tin'}</div>
        `;
        card.addEventListener('click', async () => {
          if (isGroupResult) {
            // Open group join flow
            const requireApproval = uData.settings?.approveMember || uData.settings?.require_approval;
            if (requireApproval) {
              await update(ref(db), {
                [`users/${uid}/pending/${currentUser.uid}`]: { name: currentUser.name, avatar: currentUser.avatar, ts: Date.now() }
              });
              showToast('Đã gửi yêu cầu tham gia nhóm!');
            } else {
              const updates = {};
              updates[`users/${uid}/members/${currentUser.uid}`] = { role: 'member', ts: Date.now() };
              updates[`friends/${currentUser.uid}/${uid}`] = { room_id: uid, lastMsg: `Bạn đã tham gia nhóm ${uData.name}`, lastTime: formatTime(Date.now()), ts: Date.now() };
              await update(ref(db), updates);
              showToast(`Đã tham gia nhóm "${uData.name}"`);
            }
          } else {
            // Show stranger profile
            currentStrangerId = uid;
            currentStrangerData = uData;
            document.getElementById('stranger-cover-img').src = uData.cover || 'https://images.unsplash.com/photo-1707343843437-caacff5cfa74?q=80&w=600';
            document.getElementById('stranger-avatar-img').src = uData.avatar;
            document.getElementById('stranger-name-val').textContent = uData.name;
            document.getElementById('stranger-intro-input').value = `Xin chào, mình là ${currentUser.name}. Kết bạn với mình nhé!`;
            strangerProfileModal.classList.add('active');
          }
          searchInput.value = '';
          card.remove();
        });
        
        // Insert at top of list
        if (convListEl?.firstChild) {
          convListEl.insertBefore(card, convListEl.firstChild);
        } else {
          convListEl?.appendChild(card);
        }
      } catch(err) {
        console.error('ID search error:', err);
      }
    }, 400);
  } else {
    // Clear any ID search result card when query changes
    document.querySelector('.id-search-result')?.remove();
  }
});

/* ─── Select Chat ─── */
function selectChat(c) {
  activeRoomId = c.room_id;
  activePeerId = c.uid;
  activeIsGroup = (c.tag === 'group' || (c.user_info && c.user_info.id4 && c.user_info.id4.startsWith('gr.')));
  window.currentGroupMembersCache = null;
  renderConvList(searchInput.value); // to update active state

  // Clear unread
  if (c.unread > 0) {
    update(ref(db), { [`friends/${currentUser.uid}/${c.uid}/unread`]: 0 });
  }

  // Mobile: show chat area
  if (window.innerWidth <= 768) {
    chatArea.classList.add('active');
  }

  // Reset info sub-screens
  const screens = ['info-group-manage-screen', 'info-admins-screen', 'info-members-screen', 'info-search-screen'];
  screens.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.left = '100%';
  });

  // Check stranger banner
  checkStrangerBanner(c);

  // Set Headers
  document.getElementById('chat-peer-name').textContent = c.user_info.name;
  document.getElementById('chat-peer-avatar').style.display = 'block';
  document.getElementById('chat-peer-avatar').src = c.user_info.avatar;
  document.getElementById('chat-peer-status').textContent = 'Đang hoạt động';

  // Update Right Panel
  const infoWrap = document.getElementById('info-user-wrap');
  const infoCustom = document.getElementById('info-custom-wrap');
  const infoEmpty = document.getElementById('info-empty');
  if (infoWrap) infoWrap.style.display = 'flex';
  if (infoCustom) infoCustom.style.display = 'block';
  if (infoEmpty) infoEmpty.style.display = 'none';

  document.getElementById('info-avatar').src = c.user_info.avatar;
  document.getElementById('chat-peer-avatar').src = c.user_info.avatar;
  const infoIdEl = document.getElementById('info-id');
  if (infoIdEl) infoIdEl.textContent = 'ID: ' + (c.user_info.id4 || c.uid.slice(0, 4));

  // For groups: listen to name/avatar changes in real-time
  if (c.user_info.id4 && (c.user_info.id4.startsWith('gr.') || c.user_info.id4 === 'NHOM')) {
    if (window.activeGroupInfoUnsub) window.activeGroupInfoUnsub();
    window.activeGroupInfoUnsub = onValue(ref(db, `users/${activePeerId}`), (snap) => {
      if (!snap.exists()) return;
      const gData = snap.val();
      if (gData.name) {
        document.getElementById('info-name').textContent = gData.name;
        document.getElementById('chat-peer-name').textContent = gData.name;
        // Update cache
        if (friendsCache[activePeerId]) {
          friendsCache[activePeerId].user_info.name = gData.name;
        }
      }
      if (gData.avatar) {
        document.getElementById('info-avatar').src = gData.avatar;
        document.getElementById('chat-peer-avatar').src = gData.avatar;
        if (friendsCache[activePeerId]) {
          friendsCache[activePeerId].user_info.avatar = gData.avatar;
        }
      }
    });
  }

  // Listen to room config (theme, nickname)
  onValue(ref(db, `rooms/${c.room_id}/config`), snap => {
    const conf = snap.val() || {};
    const theme = conf.theme || 'default';
    if (themeSelect) themeSelect.value = theme;
    applyTheme(theme);

    // Fallback to real names if no nickname
    const peerNick = conf.nicknames && conf.nicknames[activePeerId] ? conf.nicknames[activePeerId] : c.user_info.name;
    document.getElementById('chat-peer-name').textContent = peerNick;
    document.getElementById('info-name').textContent = peerNick;
  });

  // Update hide conv state
  if (typeof isConvHidden === 'function') {
    const hidden = isConvHidden(c.room_id);
    const hideToggle = document.getElementById('btn-info-hide-conv');
    if (hideToggle) {
      // Prevent the event listener from firing when we programmatically set it
      hideToggle.checked = hidden;
    }
  }

  const isGroup = c.user_info.id4 && c.user_info.id4.startsWith('gr.');

  if (isGroup || c.user_info.id4 === 'NHOM') {
    // Group Logic
    const infoHeaderTitle = document.getElementById('info-header-title');
    if (infoHeaderTitle) infoHeaderTitle.textContent = 'Thông tin nhóm';
    document.getElementById('info-actions-group').style.display = 'flex';
    document.getElementById('info-actions-friend').style.display = 'none';


    document.getElementById('info-nickname-row').style.display = 'none';
    document.getElementById('info-tag-row').style.display = 'none';
    document.getElementById('info-block-row').style.display = 'none';
    document.getElementById('info-unfriend-row').style.display = 'none';

    document.getElementById('info-group-members-wrap').style.display = 'block';
    document.getElementById('info-group-manage-wrap').style.display = 'block';
    document.getElementById('info-actions-bottom').style.display = 'flex';

    if (activePresenceUnsub) { activePresenceUnsub(); activePresenceUnsub = null; }


    const applyPermissions = () => {
      const inputWrap = document.getElementById('chat-input-area-wrap');
      const restrictMsg = document.getElementById('chat-restricted-msg');
      if (inputWrap && restrictMsg) {
        if (!currentSettings.sendMsg && currentMyRole === 'member') {
          inputWrap.style.display = 'none';
          restrictMsg.style.display = 'block';
        } else {
          inputWrap.style.display = 'block';
          restrictMsg.style.display = 'none';
        }
      }
      
      const btnEditAvatar = document.getElementById('btn-edit-group-avatar');
      const btnEditName = document.getElementById('btn-edit-group-name');
      const canEditInfo = currentSettings.changeInfo || currentMyRole === 'admin' || currentMyRole === 'deputy';
      
      if (btnEditAvatar) btnEditAvatar.style.display = canEditInfo ? 'flex' : 'none';
      if (btnEditName) btnEditName.style.display = canEditInfo ? 'block' : 'none';
    };
    window.applyGroupPermissions = applyPermissions;

    // Load Group Members
    if (window.activeMembersUnsub) { window.activeMembersUnsub(); window.activeMembersUnsub = null; }
    window.activeMembersUnsub = onValue(ref(db, `users/${activePeerId}/members`), async (snap) => {
      const members = snap.val() || {};
      const count = Object.keys(members).length || 1;
      const txt = `${count} thành viên`;
      document.getElementById('chat-peer-status').textContent = txt;
      document.getElementById('chat-peer-status').style.color = 'var(--text-secondary)';
      document.getElementById('info-status').textContent = txt;
      document.getElementById('info-status').style.color = 'var(--text-secondary)';
      const countLabelSpan = document.querySelector('#group-member-count-label span');
      if (countLabelSpan) countLabelSpan.textContent = txt;

      // Render member list
      const listContainer = document.getElementById('group-members-list');
      const adminsListContainer = document.getElementById('admins-list');
      if (adminsListContainer) adminsListContainer.innerHTML = '';
      
      let adminCount = 0;

      if (listContainer) {
        listContainer.innerHTML = '';
        const currentRenderId = Date.now() + Math.random();
        listContainer.dataset.renderId = currentRenderId;

        const myRole = members[currentUser.uid]?.role || 'member';
        currentMyRole = myRole;
        applyPermissions();

        const memberEntries = Object.entries(members);
        const resolvedMembers = await Promise.all(memberEntries.map(async ([uid, memData]) => {
          let uData = { name: 'Người dùng ẩn', avatar: 'https://via.placeholder.com/32' };
          let exists = true;
          if (uid === currentUser.uid) {
            uData = currentUser;
          } else {
            const uSnap = await get(child(ref(db), `users/${uid}`));
            if (uSnap.exists()) {
              uData = uSnap.val();
            } else {
              exists = false;
              update(ref(db), { [`users/${activePeerId}/members/${uid}`]: null });
            }
          }
          return { uid, memData, uData, exists };
        }));

        const validMembers = resolvedMembers.filter(m => m.exists);
        if (listContainer.dataset.renderId != currentRenderId) return;

        window.currentGroupMembersCache = validMembers;
        if (window.forceRenderMessages) window.forceRenderMessages();
        validMembers.sort((a, b) => {
          const roleWeight = { admin: 1, deputy: 2, member: 3 };
          const wA = roleWeight[a.memData.role || 'member'] || 3;
          const wB = roleWeight[b.memData.role || 'member'] || 3;
          if (wA !== wB) return wA - wB;
          return a.uData.name.localeCompare(b.uData.name);
        });

        for (const { uid, memData, uData } of validMembers) {
          let roleLabel = '';
          if (memData.role === 'admin') roleLabel = '<span style="font-size:11px; color:var(--md-sys-color-primary); background:var(--bg-input); padding:2px 6px; border-radius:10px; margin-left:6px;">Trưởng nhóm</span>';
          else if (memData.role === 'deputy') roleLabel = '<span style="font-size:11px; color:var(--orange); background:var(--bg-input); padding:2px 6px; border-radius:10px; margin-left:6px;">Phó nhóm</span>';

          const el = document.createElement('div');
          el.style.display = 'flex';
          el.style.alignItems = 'center';
          el.style.gap = '10px';
          el.style.position = 'relative'; // For dropdown
          
          let actionsHtml = '';
          const canManage = (myRole === 'admin' && uid !== currentUser.uid) || 
                            (myRole === 'deputy' && uid !== currentUser.uid && memData.role === 'member');
                            
          if (canManage) {
            actionsHtml = `
              <div class="member-actions-btn" style="cursor:pointer; padding: 4px; color:var(--text-secondary);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="12" cy="5" r="1"></circle>
                  <circle cx="12" cy="19" r="1"></circle>
                </svg>
              </div>
              <div class="member-actions-dropdown" style="display:none; position:absolute; right:0; top:30px; background:var(--bg-panel); border:1px solid var(--border); border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.1); z-index:100; min-width:150px; overflow:hidden;">
                ${myRole === 'admin' ? `
                  <div class="action-item btn-promote" data-uid="${uid}" style="padding:10px 16px; font-size:13px; cursor:pointer; color:var(--text-primary); border-bottom:1px solid var(--border-light);">Thăng làm Phó nhóm</div>
                  <div class="action-item btn-transfer" data-uid="${uid}" style="padding:10px 16px; font-size:13px; cursor:pointer; color:var(--text-primary); border-bottom:1px solid var(--border-light);">Chuyển quyền Trưởng nhóm</div>
                ` : ''}
                <div class="action-item btn-kick" data-uid="${uid}" style="padding:10px 16px; font-size:13px; cursor:pointer; color:var(--red);">Xóa khỏi nhóm</div>
              </div>
            `;
          }

          el.innerHTML = `
            <img src="${uData.avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
            <div style="flex:1;">
              <div style="font-size:14px; color:var(--text-primary); font-weight:500;">${uid === currentUser.uid ? 'Bạn' : uData.name}</div>
              ${roleLabel ? `<div style="margin-top:2px;">${roleLabel}</div>` : ''}
            </div>
            ${actionsHtml}
          `;
          listContainer.appendChild(el);
          
          if (memData.role === 'admin' || memData.role === 'deputy') {
            adminCount++;
            if (adminsListContainer) {
              const adminEl = document.createElement('div');
              adminEl.style.display = 'flex';
              adminEl.style.alignItems = 'center';
              adminEl.style.justifyContent = 'space-between';
              adminEl.style.padding = '12px 0';
              adminEl.style.borderBottom = '1px solid var(--border-light)';
              
              adminEl.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                  <img src="${uData.avatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                  <div>
                    <div style="font-size:15px; font-weight:600; color:var(--text-primary);">${uid === currentUser.uid ? 'Bạn' : uData.name}</div>
                    <div style="font-size:13px; color:var(--text-secondary);">${memData.role === 'admin' ? 'Trưởng nhóm' : 'Phó nhóm'}</div>
                  </div>
                </div>
                ${memData.role === 'deputy' && (myRole === 'admin') ? `
                  <button class="btn-remove-deputy" data-uid="${uid}" style="padding:6px 16px; border-radius:8px; background:var(--red-light, #ffebee); color:var(--red); font-weight:600; font-size:13px; border:none; cursor:pointer;">Xóa</button>
                ` : ''}
              `;
              adminsListContainer.appendChild(adminEl);
              
              const btnRemove = adminEl.querySelector('.btn-remove-deputy');
              if (btnRemove) {
                btnRemove.addEventListener('click', async (e) => {
                  e.stopPropagation();
                  if (confirm('Bạn có chắc chắn muốn xóa quyền Phó nhóm của thành viên này?')) {
                    await update(ref(db), { [`users/${activePeerId}/members/${uid}/role`]: 'member' });
                  }
                });
              }
            }
          }

          // Add events for actions if present
          if (canManage) {
            const btnToggle = el.querySelector('.member-actions-btn');
            const dropdown = el.querySelector('.member-actions-dropdown');
            
            btnToggle.addEventListener('click', (e) => {
              e.stopPropagation();
              // Close all other dropdowns
              document.querySelectorAll('.member-actions-dropdown').forEach(d => {
                if (d !== dropdown) d.style.display = 'none';
              });
              dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
            });

            const kickBtn = el.querySelector('.btn-kick');
            if (kickBtn) {
              kickBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                dropdown.style.display = 'none';
                if (!confirm(`Bạn có chắc chắn muốn xóa ${uData.name} khỏi nhóm?`)) return;
                const u = kickBtn.dataset.uid;
                try {
                  const updates = {};
                  updates[`users/${activePeerId}/members/${u}`] = null;
                  updates[`friends/${u}/${activePeerId}`] = null;
                  await update(ref(db), updates);
                  showToast(`Đã xóa ${uData.name} khỏi nhóm`);
                } catch(err) {
                  showToast('Lỗi: ' + err.message, true);
                }
              });
            }

            const promoteBtn = el.querySelector('.btn-promote');
            if (promoteBtn) {
              promoteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const u = promoteBtn.dataset.uid;
                await update(ref(db), { [`users/${activePeerId}/members/${u}/role`]: 'deputy' });
                dropdown.style.display = 'none';
              });
            }

            const transferBtn = el.querySelector('.btn-transfer');
            if (transferBtn) {
              transferBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('Bạn có chắc chắn muốn chuyển quyền Trưởng nhóm? Bạn sẽ trở thành Phó nhóm.')) {
                  const u = transferBtn.dataset.uid;
                  const updates = {};
                  updates[`users/${activePeerId}/members/${u}/role`] = 'admin';
                  updates[`users/${activePeerId}/members/${currentUser.uid}/role`] = 'deputy';
                  await update(ref(db), updates);
                }
                dropdown.style.display = 'none';
              });
            }
          }
        }
        
        const countPreview = document.getElementById('admins-count-preview');
        if (countPreview) countPreview.textContent = `${adminCount} người`;
      }
    });

    // Load Group Settings
    if (window.activeSettingsUnsub) window.activeSettingsUnsub();
    window.activeSettingsUnsub = onValue(ref(db, `users/${activePeerId}/settings`), (snap) => {
      const rawSettings = snap.val() || {};
      // Merge with defaults (null/undefined → default value)
      const settings = {
        changeInfo: rawSettings.changeInfo !== false,
        pinMsg: rawSettings.pinMsg !== false,
        sendMsg: rawSettings.sendMsg !== false,
        approveMember: !!rawSettings.approveMember,
        highlightAdmin: !!rawSettings.highlightAdmin,
        readRecent: rawSettings.readRecent !== false,
        joinId: rawSettings.joinId !== false
      };
      
      currentSettings = settings;
      applyPermissions();
      
      const idDisplay = document.getElementById('group-manage-id-display');
      if (idDisplay) idDisplay.textContent = `ID: ${c.user_info.id4 || activePeerId}`;
    });

    // Load Pending Members
    if (window.activePendingUnsub) window.activePendingUnsub();
    window.activePendingUnsub = onValue(ref(db, `users/${activePeerId}/pending`), (snap) => {
      const section = document.getElementById('pending-members-section');
      const listEl = document.getElementById('group-pending-list');
      const countEl = document.getElementById('group-pending-count');
      if (!section || !listEl || !countEl) return;
      
      const pending = snap.val() || {};
      const count = Object.keys(pending).length;
      countEl.textContent = count;
      listEl.innerHTML = '';
      
      // Only show section if we are admin/deputy AND settings.approveMember is true
      if (currentSettings.approveMember && count > 0 && (currentMyRole === 'admin' || currentMyRole === 'deputy')) {
        section.style.display = 'block';
        Object.entries(pending).forEach(([uid, pData]) => {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.gap = '10px';
          row.style.padding = '8px 0';
          
          row.innerHTML = `
            <img src="${pData.avatar}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
            <div style="flex:1;">
              <div style="font-size:14px; font-weight:600; color:var(--text-primary);">${pData.name}</div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn-approve" data-uid="${uid}" style="padding:6px 16px; border-radius:8px; background:var(--md-sys-color-primary); color:#fff; font-weight:600; font-size:13px; border:none; cursor:pointer;">Phê duyệt</button>
              <button class="btn-reject" data-uid="${uid}" style="padding:6px 16px; border-radius:8px; background:var(--bg-input); color:var(--text-secondary); font-weight:600; font-size:13px; border:1px solid var(--border); cursor:pointer;">Xóa</button>
            </div>
          `;
          listEl.appendChild(row);
        });

        listEl.querySelectorAll('.btn-approve').forEach(btn => {
          btn.onclick = async () => {
            const u = btn.dataset.uid;
            try {
              const uSnap = await get(child(ref(db), `users/${u}`));
              const gSnap = await get(child(ref(db), `users/${activePeerId}`));
              if (uSnap.exists() && gSnap.exists()) {
                const gData = gSnap.val();
                const updates = {};
                updates[`users/${activePeerId}/members/${u}`] = { role: 'member', ts: Date.now() };
                updates[`users/${activePeerId}/pending/${u}`] = null;
                updates[`friends/${u}/${activePeerId}`] = {
                  room_id: activePeerId,
                  lastMsg: `Bạn đã được duyệt vào nhóm ${gData.name}`,
                  lastTime: formatTime(Date.now()),
                  ts: Date.now()
                };
                await update(ref(db), updates);
              }
            } catch (err) {
              alert("Lỗi khi duyệt: " + err.message);
            }
          };
        });

        listEl.querySelectorAll('.btn-reject').forEach(btn => {
          btn.onclick = async () => {
            const u = btn.dataset.uid;
            await update(ref(db), { [`users/${activePeerId}/pending/${u}`]: null });
          };
        });
      } else {
        section.style.display = 'none';
      }
    });

  } else {
    // Friend Logic
    const infoHeaderTitle = document.getElementById('info-header-title');
    if (infoHeaderTitle) infoHeaderTitle.textContent = 'Thông tin hội thoại';
    document.getElementById('info-actions-group').style.display = 'none';
    document.getElementById('info-actions-friend').style.display = 'flex';
    const btnEditAvatar = document.getElementById('btn-edit-group-avatar');
    const btnEditName = document.getElementById('btn-edit-group-name');
    if (btnEditAvatar) btnEditAvatar.style.display = 'none';
    if (btnEditName) btnEditName.style.display = 'none';
    document.getElementById('info-nickname-row').style.display = 'flex';
    document.getElementById('info-tag-row').style.display = 'flex';
    
    // Check if friend
    const isFriend = friendsCache[activePeerId] !== undefined;
    const unfriendRow = document.getElementById('info-unfriend-row');
    if (isFriend) {
      document.getElementById('info-block-row').style.display = 'flex';
      if (unfriendRow) unfriendRow.style.display = 'flex';
    } else {
      document.getElementById('info-block-row').style.display = 'none';
      if (unfriendRow) unfriendRow.style.display = 'none';
    }

    document.getElementById('info-group-members-wrap').style.display = 'none';
    document.getElementById('info-group-manage-wrap').style.display = 'none';
    document.getElementById('info-actions-bottom').style.display = 'none';

    // Listen to tag
    get(ref(db, `friends/${currentUser.uid}/${activePeerId}/tag`)).then(snap => {
      if (tagSelect) tagSelect.value = snap.val() || 'none';
    });

    // Presence listener for the active peer
    if (activePresenceUnsub) activePresenceUnsub();
    const peerStatusRef = ref(db, `status/${activePeerId}`);
    activePresenceUnsub = onValue(peerStatusRef, (snap) => {
      const st = snap.val();
      const statusEls = [
        document.querySelector('.chat-peer-status'),
        document.getElementById('info-status')
      ];
      if (st && st.state === 'online') {
        statusEls.forEach(el => { if (el) { el.textContent = 'Đang hoạt động'; el.style.color = '#22c55e'; } });
      } else {
        const timeStr = st && st.ts ? formatOfflineTime(st.ts) : 'Ngoại tuyến';
        statusEls.forEach(el => { if (el) { el.textContent = timeStr; el.style.color = 'var(--text-muted)'; } });
      }
    });
  }

  // Block User Listeners
  if (window.unsubBlockMe) window.unsubBlockMe();
if (window.unsubBlockThem) window.unsubBlockThem();

window.unsubBlockMe = onValue(ref(db, `blocks/${currentUser.uid}/${activePeerId}`), snap => {
  isBlockedByMe = !!snap.val();
  const switchEl = document.getElementById('block-user-switch');
  if (switchEl) switchEl.checked = isBlockedByMe;
  updateChatInputState();
});
window.unsubBlockThem = onValue(ref(db, `blocks/${activePeerId}/${currentUser.uid}`), snap => {
  isBlockingMe = !!snap.val();
  updateChatInputState();
});

// Load Messages via simple event listener
// We use the basic onValue to get full array, but for performance onChildAdded is better
// To keep it simple text-only:
listenMessages(c.room_id);
}

// Mobile Back Button
chatBackBtn.addEventListener('click', () => {
  chatArea.classList.remove('active');
});

function updateChatInputState() {
  const inlineUnblock = document.getElementById('inline-unblock-btn');
  if (isBlockedByMe) {
    msgInput.disabled = true;
    msgInput.placeholder = "Bạn đã chặn người này.";
    sendBtn.style.display = 'none';
    btnSendImage.style.display = 'none';
    emojiPicker.style.display = 'none';
    document.getElementById('emoji-btn').style.display = 'none';
    if (inlineUnblock) inlineUnblock.style.display = 'block';
  } else if (isBlockingMe) {
    msgInput.disabled = true;
    msgInput.placeholder = "Bạn không thể gửi tin nhắn lúc này.";
    sendBtn.style.display = 'none';
    btnSendImage.style.display = 'none';
    emojiPicker.style.display = 'none';
    document.getElementById('emoji-btn').style.display = 'none';
    if (inlineUnblock) inlineUnblock.style.display = 'none';
  } else {
    msgInput.disabled = false;
    msgInput.placeholder = "Nhập tin nhắn...";
    sendBtn.style.display = 'flex';
    btnSendImage.style.display = 'flex';
    document.getElementById('emoji-btn').style.display = 'block';
    if (inlineUnblock) inlineUnblock.style.display = 'none';
  }
}

// Inline unblock button listener
document.getElementById('inline-unblock-btn')?.addEventListener('click', async () => {
  if (!activePeerId) return;
  try {
    await update(ref(db), {
      [`blocks/${currentUser.uid}/${activePeerId}`]: null
    });
    // The listener onValue will automatically update state
  } catch (err) {
    alert("Lỗi khi bỏ chặn: " + err.message);
  }
});

function checkStrangerBanner(c) {
  const banner = document.getElementById('stranger-banner');
  const bText = document.getElementById('stranger-banner-text');
  const bSub = document.getElementById('stranger-banner-sub');
  const bBtn = document.getElementById('stranger-banner-btn');
  if (!banner) return;

  if (c.tag !== 'stranger') {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = 'flex';

  // Check request status
  // 1. Did I receive a request from them?
  get(child(ref(db), `friend_requests/${currentUser.uid}/${c.uid}`)).then(snap1 => {
    if (snap1.exists()) {
      bText.textContent = "Lời mời kết bạn từ người lạ";
      bSub.textContent = "Họ muốn kết bạn với bạn.";
      bBtn.textContent = "Đồng ý";
      bBtn.onclick = async () => {
        // Accept request
        bBtn.textContent = "Đang xử lý...";
        bBtn.disabled = true;
        try {
          await update(ref(db), {
            [`friend_requests/${currentUser.uid}/${c.uid}`]: null,
            [`friends/${currentUser.uid}/${c.uid}/tag`]: 'friend',
            [`friends/${c.uid}/${currentUser.uid}/tag`]: 'friend'
          });
          banner.style.display = 'none';
        } catch (e) {
          alert("Lỗi: " + e.message);
          bBtn.textContent = "Đồng ý";
          bBtn.disabled = false;
        }
      };
    } else {
      // 2. Did I send a request to them?
      get(child(ref(db), `friend_requests/${c.uid}/${currentUser.uid}`)).then(snap2 => {
        if (snap2.exists()) {
          bText.textContent = "Đã gửi yêu cầu kết bạn";
          bSub.textContent = "Đang chờ người này xác nhận.";
          bBtn.textContent = "Đã gửi";
          bBtn.disabled = true;
        } else {
          // No request sent by anyone
          bText.textContent = "Gửi yêu cầu kết bạn tới người này";
          bSub.textContent = "Người này chưa nằm trong danh bạ của bạn.";
          bBtn.textContent = "Gửi kết bạn";
          bBtn.disabled = false;
          bBtn.onclick = () => {
            // Open add friend profile modal with prefilled data
            currentStrangerId = c.uid;
            currentStrangerData = c.user_info;
            document.getElementById('stranger-avatar-img').src = c.user_info.avatar;
            document.getElementById('stranger-name-val').textContent = c.user_info.name;
            document.getElementById('stranger-intro-input').value = `Xin chào, mình là ${currentUser.name}. Kết bạn với mình nhé!`;
            document.getElementById('stranger-profile-modal').classList.add('active');
          };
        }
      });
    }
  });
}

// Block user switch listener
document.getElementById('block-user-switch')?.addEventListener('change', async (e) => {
  if (!activePeerId) return;
  const isBlocked = e.target.checked;
  try {
    await update(ref(db), {
      [`blocks/${currentUser.uid}/${activePeerId}`]: isBlocked ? true : null
    });
  } catch (err) {
    alert("Lỗi khi thay đổi trạng thái chặn: " + err.message);
    e.target.checked = !isBlocked;
  }
});

/* ─── Listen to Messages ─── */
function listenMessages(roomId) {
  // Unsubscribe previous
  // Normally firebase v9 allows removing listeners, but here we can just detach using refs. Wait, onValue returns unsubscribe.
  // Actually, better to unsubscribe nicely, but simplified for now: re-fetching.
  if (window.unsubMessages) {
    window.unsubMessages();
  }
  if (window.unsubPinned) {
    window.unsubPinned();
  }

  messagesWrap.innerHTML = '';
  const msgRef = ref(db, `messages/${roomId}`);

  // Pinned message listener
  window.unsubPinned = onValue(ref(db, `rooms/${roomId}/pinned`), snap => {
    const banner = document.getElementById('pinned-msg-banner');
    const textEl = document.getElementById('pinned-msg-text');
    const unpinBtn = document.getElementById('btn-unpin-msg');
    
    if (snap.exists()) {
      const pinData = snap.val();
      banner.style.display = 'flex';
      textEl.textContent = pinData.txt || '[Hình ảnh]';
      
      banner.onclick = (e) => {
        if (e.target.closest('#btn-unpin-msg')) return;
        // Scroll to message
        const targetBubble = document.querySelector(`.bubble[data-id="${pinData.id}"]`);
        if (targetBubble) {
          targetBubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetBubble.style.transition = 'background 0.5s';
          const oldBg = targetBubble.style.background;
          targetBubble.style.background = 'rgba(34, 197, 94, 0.3)';
          setTimeout(() => targetBubble.style.background = oldBg, 1500);
        }
      };

      unpinBtn.onclick = (e) => {
        e.stopPropagation();
        update(ref(db), { [`rooms/${roomId}/pinned`]: null });
      };
    } else {
      banner.style.display = 'none';
    }
  });

  // Create a separate div for typing indicators to stay at bottom
  const container = document.createElement('div');

  // ─── Local Caching & Cleanup ───
  const cacheKey = `tola_cache_${roomId}`;
  let cachedMessages = JSON.parse(localStorage.getItem(cacheKey) || '[]');
  // cachedMessages format: [ { id: "firebase_push_id", data: { s: "uid", txt: "...", ts: 123 } } ]

  // Render từ cache trước cho nhanh
  function renderMessages(msgs) {
    messagesWrap.innerHTML = '';
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';
    messagesWrap.appendChild(container);

    // Fix: reset DOM group tracking for fresh render so new elements aren't orphaned
    lastSender = null;
    lastGroup = null;
    lastTs = 0;

    msgs.forEach(m => {
      renderSingleMessage(m.data, m.id, container);
    });
    scrollToBottom();
  }
  
  window.forceRenderMessages = () => {
      renderMessages(cachedMessages);
  };

  if (cachedMessages.length > 0 && typeof cachedMessages[0].data === 'undefined') {
    // Migrate old cache format if exists
    cachedMessages = [];
    localStorage.setItem(cacheKey, '[]');
  }

  renderMessages(cachedMessages);
  // Fetch cleared_at
  let clearedAt = 0;
  get(child(ref(db), `friends/${currentUser.uid}/${activePeerId}/cleared_at`)).then(snap => {
    if (snap.exists()) clearedAt = snap.val();
  });

  // Lắng nghe dữ liệu thực tế
  window.unsubMessages = onValue(ref(db, `messages/${roomId}`), async (snapshot) => {
    const data = snapshot.val();
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    let cacheUpdated = false;

    if (data) {
      Object.entries(data).forEach(([msgId, msg]) => {
        // 1. Kiểm tra nếu tin nhắn cũ hơn 1 ngày thì xóa trên Firebase
        if (now - msg.ts > oneDayInMs) {
          remove(ref(db, `messages/${roomId}/${msgId}`));
        } else if (msg.ts > clearedAt) {
          // 2. Thêm vào cache nếu tin nhắn này chưa có trong máy và sau thời gian clearedAt
          const existing = cachedMessages.find(m => m.id === msgId);
          if (!existing) {
            cachedMessages.push({ id: msgId, data: msg });
            cacheUpdated = true;
          } else if (existing.data.d !== msg.d || existing.data.react !== msg.react) {
            // Update if deleted or reacted
            existing.data = msg;
            cacheUpdated = true;
          }
        }
      });
    }

    // Lọc lại cache nếu có clearedAt
    cachedMessages = cachedMessages.filter(m => m.data.ts > clearedAt);

    if (cacheUpdated) {
      cachedMessages.sort((a, b) => a.data.ts - b.data.ts);
      localStorage.setItem(cacheKey, JSON.stringify(cachedMessages));
    }

    // Render bản gộp mới nhất
    renderMessages(cachedMessages);
  });
}

let lastSender = null;
let lastGroup = null;
let lastTs = 0;

function renderSingleMessage(m, id, container) {
  // SYSTEM MESSAGE HANDLING
  if (m.type === 'system') {
     const sysRow = document.createElement('div');
     sysRow.style.display = 'flex';
     sysRow.style.justifyContent = 'center';
     sysRow.style.margin = '12px 0';
     sysRow.style.width = '100%';

     const pill = document.createElement('div');
     pill.style.background = 'var(--bg-input)';
     pill.style.padding = '6px 16px';
     pill.style.borderRadius = '20px';
     pill.style.fontSize = '12px';
     pill.style.color = 'var(--text-secondary)';
     pill.style.fontWeight = '500';
     pill.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
     pill.textContent = m.txt;

     sysRow.appendChild(pill);
     container.appendChild(sysRow);

     lastSender = null;
     lastGroup = null;
     lastTs = m.ts || 0;
     return;
  }

  // If deleted
  if (m.d) {
    m.t_txt = "Tin nhắn đã bị thu hồi";
  }

  const isMine = m.s === currentUser.uid;
  const mDate = new Date(m.ts);
  const lastDate = new Date(lastTs);
  const isDiffTime = mDate.getMinutes() !== lastDate.getMinutes() || mDate.getHours() !== lastDate.getHours() || mDate.getDate() !== lastDate.getDate();
  const isDiffSender = lastSender !== m.s || isDiffTime;
  lastSender = m.s;
  lastTs = m.ts;

  let avSrc = 'https://via.placeholder.com/32';
  let senderName = '';
  const isGroup = activeIsGroup;

  if (isDiffSender || !lastGroup) {
    // Tự tạo row mới
    const row = document.createElement('div');
    row.className = 'msg-row ' + (isMine ? 'me' : 'them');

    if (isGroup) {
        if (window.currentGroupMembersCache) {
            const mData = window.currentGroupMembersCache.find(x => x.uid === m.s);
            if (mData && mData.uData) {
                avSrc = mData.uData.avatar || avSrc;
                senderName = mData.uData.name || 'Người dùng';
            } else {
                senderName = 'Người dùng (đã rời)';
            }
        }
    } else if (!isMine) {
        const peer = friendsCache[activePeerId];
        if (peer && peer.user_info) avSrc = peer.user_info.avatar || avSrc;
    }

    if (!isMine || isGroup) {
      const av = document.createElement('img');
      av.className = 'msg-avatar';
      av.src = avSrc;
      row.appendChild(av);
    }
    
    lastGroup = document.createElement('div');
    lastGroup.className = 'msg-group';
    row.appendChild(lastGroup);
    container.appendChild(row);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble ' + (isMine ? 'me' : 'them');

  // Thêm tên người gửi vào BÊN TRONG bong bóng (như Zalo PC)
  if (isGroup && senderName) {
      const nameDiv = document.createElement('div');
      nameDiv.className = 'msg-sender-name-inner';
      nameDiv.style.fontSize = '12px';
      nameDiv.style.color = isMine ? 'rgba(255,255,255,0.8)' : 'var(--md-sys-color-primary)';
      nameDiv.style.marginBottom = '4px';
      nameDiv.style.fontWeight = '600';
      nameDiv.style.textAlign = isMine ? 'right' : 'left';
      nameDiv.textContent = senderName;
      bubble.appendChild(nameDiv);
  }

  // Render Reply Block
  if (m.replyTo) {
    const q = document.createElement('div');
    q.style.fontSize = '12px'; q.style.color = 'var(--text-secondary)';
    q.style.paddingLeft = '6px'; q.style.borderLeft = '2px solid var(--border)';
    q.style.marginBottom = '6px';
    const repText = m.replyTo.text || 'Hình ảnh';
    q.textContent = repText.length > 30 ? repText.substring(0, 30) + '...' : repText;
    bubble.appendChild(q);
  }

  // Render Core Content
  if (m.type === 'image') {
    bubble.style.padding = '4px';
    const img = document.createElement('img');
    img.src = m.url || '';
    img.style.maxWidth = '200px'; img.style.borderRadius = '8px'; img.style.display = 'block';
    img.onerror = () => { img.src = 'https://via.placeholder.com/200?text=Lỗi+Ảnh'; };
    bubble.appendChild(img);
  } else {
    const p = document.createElement('div');
    p.textContent = m.txt || m.t_txt; // support deleted
    p.style.whiteSpace = 'pre-wrap';
    p.style.wordBreak = 'break-word';
    bubble.appendChild(p);
  }


  if (m.d) {
    bubble.innerHTML = 'Tin nhắn đã thu hồi';
    bubble.style.background = 'transparent';
    bubble.style.border = '1px solid var(--border)';
    bubble.style.color = 'var(--text-muted)';
    bubble.style.fontStyle = 'italic';
  }

  bubble.dataset.id = id;
  bubble.dataset.msgId = id;
  bubble.dataset.type = m.type || 'text';
  bubble.dataset.txt = m.txt || m.t_txt || '';
  if (m.type === 'image') bubble.dataset.url = m.url || '';
  bubble.dataset.s = m.s;
  bubble.dataset.ts = m.ts || Date.now();

  // Wrap bubble for hover actions
  const bubbleWrap = document.createElement('div');
  bubbleWrap.style.display = 'flex';
  bubbleWrap.style.alignItems = 'center';
  bubbleWrap.style.gap = '8px';
  bubbleWrap.style.marginBottom = m.react ? '0' : '2px';
  bubbleWrap.style.position = 'relative';
  bubbleWrap.style.flexDirection = isMine ? 'row-reverse' : 'row';

  if (m.react) {
    const r = document.createElement('div');
    r.className = 'bubble-reaction'; r.textContent = m.react;
    bubble.appendChild(r);
    bubbleWrap.style.marginBottom = '12px';
  }

  bubbleWrap.appendChild(bubble);

  // Hover Actions Bar
  if (!m.d) {
    const actionBar = document.createElement('div');
    actionBar.className = 'msg-actions-bar';
    actionBar.style.display = 'none';
    actionBar.style.alignItems = 'center';
    actionBar.style.gap = '4px';
    actionBar.style.padding = '4px 8px';
    actionBar.style.background = 'var(--bg-panel)';
    actionBar.style.borderRadius = '16px';
    actionBar.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    actionBar.style.border = '1px solid var(--border-light)';
    
    // Nút Trả lời
    const btnReply = document.createElement('div');
    btnReply.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>';
    btnReply.style.cursor = 'pointer';
    btnReply.style.padding = '4px';
    btnReply.style.color = 'var(--text-secondary)';
    btnReply.title = "Trả lời";
    btnReply.onmouseenter = () => btnReply.style.color = 'var(--text-primary)';
    btnReply.onmouseleave = () => btnReply.style.color = 'var(--text-secondary)';
    btnReply.onclick = () => {
      replyTarget = { id, text: m.txt || (m.type === 'image' ? 'Hình ảnh' : ''), sender: m.s };
      let t = replyTarget.text;
      if (replyPreviewText) replyPreviewText.textContent = `Trả lời: ${t.substring(0, 40)}`;
      if (replyPreview) replyPreview.style.display = 'flex';
      msgInput.focus();
    };

    // Nút Chia sẻ
    const btnShare = document.createElement('div');
    btnShare.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';
    btnShare.style.cursor = 'pointer';
    btnShare.style.padding = '4px';
    btnShare.style.color = 'var(--text-secondary)';
    btnShare.title = "Chia sẻ";
    btnShare.onmouseenter = () => btnShare.style.color = 'var(--text-primary)';
    btnShare.onmouseleave = () => btnShare.style.color = 'var(--text-secondary)';
    btnShare.onclick = () => {
      if (bubble.dataset.id) openShareModal(bubble);
    };

    // Nút Thêm (3 chấm)
    const btnMore = document.createElement('div');
    btnMore.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>';
    btnMore.style.cursor = 'pointer';
    btnMore.style.padding = '4px';
    btnMore.style.color = 'var(--text-secondary)';
    btnMore.title = "Thêm";
    btnMore.onmouseenter = () => btnMore.style.color = 'var(--text-primary)';
    btnMore.onmouseleave = () => btnMore.style.color = 'var(--text-secondary)';
    btnMore.onclick = (e) => {
      e.stopPropagation();
      onBubbleRightClick(e, bubble);
    };

    actionBar.appendChild(btnReply);
    actionBar.appendChild(btnShare);
    actionBar.appendChild(btnMore);

    bubbleWrap.appendChild(actionBar);

    // Hover events
    bubbleWrap.onmouseenter = () => actionBar.style.display = 'flex';
    bubbleWrap.onmouseleave = () => actionBar.style.display = 'none';

    // Right click still works
    bubble.addEventListener('contextmenu', (e) => onBubbleRightClick(e, bubble));
  }

  lastGroup.appendChild(bubbleWrap);

  // Remove existing meta in this group if any
  const existingMeta = lastGroup.querySelector('.msg-meta');
  if (existingMeta) existingMeta.remove();

  // Time stamp
  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.innerHTML = `<span>${formatTime(m.ts)}</span>`;
  if (isMine) {
    const status = document.createElement('span');
    status.className = 'msg-status seen'; // Just fake seen for simplicity
    status.innerHTML = '✓✓';
    meta.appendChild(status);
  }
  lastGroup.appendChild(meta);
}

/* ─── Send Message ─── */
async function sendMessage(forceText = null, msgType = 'text', additionalData = {}) {
  if (!activeRoomId) return;
  const text = forceText !== null ? forceText : msgInput.value.trim();
  if (!text && msgType !== 'image') return; // Image might just have URL in 'text' parameter

  msgInput.value = '';
  msgInput.style.height = 'auto';
  if (likeBtn) likeBtn.style.display = 'flex';
  sendBtn.style.display = 'none';

  const msgData = {
    s: currentUser.uid,
    ts: Date.now(),
    type: msgType,
    ...additionalData
  };

  if (msgType === 'image') {
    msgData.url = text;
  } else {
    msgData.txt = text;
  }

  // Check Stranger Privacy
  try {
    const peerTagSnap = await get(child(ref(db), `friends/${activePeerId}/${currentUser.uid}/tag`));
    const peerTag = peerTagSnap.val() || 'none';
    if (peerTag === 'stranger') {
      const privacySnap = await get(child(ref(db), `users/${activePeerId}/settings/allow_stranger_msg`));
      const allowsStrangers = privacySnap.exists() ? privacySnap.val() : true;
      if (!allowsStrangers) {
        alert("Người này không nhận tin nhắn từ người lạ.");
        sendBtn.style.display = 'flex';
        return; // Hủy gửi
      }
    }
  } catch (err) {
    console.error("Lỗi check privacy:", err);
  }

  // Group membership check
  if (activeIsGroup && !friendsCache[activePeerId]) {
    alert("Bạn đã không còn là thành viên của nhóm này, không thể gửi tin nhắn!");
    return;
  }

  // Bind reply info
  if (replyTarget) {
    msgData.replyTo = replyTarget;
    if (replyClose) replyClose.click();
  }

  try {
    await push(ref(db, `messages/${activeRoomId}`), msgData);

    const preview = msgType === 'image' ? '[Hình ảnh]' : (text === '👍' ? '👍' : text);

    // Update contact last message info globally
    const timeStr = formatTime(msgData.ts);

    // Both users update their friend list pointer
    const updates = {};

    // My side
    updates[`friends/${currentUser.uid}/${activePeerId}/lastMsg`] = preview;
    updates[`friends/${currentUser.uid}/${activePeerId}/lastTime`] = timeStr;
    updates[`friends/${currentUser.uid}/${activePeerId}/ts`] = msgData.ts;

    // Peer side (increase unread)
    const peerRef = `friends/${activePeerId}/${currentUser.uid}`;
    const peerSnap = await get(child(ref(db), peerRef));
    if (peerSnap.exists()) {
      const pData = peerSnap.val();
      const currUnread = pData.unread || 0;
      updates[`${peerRef}/unread`] = currUnread + 1;
      updates[`${peerRef}/lastMsg`] = preview;
      updates[`${peerRef}/lastTime`] = timeStr;
      updates[`${peerRef}/ts`] = msgData.ts;
    }

    update(ref(db), updates);

    scrollToBottom();
  } catch (err) {
    console.error(err);
  }
}

msgInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
sendBtn.addEventListener('click', () => sendMessage());
if (likeBtn) {
  likeBtn.addEventListener('click', () => sendMessage('👍'));
}

/* ─── Scroll ─── */
function scrollToBottom() {
  setTimeout(() => {
    if (messagesWrap) {
      messagesWrap.scrollTo({ top: messagesWrap.scrollHeight, behavior: 'smooth' });
      if (scrollBottomBtn) scrollBottomBtn.style.display = 'none';
    }
  }, 30);
}

/* ─── Emoji ─── */
function initEmojiPicker() {
  EMOJIS.forEach(e => {
    const btn = document.createElement('div');
    btn.className = 'emoji-item';
    btn.textContent = e;
    btn.addEventListener('click', () => {
      msgInput.value += e;
      msgInput.focus();
      closeEmoji();
    });
    emojiGrid.appendChild(btn);
  });
}

function toggleEmoji() { emojiOpen = !emojiOpen; emojiPicker.classList.toggle('open', emojiOpen); }
function closeEmoji() { emojiOpen = false; emojiPicker.classList.remove('open'); }

const emojiBtn = document.getElementById('emoji-btn');
if (emojiBtn) {
  emojiBtn.addEventListener('click', e => { e.stopPropagation(); toggleEmoji(); });
}
emojiPicker.addEventListener('click', e => e.stopPropagation());

/* ─── Context Menu ─── */
function onBubbleRightClick(e, targetBubble = null) {
  e.preventDefault();
  closeEmoji();
  ctxTargetDoc = targetBubble || e.currentTarget;

  const isMine = ctxTargetDoc.dataset.s === currentUser.uid;
  document.getElementById('ctx-delete').style.display = isMine ? 'flex' : 'none';

  const rect = ctxTargetDoc.getBoundingClientRect();
  let menuLeft = isMine ? rect.right - 180 : rect.left;
  let menuTop = rect.bottom + 8;
  
  if (menuLeft < 10) menuLeft = 10;
  if (menuLeft + 180 > window.innerWidth) menuLeft = window.innerWidth - 190;
  if (menuTop + 240 > window.innerHeight) {
    menuTop = rect.top - 240 - 8;
  }
  
  ctxMenu.style.left = menuLeft + 'px';
  ctxMenu.style.top = menuTop + 'px';
  ctxMenu.classList.add('open');
}

document.addEventListener('click', () => {
  ctxMenu.classList.remove('open');
  closeEmoji();
});

// Context Menu logic
if (replyClose) {
  replyClose.addEventListener('click', () => {
    replyTarget = null;
    replyPreview.style.display = 'none';
  });
}

// Image Send logic
if (btnSendImage) {
  btnSendImage.addEventListener('click', () => {
    const url = prompt('Nhập URL hình ảnh (VD: link từ imgur):');
    if (url) {
      sendMessage(url, 'image');
    }
  });
}

const ctxCopy = document.getElementById('ctx-copy');
if (ctxCopy) {
  ctxCopy.addEventListener('click', () => {
    if (!ctxTargetDoc) return;
    navigator.clipboard.writeText(ctxTargetDoc.dataset.txt).catch(() => { });
    ctxMenu.classList.remove('open');
  });
}

const ctxPin = document.getElementById('ctx-pin');
if (ctxPin) {
  ctxPin.addEventListener('click', () => {
    if (!ctxTargetDoc || !activeRoomId) return;
    const msgId = ctxTargetDoc.dataset.id;
    const pinData = {
      id: msgId,
      txt: ctxTargetDoc.dataset.txt,
      s: ctxTargetDoc.dataset.s,
      ts: Date.now()
    };
    update(ref(db), { [`rooms/${activeRoomId}/pinned`]: pinData });
    ctxMenu.classList.remove('open');
  });
}

const ctxMark = document.getElementById('ctx-mark');
if (ctxMark) ctxMark.addEventListener('click', () => { alert('Tính năng đánh dấu đang phát triển!'); ctxMenu.classList.remove('open'); });

const ctxMulti = document.getElementById('ctx-multi');
if (ctxMulti) ctxMulti.addEventListener('click', () => { alert('Tính năng chọn nhiều tin nhắn đang phát triển!'); ctxMenu.classList.remove('open'); });

const ctxDetail = document.getElementById('ctx-detail');
if (ctxDetail) ctxDetail.addEventListener('click', () => { alert('Tính năng xem chi tiết đang phát triển!'); ctxMenu.classList.remove('open'); });

const ctxDelete = document.getElementById('ctx-delete');
if (ctxDelete) {
  ctxDelete.addEventListener('click', async () => {
    if (!ctxTargetDoc || !activeRoomId) return;
    const msgId = ctxTargetDoc.dataset.id;
    const isGroup = activeIsGroup;
    const updates = {
      [`messages/${activeRoomId}/${msgId}/txt`]: null,
      [`messages/${activeRoomId}/${msgId}/d`]: true
    };
    
    // update lastMsg preview
    const preview = "Tin nhắn đã thu hồi";
    updates[`friends/${currentUser.uid}/${activePeerId}/lastMsg`] = preview;
    if (isGroup) {
      const snap = await get(child(ref(db), `users/${activePeerId}/members`));
      if (snap.exists()) {
        Object.keys(snap.val()).forEach(u => {
          updates[`friends/${u}/${activePeerId}/lastMsg`] = preview;
        });
      }
    } else {
      updates[`friends/${activePeerId}/${currentUser.uid}/lastMsg`] = preview;
    }
    
    await update(ref(db), updates);
    ctxMenu.classList.remove('open');
  });
}

/* ─── Auto Resize Input & Toggle Buttons ─── */
const mentionDropdown = document.getElementById('mention-dropdown');
let isMentioning = false;

msgInput.addEventListener('input', () => {
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 250) + 'px';

  if (msgInput.value.trim().length > 0) {
    if (likeBtn) likeBtn.style.display = 'none';
    sendBtn.style.display = 'flex';
  } else {
    if (likeBtn) likeBtn.style.display = 'flex';
    sendBtn.style.display = 'none';
  }
  
  // Mention Logic
  if (activeIsGroup && window.currentGroupMembersCache && mentionDropdown) {
      const val = msgInput.value;
      const cursorPos = msgInput.selectionStart;
      const textBeforeCursor = val.slice(0, cursorPos);
      const match = textBeforeCursor.match(/(?:^|\s)@([^\s]*)$/);
      
      if (match) {
          isMentioning = true;
          const mentionSearchTerm = match[1].toLowerCase();
          
          const filteredMembers = window.currentGroupMembersCache.filter(m => 
              m.uid !== currentUser.uid && m.uData && m.uData.name && m.uData.name.toLowerCase().includes(mentionSearchTerm)
          );
          
          if (filteredMembers.length > 0) {
              mentionDropdown.style.display = 'block';
              mentionDropdown.innerHTML = '';
              filteredMembers.forEach((m, idx) => {
                  const item = document.createElement('div');
                  item.style.padding = '8px 12px';
                  item.style.cursor = 'pointer';
                  item.style.display = 'flex';
                  item.style.alignItems = 'center';
                  item.style.gap = '8px';
                  item.style.borderRadius = '6px';
                  item.style.background = idx === 0 ? 'var(--bg-hover)' : 'transparent';
                  
                  item.innerHTML = `
                      <img src="${m.uData.avatar || 'https://via.placeholder.com/24'}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">
                      <span style="font-size:14px; font-weight:500; color:var(--text-primary);">${m.uData.name}</span>
                  `;
                  
                  item.onmouseover = () => {
                      Array.from(mentionDropdown.children).forEach(c => c.style.background = 'transparent');
                      item.style.background = 'var(--bg-hover)';
                  };
                  
                  item.onmousedown = (e) => {
                      e.preventDefault(); // Prevent losing focus on textarea
                      const beforeMatch = val.slice(0, cursorPos - match[0].length + (match[0].startsWith(' ') ? 1 : 0));
                      const afterMatch = val.slice(cursorPos);
                      msgInput.value = beforeMatch + '@' + m.uData.name + ' ' + afterMatch;
                      mentionDropdown.style.display = 'none';
                      isMentioning = false;
                      msgInput.focus();
                  };
                  mentionDropdown.appendChild(item);
              });
          } else {
              mentionDropdown.style.display = 'none';
          }
      } else {
          isMentioning = false;
          mentionDropdown.style.display = 'none';
      }
  } else {
      isMentioning = false;
      if (mentionDropdown) mentionDropdown.style.display = 'none';
  }
});

document.addEventListener('click', (e) => {
    if (mentionDropdown && !mentionDropdown.contains(e.target) && e.target !== msgInput) {
        mentionDropdown.style.display = 'none';
        isMentioning = false;
    }
});

/* ─── Left Nav tabs & Settings ─── */
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter || 'all';
    renderConvList(searchInput.value);
  });
});

// Dropdown tag filter
const tagFilterBtn = document.getElementById('tag-filter-btn');
const tagFilterDropdown = document.getElementById('tag-filter-dropdown');
if (tagFilterBtn && tagFilterDropdown) {
  tagFilterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    tagFilterDropdown.style.display = tagFilterDropdown.style.display === 'none' ? 'block' : 'none';
  });

  document.addEventListener('click', () => {
    tagFilterDropdown.style.display = 'none';
  });

  tagFilterDropdown.addEventListener('click', e => e.stopPropagation());

  document.querySelectorAll('.tag-filter-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      selectedTags = Array.from(document.querySelectorAll('.tag-filter-cb:checked')).map(el => el.value);
      renderConvList(searchInput.value);
    });
  });
}

if (navSettings) {
  navSettings.addEventListener('click', (e) => {
    e.stopPropagation();
    if (settingsNameInput && currentUser) {
      settingsNameInput.value = currentUser.name;
      settingsAvatarInput.value = currentUser.avatar;
    }
    if (settingsModal) settingsModal.style.display = 'flex';
  });
}
if (settingsClose) {
  settingsClose.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });
}
if (settingsSaveBtn) {
  settingsSaveBtn.addEventListener('click', async () => {
    const newName = settingsNameInput.value.trim();
    const newAvatar = settingsAvatarInput.value.trim();
    if (!newName || !newAvatar) return alert('Vui lòng nhập đủ thông tin!');

    settingsSaveBtn.textContent = 'Đang lưu...';
    try {
      await update(ref(db), {
        [`users/${currentUser.uid}/name`]: newName,
        [`users/${currentUser.uid}/avatar`]: newAvatar
      });
      currentUser.name = newName;
      currentUser.avatar = newAvatar;
      localStorage.setItem('talk_user', JSON.stringify(currentUser));
      const av = document.getElementById('my-avatar-img');
      if (av) av.src = newAvatar;
      // also update nav avatar if different selector
      const navAvatar = document.querySelector('.nav-avatar img');
      if (navAvatar) navAvatar.src = newAvatar;

      alert('Cập nhật thành công!');
    } catch (e) {
      alert('Lỗi: ' + e.message);
    }
    settingsSaveBtn.textContent = 'Cập nhật hồ sơ';
  });
}
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn đăng xuất?')) {
      localStorage.removeItem('talk_user');
      location.reload();
    }
  });
}

/* ─── Nicknames, Themes & Tags ─── */
if (btnEditNickname) {
  btnEditNickname.addEventListener('click', () => {
    if (!activeRoomId) return;
    nicknameInput.value = document.getElementById('info-name').textContent;
    nicknameModal.classList.add('active');
  });
}
if (nicknameClose) {
  nicknameClose.addEventListener('click', () => nicknameModal.classList.remove('active'));
}
if (saveNicknameBtn) {
  saveNicknameBtn.addEventListener('click', async () => {
    if (!activeRoomId || !activePeerId) return;
    const nn = nicknameInput.value.trim();
    if (nn) {
      // Save for peer
      await update(ref(db), { [`rooms/${activeRoomId}/config/nicknames/${activePeerId}`]: nn });
    } else {
      // Remove nickname
      await remove(ref(db, `rooms/${activeRoomId}/config/nicknames/${activePeerId}`));
    }
    nicknameModal.classList.remove('active');
  });
}

if (themeSelect) {
  themeSelect.addEventListener('change', e => {
    if (!activeRoomId) return;
    update(ref(db), { [`rooms/${activeRoomId}/config/theme`]: e.target.value });
  });
}

if (tagSelect) {
  tagSelect.addEventListener('change', e => {
    if (!activePeerId) return;
    set(ref(db, `friends/${currentUser.uid}/${activePeerId}/tag`), e.target.value);
  });
}

function applyTheme(theme) {
  let activeTheme = theme;
  if (theme === 'default' && document.body.classList.contains('dark-theme')) {
    activeTheme = 'red';
  }

  let color = 'var(--md-sys-color-primary)';
  let bubbleColor = '';
  let dropGlow = '0 0 18px rgba(255,255,255,0.18)';

  if (activeTheme === 'red') {
    color = '#ff3b30';
    bubbleColor = '#ff3b30';
    dropGlow = '0 0 18px rgba(255,59,48,0.3)';
  } else if (activeTheme === 'blue') {
    color = '#0a84ff';
    bubbleColor = '#0a84ff';
    dropGlow = '0 0 18px rgba(10,132,255,0.3)';
  } else if (activeTheme === 'purple') {
    color = '#bf5af2';
    bubbleColor = '#bf5af2';
    dropGlow = '0 0 18px rgba(191,90,242,0.3)';
  } else if (activeTheme === 'green') {
    color = '#30d158';
    bubbleColor = '#30d158';
    dropGlow = '0 0 18px rgba(48,209,88,0.3)';
  }

  if (bubbleColor) {
    document.documentElement.style.setProperty('--bubble-me', bubbleColor);
  } else {
    document.documentElement.style.removeProperty('--bubble-me');
  }

  document.documentElement.style.setProperty('--glow-white', dropGlow);

  // also change the send btn and like btn to match
  const likeBtnIco = document.getElementById('like-btn');
  if (likeBtnIco) {
    likeBtnIco.style.color = color;
  }
  const sendBtnIco = document.getElementById('send-btn');
  if (sendBtnIco) {
    sendBtnIco.style.background = bubbleColor || 'var(--md-sys-color-primary)';
  }
}

document.getElementById('btn-info').addEventListener('click', () => {
  const panel = document.querySelector('.info-panel');
  panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
});

// Close info panel with the X button
document.getElementById('close-info')?.addEventListener('click', () => {
  const panel = document.getElementById('info-panel');
  if (panel) panel.style.display = 'none';
});

// Group Info Panel Toggles
// Toggle group members section
const btnToggleMembers = document.getElementById('btn-toggle-members');
if (btnToggleMembers) {
  btnToggleMembers.addEventListener('click', () => {
    const list = document.getElementById('group-members-list');
    if (list) {
      if (list.style.display === 'none' || !list.style.display) {
        list.style.display = 'flex';
        btnToggleMembers.querySelector('svg').style.transform = 'rotate(180deg)';
      } else {
        list.style.display = 'none';
        btnToggleMembers.querySelector('svg').style.transform = 'rotate(0deg)';
      }
    }
  });
}
// Toggle group security section
const btnAddMemberSmall = document.getElementById('btn-group-add-member');
const btnAddMemberFull = document.getElementById('btn-group-add-member-full');
// Re-bound in the 'Add Member & Group Manage Logic' section below

// Clear History
document.getElementById('btn-group-clear-history')?.addEventListener('click', async () => {
  if (!confirm('Bạn có chắc chắn muốn xóa lịch sử trò chuyện phía bạn? (Tin nhắn vẫn hiển thị với người khác)')) return;
  try {
    await update(ref(db), {
      [`friends/${currentUser.uid}/${activePeerId}/cleared_at`]: Date.now()
    });
    chatMessages.innerHTML = '';
    alert('Đã xóa lịch sử trò chuyện!');
  } catch (e) {
    alert('Lỗi: ' + e.message);
  }
});

// Leave Group
document.getElementById('btn-group-leave')?.addEventListener('click', async () => {
  if (!confirm('Bạn có chắc chắn muốn rời nhóm này?')) return;
  try {
    const groupId = activePeerId;
    // Check member count first
    const snap = await get(child(ref(db), `users/${groupId}/members`));
    let membersCount = 0;
    if (snap.exists()) {
      membersCount = Object.keys(snap.val()).length;
    }

    if (membersCount <= 1) {
      // Last member leaving, delete group entirely
      const updates = {
        [`users/${groupId}`]: null,
        [`friends/${currentUser.uid}/${groupId}`]: null,
        [`messages/${groupId}`]: null
      };
      await update(ref(db), updates);
      alert('Đã rời và giải tán nhóm do không còn thành viên!');
    } else {
      // Remove from members list
      await update(ref(db), {
        [`users/${groupId}/members/${currentUser.uid}`]: null,
        [`friends/${currentUser.uid}/${groupId}`]: null
      });
      // Write system message that user left
      const newMsgRef = push(ref(db, `messages/${groupId}`));
      await set(newMsgRef, {
        uid: 'SYSTEM',
        name: 'Hệ thống',
        txt: `${currentUser.name} đã rời nhóm`,
        ts: Date.now(),
        type: 'system'
      });
      alert('Đã rời nhóm!');
    }
    
    // Go back to empty chat
    chatArea.classList.remove('active');
    activeRoomId = null;
    activePeerId = null;
    renderConvList(searchInput.value);
  } catch (e) {
    alert('Lỗi khi rời nhóm: ' + e.message);
  }
});

// Group Management
document.getElementById('group-manage-close')?.addEventListener('click', () => {
  document.getElementById('group-manage-modal').classList.remove('active');
});

document.getElementById('btn-group-manage')?.addEventListener('click', async () => {
  if (!activePeerId) return;
  const modal = document.getElementById('group-manage-modal');
  modal.classList.add('active');

  const content = document.getElementById('group-manage-content');
  const errorMsg = document.getElementById('group-manage-error');

  try {
    const memSnap = await get(child(ref(db), `users/${activePeerId}/members/${currentUser.uid}`));
    const myRole = memSnap.exists() ? memSnap.val().role : 'member';

    if (myRole !== 'admin' && myRole !== 'deputy') {
      content.style.display = 'none';
      errorMsg.style.display = 'block';
      return;
    }

    content.style.display = 'block';
    errorMsg.style.display = 'none';

    // Setup listeners for settings
    const switchEl = document.getElementById('group-require-approval-switch');
    const setSnap = await get(child(ref(db), `users/${activePeerId}/settings/require_approval`));
    switchEl.checked = setSnap.val() || false;

    switchEl.onchange = async (e) => {
      await update(ref(db), {
        [`users/${activePeerId}/settings/require_approval`]: e.target.checked
      });
    };

    // Load Pending Members
    onValue(ref(db, `users/${activePeerId}/pending`), snap => {
      const listEl = document.getElementById('group-pending-list');
      const countEl = document.getElementById('group-pending-count');
      const pending = snap.val() || {};
      const count = Object.keys(pending).length;
      countEl.textContent = count;
      listEl.innerHTML = '';

      if (count === 0) {
        listEl.innerHTML = '<div style="color:var(--text-muted); font-size:13px; text-align:center;">Không có yêu cầu nào</div>';
      } else {
        Object.entries(pending).forEach(([uid, pData]) => {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.gap = '10px';
          row.style.borderBottom = '1px solid var(--border-light)';
          row.style.paddingBottom = '8px';

          row.innerHTML = `
            <img src="${pData.avatar}" style="width:32px; height:32px; border-radius:50%;">
            <div style="flex:1;">
              <div style="font-size:14px; font-weight:500; color:var(--text-primary);">${pData.name}</div>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="profile-btn-small primary btn-approve" data-uid="${uid}">Duyệt</button>
              <button class="profile-btn-small btn-reject" data-uid="${uid}">Từ chối</button>
            </div>
          `;
          listEl.appendChild(row);
        });

        listEl.querySelectorAll('.btn-approve').forEach(btn => {
          btn.onclick = async () => {
            const u = btn.dataset.uid;
            // Get user info to update their friend list
            const uSnap = await get(child(ref(db), `users/${u}`));
            const gSnap = await get(child(ref(db), `users/${activePeerId}`));
            if (uSnap.exists() && gSnap.exists()) {
              const uData = uSnap.val();
              const gData = gSnap.val();
              const updates = {};
              updates[`users/${activePeerId}/members/${u}`] = { role: 'member', ts: Date.now() };
              updates[`users/${activePeerId}/pending/${u}`] = null;
              updates[`friends/${u}/${activePeerId}/room_id`] = activePeerId;
              updates[`friends/${u}/${activePeerId}/lastMsg`] = `Bạn đã được duyệt vào nhóm ${gData.name}`;
              updates[`friends/${u}/${activePeerId}/lastTime`] = formatTime(Date.now());
              updates[`friends/${u}/${activePeerId}/ts`] = Date.now();
              await update(ref(db), updates);
            }
          };
        });

        listEl.querySelectorAll('.btn-reject').forEach(btn => {
          btn.onclick = async () => {
            const u = btn.dataset.uid;
            await update(ref(db), { [`users/${activePeerId}/pending/${u}`]: null });
          };
        });
      }
    });

  } catch (e) {
    console.error(e);
  }
});

// Run Init
window.addEventListener('DOMContentLoaded', initApp);

/* ─── Group Creation ─── */
const createGroupBtn = document.getElementById('open-create-group-btn');
const createGroupModal = document.getElementById('create-group-modal');
const createGroupClose = document.getElementById('create-group-close');
const submitCreateGroupBtn = document.getElementById('submit-create-group-btn');
const groupNameInput = document.getElementById('group-name-input');
const groupFriendsInput = document.getElementById('group-friends-input');

if (createGroupBtn) {
  createGroupBtn.addEventListener('click', () => {
    createGroupModal.classList.add('active');
    groupNameInput.value = '';

    // Render friends list
    const listContainer = document.getElementById('group-friends-list');
    listContainer.innerHTML = '';

    const friends = Object.values(friendsCache).filter(f => f.user_info && f.user_info.id4 !== 'NHOM' && !f.user_info.id4?.startsWith('gr.') && f.tag !== 'group' && f.tag !== 'stranger');
    if (friends.length === 0) {
      listContainer.innerHTML = '<div style="color:var(--text-muted); font-size:13px; text-align:center; padding: 10px;">Bạn chưa có bạn bè nào.</div>';
      return;
    }

    friends.forEach(f => {
      const item = document.createElement('label');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '10px';
      item.style.padding = '8px';
      item.style.cursor = 'pointer';
      item.style.borderBottom = '1px solid var(--border-light)';

      item.innerHTML = `
        <input type="checkbox" class="friend-checkbox" value="${f.uid}" style="width: 16px; height: 16px; accent-color: var(--md-sys-color-primary);">
        <img src="${f.user_info.avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
        <span style="font-size: 14px; font-weight: 500; color: var(--text-primary);">${f.user_info.name}</span>
      `;
      listContainer.appendChild(item);
    });
  });
}
if (createGroupClose) {
  createGroupClose.addEventListener('click', () => {
    createGroupModal.classList.remove('active');
  });
}
if (submitCreateGroupBtn) {
  submitCreateGroupBtn.addEventListener('click', async () => {
    const groupName = groupNameInput.value.trim();
    if (!groupName) return alert('Vui lòng nhập tên nhóm!');

    const checkboxes = document.querySelectorAll('.friend-checkbox:checked');
    if (checkboxes.length === 0) return alert('Vui lòng chọn ít nhất 1 bạn bè!');

    const selectedFriendUids = Array.from(checkboxes).map(cb => cb.value);
    const memberUids = [currentUser.uid, ...selectedFriendUids];

    submitCreateGroupBtn.disabled = true;
    submitCreateGroupBtn.textContent = 'Đang xử lý...';

    // Create Room ID and Group ID4
    const room_id = 'group_' + Date.now();
    const groupId4 = 'gr.' + Math.floor(1000 + Math.random() * 9000);
    const createdAt = Date.now();

    const groupMembers = {};
    memberUids.forEach(uid => {
      groupMembers[uid] = { role: uid === currentUser.uid ? 'admin' : 'member', ts: createdAt };
    });

    // Lưu thông tin nhóm giống định dạng user để render danh bạ
    const groupInfo = {
      uid: room_id,
      name: groupName,
      avatar: `https://api.dicebear.com/8.x/shapes/svg?seed=${room_id}&backgroundColor=e8001f`,
      id4: groupId4,
      creator: currentUser.uid,
      members: groupMembers,
      settings: { require_approval: false }
    };

    const roomMeta = {
      room_id: room_id,
      tag: 'group',
      lastMsg: `Bạn đã tạo nhóm ${groupName}`,
      lastTime: formatTime(createdAt),
      ts: createdAt,
      unread: 0
    };

    const safeGroupId = groupId4.replace('.', '-');
    const updates = {};
    updates[`users/${room_id}`] = groupInfo;
    updates[`id_map/${safeGroupId}`] = room_id;

    updates[`friends/${currentUser.uid}/${room_id}`] = roomMeta;

    // Đưa thành viên vào nhóm và vào danh sách hội thoại
    selectedFriendUids.forEach(uid => {
      updates[`friends/${uid}/${room_id}`] = {
        ...roomMeta,
        lastMsg: `Bạn đã được thêm vào nhóm ${groupName}`,
        lastTime: formatTime(createdAt),
        ts: createdAt,
        unread: 0
      };
      // Removed redundant group_invites logic here because users are added directly
    });

    try {
      await update(ref(db), updates);

      friendsCache[room_id] = {
        uid: room_id,
        room_id: room_id,
        user_info: groupInfo,
        lastMsg: roomMeta.lastMsg,
        lastTime: roomMeta.lastTime,
        ts: createdAt,
        unread: 0,
        tag: 'group'
      };

      renderConvList(searchInput.value);
      updateContactsList();
      createGroupModal.classList.remove('active');
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }

    submitCreateGroupBtn.disabled = false;
    submitCreateGroupBtn.textContent = 'Tạo nhóm';
  });
}

/* ─── tola-like Settings Tab Switching ─── */
document.querySelectorAll('.tola-menu-item').forEach(item => {
  item.addEventListener('click', () => {
    // Remove active class from all menu items
    document.querySelectorAll('.tola-menu-item').forEach(mi => mi.classList.remove('active'));
    // Add active class to clicked menu item
    item.classList.add('active');

    // Hide all tab contents
    document.querySelectorAll('.tola-tab-content').forEach(tc => tc.classList.remove('active'));
    // Show active tab content
    const tabId = 'tab-' + item.dataset.tab;
    const tabContent = document.getElementById(tabId);
    if (tabContent) tabContent.classList.add('active');
  });
});

/* ─── Theme Toggle ─── */
const themeToggleSwitch = document.getElementById('tola-dark-switch');
let isDarkTheme = localStorage.getItem('tola_theme') === 'dark';

function updateTheme(dark) {
  isDarkTheme = dark;
  if (dark) {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
  // Sync switch if exists
  const sw = document.getElementById('tola-dark-switch');
  if (sw) sw.checked = dark;
  localStorage.setItem('tola_theme', dark ? 'dark' : 'light');

  // Refresh active room theme
  if (themeSelect) {
    applyTheme(themeSelect.value);
  }
}

// Apply on load
updateTheme(isDarkTheme);

// Switch change listener (uses event delegation in case switch is hidden at first)
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'tola-dark-switch') {
    updateTheme(e.target.checked);
  }
  if (e.target && e.target.id === 'privacy-stranger-msg') {
    if (currentUser) {
      update(ref(db), { [`users/${currentUser.uid}/settings/allow_stranger_msg`]: e.target.checked });
    }
  }
});

/* ─── Avatar Dropdown & Settings Actions ─── */
const ddProfile = document.getElementById('dd-profile');
const ddSettings = document.getElementById('dd-settings');
const ddLogout = document.getElementById('dd-logout');
const btnDeleteAccount = document.getElementById('btn-delete-account');

const btnChangeHidePin = document.getElementById('btn-change-hide-pin');
if (btnChangeHidePin) {
  btnChangeHidePin.addEventListener('click', () => {
    const gPin = getGlobalPin();
    if (!gPin) {
      settingsModal.style.display = 'none';
      convCtxTargetRoomId = '__CHANGE_GLOBAL_PIN__';
      pinSetBuf = pinConfirmBuf = pinToSave = '';
      updatePinDots('', 'set'); updatePinDots('', 'confirm');
      document.getElementById('hide-pin-error').textContent = '';
      document.getElementById('hide-pin-confirm-error').textContent = '';
      document.getElementById('hide-pin-step1').style.display = 'block';
      document.getElementById('hide-pin-step2').style.display = 'none';
      hideConvModal.style.display = 'flex';
      return;
    }
    // Close settings modal to show unlock modal
    settingsModal.style.display = 'none';
    
    openUnlockModal(null, (rId) => {
      // Callback after successfully entering CURRENT PIN
      setTimeout(() => {
        convCtxTargetRoomId = '__CHANGE_GLOBAL_PIN__';
        pinSetBuf = pinConfirmBuf = pinToSave = '';
        updatePinDots('', 'set'); updatePinDots('', 'confirm');
        document.getElementById('hide-pin-error').textContent = '';
        document.getElementById('hide-pin-confirm-error').textContent = '';
        document.getElementById('hide-pin-step1').style.display = 'block';
        document.getElementById('hide-pin-step2').style.display = 'none';
        hideConvModal.style.display = 'flex';
      }, 300); // small delay to allow unlock modal to close smoothly
    }, "Nhập mã PIN hiện tại");
  });
}
if (btnDeleteAccount) {
  btnDeleteAccount.addEventListener('click', async () => {
    if (!currentUser) return;
    if (!confirm('CẢNH BÁO: Hành động này sẽ xóa VĨNH VIỄN tài khoản của bạn, tự động rời các nhóm bạn đã tham gia và xóa dữ liệu liên kết trên thiết bị bạn bè. Bạn có chắc chắn muốn tiếp tục?')) return;
    
    btnDeleteAccount.disabled = true;
    btnDeleteAccount.textContent = 'Đang xóa...';
    try {
      const updates = {};
      
      // 1. Remove from all friends
      for (const fuid of Object.keys(friendsCache)) {
        if (fuid.startsWith('group_')) {
          updates[`users/${fuid}/members/${currentUser.uid}`] = null;
          updates[`friends/${currentUser.uid}/${fuid}`] = null;
          
          const memSnap = await get(child(ref(db), `users/${fuid}/members`));
          if (memSnap.exists()) {
            const members = memSnap.val();
            if (members[currentUser.uid] && members[currentUser.uid].role === 'admin') {
              const candidates = Object.keys(members).filter(u => u !== currentUser.uid);
              if (candidates.length > 0) {
                 let nextAdmin = candidates[Math.floor(Math.random() * candidates.length)];
                 const msgsSnap = await get(child(ref(db), `messages/${fuid}`));
                 if (msgsSnap.exists()) {
                   const msgs = Object.values(msgsSnap.val());
                   const tally = {};
                   candidates.forEach(c => tally[c] = 0);
                   msgs.forEach(m => {
                     if (m.s === currentUser.uid && m.replyTo && m.replyTo.s && candidates.includes(m.replyTo.s)) {
                       tally[m.replyTo.s] += 2;
                     } else if (candidates.includes(m.s)) {
                       tally[m.s] += 1;
                     }
                   });
                   let max = -1;
                   for (const c of candidates) {
                     if (tally[c] > max) { max = tally[c]; nextAdmin = c; }
                   }
                 }
                 updates[`users/${fuid}/members/${nextAdmin}/role`] = 'admin';
              } else {
                 updates[`users/${fuid}`] = null;
                 updates[`messages/${fuid}`] = null;
              }
            }
          }
        } else {
          // Remove from friend's friendlist
          updates[`friends/${fuid}/${currentUser.uid}`] = null;
        }
      }
      
      // 2. Delete my user data
      updates[`users/${currentUser.uid}`] = null;
      updates[`friends/${currentUser.uid}`] = null;
      
      // Execute DB update
      await update(ref(db), updates);
      
      // 3. Delete Firebase Auth account
      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
      }
      
      alert('Tài khoản đã được xóa thành công!');
      window.location.href = 'login.html';
    } catch (e) {
      alert('Lỗi khi xóa tài khoản: ' + e.message + '. Gợi ý: Hãy đăng xuất và đăng nhập lại trước khi xóa để xác thực bảo mật.');
      btnDeleteAccount.disabled = false;
      btnDeleteAccount.textContent = 'Xóa';
    }
  });
}

if (ddProfile) {
  ddProfile.addEventListener('click', () => {
    openProfileModal();
    if (settingsDropdown) settingsDropdown.classList.remove('active');
  });
}
if (ddSettings) {
  ddSettings.addEventListener('click', () => {
    if (settingsNameInput && currentUser) {
      settingsNameInput.value = currentUser.name;
      settingsAvatarInput.value = currentUser.avatar;
    }
    settingsModal.style.display = 'flex';
    if (settingsDropdown) settingsDropdown.classList.remove('active');
  });
}
if (ddLogout) {
  ddLogout.addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn đăng xuất?')) {
      if (activePresenceUnsub) {
        remove(ref(db, `status/${currentUser.uid}`));
        activePresenceUnsub();
      }
      localStorage.removeItem('talk_user');
      location.reload();
    }
  });
}

// Add Material Design Ripple Effect
document.addEventListener('click', function (e) {
  const target = e.target.closest('.nav-btn, .icon-btn, .login-btn, .send-btn, .conv-item, .ripple, .ctx-item');
  if (!target) return;

  if (getComputedStyle(target).position === 'static') {
    target.style.position = 'relative';
  }
  target.style.overflow = 'hidden';

  const circle = document.createElement('span');
  const diameter = Math.max(target.clientWidth, target.clientHeight);
  const radius = diameter / 2;

  const rect = target.getBoundingClientRect();

  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${e.clientX - rect.left - radius}px`;
  circle.style.top = `${e.clientY - rect.top - radius}px`;
  circle.classList.add('ripple-effect');

  target.appendChild(circle);

  setTimeout(() => {
    circle.remove();
  }, 600);
});

/* ─── Info Panel Sub-Screens Navigation ─── */
document.addEventListener('click', async (e) => {
  // Members Screen
  const btnToggleMembers = e.target.closest('#btn-toggle-members');
  if (btnToggleMembers) {
    document.getElementById('info-members-screen').style.left = '0';
  }
  const btnBackMembers = e.target.closest('#btn-back-members');
  if (btnBackMembers) {
    document.getElementById('info-members-screen').style.left = '100%';
  }

  // Group Manage Screen — load settings when opened
  const btnToggleGroupManage = e.target.closest('#btn-toggle-group-manage');
  if (btnToggleGroupManage) {
    const screen = document.getElementById('info-group-manage-screen');
    if (screen) screen.style.left = '0';

    // Re-sync settings UI from Firebase
    if (activePeerId) {
      try {
        const snap = await get(ref(db, `users/${activePeerId}/settings`));
        const settings = snap.val() || {};
        const setCheckbox = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.checked = !!val;
        };
        setCheckbox('group-setting-change-info', settings.changeInfo !== false);
        setCheckbox('group-setting-pin-msg', settings.pinMsg !== false);
        setCheckbox('group-setting-send-msg', settings.sendMsg !== false);
        setCheckbox('group-setting-approve-member', !!settings.approveMember);
        setCheckbox('group-setting-highlight-admin', !!settings.highlightAdmin);
        setCheckbox('group-setting-read-recent', settings.readRecent !== false);
        setCheckbox('group-setting-join-id', settings.joinId !== false);

        const idDisplay = document.getElementById('group-manage-id-display');
        if (idDisplay) {
          const gData = friendsCache[activePeerId];
          idDisplay.textContent = 'ID: ' + (gData?.user_info?.id4 || activePeerId);
        }
        
        // Show/hide disband button based on role
        const disbandBtn = document.getElementById('btn-disband-group');
        if (disbandBtn) {
          disbandBtn.style.display = (currentMyRole === 'admin') ? 'flex' : 'none';
        }
      } catch(err) {
        console.error('Error loading group settings:', err);
      }
    }
  }
  const btnBackGroupManage = e.target.closest('#btn-back-group-manage');
  if (btnBackGroupManage) {
    document.getElementById('info-group-manage-screen').style.left = '100%';
  }

  // Admins Screen — load when opened
  const btnOpenAdmins = e.target.closest('#btn-open-admins');
  if (btnOpenAdmins) {
    const screen = document.getElementById('info-admins-screen');
    if (screen) screen.style.left = '0';
    
    // Load admins list fresh
    if (activePeerId) {
      try {
        const memSnap = await get(ref(db, `users/${activePeerId}/members`));
        const members = memSnap.val() || {};
        const adminsListContainer = document.getElementById('admins-list');
        if (adminsListContainer) {
          adminsListContainer.innerHTML = '';
          for (const [uid, memData] of Object.entries(members)) {
            if (memData.role !== 'admin' && memData.role !== 'deputy') continue;
            let uData = { name: 'Người dùng', avatar: '' };
            if (uid === currentUser.uid) {
              uData = currentUser;
            } else {
              const uSnap = await get(child(ref(db), `users/${uid}`));
              if (uSnap.exists()) uData = uSnap.val();
            }
            const roleLabel = memData.role === 'admin' ? 'Trưởng nhóm' : 'Phó nhóm';
            const roleColor = memData.role === 'admin' ? 'var(--md-sys-color-primary)' : 'var(--orange)';
            const adminEl = document.createElement('div');
            adminEl.style.display = 'flex';
            adminEl.style.alignItems = 'center';
            adminEl.style.gap = '12px';
            adminEl.style.padding = '8px 0';
            adminEl.innerHTML = `
              <img src="${uData.avatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
              <div style="flex:1;">
                <div style="font-size:14px; font-weight:600;">${uData.name}${uid === currentUser.uid ? ' (Bạn)' : ''}</div>
                <div style="font-size:12px; color:${roleColor};">${roleLabel}</div>
              </div>
              ${(currentMyRole === 'admin' && uid !== currentUser.uid) ? `
                <button class="btn-remove-deputy" data-uid="${uid}" style="padding:4px 10px; border-radius:6px; background:var(--bg-input); border:1px solid var(--border); font-size:12px; cursor:pointer; color:var(--red);">Xóa</button>
              ` : ''}
            `;
            adminsListContainer.appendChild(adminEl);
          }
          
          // Handle remove deputy
          adminsListContainer.querySelectorAll('.btn-remove-deputy').forEach(btn => {
            btn.onclick = async () => {
              const uid = btn.dataset.uid;
              if (confirm('Xóa quyền phó nhóm của thành viên này?')) {
                await update(ref(db), { [`users/${activePeerId}/members/${uid}/role`]: 'member' });
              }
            };
          });
        }
        
        // Show/hide admin-only buttons
        const btnAddDeputy = document.getElementById('btn-add-deputy');
        const btnTransferAdmin = document.getElementById('btn-transfer-admin');
        if (btnAddDeputy) btnAddDeputy.style.display = currentMyRole === 'admin' ? 'block' : 'none';
        if (btnTransferAdmin) btnTransferAdmin.style.display = currentMyRole === 'admin' ? 'block' : 'none';
      } catch(err) {
        console.error('Error loading admins:', err);
      }
    }
  }
  const btnBackAdmins = e.target.closest('#btn-back-admins');
  if (btnBackAdmins) {
    document.getElementById('info-admins-screen').style.left = '100%';
  }

  // Disband Group
  const btnDisbandGroup = e.target.closest('#btn-disband-group');
  if (btnDisbandGroup && activePeerId) {
    if (!confirm('Bạn có chắc chắn muốn GIẢI TÁN nhóm này? Toàn bộ dữ liệu sẽ bị xóa!')) return;
    try {
      // Remove group from all members' friend lists
      const memSnap = await get(ref(db, `users/${activePeerId}/members`));
      const members = memSnap.val() || {};
      const updates = {};
      for (const uid of Object.keys(members)) {
        updates[`friends/${uid}/${activePeerId}`] = null;
      }
      updates[`users/${activePeerId}`] = null;
      await update(ref(db), updates);
      document.getElementById('info-group-manage-screen').style.left = '100%';
      document.getElementById('info-panel').style.display = 'none';
      alert('Nhóm đã được giải tán.');
    } catch(err) {
      alert('Lỗi: ' + err.message);
    }
  }
});

/* ─── Add Friend Logic ─── */
const openAddFriendBtn = document.getElementById('open-add-friend-btn');
const strangerProfileModal = document.getElementById('stranger-profile-modal');
const strangerProfileClose = document.getElementById('stranger-profile-close');
const strangerAddBtn = document.getElementById('stranger-add-btn');

let currentStrangerId = null;
let currentStrangerData = null;

if (openAddFriendBtn) {
  openAddFriendBtn.addEventListener('click', () => {
    addFriendModal.classList.add('active');
    friendIdInput.value = '';
    friendResult.innerHTML = '';
    addFriendBtn.style.display = 'none';
  });
}

if (document.getElementById('friend-modal-close')) {
  document.getElementById('friend-modal-close').addEventListener('click', () => {
    addFriendModal.classList.remove('active');
  });
}

if (strangerProfileClose) {
  strangerProfileClose.addEventListener('click', () => {
    strangerProfileModal.classList.remove('active');
  });
}

// Search ID
if (friendIdInput) {
  friendIdInput.addEventListener('input', async (e) => {
    const val = e.target.value.trim();
    const isGroup = val.startsWith('gr.');
    const searchId = isGroup ? val.replace('.', '-') : val;
    
    if (searchId.length === 4 || (isGroup && searchId.length === 7)) {
      try {
        const snap = await get(child(ref(db), `id_map/${searchId}`));
        if (snap.exists()) {
          const uId = snap.val();
          if (uId === currentUser.uid) {
            friendResult.innerHTML = '<div style="color:var(--text-secondary); margin-top:12px;">Đây là ID của bạn.</div>';
            addFriendBtn.style.display = 'none';
            return;
          }
          const uSnap = await get(child(ref(db), `users/${uId}`));
          if (uSnap.exists()) {
            currentStrangerData = uSnap.val();
            currentStrangerId = uId;
            friendResult.innerHTML = `
              <div style="display:flex; align-items:center; gap:16px; margin: 24px 0 32px 0; padding:16px; border-radius:12px; background:var(--md-sys-color-surface-container); border:1px solid var(--border); box-shadow:var(--elevation-1);">
                <img src="${currentStrangerData.avatar}" style="width:52px; height:52px; border-radius:50%; object-fit:cover; border:2px solid var(--border);">
                <div style="flex:1; text-align:left;">
                  <div style="font-weight:700; font-size:16px; color:var(--text-primary); margin-bottom:4px;">${currentStrangerData.name}</div>
                  <div style="font-size:13px; color:var(--text-secondary); display:flex; align-items:center; gap:4px;">
                    <span style="opacity:0.8;">ID:</span> <span style="font-weight:500;">${currentStrangerData.id4}</span>
                  </div>
                </div>
              </div>
            `;
            addFriendBtn.textContent = "Xem hồ sơ";
            addFriendBtn.style.display = 'block';
          }
        } else {
          friendResult.innerHTML = '<div style="color:var(--red); margin-top:12px;">Không tìm thấy người dùng!</div>';
          addFriendBtn.style.display = 'none';
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      friendResult.innerHTML = '';
      addFriendBtn.style.display = 'none';
    }
  });
}

// Open Stranger Profile
if (addFriendBtn) {
  addFriendBtn.addEventListener('click', () => {
    if (!currentStrangerData) return;
    addFriendModal.classList.remove('active');

    document.getElementById('stranger-avatar-img').src = currentStrangerData.avatar;
    document.getElementById('stranger-name-val').textContent = currentStrangerData.name;
    
    const isGroup = currentStrangerData.id4 && currentStrangerData.id4.startsWith('gr.');
    const introInput = document.getElementById('stranger-intro-input');
    const msgBtn = document.getElementById('stranger-message-btn');
    const subInfo = document.getElementById('stranger-sub-info');
    
    if (isGroup) {
      introInput.style.display = 'none';
      msgBtn.style.display = 'none';
      strangerAddBtn.textContent = 'Xin tham gia';
      
      let memCount = 0;
      if (currentStrangerData.members) memCount = Object.keys(currentStrangerData.members).length;
      
      if (subInfo) {
        subInfo.textContent = `${memCount} thành viên`;
        subInfo.style.display = 'block';
      }
    } else {
      introInput.style.display = 'block';
      msgBtn.style.display = 'block';
      strangerAddBtn.textContent = 'Kết bạn';
      introInput.value = `Xin chào, mình là ${currentUser.name}. Kết bạn với mình nhé!`;
      if (subInfo) subInfo.style.display = 'none';
    }

    strangerProfileModal.classList.add('active');
  });
}

// Send Friend Request
if (strangerAddBtn) {
  strangerAddBtn.addEventListener('click', async () => {
    if (!currentStrangerId || !currentStrangerData) return;
    const isGroup = currentStrangerData.id4 && currentStrangerData.id4.startsWith('gr.');
    const introMsg = document.getElementById('stranger-intro-input').value.trim();

    try {
      strangerAddBtn.textContent = "Đang gửi...";
      strangerAddBtn.disabled = true;

      if (isGroup) {
        await update(ref(db), {
          [`users/${currentStrangerId}/pending/${currentUser.uid}`]: {
            name: currentUser.name,
            avatar: currentUser.avatar,
            ts: Date.now()
          }
        });
        alert("Đã gửi yêu cầu tham gia nhóm!");
      } else {
        const reqData = {
          sender: currentUser.uid,
          receiver: currentStrangerId,
          intro: introMsg,
          timestamp: Date.now(),
          senderData: {
            name: currentUser.name,
            avatar: currentUser.avatar,
            id4: currentUser.id4
          }
        };

        await update(ref(db), {
          [`friend_requests/${currentStrangerId}/${currentUser.uid}`]: reqData
        });

        const roomId = [currentUser.uid, currentStrangerId].sort().join('_');
        await update(ref(db), {
          [`friends/${currentUser.uid}/${currentStrangerId}`]: {
            room_id: roomId,
            ts: Date.now(),
            tag: 'stranger'
          }
        });

        alert("Đã gửi yêu cầu kết bạn!");
      }
      strangerProfileModal.classList.remove('active');
    } catch (err) {
      alert("Lỗi: " + err.message);
    } finally {
      strangerAddBtn.textContent = isGroup ? "Xin tham gia" : "Kết bạn";
      strangerAddBtn.disabled = false;
    }
  });
}

/* ─── Accordion Logic for Info Panel (Event Delegation) ─── */
document.addEventListener('click', (e) => {
  const btnToggleMembers = e.target.closest('#btn-toggle-members');
  if (btnToggleMembers) {
    const groupMembersList = document.getElementById('group-members-list');
    const iconToggleMembers = document.getElementById('icon-toggle-members');
    if (groupMembersList) {
      const isHidden = groupMembersList.style.display === 'none';
      groupMembersList.style.display = isHidden ? 'flex' : 'none';
      if (iconToggleMembers) {
        iconToggleMembers.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    }
  }

  const btnToggleSecurity = e.target.closest('#btn-toggle-security');
  if (btnToggleSecurity) {
    const groupSecurityList = document.getElementById('group-security-list');
    const securityIcon = btnToggleSecurity.querySelector('svg');
    if (groupSecurityList) {
      const isHidden = groupSecurityList.style.display === 'none';
      groupSecurityList.style.display = isHidden ? 'flex' : 'none';
      if (securityIcon) {
        securityIcon.style.transition = 'transform 0.2s';
        securityIcon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    }
  }
});

// Contacts Logic
const navContacts = document.getElementById('nav-contacts');
const navMsg = document.getElementById('nav-msg');
const msgSidebar = document.getElementById('msg-sidebar');
const contactsSidebar = document.getElementById('contacts-sidebar');
const btnOpenAddFriendContacts = document.getElementById('open-add-friend-contacts-btn');
const friendRequestsList = document.getElementById('friend-requests-list');
const friendsListContainer = document.getElementById('friends-list');

if (navContacts && navMsg) {
  navContacts.addEventListener('click', () => {
    navContacts.classList.add('active');
    navMsg.classList.remove('active');
    msgSidebar.style.display = 'none';
    contactsSidebar.style.display = 'flex';
  });

  navMsg.addEventListener('click', () => {
    navMsg.classList.add('active');
    navContacts.classList.remove('active');
    msgSidebar.style.display = 'flex';
    contactsSidebar.style.display = 'none';
  });
}

if (btnOpenAddFriendContacts) {
  btnOpenAddFriendContacts.addEventListener('click', () => {
    addFriendModal.classList.add('active');
    friendIdInput.value = '';
    friendResult.innerHTML = '';
    addFriendBtn.style.display = 'none';
  });
}

// Render contacts
function renderContacts() {
  if (!currentUser) return;

  // 1. Render Requests
  onValue(ref(db, `friend_requests/${currentUser.uid}`), (snap) => {
    friendRequestsList.innerHTML = '';
    let count = 0;
    const requests = snap.val() || {};

    for (const [senderUid, reqData] of Object.entries(requests)) {
      // Skip group invites if user is already a member
      if (reqData.room_id && reqData.room_id.startsWith('group_')) {
        const groupInfo = friendsCache[reqData.room_id]?.user_info;
        if (groupInfo && groupInfo.members && groupInfo.members[currentUser.uid]) {
          // User is already a member of this group, skip showing the invite
          continue;
        }
      }

      count++;
      const reqEl = document.createElement('div');
      reqEl.style.padding = '12px 16px';
      reqEl.style.borderBottom = '1px solid var(--border)';
      reqEl.style.display = 'flex';
      reqEl.style.alignItems = 'center';
      reqEl.style.gap = '12px';

      const sData = reqData.senderData || { name: 'Người lạ', avatar: 'https://via.placeholder.com/40', id4: '????' };

      reqEl.innerHTML = `
        <img src="${sData.avatar}" style="width:40px; height:40px; border-radius:50%;">
        <div style="flex:1;">
          <div style="font-weight:600;">${sData.name}</div>
          <div style="font-size:12px; color:var(--text-secondary);">ID: ${sData.id4}</div>
          ${reqData.intro ? `<div style="font-size:12px; font-style:italic; margin-top:4px;">"${reqData.intro}"</div>` : ''}
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <button class="accept-btn login-btn" style="padding:4px 8px; font-size:12px; height:auto; width:auto; border-radius:4px;">Đồng ý</button>
          <button class="reject-btn" style="padding:4px 8px; font-size:12px; height:auto; width:auto; border-radius:4px; background:var(--bg-input); border:1px solid var(--border); color:var(--text-primary); cursor:pointer;">Từ chối</button>
        </div>
      `;

      const btnAccept = reqEl.querySelector('.accept-btn');
      const btnReject = reqEl.querySelector('.reject-btn');

      btnAccept.addEventListener('click', async () => {
        btnAccept.textContent = '...';
        btnAccept.disabled = true;
        try {
          // Remove request, add as friend for both
          const roomId = [currentUser.uid, senderUid].sort().join('_');
          await update(ref(db), {
            [`friend_requests/${currentUser.uid}/${senderUid}`]: null,
            [`friends/${currentUser.uid}/${senderUid}`]: {
              room_id: roomId,
              tag: 'friend',
              ts: Date.now()
            },
            [`friends/${senderUid}/${currentUser.uid}`]: {
              room_id: roomId,
              tag: 'friend',
              ts: Date.now()
            }
          });
        } catch (e) {
          alert('Lỗi: ' + e.message);
        }
      });

      btnReject.addEventListener('click', async () => {
        btnReject.textContent = '...';
        btnReject.disabled = true;
        try {
          await update(ref(db), {
            [`friend_requests/${currentUser.uid}/${senderUid}`]: null
          });
        } catch (e) {
          alert('Lỗi: ' + e.message);
        }
      });

      friendRequestsList.appendChild(reqEl);
    }

    const countEl = document.getElementById('req-count');
    if (countEl) countEl.textContent = count;
  });

  // 2. Render Group Invites
  const groupRequestsList = document.getElementById('group-requests-list');
  onValue(ref(db, `group_invites/${currentUser.uid}`), (snap) => {
    if (!groupRequestsList) return;
    groupRequestsList.innerHTML = '';
    let count = 0;
    const invites = snap.val() || {};

    for (const [roomId, invData] of Object.entries(invites)) {
      count++;
      const reqEl = document.createElement('div');
      reqEl.style.padding = '12px 16px';
      reqEl.style.borderBottom = '1px solid var(--border)';
      reqEl.style.display = 'flex';
      reqEl.style.alignItems = 'center';
      reqEl.style.gap = '12px';

      reqEl.innerHTML = `
        <img src="${invData.groupAvatar}" style="width:40px; height:40px; border-radius:50%;">
        <div style="flex:1;">
          <div style="font-weight:600;">${invData.groupName}</div>
          <div style="font-size:12px; color:var(--text-secondary);">Mời bởi: ${invData.inviterName}</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <button class="accept-btn login-btn" style="padding:4px 8px; font-size:12px; height:auto; width:auto; border-radius:4px;">Tham gia</button>
          <button class="reject-btn" style="padding:4px 8px; font-size:12px; height:auto; width:auto; border-radius:4px; background:var(--bg-input); border:1px solid var(--border); color:var(--text-primary); cursor:pointer;">Từ chối</button>
        </div>
      `;

      const btnAccept = reqEl.querySelector('.accept-btn');
      const btnReject = reqEl.querySelector('.reject-btn');

      btnAccept.addEventListener('click', async () => {
        btnAccept.textContent = '...';
        btnAccept.disabled = true;
        try {
          await update(ref(db), {
            [`group_invites/${currentUser.uid}/${roomId}`]: null,
            [`friends/${currentUser.uid}/${roomId}/room_id`]: roomId,
            [`friends/${currentUser.uid}/${roomId}/lastMsg`]: `Bạn đã tham gia nhóm ${invData.groupName}`,
            [`friends/${currentUser.uid}/${roomId}/lastTime`]: formatTime(Date.now()),
            [`friends/${currentUser.uid}/${roomId}/ts`]: Date.now()
          });
        } catch (e) {
          alert('Lỗi: ' + e.message);
        }
      });

      btnReject.addEventListener('click', async () => {
        btnReject.textContent = '...';
        btnReject.disabled = true;
        try {
          await update(ref(db), {
            [`group_invites/${currentUser.uid}/${roomId}`]: null
          });
        } catch (e) {
          alert('Lỗi: ' + e.message);
        }
      });

      groupRequestsList.appendChild(reqEl);
    }

    const countEl = document.getElementById('group-req-count');
    if (countEl) countEl.textContent = count;
  });
}

function updateContactsList() {
  const friendsListContainer = document.getElementById('friends-list');
  if (!friendsListContainer) return;
  friendsListContainer.innerHTML = '';

  const list = Object.values(friendsCache).filter(c => c.user_info && c.user_info.id4 !== 'NHOM' && !c.user_info.id4?.startsWith('gr.') && c.tag !== 'stranger' && c.tag !== 'group');

  // Sort alphabetically
  list.sort((a, b) => a.user_info.name.localeCompare(b.user_info.name));

  list.forEach(c => {
    const item = document.createElement('div');
    item.style.padding = '12px 16px';
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '12px';
    item.style.cursor = 'pointer';
    item.style.borderBottom = '1px solid var(--border)';
    item.className = 'ripple';

    item.innerHTML = `
      <img src="${c.user_info.avatar}" style="width:40px; height:40px; border-radius:50%;">
      <div style="flex:1;">
        <div style="font-weight:600;">${c.user_info.name}</div>
        <div style="font-size:12px; color:var(--text-secondary);">ID: ${c.user_info.id4}</div>
      </div>
    `;

    item.addEventListener('click', () => {
      // Switch back to msg view and open chat
      if (navMsg) navMsg.click();
      selectChat(c);
    });

    friendsListContainer.appendChild(item);
  });

  const countEl = document.getElementById('friend-count');
  if (countEl) countEl.textContent = list.length;
}

// Call updateContactsList after friends load (done inside onValue friendsRef)

/* ─── Add Member & Group Manage Logic ─── */
const addMemberModal = document.getElementById('add-member-modal');
const addMemberClose = document.getElementById('add-member-close');
const btnAddMemberId = document.getElementById('btn-add-member-id');
const addMemberIdInput = document.getElementById('add-member-id-input');
const submitAddMemberBtn = document.getElementById('submit-add-member-btn');

const openAddMemberModal = () => {
  if (!addMemberModal) return;
  addMemberModal.classList.add('active');
  if (addMemberIdInput) addMemberIdInput.value = '';
  
  const listContainer = document.getElementById('add-member-friends-list');
  if (!listContainer) return;
  listContainer.innerHTML = '';
  
  const friends = Object.values(friendsCache).filter(f => f.user_info && f.user_info.id4 !== 'NHOM');
  
  // Filter out existing members
  const existingMembers = [];
  document.querySelectorAll('#group-members-list .btn-kick').forEach(b => existingMembers.push(b.dataset.uid));
  const availableFriends = friends.filter(f => !existingMembers.includes(f.uid));

  if (availableFriends.length === 0) {
    listContainer.innerHTML = '<div style="color:var(--text-muted); font-size:13px; text-align:center; padding: 10px;">Không có bạn bè nào để thêm.</div>';
    return;
  }

  availableFriends.forEach(f => {
    const item = document.createElement('label');
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '10px';
    item.style.padding = '8px';
    item.style.cursor = 'pointer';
    item.style.borderBottom = '1px solid var(--border-light)';
    item.innerHTML = `
      <input type="checkbox" class="add-member-checkbox" value="${f.uid}" style="width: 16px; height: 16px; accent-color: var(--md-sys-color-primary);">
      <img src="${f.user_info.avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
      <span style="font-size: 14px; font-weight: 500; color: var(--text-primary);">${f.user_info.name}</span>
    `;
    listContainer.appendChild(item);
  });
};

if (document.getElementById('btn-group-add-member')) {
  document.getElementById('btn-group-add-member').addEventListener('click', openAddMemberModal);
}
if (document.getElementById('btn-group-add-member-full')) {
  document.getElementById('btn-group-add-member-full').addEventListener('click', openAddMemberModal);
}

if (addMemberClose) {
  addMemberClose.addEventListener('click', () => addMemberModal.classList.remove('active'));
}

async function resolveId4ToUid(id4) {
  const usersSnap = await get(ref(db, 'users'));
  const users = usersSnap.val() || {};
  for (const [uid, u] of Object.entries(users)) {
    if (u.id4 === id4) return { uid, data: u };
  }
  return null;
}

if (btnAddMemberId) {
  btnAddMemberId.addEventListener('click', async () => {
    const id = addMemberIdInput.value.trim();
    if (!id) return;
    btnAddMemberId.textContent = '...';
    const found = await resolveId4ToUid(id);
    btnAddMemberId.textContent = 'Thêm';
    
    if (found) {
      const listContainer = document.getElementById('add-member-friends-list');
      if (listContainer.querySelector(`input[value="${found.uid}"]`)) {
        return alert("Người này đã có trong danh sách chọn!");
      }
      const item = document.createElement('label');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '10px';
      item.style.padding = '8px';
      item.style.cursor = 'pointer';
      item.style.borderBottom = '1px solid var(--border-light)';
      item.innerHTML = `
        <input type="checkbox" class="add-member-checkbox" value="${found.uid}" checked style="width: 16px; height: 16px; accent-color: var(--md-sys-color-primary);">
        <img src="${found.data.avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
        <span style="font-size: 14px; font-weight: 500; color: var(--text-primary);">${found.data.name} (Từ ID)</span>
      `;
      listContainer.prepend(item);
      addMemberIdInput.value = '';
    } else {
      alert("Không tìm thấy người dùng với ID này!");
    }
  });
}

if (submitAddMemberBtn) {
  submitAddMemberBtn.addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('.add-member-checkbox:checked');
    if (checkboxes.length === 0) return alert('Vui lòng chọn ít nhất 1 người!');
    const selectedUids = Array.from(checkboxes).map(cb => cb.value);

    submitAddMemberBtn.disabled = true;
    submitAddMemberBtn.textContent = 'Đang xử lý...';

    const updates = {};
    const ts = Date.now();
    const needsApproval = currentSettings.approveMember && currentMyRole === 'member';

    for (const u of selectedUids) {
      if (needsApproval) {
        updates[`users/${activePeerId}/pending/${u}`] = { 
          name: friendsCache[u]?.user_info?.name || 'Người dùng',
          avatar: friendsCache[u]?.user_info?.avatar || 'https://via.placeholder.com/32',
          ts 
        };
      } else {
        updates[`users/${activePeerId}/members/${u}`] = { role: 'member', ts };
        updates[`friends/${u}/${activePeerId}`] = {
          room_id: friendsCache[activePeerId]?.room_id || activePeerId,
          tag: 'group',
          ts
        };
      }
    }

    try {
      await update(ref(db), updates);
      addMemberModal.classList.remove('active');
    } catch (e) {
      alert("Lỗi: " + e.message);
    } finally {
      submitAddMemberBtn.disabled = false;
      submitAddMemberBtn.textContent = 'Thêm vào nhóm';
    }
  });
}

// Logic for btn-group-add-id in Create Group
const btnGroupAddId = document.getElementById('btn-group-add-id');
const groupAddIdInput = document.getElementById('group-add-id-input');
if (btnGroupAddId) {
  btnGroupAddId.addEventListener('click', async () => {
    const id = groupAddIdInput.value.trim();
    if (!id) return;
    btnGroupAddId.textContent = '...';
    const found = await resolveId4ToUid(id);
    btnGroupAddId.textContent = 'Thêm';
    
    if (found) {
      const listContainer = document.getElementById('group-friends-list');
      if (listContainer.querySelector(`input[value="${found.uid}"]`)) {
        return alert("Người này đã có trong danh sách chọn!");
      }
      const item = document.createElement('label');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '10px';
      item.style.padding = '8px';
      item.style.cursor = 'pointer';
      item.style.borderBottom = '1px solid var(--border-light)';
      item.innerHTML = `
        <input type="checkbox" class="friend-checkbox" value="${found.uid}" checked style="width: 16px; height: 16px; accent-color: var(--md-sys-color-primary);">
        <img src="${found.data.avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
        <span style="font-size: 14px; font-weight: 500; color: var(--text-primary);">${found.data.name} (Từ ID)</span>
      `;
      listContainer.prepend(item);
      groupAddIdInput.value = '';
    } else {
      alert("Không tìm thấy người dùng với ID này!");
    }
  });
}

/* ─── Group Settings Checkboxes ─── */
const groupSettingsKeys = [
  { id: 'group-setting-change-info', key: 'changeInfo' },
  { id: 'group-setting-pin-msg', key: 'pinMsg' },
  { id: 'group-setting-send-msg', key: 'sendMsg' },
  { id: 'group-setting-approve-member', key: 'approveMember' },
  { id: 'group-setting-highlight-admin', key: 'highlightAdmin' },
  { id: 'group-setting-read-recent', key: 'readRecent' },
  { id: 'group-setting-join-id', key: 'joinId' }
];

groupSettingsKeys.forEach(({ id, key }) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('change', async (e) => {
      if (!activePeerId) return;
      const newVal = e.target.checked;
      try {
        await update(ref(db), { [`users/${activePeerId}/settings/${key}`]: newVal });
        // Update the local cache so permissions apply immediately
        currentSettings[key] = newVal;
        if (window.applyGroupPermissions) window.applyGroupPermissions();
      } catch (err) {
        alert("Lỗi khi cập nhật cài đặt: " + err.message);
        e.target.checked = !newVal; // Revert
      }
    });
  }
});

/* ─── Copy Group ID ─── */
const btnCopyGroupId = document.getElementById('btn-copy-group-id');
if (btnCopyGroupId) {
  btnCopyGroupId.addEventListener('click', () => {
    if (!activePeerId) return;
    const groupData = friendsCache[activePeerId];
    if (groupData && groupData.user_info && groupData.user_info.id4) {
      navigator.clipboard.writeText(groupData.user_info.id4);
      alert('Đã copy ID nhóm!');
    } else {
      navigator.clipboard.writeText(activePeerId);
      alert('Đã copy UID nhóm!');
    }
  });
}


/* ─── Adjust Role / Transfer Admin ─── */
const btnAddDeputy = document.getElementById('btn-add-deputy');
const btnTransferAdmin = document.getElementById('btn-transfer-admin');
const adjustRoleModal = document.getElementById('adjust-role-modal');
const adjustRoleClose = document.getElementById('adjust-role-close');
const adjustRoleCancel = document.getElementById('adjust-role-cancel');
const adjustRoleConfirm = document.getElementById('adjust-role-confirm');
const adjustRoleList = document.getElementById('adjust-role-list');
const adjustRoleSearch = document.getElementById('adjust-role-search');
const adjustRoleTitle = document.getElementById('adjust-role-title');

let adjustRoleMode = ''; // 'deputy' or 'admin'
let selectedAdjustMembers = new Set();
let allGroupMembers = [];

function openAdjustRoleModal(mode) {
  if (!activePeerId) return;
  adjustRoleMode = mode;
  selectedAdjustMembers.clear();
  adjustRoleSearch.value = '';
  
  if (mode === 'deputy') {
    adjustRoleTitle.textContent = 'Điều chỉnh phó nhóm';
  } else {
    adjustRoleTitle.textContent = 'Chuyển quyền trưởng nhóm';
  }
  
  // Fetch members
  get(ref(db, `users/${activePeerId}/members`)).then(async snap => {
    if (!snap.exists()) return;
    const members = snap.val();
    allGroupMembers = [];
    
    for (const u of Object.keys(members)) {
      if (u === currentUser.uid) continue; // skip self
      if (mode === 'admin' && members[u].role === 'admin') continue;
      if (members[u].role === 'admin') continue;
      
      const pSnap = await get(ref(db, `users/${u}`));
      if (pSnap.exists()) {
        const uData = pSnap.val();
        uData.uid = u;
        uData.role = members[u].role;
        allGroupMembers.push(uData);
        if (mode === 'deputy' && members[u].role === 'deputy') {
          selectedAdjustMembers.add(u);
        }
      }
    }
    renderAdjustRoleList();
    adjustRoleModal.classList.add('active');
  });
}

function renderAdjustRoleList(query = '') {
  adjustRoleList.innerHTML = '';
  const q = query.toLowerCase();
  
  allGroupMembers.forEach(m => {
    if (q && !m.name.toLowerCase().includes(q)) return;
    
    const isChecked = selectedAdjustMembers.has(m.uid);
    const type = adjustRoleMode === 'deputy' ? 'checkbox' : 'radio';
    const checkedHtml = isChecked ? 'checked' : '';
    
    const el = document.createElement('div');
    el.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-light); cursor:pointer;';
    el.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; pointer-events:none;">
        <input type="${type}" name="adjust-role" style="width:18px; height:18px; cursor:pointer;" ${checkedHtml}>
        <img src="${m.avatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
        <div style="font-weight:600; font-size:15px; color:var(--text-primary);">${m.name}</div>
      </div>
    `;
    
    el.onclick = () => {
      if (adjustRoleMode === 'deputy') {
        if (selectedAdjustMembers.has(m.uid)) selectedAdjustMembers.delete(m.uid);
        else selectedAdjustMembers.add(m.uid);
      } else {
        selectedAdjustMembers.clear();
        selectedAdjustMembers.add(m.uid);
      }
      renderAdjustRoleList(adjustRoleSearch.value);
    };
    adjustRoleList.appendChild(el);
  });
}

if (btnAddDeputy) btnAddDeputy.addEventListener('click', () => openAdjustRoleModal('deputy'));
if (btnTransferAdmin) btnTransferAdmin.addEventListener('click', () => openAdjustRoleModal('admin'));
if (adjustRoleClose) adjustRoleClose.addEventListener('click', () => adjustRoleModal.classList.remove('active'));
if (adjustRoleCancel) adjustRoleCancel.addEventListener('click', () => adjustRoleModal.classList.remove('active'));
if (adjustRoleSearch) adjustRoleSearch.addEventListener('input', e => renderAdjustRoleList(e.target.value));

if (adjustRoleConfirm) {
  adjustRoleConfirm.addEventListener('click', async () => {
    if (!activePeerId) return;
    adjustRoleConfirm.disabled = true;
    adjustRoleConfirm.textContent = 'Đang xử lý...';
    try {
      if (adjustRoleMode === 'deputy') {
        const updates = {};
        allGroupMembers.forEach(m => {
          if (selectedAdjustMembers.has(m.uid)) {
            updates[`users/${activePeerId}/members/${m.uid}/role`] = 'deputy';
          } else {
            updates[`users/${activePeerId}/members/${m.uid}/role`] = 'member';
          }
        });
        await update(ref(db), updates);
        showToast('Đã cập nhật phó nhóm');
      } else if (adjustRoleMode === 'admin') {
        const newAdminId = Array.from(selectedAdjustMembers)[0];
        if (newAdminId) {
          const updates = {};
          updates[`users/${activePeerId}/members/${newAdminId}/role`] = 'admin';
          updates[`users/${activePeerId}/members/${currentUser.uid}/role`] = 'member';
          await update(ref(db), updates);
          showToast('Đã chuyển quyền trưởng nhóm');
          document.getElementById('info-members-screen').style.left = '100%';
        }
      }
      adjustRoleModal.classList.remove('active');
    } catch (err) {
      showToast('Lỗi: ' + err.message);
    }
    adjustRoleConfirm.disabled = false;
    adjustRoleConfirm.textContent = 'Xác nhận';
  });
}

/* ─── Share Logic ─── */
const shareModal = document.getElementById('share-modal');
const shareClose = document.getElementById('share-modal-close');
const shareCancel = document.getElementById('share-cancel');
const shareConfirm = document.getElementById('share-confirm');
const shareList = document.getElementById('share-list');
const shareSearch = document.getElementById('share-search');
const sharePreviewMsg = document.getElementById('share-preview-msg');
const shareCustomMsg = document.getElementById('share-custom-msg');
const ctxShare = document.getElementById('ctx-share');
const shareTabs = document.querySelectorAll('.share-tab');

let shareTargetDoc = null;
let selectedShareTargets = new Set();
let currentShareTab = 'recent';

function renderShareList() {
  shareList.innerHTML = '';
  const q = shareSearch.value.toLowerCase().trim();
  
  let candidates = [];
  Object.keys(friendsCache).forEach(uid => {
    const f = friendsCache[uid];
    const isGroup = f.user_info.id4 && f.user_info.id4.startsWith('gr.');
    candidates.push({ uid, name: f.user_info.name, avatar: f.user_info.avatar, isGroup, ts: f.ts });
  });
  
  if (currentShareTab === 'group') candidates = candidates.filter(c => c.isGroup);
  if (currentShareTab === 'friend') candidates = candidates.filter(c => !c.isGroup);
  
  if (currentShareTab === 'recent') {
    candidates.sort((a,b) => b.ts - a.ts);
  } else {
    candidates.sort((a,b) => a.name.localeCompare(b.name));
  }
  
  if (q) candidates = candidates.filter(c => c.name.toLowerCase().includes(q));
  
  candidates.forEach(c => {
    const isChecked = selectedShareTargets.has(c.uid);
    const el = document.createElement('div');
    el.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-light); cursor:pointer;';
    el.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; pointer-events:none;">
        <input type="checkbox" style="width:18px; height:18px; cursor:pointer;" ${isChecked ? 'checked' : ''}>
        <img src="${c.avatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
        <div style="font-weight:600; font-size:15px; color:var(--text-primary);">${c.name}</div>
      </div>
    `;
    el.onclick = () => {
      if (selectedShareTargets.has(c.uid)) selectedShareTargets.delete(c.uid);
      else selectedShareTargets.add(c.uid);
      renderShareList();
    };
    shareList.appendChild(el);
  });
}

function openShareModal(targetDoc) {
  shareTargetDoc = targetDoc;
  if (typeof ctxMenu !== 'undefined' && ctxMenu) ctxMenu.classList.remove('open');
  selectedShareTargets.clear();
  shareSearch.value = '';
  
  if (targetDoc.dataset.type === 'image') {
    sharePreviewMsg.innerHTML = `<img src="${targetDoc.dataset.url}" style="max-height: 40px; border-radius: 4px; vertical-align: middle;"> <span style="vertical-align: middle;">[Hình ảnh]</span>`;
  } else {
    sharePreviewMsg.textContent = targetDoc.dataset.txt || '[Tin nhắn đa phương tiện]';
  }
  
  renderShareList();
  shareModal.classList.add('active');
}

if (ctxShare) {
  ctxShare.addEventListener('click', () => {
    if (!ctxTargetDoc) return;
    openShareModal(ctxTargetDoc);
  });
}

if (shareClose) shareClose.addEventListener('click', () => shareModal.classList.remove('active'));
if (shareCancel) shareCancel.addEventListener('click', () => shareModal.classList.remove('active'));
if (shareSearch) shareSearch.addEventListener('input', () => renderShareList());

shareTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    shareTabs.forEach(t => {
      t.classList.remove('active');
      t.style.borderBottomColor = 'transparent';
      t.style.color = 'var(--text-secondary)';
    });
    tab.classList.add('active');
    tab.style.borderBottomColor = 'var(--md-sys-color-primary)';
    tab.style.color = 'var(--md-sys-color-primary)';
    currentShareTab = tab.dataset.tab;
    renderShareList();
  });
});

if (shareConfirm) {
  shareConfirm.addEventListener('click', async () => {
    if (selectedShareTargets.size === 0) return showToast('Vui lòng chọn người nhận');
    shareConfirm.disabled = true;
    shareConfirm.textContent = 'Đang gửi...';
    try {
      const txt = shareTargetDoc.dataset.txt;
      const type = shareTargetDoc.dataset.type || 'text';
      const url = shareTargetDoc.dataset.url;
      
      const updates = {};
      const msgId1 = `m_${Date.now()}`;
      const timeStr = formatTime(Date.now());
      const ts = Date.now();
      
      for (const targetUid of selectedShareTargets) {
        let roomId = targetUid;
        if (!targetUid.startsWith('gr.')) {
          const uSnap = await get(child(ref(db), `friends/${currentUser.uid}/${targetUid}`));
          if (uSnap.exists() && uSnap.val().room_id) roomId = uSnap.val().room_id;
          else roomId = [currentUser.uid, targetUid].sort().join('_');
        }
        
        const newMsg1 = { 
          s: currentUser.uid, 
          t: timeStr,
          ts: ts,
          type: type
        };
        if (type === 'image') newMsg1.url = url;
        else newMsg1.txt = txt;
        
        updates[`messages/${roomId}/${msgId1}`] = newMsg1;
        
        const preview = type === 'image' ? '[Hình ảnh]' : txt;
        updates[`friends/${currentUser.uid}/${targetUid}/lastMsg`] = preview;
        updates[`friends/${currentUser.uid}/${targetUid}/ts`] = ts;
        if (targetUid.startsWith('gr.')) {
          const snap = await get(child(ref(db), `users/${targetUid}/members`));
          if (snap.exists()) {
            Object.keys(snap.val()).forEach(u => {
              updates[`friends/${u}/${targetUid}/lastMsg`] = preview;
              updates[`friends/${u}/${targetUid}/ts`] = ts;
            });
          }
        } else {
          updates[`friends/${targetUid}/${currentUser.uid}/lastMsg`] = preview;
          updates[`friends/${targetUid}/${currentUser.uid}/ts`] = ts;
          updates[`friends/${targetUid}/${currentUser.uid}/room_id`] = roomId;
          updates[`friends/${currentUser.uid}/${targetUid}/room_id`] = roomId;
        }
      }
      await update(ref(db), updates);
      showToast('Đã chia sẻ tin nhắn');
      shareModal.classList.remove('active');
    } catch (err) {
      showToast('Lỗi chia sẻ: ' + err.message);
    }
    shareConfirm.disabled = false;
    shareConfirm.textContent = 'Chia sẻ';
  });
}

/* ─── Edit Group Info ─── */
const btnEditGroupAvatar = document.getElementById('btn-edit-group-avatar');
const btnEditGroupName = document.getElementById('btn-edit-group-name');

if (btnEditGroupAvatar) {
  btnEditGroupAvatar.addEventListener('click', async () => {
    if (!activePeerId) return;
    const url = prompt("Nhập URL ảnh đại diện mới cho nhóm:", document.getElementById('info-avatar').src);
    if (url && url.trim() !== '') {
      try {
        await update(ref(db), { [`users/${activePeerId}/avatar`]: url.trim() });
      } catch(e) {
        alert("Lỗi: " + e.message);
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   ẨN TRÒ CHUYỆN – CONVERSATION HIDE WITH PIN
═══════════════════════════════════════════════════════════ */

// ── Storage helpers ───────────────────────────────────────
function getHiddenData() {
  try { return JSON.parse(localStorage.getItem('talk_hidden_' + (currentUser?.uid || '')) || '{}'); }
  catch { return {}; }
}
function saveHiddenData(data) {
  localStorage.setItem('talk_hidden_' + (currentUser?.uid || ''), JSON.stringify(data));
}
function isConvHidden(roomId) { return !!getHiddenData()[roomId]; }
function getConvPin(roomId)   { return getHiddenData()[roomId]?.pin || null; }

function getGlobalPin() {
  const uid = typeof currentUser !== 'undefined' && currentUser ? currentUser.uid : '';
  const localPin = localStorage.getItem('talk_global_pin_' + uid);
  if (localPin) return localPin;
  const hd = getHiddenData();
  const first = Object.values(hd).find(x => x.pin);
  if (first) {
    localStorage.setItem('talk_global_pin_' + uid, first.pin);
    return first.pin;
  }
  return null;
}

function setGlobalPin(pin) {
  const uid = typeof currentUser !== 'undefined' && currentUser ? currentUser.uid : '';
  localStorage.setItem('talk_global_pin_' + uid, pin);
}

// Unlocked rooms this session (visible temporarily)
window._hiddenUnlocked = new Set();

// ── Right-click menu on conv-item ─────────────────────────
let convCtxTargetRoomId = null;
const convCtxMenu  = document.getElementById('conv-ctx-menu');
const convCtxHide  = document.getElementById('conv-ctx-hide');
const convCtxUnhide= document.getElementById('conv-ctx-unhide');
const convCtxDel   = document.getElementById('conv-ctx-delete');

document.getElementById('conv-list').addEventListener('contextmenu', (e) => {
  const item = e.target.closest('.conv-item');
  if (!item) return;
  e.preventDefault();
  convCtxTargetRoomId = item.dataset.roomId;
  const hidden = isConvHidden(convCtxTargetRoomId);
  convCtxHide.style.display   = hidden ? 'none' : 'flex';
  convCtxUnhide.style.display = hidden ? 'flex' : 'none';
  // position
  const menuW = 200, menuH = 120;
  let left = e.clientX, top = e.clientY;
  if (left + menuW > window.innerWidth) left = window.innerWidth - menuW - 8;
  if (top + menuH > window.innerHeight) top = window.innerHeight - menuH - 8;
  convCtxMenu.style.left = left + 'px';
  convCtxMenu.style.top  = top  + 'px';
  convCtxMenu.classList.add('open');
});

document.addEventListener('click', (e) => {
  if (convCtxMenu && !convCtxMenu.contains(e.target)) convCtxMenu.classList.remove('open');
});

// Delete conv from list
document.addEventListener('click', async (e) => {
  const delBtn = e.target.closest('#conv-ctx-delete');
  if (delBtn) {
    convCtxMenu.classList.remove('open');
    if (!convCtxTargetRoomId || !confirm('Xóa hội thoại này khỏi danh sách của bạn?')) return;
    try {
      await update(ref(db), { [`friends/${currentUser.uid}/${convCtxTargetRoomId}`]: null });
      if (activeRoomId === convCtxTargetRoomId) {
        chatArea.classList.remove('active');
        activeRoomId = null; activePeerId = null;
      }
      const hd = getHiddenData(); delete hd[convCtxTargetRoomId]; saveHiddenData(hd);
      window._hiddenUnlocked.delete(convCtxTargetRoomId);
      renderConvList(searchInput.value);
    } catch(err) { alert('Lỗi: ' + err.message); }
  }
});

// ── PIN dots helper ───────────────────────────────────────
function updatePinDots(buffer, prefix) {
  for (let i = 0; i < 5; i++) {
    const dot = document.getElementById('pin-dot-' + prefix + '-' + i);
    if (dot) dot.classList.toggle('filled', i < buffer.length);
  }
}

// ── HIDE: open Set-PIN modal ──────────────────────────────
let pinSetBuf = '', pinConfirmBuf = '', pinToSave = '';

document.addEventListener('click', (e) => {
  const hideBtn = e.target.closest('#conv-ctx-hide');
  
  if (hideBtn) {
    convCtxMenu.classList.remove('open');
    convCtxTargetRoomId = hideBtn ? convCtxTargetRoomId : activeRoomId;
    if (!convCtxTargetRoomId) return;
    
    const gPin = getGlobalPin();
    if (gPin) {
      openUnlockModal(convCtxTargetRoomId, (rId) => {
        const hd = getHiddenData();
        hd[rId] = { pin: gPin, ts: Date.now() };
        saveHiddenData(hd);
        if (activeRoomId === rId) {
          document.getElementById('chat-area').classList.remove('active');
          document.getElementById('msg-sidebar').classList.remove('chat-active');
          activeRoomId = null; activePeerId = null;
          const hideToggle = document.getElementById('btn-info-hide-conv');
          if (hideToggle) hideToggle.checked = true;
        }
        renderConvList(searchInput.value);
        showToast('Đã ẩn trò chuyện 🔒');
      }, "Nhập mã PIN để xác nhận ẩn", true);
    } else {
      pinSetBuf = pinConfirmBuf = pinToSave = '';
      updatePinDots('', 'set'); updatePinDots('', 'confirm');
      document.getElementById('hide-pin-error').textContent = '';
      document.getElementById('hide-pin-confirm-error').textContent = '';
      document.getElementById('hide-pin-step1').style.display = 'block';
      document.getElementById('hide-pin-step2').style.display = 'none';
      hideConvModal.style.display = 'flex';
    }
  }
});

document.getElementById('hide-conv-modal-close')?.addEventListener('click', () => { 
  hideConvModal.style.display = 'none'; 
  // Revert toggle if activeRoomId was the target and it's not hidden
  if (activeRoomId && activeRoomId === convCtxTargetRoomId && !isConvHidden(activeRoomId)) {
    const toggle = document.getElementById('btn-info-hide-conv');
    if (toggle) toggle.checked = false;
  }
});
hideConvModal?.addEventListener('click', (e) => { 
  if (e.target === hideConvModal) {
    hideConvModal.style.display = 'none'; 
    // Revert toggle if activeRoomId was the target and it's not hidden
    if (activeRoomId && activeRoomId === convCtxTargetRoomId && !isConvHidden(activeRoomId)) {
      const toggle = document.getElementById('btn-info-hide-conv');
      if (toggle) toggle.checked = false;
    }
  }
});

hideConvModal?.addEventListener('click', (e) => {
  const btn = e.target.closest('.pin-key');
  if (!btn) return;
  const mode = btn.dataset.mode;

  if (mode === 'set') {
    if (btn.id === 'pin-key-clear-set') {
      pinSetBuf = pinSetBuf.slice(0, -1);
      updatePinDots(pinSetBuf, 'set');
    } else if (btn.id === 'pin-key-ok-set') {
      if (pinSetBuf.length < 5) { document.getElementById('hide-pin-error').textContent = 'Vui lòng nhập đủ 5 chữ số!'; return; }
      pinToSave = pinSetBuf;
      pinConfirmBuf = '';
      updatePinDots('', 'confirm');
      document.getElementById('hide-pin-step1').style.display = 'none';
      document.getElementById('hide-pin-step2').style.display = 'block';
    } else if (btn.dataset.n !== undefined && pinSetBuf.length < 5) {
      pinSetBuf += btn.dataset.n;
      updatePinDots(pinSetBuf, 'set');
    }
    return;
  }

  if (mode === 'confirm') {
    if (btn.id === 'pin-key-clear-confirm') {
      pinConfirmBuf = pinConfirmBuf.slice(0, -1);
      updatePinDots(pinConfirmBuf, 'confirm');
    } else if (btn.id === 'pin-key-ok-confirm') {
      if (pinConfirmBuf.length < 5) { document.getElementById('hide-pin-confirm-error').textContent = 'Nhập đủ 5 chữ số!'; return; }
      if (pinConfirmBuf !== pinToSave) {
        document.getElementById('hide-pin-confirm-error').textContent = 'Mã PIN không khớp. Thử lại!';
        pinConfirmBuf = ''; updatePinDots('', 'confirm'); return;
      }
      if (convCtxTargetRoomId === '__CHANGE_GLOBAL_PIN__') {
        setGlobalPin(pinToSave);
        const hd = getHiddenData();
        for (let key in hd) { 
          if (key !== 'globalPin') {
            hd[key].pin = pinToSave; 
          }
        }
        saveHiddenData(hd);
        hideConvModal.style.display = 'none';
        showToast('Đã đổi mã PIN thành công!');
        return;
      }

      const hd = getHiddenData();
      hd[convCtxTargetRoomId] = { pin: pinToSave, ts: Date.now() };
      setGlobalPin(pinToSave); // also update global pin when setting for the first time
      saveHiddenData(hd);
      window._hiddenUnlocked.delete(convCtxTargetRoomId);
      hideConvModal.style.display = 'none';
      
      // If we are currently viewing this chat, close it because it's now hidden
      if (activeRoomId === convCtxTargetRoomId) {
        document.getElementById('chat-area').classList.remove('active');
        document.getElementById('msg-sidebar').classList.remove('chat-active');
        activeRoomId = null;
        activePeerId = null;
        
        // Ensure info panel toggle reflects it if somehow reopened
        const hideToggle = document.getElementById('btn-info-hide-conv');
        if (hideToggle) hideToggle.checked = true;
      }
      
      renderConvList(searchInput.value);
      showToast('Đã ẩn trò chuyện 🔒');
    } else if (btn.dataset.n !== undefined && pinConfirmBuf.length < 5) {
      pinConfirmBuf += btn.dataset.n;
      updatePinDots(pinConfirmBuf, 'confirm');
    }
  }
});

// ── UNHIDE: open Unlock modal then remove hidden status ───
document.addEventListener('click', (e) => {
  const unhideBtn = e.target.closest('#conv-ctx-unhide');
  
  if (unhideBtn) {
    convCtxMenu.classList.remove('open');
    const targetRoomId = convCtxTargetRoomId;
    if (!targetRoomId) return;
    
    openUnlockModal(targetRoomId, (rId) => {
      const hd = getHiddenData(); delete hd[rId]; saveHiddenData(hd);
      window._hiddenUnlocked.delete(rId);
      renderConvList(searchInput.value);
      showToast('Đã bỏ ẩn trò chuyện');
      // If we are currently viewing this chat, update info panel button
      if (activeRoomId === rId) {
        const hideToggle = document.getElementById('btn-info-hide-conv');
        if (hideToggle) hideToggle.checked = false;
      }
    });
  }
});

// Info panel toggle handler
document.getElementById('btn-info-hide-conv')?.addEventListener('change', (e) => {
  if (!activeRoomId) return;
  const isChecked = e.target.checked;
  const currentlyHidden = isConvHidden(activeRoomId);
  
  if (isChecked && !currentlyHidden) {
    // Attempting to hide
    const gPin = getGlobalPin();
    if (gPin) {
      openUnlockModal(activeRoomId, (rId) => {
        const hd = getHiddenData();
        hd[rId] = { pin: gPin, ts: Date.now() };
        saveHiddenData(hd);
        
        if (activeRoomId === rId) {
          document.getElementById('chat-area').classList.remove('active');
          document.getElementById('msg-sidebar').classList.remove('chat-active');
          activeRoomId = null;
          activePeerId = null;
          
          const hideToggle = document.getElementById('btn-info-hide-conv');
          if (hideToggle) hideToggle.checked = true;
        }
        
        renderConvList(searchInput.value);
        showToast('Đã ẩn trò chuyện 🔒');
      }, "Nhập mã PIN để xác nhận ẩn", true);
      return;
    }

    convCtxTargetRoomId = activeRoomId;
    pinSetBuf = pinConfirmBuf = pinToSave = '';
    updatePinDots('', 'set'); updatePinDots('', 'confirm');
    document.getElementById('hide-pin-error').textContent = '';
    document.getElementById('hide-pin-confirm-error').textContent = '';
    document.getElementById('hide-pin-step1').style.display = 'block';
    document.getElementById('hide-pin-step2').style.display = 'none';
    hideConvModal.style.display = 'flex';
  } else if (!isChecked && currentlyHidden) {
    // Attempting to unhide
    openUnlockModal(activeRoomId, (rId) => {
      const hd = getHiddenData(); delete hd[rId]; saveHiddenData(hd);
      window._hiddenUnlocked.delete(rId);
      renderConvList(searchInput.value);
      showToast('Đã bỏ ẩn trò chuyện');
      e.target.checked = false;
    });
    // Temporarily keep it checked until unlock is successful
    e.target.checked = true; 
  }
});

let pinUnlockBuf = '', unlockTarget = null, unlockCb = null, unlockUseGlobalPin = false;

function openUnlockModal(roomId, onSuccess, customTitle, useGlobalPin = false) {
  pinUnlockBuf = ''; unlockTarget = roomId; unlockCb = onSuccess; unlockUseGlobalPin = useGlobalPin;
  updatePinDots('', 'unlock');
  document.getElementById('unlock-pin-error').textContent = '';
  
  const titleEl = document.querySelector('#unlock-conv-modal h2');
  if (titleEl) {
    titleEl.textContent = customTitle || 'Nhập mã PIN để mở khóa';
  }
  
  unlockConvModal.style.display = 'flex';
}

document.getElementById('unlock-conv-modal-close')?.addEventListener('click', () => { unlockConvModal.style.display = 'none'; });
unlockConvModal?.addEventListener('click', (e) => { if (e.target === unlockConvModal) unlockConvModal.style.display = 'none'; });

unlockConvModal?.addEventListener('click', (e) => {
  const btn = e.target.closest('.pin-key[data-mode="unlock"]');
  if (!btn) return;

  if (btn.id === 'pin-key-clear-unlock') {
    pinUnlockBuf = pinUnlockBuf.slice(0, -1);
    updatePinDots(pinUnlockBuf, 'unlock');
  } else if (btn.id === 'pin-key-ok-unlock') {
    if (pinUnlockBuf.length < 5) { document.getElementById('unlock-pin-error').textContent = 'Nhập đủ 5 chữ số!'; return; }
    const correctPin = (unlockUseGlobalPin || !unlockTarget) ? getGlobalPin() : getConvPin(unlockTarget);
    if (pinUnlockBuf !== correctPin) {
      document.getElementById('unlock-pin-error').textContent = 'Sai mã PIN! Thử lại.';
      pinUnlockBuf = ''; updatePinDots('', 'unlock'); return;
    }
    unlockConvModal.style.display = 'none';
    if (unlockCb) unlockCb(unlockTarget);
  } else if (btn.dataset.n !== undefined && pinUnlockBuf.length < 5) {
    pinUnlockBuf += btn.dataset.n;
    updatePinDots(pinUnlockBuf, 'unlock');
  }
});


if (btnEditGroupName) {
  btnEditGroupName.addEventListener('click', async () => {
    if (!activePeerId) return;
    const currentName = document.getElementById('info-name').textContent;
    const newName = prompt("Nhập tên nhóm mới:", currentName);
    if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
      try {
        await update(ref(db), { [`users/${activePeerId}/name`]: newName.trim() });
      } catch(e) {
        alert("Lỗi: " + e.message);
      }
    }
  });
}

document.getElementById('nav-cloud')?.addEventListener('click', () => {
  showToast('Tính năng này đang phát triển ☁️');
});

/* ─── Sidebar Search Panel ─── */
const infoSearchScreen = document.getElementById('info-search-screen');
const sidebarSearchInput = document.getElementById('sidebar-search-input');
const sidebarSearchClear = document.getElementById('sidebar-search-clear');
const sidebarSearchResults = document.getElementById('sidebar-search-results');
const sidebarSearchEmpty = document.getElementById('sidebar-search-empty');
const btnBackSearch = document.getElementById('btn-back-search');
const btnCloseSearch = document.getElementById('btn-close-search');

function openSearchPanel() {
  if (infoSearchScreen) {
    // First, close all other sub-screens so they don't overlap
    ['info-group-manage-screen', 'info-admins-screen', 'info-members-screen'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.left = '100%';
    });
    infoSearchScreen.style.left = '0';
    if (sidebarSearchInput) {
      sidebarSearchInput.value = '';
      setTimeout(() => sidebarSearchInput.focus(), 300);
    }
    if (sidebarSearchResults) sidebarSearchResults.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:13px; padding:40px 16px;">Nhập từ khóa để tìm kiếm tin nhắn</div>`;
    if (sidebarSearchClear) sidebarSearchClear.style.display = 'none';
    // Make sure info panel is open
    const infoPanel = document.getElementById('info-panel');
    if (infoPanel && infoPanel.style.display === 'none') {
      infoPanel.style.display = 'flex';
    }
  }
}

function closeSearchPanel() {
  if (infoSearchScreen) {
    infoSearchScreen.style.left = '100%';
    if (sidebarSearchInput) sidebarSearchInput.value = '';
  }
}

// Btn from info panel actions
document.getElementById('btn-info-search')?.addEventListener('click', () => {
  openSearchPanel();
});

// Also wire up header search icon in chat
document.querySelector('.chat-header .icon-btn[title="Tìm kiếm trong cuộc trò chuyện"]')?.addEventListener('click', () => {
  // Open info panel first if closed
  const infoPanelEl = document.getElementById('info-panel');
  if (infoPanelEl && infoPanelEl.style.display === 'none') {
    document.getElementById('btn-info')?.click();
  }
  setTimeout(openSearchPanel, 100);
});

if (btnBackSearch) btnBackSearch.addEventListener('click', closeSearchPanel);
if (btnCloseSearch) {
  btnCloseSearch.addEventListener('click', () => {
    closeSearchPanel();
    // Also close the info panel
    const infoPanel = document.getElementById('info-panel');
    if (infoPanel) infoPanel.style.display = 'none';
  });
}

function highlightKeyword(text, keyword) {
  if (!keyword) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

function formatRelativeTime(ts) {
  if (!ts) return '';
  const now = Date.now();
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Vừa xong';
  if (hours < 1) return `${mins} phút`;
  if (hours < 24) return `${hours} giờ`;
  if (days < 7) return `${days} ngày`;
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`;
}

if (sidebarSearchInput) {
  const searchBox = document.getElementById('sidebar-search-box');
  sidebarSearchInput.addEventListener('focus', () => {
    if (searchBox) searchBox.style.borderColor = 'var(--md-sys-color-primary)';
  });
  sidebarSearchInput.addEventListener('blur', () => {
    if (searchBox) searchBox.style.borderColor = 'var(--border)';
  });
  sidebarSearchInput.addEventListener('input', () => {
    const val = sidebarSearchInput.value.trim();

    if (sidebarSearchClear) sidebarSearchClear.style.display = val ? 'inline' : 'none';

    if (!val) {
      if (sidebarSearchResults) sidebarSearchResults.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:13px; padding:40px 16px;">Nhập từ khóa để tìm kiếm tin nhắn</div>`;
      return;
    }

    // Collect all rendered messages from current conversation
    const messagesWrap = document.getElementById('messages-wrap');
    if (!messagesWrap) return;

    const results = [];
    const allBubbles = messagesWrap.querySelectorAll('[data-msg-id]');

    allBubbles.forEach(bubble => {
      // Get text from dataset.txt first, fall back to DOM
      const msgText = bubble.dataset.txt || '';
      if (!msgText || !msgText.toLowerCase().includes(val.toLowerCase())) return;
      if (bubble.dataset.type === 'image') return; // skip images

      // Try to get sender info from the parent group row
      const nameEl = bubble.querySelector('.msg-sender-name-inner');
      let senderName = nameEl ? nameEl.textContent : '';
      if (!senderName) {
        // For 1-1 chats: figure out if it's mine or not
        if (bubble.classList.contains('me')) {
          senderName = 'Bạn';
        } else {
          senderName = activePeerId ? (friendsCache[activePeerId]?.user_info?.name || 'Bạn') : 'Bạn';
        }
      }

      // Try to get avatar
      const rowEl = bubble.closest('.msg-row');
      const avatarEl = rowEl ? rowEl.querySelector('.msg-avatar') : null;
      const avatarSrc = avatarEl ? avatarEl.src : '';

      const ts = parseInt(bubble.dataset.ts || '0');

      results.push({
        el: bubble,
        text: msgText,
        avatarSrc,
        senderName,
        ts
      });
    });

    // Sort newest first
    results.sort((a, b) => b.ts - a.ts);

    if (sidebarSearchResults) {
      if (results.length === 0) {
        sidebarSearchResults.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:13px; padding:40px 16px;">Không tìm thấy tin nhắn nào chứa "<strong>${val}</strong>"</div>`;
        return;
      }

      sidebarSearchResults.innerHTML = `<div style="padding:8px 16px; font-size:12px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Tin nhắn (${results.length})</div>`;

      results.forEach(r => {
        const item = document.createElement('div');
        item.className = 'search-result-item';

        let avatarHTML;
        if (r.avatarSrc && !r.avatarSrc.includes('undefined')) {
          avatarHTML = `<img src="${r.avatarSrc}" class="search-result-avatar" onerror="this.style.display='none'">`;
        } else {
          const initial = (r.senderName || '?')[0].toUpperCase();
          avatarHTML = `<div class="search-result-avatar-placeholder">${initial}</div>`;
        }

        const highlightedText = highlightKeyword(r.text, val);
        const timeStr = formatRelativeTime(r.ts);

        item.innerHTML = `
          ${avatarHTML}
          <div class="search-result-info">
            <div class="search-result-name">${r.senderName}</div>
            <div class="search-result-text">${highlightedText}</div>
          </div>
          <div class="search-result-time">${timeStr}</div>
        `;

        item.addEventListener('click', () => {
          // Scroll to message and highlight
          r.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          r.el.classList.remove('msg-highlight-active');
          void r.el.offsetWidth; // Force reflow
          r.el.classList.add('msg-highlight-active');
          setTimeout(() => r.el.classList.remove('msg-highlight-active'), 2000);
        });

        sidebarSearchResults.appendChild(item);
      });
    }
  });
}

if (sidebarSearchClear) {
  sidebarSearchClear.addEventListener('click', () => {
    if (sidebarSearchInput) {
      sidebarSearchInput.value = '';
      sidebarSearchInput.focus();
      sidebarSearchClear.style.display = 'none';
    }
    if (sidebarSearchResults) sidebarSearchResults.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:13px; padding:40px 16px;">Nhập từ khóa để tìm kiếm tin nhắn</div>`;
  });
}
