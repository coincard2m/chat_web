import { db, ref, onValue, push, update, get, set, remove } from '/js/script.js';

// ─── ELEMENTS ────────────────────────────────────────────────────────────────
const studentListEl = document.getElementById('student-list');
const studentCountEl = document.getElementById('student-count');
const spamCountEl = document.getElementById('spam-count');
const currentChatAvatar = document.getElementById('current-chat-avatar');
const currentChatName = document.getElementById('current-chat-name');
const currentChatClass = document.getElementById('current-chat-class');
const btnResolveChat = document.getElementById('btn-resolve-chat');
const btnViewReports = document.getElementById('btn-view-reports');
const studentChatBox = document.getElementById('student-chat-box');
const studentChatInput = document.getElementById('student-chat-input');
const studentChatSubmit = document.getElementById('student-chat-submit');
const btnAnalyzeChat = document.getElementById('btn-analyze-chat');
const btnSummarizeChat = document.getElementById('btn-summarize-chat');
const aiChatBox = document.getElementById('ai-chat-box');
const aiChatInput = document.getElementById('ai-chat-input');
const aiTyping = document.getElementById('ai-typing');

// ─── STATE ────────────────────────────────────────────────────────────────────
const SPECIALIST_ID = localStorage.getItem('currentUser') || 'specialist_' + Date.now();
const SPECIALIST_NAME = localStorage.getItem('currentUserName') || 'Chuyên trách';

let allChats = [];
let spamChats = [];
let currentStudentId = null;
let currentChatObject = null;
let currentAcceptedChatId = null; // The chat THIS specialist has claimed
let unsubscribeMessages = null;
let unsubscribeCurrentChatMeta = null; // Watch for another specialist claiming this case
let currentMessages = [];
let showingSpam = false;
let isSummarized = false;
let isAIResponding = false;
let aiMessageQueue = [];

// ─── GEMMA 4 AI ──────────────────────────────────────────────────────────────
const GEMINI_API_KEY = "AQ.Ab8RN6K9pEUdEUhQNUoJBvh_D6r6uNBQNPvvbQlvjmnz7QTvow";

let aiChatHistory = [
    { role: "user", parts: [{ text: "Bạn là AI Trợ Lý Chuyên trách An toàn Học đường. Nhiệm vụ phân tích đoạn chat giữa học sinh và chuyên viên, đưa ra lời khuyên xử lý, gợi ý câu trả lời phù hợp tâm lý. Chuyên nghiệp, thấu cảm. CHỈ TRẢ VỀ BẰNG TIẾNG VIỆT, không suy nghĩ nội tâm, không tiếng Anh." }] },
    { role: "model", parts: [{ text: "Xin chào! Tôi là AI Trợ Lý sẵn sàng hỗ trợ bạn phân tích và xử lý tình huống." }] }
];

// ─── FETCH CHATS FROM FIREBASE ───────────────────────────────────────────────
const chatsRef = ref(db, 'chats');

onValue(chatsRef, (snapshot) => {
    allChats = [];
    spamChats = [];
    if (!snapshot.exists()) { renderStudentList(); return; }

    snapshot.forEach(userSnap => {
        const userKey = userSnap.key;
        const sessionsSnap = userSnap.child('sessions');
        if (!sessionsSnap.exists()) return;

        sessionsSnap.forEach(sessionSnap => {
            const chatData = sessionSnap.val();
            const uniqueId = `${userKey}_${sessionSnap.key}`;

            // Hide chats claimed by ANOTHER specialist
            if (chatData.claimedBy && chatData.claimedBy !== SPECIALIST_ID) return;

            const formatted = {
                uniqueId,
                id: sessionSnap.key,
                userPathKey: userKey,
                name: chatData.name || userKey,
                roleClass: chatData.roleClass || 'Học sinh',
                lastMessage: chatData.lastMessage || '...',
                timestamp: chatData.timestamp || new Date().toISOString(),
                status: chatData.status || 'green',
                isSpam: chatData.isSpam || false,
                claimedBy: chatData.claimedBy || null,
                claimedName: chatData.claimedName || null,
                sourceType: 'chats'
            };

            if (formatted.isSpam) spamChats.push(formatted);
            else allChats.push(formatted);
        });
    });

    if (studentCountEl) studentCountEl.textContent = allChats.length;
    if (spamCountEl) spamCountEl.textContent = spamChats.length;
    renderStudentList();
});

// ─── STATUS WEIGHT ────────────────────────────────────────────────────────────
function getStatusWeight(s) { return s === 'red' ? 3 : s === 'yellow' ? 2 : 1; }

// ─── RENDER LIST ─────────────────────────────────────────────────────────────
function renderStudentList() {
    const list = showingSpam ? spamChats : allChats;
    list.sort((a, b) => {
        const w = getStatusWeight(b.status) - getStatusWeight(a.status);
        return w !== 0 ? w : new Date(b.timestamp) - new Date(a.timestamp);
    });

    studentListEl.innerHTML = '';
    if (!list.length) {
        studentListEl.innerHTML = `<div class="text-center text-sm text-gray-400 py-6">${showingSpam ? '✅ Không có báo cáo spam/nghi ngờ.' : 'Chưa có cuộc trò chuyện nào cần hỗ trợ.'}</div>`;
        return;
    }

    list.forEach(chat => {
        const div = document.createElement('div');
        const isSelected = chat.uniqueId === currentStudentId;
        const isClaimed = chat.claimedBy === SPECIALIST_ID;

        let statusDot = '<span class="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0"></span>';
        let bgClass = isSelected
            ? 'bg-amber-50 border-amber-300 dark:bg-[#36343B] dark:border-amber-500/50'
            : 'bg-white dark:bg-[#211F26] border-gray-200 dark:border-[#49454F]/50 hover:bg-gray-50 dark:hover:bg-[#36343B]';

        if (chat.isSpam) {
            bgClass = isSelected ? 'bg-red-50 border-red-300 dark:bg-red-900/40' : 'bg-red-50/30 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 hover:bg-red-50/60';
            statusDot = '<span class="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full border border-red-200">SPAM</span>';
        } else if (chat.status === 'red') {
            bgClass = isSelected ? 'bg-red-50 border-red-300 dark:bg-red-900/40 dark:border-red-700/50' : 'bg-red-50/30 dark:bg-red-900/20 border-red-200 dark:border-red-800';
            statusDot = '<span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0"></span>';
        } else if (chat.status === 'yellow') {
            bgClass = isSelected ? 'bg-amber-50 border-amber-300 dark:bg-amber-900/40 dark:border-amber-700/50' : 'blink-bg border-amber-200';
            statusDot = '<span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>';
        }

        const dateStr = chat.timestamp ? new Date(chat.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
        const claimedBadge = isClaimed ? '<span class="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-bold">Đang tiếp nhận</span>' : '';

        div.className = `p-3 rounded-2xl border cursor-pointer transition ${bgClass} mb-2`;
        div.onclick = () => trySelectStudent(chat.uniqueId);

        div.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-100 to-orange-100 flex items-center justify-center font-bold text-amber-700 shrink-0 text-sm">
                    ${chat.name ? chat.name.charAt(0).toUpperCase() : '👤'}
                </div>
                <div class="flex-1 min-w-0 space-y-1">
                    <div class="flex justify-between items-center gap-1">
                        <h4 class="font-bold text-gray-800 dark:text-[#E6E0E9] text-sm truncate">${escapeHTML(chat.name || chat.id)}</h4>
                        <span class="text-xs text-gray-400 shrink-0">${dateStr}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        ${statusDot}
                        <p class="text-xs text-gray-500 dark:text-[#CAC4D0] truncate flex-1">${escapeHTML(chat.lastMessage || '...')}</p>
                    </div>
                    <div class="flex items-center gap-2">${claimedBadge}</div>
                </div>
            </div>
        `;
        studentListEl.appendChild(div);
    });
}

// ─── TRY SELECT: Check if switching away from accepted case ──────────────────
window.trySelectStudent = function(uniqueId) {
    if (uniqueId === currentStudentId) return;

    if (currentAcceptedChatId && currentAcceptedChatId !== uniqueId) {
        // Ask to transfer
        showTransferPopup(uniqueId);
    } else {
        selectStudent(uniqueId);
    }
};

// ─── TRANSFER POPUP ───────────────────────────────────────────────────────────
function showTransferPopup(targetUniqueId) {
    let popup = document.getElementById('transfer-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'transfer-popup';
        popup.className = 'fixed inset-0 bg-slate-950/60 z-[200] flex items-center justify-center p-4';
        document.body.appendChild(popup);
    }
    popup.innerHTML = `
        <div class="bg-white dark:bg-[#211F26] rounded-2xl shadow-2xl p-6 max-w-md w-full border dark:border-[#49454F]/50">
            <div class="text-2xl mb-3 text-center">🔄</div>
            <h3 class="font-bold text-center text-gray-900 dark:text-[#E6E0E9] mb-2">Chuyển giao vụ việc?</h3>
            <p class="text-sm text-gray-500 dark:text-[#CAC4D0] text-center leading-relaxed mb-5">Bạn đang tiếp nhận một vụ việc khác. Nếu xác nhận, vụ việc hiện tại sẽ được trả về hàng đợi chung để chuyên trách khác tiếp nhận.</p>
            <div class="flex gap-3">
                <button id="transfer-cancel" class="flex-1 py-2.5 border border-gray-200 dark:border-[#49454F]/50 text-gray-700 dark:text-[#CAC4D0] rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-[#36343B] transition">Hủy</button>
                <button id="transfer-confirm" class="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition">Xác nhận chuyển giao</button>
            </div>
        </div>
    `;
    document.getElementById('transfer-cancel').onclick = () => popup.remove();
    document.getElementById('transfer-confirm').onclick = () => {
        // Release current claim
        if (currentAcceptedChatId) {
            const cur = [...allChats, ...spamChats].find(c => c.uniqueId === currentAcceptedChatId);
            if (cur) {
                const chatRef = ref(db, `${cur.sourceType}/${cur.userPathKey}/sessions/${cur.id}`);
                update(chatRef, { claimedBy: null, claimedName: null });
            }
        }
        currentAcceptedChatId = null;
        popup.remove();
        selectStudent(targetUniqueId);
    };
}

// ─── SELECT STUDENT ───────────────────────────────────────────────────────────
window.selectStudent = function(uniqueId) {
    currentStudentId = uniqueId;
    const chat = [...allChats, ...spamChats].find(c => c.uniqueId === uniqueId);
    if (!chat) return;
    currentChatObject = chat;
    isSummarized = false;

    renderStudentList();

    currentChatName.textContent = chat.name || chat.id;
    currentChatClass.textContent = chat.roleClass;
    currentChatAvatar.textContent = chat.name ? chat.name.charAt(0).toUpperCase() : '👤';

    // Buttons - only show Accept if not claimed by this specialist
    const isMyClaim = chat.claimedBy === SPECIALIST_ID;
    updateActionButtons(isMyClaim);

    if (unsubscribeMessages) unsubscribeMessages();
    if (unsubscribeCurrentChatMeta) unsubscribeCurrentChatMeta();

    const dbPath = `${chat.sourceType}/${chat.userPathKey}/sessions/${chat.id}/messages`;
    const msgsRef = ref(db, dbPath);

    unsubscribeMessages = onValue(msgsRef, (snapshot) => {
        const cacheKey = `chat_cache_${chat.userPathKey}_${chat.id}`;
        let localMessages = JSON.parse(localStorage.getItem(cacheKey) || '[]');

        let dbMessages = [];
        let messagesToDelete = [];
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;

        if (snapshot.exists()) {
            snapshot.forEach(childSnap => {
                const msg = childSnap.val();
                dbMessages.push(msg);
                if (chat.claimedBy && msg.timestamp) {
                    const msgTime = new Date(msg.timestamp).getTime();
                    if (now - msgTime > ONE_DAY) {
                        messagesToDelete.push(childSnap.key);
                    }
                }
            });
        }

        dbMessages.forEach(dbMsg => {
            const exists = localMessages.some(localMsg => 
                localMsg.sender === dbMsg.sender && 
                localMsg.text === dbMsg.text && 
                localMsg.timestamp === dbMsg.timestamp
            );
            if (!exists) {
                localMessages.push(dbMsg);
            }
        });

        localStorage.setItem(cacheKey, JSON.stringify(localMessages));

        currentMessages = localMessages;
        studentChatBox.innerHTML = '';
        if (currentMessages.length > 0) {
            currentMessages.forEach(msg => {
                appendStudentMessage(msg);
            });
            studentChatBox.scrollTop = studentChatBox.scrollHeight;
        } else {
            studentChatBox.innerHTML = '<div class="text-center text-sm text-gray-400 py-10">Chưa có tin nhắn nào trong phiên này.</div>';
        }

        if (messagesToDelete.length > 0) {
            messagesToDelete.forEach(msgKey => {
                remove(ref(db, `${chat.sourceType}/${chat.userPathKey}/sessions/${chat.id}/messages/${msgKey}`));
            });
        }
    });

    // Watch for another specialist claiming this case
    const chatMetaRef = ref(db, `${chat.sourceType}/${chat.userPathKey}/sessions/${chat.id}`);
    unsubscribeCurrentChatMeta = onValue(chatMetaRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.val();
        // If someone else claimed while I'm viewing
        if (data.claimedBy && data.claimedBy !== SPECIALIST_ID) {
            // Only show popup if I'm currently looking at this chat and haven't accepted it
            if (currentStudentId === uniqueId && currentAcceptedChatId !== uniqueId) {
                showCaseTakenPopup(data.claimedName || 'chuyên trách khác');
            }
        }
    });
};

function updateActionButtons(isMyClaim) {
    if (isMyClaim) {
        studentChatInput.disabled = false;
        studentChatSubmit.disabled = false;
        btnResolveChat.classList.remove('hidden');
        btnViewReports.classList.remove('hidden');
        btnAnalyzeChat.disabled = false;
        btnSummarizeChat.disabled = false;
        // Change accept button to resolve
        const acceptBtn = document.getElementById('btn-accept-chat');
        if (acceptBtn) acceptBtn.classList.add('hidden');
    } else {
        studentChatInput.disabled = true;
        studentChatSubmit.disabled = true;
        btnResolveChat.classList.add('hidden');
        // Show accept button
        showAcceptButton();
    }
}

function showAcceptButton() {
    let acceptBtn = document.getElementById('btn-accept-chat');
    if (!acceptBtn) {
        acceptBtn = document.createElement('button');
        acceptBtn.id = 'btn-accept-chat';
        acceptBtn.onclick = () => acceptCurrentChat();
        const header = document.querySelector('#student-chat-form').parentElement.previousElementSibling;
        const btnGroup = btnResolveChat.parentElement;
        btnGroup.prepend(acceptBtn);
    }
    acceptBtn.className = 'px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white border-0 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow-md';
    acceptBtn.innerHTML = '✅ Tiếp nhận vụ việc';
    acceptBtn.classList.remove('hidden');
}

// ─── ACCEPT CASE ─────────────────────────────────────────────────────────────
window.acceptCurrentChat = async function() {
    if (!currentChatObject) return;
    const chat = currentChatObject;
    const chatRef = ref(db, `${chat.sourceType}/${chat.userPathKey}/sessions/${chat.id}`);

    // Check if already claimed by someone else
    const snap = await get(chatRef);
    if (snap.exists()) {
        const data = snap.val();
        if (data.claimedBy && data.claimedBy !== SPECIALIST_ID) {
            showCaseTakenPopup(data.claimedName || 'chuyên trách khác');
            return;
        }
    }

    await update(chatRef, { claimedBy: SPECIALIST_ID, claimedName: SPECIALIST_NAME });
    currentAcceptedChatId = chat.uniqueId;
    updateActionButtons(true);
};

// ─── CASE TAKEN POPUP ────────────────────────────────────────────────────────
function showCaseTakenPopup(takerName) {
    let popup = document.getElementById('case-taken-popup');
    if (popup) popup.remove();
    popup = document.createElement('div');
    popup.id = 'case-taken-popup';
    popup.className = 'fixed inset-0 bg-slate-950/60 z-[200] flex items-center justify-center p-4';
    popup.innerHTML = `
        <div class="bg-white dark:bg-[#211F26] rounded-2xl shadow-2xl p-6 max-w-md w-full border dark:border-[#49454F]/50">
            <div class="text-3xl mb-3 text-center">⚠️</div>
            <h3 class="font-bold text-center text-gray-900 dark:text-[#E6E0E9] mb-2">Vụ việc đã có người tiếp nhận!</h3>
            <p class="text-sm text-gray-500 dark:text-[#CAC4D0] text-center mb-5"><strong>${escapeHTML(takerName)}</strong> vừa tiếp nhận vụ việc này. Vui lòng chọn vụ việc khác.</p>
            <button onclick="document.getElementById('case-taken-popup').remove(); clearCurrentSelection();" class="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition">Chọn vụ việc khác</button>
        </div>
    `;
    document.body.appendChild(popup);
}

window.clearCurrentSelection = function() {
    currentStudentId = null;
    currentChatObject = null;
    if (unsubscribeMessages) unsubscribeMessages();
    if (unsubscribeCurrentChatMeta) unsubscribeCurrentChatMeta();
    studentChatBox.innerHTML = `
        <div class="absolute inset-0 flex items-center justify-center opacity-30" style="background-image: radial-gradient(#e5e7eb 1px, transparent 1px); background-size: 20px 20px;"></div>
        <div class="text-center text-base text-gray-500 dark:text-[#CAC4D0] py-16 relative z-10 font-medium">
            <div class="text-4xl mb-3">🛡️</div>
            <div class="font-bold text-gray-700 dark:text-gray-300">Bảng điều khiển Chuyên trách</div>
            <div class="text-sm mt-1">Chọn một học sinh từ danh sách bên trái để xem và tiếp nhận</div>
        </div>`;
    currentChatName.textContent = 'Chọn một học sinh để bắt đầu';
    currentChatClass.textContent = '---';
    currentChatAvatar.textContent = '🛡️';
    btnResolveChat.classList.add('hidden');
    btnViewReports.classList.add('hidden');
    renderStudentList();
};

// ─── TOGGLE SPAM VIEW ────────────────────────────────────────────────────────
window.toggleSpamView = function() {
    showingSpam = !showingSpam;
    const btn = document.getElementById('btn-toggle-spam');
    const span = btn.querySelector('span:first-child');
    if (showingSpam) {
        btn.classList.add('bg-red-100', 'dark:bg-red-900/40');
        span.textContent = '← Quay lại tin chính';
    } else {
        btn.classList.remove('bg-red-100', 'dark:bg-red-900/40');
        span.textContent = '⚠️ Spam / Nghi ngờ';
    }
    renderStudentList();
};

// ─── UNMARK SPAM (Button in chat when viewing spam) ──────────────────────────
window.unmarkSpam = async function() {
    if (!currentChatObject) return;
    const chat = currentChatObject;
    const chatRef = ref(db, `${chat.sourceType}/${chat.userPathKey}/sessions/${chat.id}`);
    await update(chatRef, { isSpam: false });
    currentChatObject.isSpam = false;
    showingSpam = false;
    document.getElementById('btn-toggle-spam').querySelector('span:first-child').textContent = '⚠️ Spam / Nghi ngờ';
    document.getElementById('unmark-spam-btn')?.remove();
};

// ─── APPEND MESSAGES ─────────────────────────────────────────────────────────
function appendStudentMessage(msg) {
    const isAdmin = msg.sender === 'admin' || msg.sender === 'specialist';
    const isSystem = msg.sender === 'system';
    const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';

    let bubble = '';
    if (isSystem) {
        bubble = `<div class="flex justify-center"><div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-2 rounded-2xl text-xs text-amber-800 dark:text-amber-400 text-center max-w-[85%]">🚨 ${escapeHTML(msg.text)}</div></div>`;
    } else if (isAdmin) {
        bubble = `
        <div class="flex items-start gap-3 max-w-[85%] ml-auto flex-row-reverse">
            <div class="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 font-bold text-sm shrink-0">CT</div>
            <div class="space-y-1 text-right">
                <div class="bg-amber-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-none text-sm shadow-sm leading-relaxed text-left">${escapeHTML(msg.text)}</div>
                <div class="text-xs text-gray-400 pr-1">${timeStr}</div>
            </div>
        </div>`;
    } else {
        bubble = `
        <div class="flex items-start gap-3 max-w-[85%]">
            <div class="w-9 h-9 rounded-full bg-gray-100 dark:bg-[#36343B] flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-sm shrink-0">
                ${currentChatObject?.name ? currentChatObject.name.charAt(0).toUpperCase() : '👤'}
            </div>
            <div class="space-y-1">
                <div class="bg-white dark:bg-[#2B2930] border border-gray-100 dark:border-[#49454F]/50 px-4 py-2.5 rounded-2xl rounded-tl-none text-sm text-gray-800 dark:text-[#E6E0E9] shadow-sm leading-relaxed">${escapeHTML(msg.text)}</div>
                <div class="text-xs text-gray-400 pl-1">${timeStr}</div>
            </div>
        </div>`;
    }
    studentChatBox.insertAdjacentHTML('beforeend', bubble);

    // If spam view & claim accepted: show unmark spam button once
    if (currentChatObject?.isSpam && currentAcceptedChatId === currentChatObject.uniqueId && !document.getElementById('unmark-spam-btn')) {
        const unmarkBtn = document.createElement('div');
        unmarkBtn.id = 'unmark-spam-btn';
        unmarkBtn.className = 'flex justify-center my-2';
        unmarkBtn.innerHTML = `<button onclick="unmarkSpam()" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95">✅ Không phải nghi ngờ - Chuyển về Tin chính</button>`;
        studentChatBox.appendChild(unmarkBtn);
    }
}

// ─── SEND MESSAGE ────────────────────────────────────────────────────────────
window.handleStudentChatSubmit = function(event) {
    event.preventDefault();
    const text = studentChatInput.value.trim();
    if (!text || !currentChatObject || currentAcceptedChatId !== currentChatObject.uniqueId) return;

    const chat = currentChatObject;
    const msgsRef = ref(db, `${chat.sourceType}/${chat.userPathKey}/sessions/${chat.id}/messages`);
    const chatRef = ref(db, `${chat.sourceType}/${chat.userPathKey}/sessions/${chat.id}`);

    push(msgsRef, { sender: 'specialist', text, timestamp: new Date().toISOString() });
    update(chatRef, { lastMessage: `[Chuyên trách]: ${text}`, timestamp: new Date().toISOString(), status: 'green' });
    studentChatInput.value = '';
};

// ─── RESOLVE CHAT ────────────────────────────────────────────────────────────
window.resolveCurrentChat = function() {
    if (!currentChatObject) return;
    const chatRef = ref(db, `${currentChatObject.sourceType}/${currentChatObject.userPathKey}/sessions/${currentChatObject.id}`);
    update(chatRef, { status: 'green', claimedBy: null, claimedName: null });
    currentAcceptedChatId = null;
    btnResolveChat.classList.add('hidden');
};

// ─── VIEW REPORTS ────────────────────────────────────────────────────────────
window.viewStudentReports = async function() {
    if (!currentChatObject) return;
    const modal = document.getElementById('reports-modal');
    const body = document.getElementById('reports-modal-body');
    modal.classList.remove('hidden');
    body.innerHTML = '<div class="text-center text-gray-400 py-8">Đang tìm báo cáo...</div>';

    const snapshot = await get(ref(db, 'reports'));
    if (!snapshot.exists()) { body.innerHTML = '<div class="text-center text-gray-400 py-8">Học sinh này chưa gửi báo cáo nào.</div>'; return; }

    const userId = currentChatObject.userPathKey;
    let found = [];
    snapshot.forEach(child => {
        const r = child.val();
        if (r.senderId === userId || r.senderId === currentChatObject.name) found.push({ ...r, key: child.key });
    });

    if (!found.length) { body.innerHTML = '<div class="text-center text-gray-400 py-8">Học sinh này chưa gửi báo cáo nào.</div>'; return; }

    body.innerHTML = found.map(r => `
        <div class="bg-gray-50 dark:bg-[#141218] border border-gray-200 dark:border-[#49454F]/50 rounded-2xl p-4 space-y-2">
            <div class="flex items-center justify-between flex-wrap gap-2">
                <span class="font-bold text-sm text-gray-800 dark:text-[#E6E0E9]">Mã: ${r.key}</span>
                <span class="text-xs px-2 py-1 rounded-full font-bold ${r.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600 dark:bg-[#36343B] dark:text-gray-300'}">${r.priority === 'urgent' ? '⚡ Khẩn cấp' : 'Thường'}</span>
            </div>
            <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">${escapeHTML(r.content || 'Không có nội dung')}</p>
            <p class="text-xs text-gray-400">${r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : ''} · ${r.status || '?'}</p>
            <div class="flex justify-end pt-2">
                <button onclick="window.deleteReport('${r.key}')" class="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-xs font-bold transition active:scale-95 flex items-center gap-1">
                    🗑️ Xóa báo cáo
                </button>
            </div>
        </div>
    `).join('');
};

window.deleteReport = async function(reportKey) {
    if (!confirm("Bạn có chắc chắn muốn xóa báo cáo này? Thao tác này không thể hoàn tác.")) return;
    try {
        await remove(ref(db, `reports/${reportKey}`));
        alert("Đã xóa báo cáo thành công!");
        window.viewStudentReports();
    } catch (e) {
        console.error("Lỗi xóa báo cáo:", e);
        alert("Không thể xóa báo cáo!");
    }
};

// ─── AI: QUEUE + PROCESS ─────────────────────────────────────────────────────
window.handleAIChatSubmit = function(e) {
    e.preventDefault();
    const text = aiChatInput.value.trim();
    if (!text) return;
    appendAIMessage(text, 'user');
    aiChatInput.value = '';
    aiMessageQueue.push(text);
    if (!isAIResponding) processAIQueue();
};

async function processAIQueue() {
    if (!aiMessageQueue.length) { isAIResponding = false; return; }
    isAIResponding = true;
    const text = aiMessageQueue.shift();
    await callGeminiForAI(text);
    processAIQueue(); // Process next in queue
}

window.analyzeCurrentChat = async function() {
    if (!currentStudentId || !currentMessages.length) return;
    let context = "Đây là đoạn chat giữa học sinh và chuyên viên:\n\n";
    currentMessages.forEach(m => {
        const name = m.sender === 'user' ? 'Học sinh' : (m.sender === 'system' ? 'Hệ thống' : 'Chuyên trách');
        context += `[${name}]: ${m.text}\n`;
    });
    context += "\nHãy phân tích: Vấn đề chính là gì? Mức độ nghiêm trọng? Gợi ý câu trả lời cụ thể mà chuyên trách có thể gửi ngay (viết sẵn nội dung có thể copy).";
    appendAIMessage("Đang phân tích cuộc trò chuyện...", 'user');
    aiMessageQueue.push(context);
    if (!isAIResponding) processAIQueue();
};

window.summarizeCurrentChat = async function() {
    if (!currentStudentId || !currentMessages.length) return;
    if (isSummarized) {
        selectStudent(currentStudentId);
        isSummarized = false;
        btnSummarizeChat.innerHTML = '<span>📝</span> Làm gọn nội dung chat';
        return;
    }
    let context = "Tóm tắt gọn toàn bộ đoạn chat sau thành đoạn văn ngắn (không quá 5 câu): vấn đề của học sinh, diễn biến chính, kết quả. CHỈ TRẢ VỀ TÓM TẮT BẰNG TIẾNG VIỆT:\n\n";
    currentMessages.forEach(m => {
        context += `[${m.sender === 'user' ? 'Học sinh' : 'Chuyên trách'}]: ${m.text}\n`;
    });
    appendAIMessage("Đang tóm tắt nội dung chat...", 'user');
    aiMessageQueue.push(context);
    if (!isAIResponding) processAIQueue();
    isSummarized = true;
    btnSummarizeChat.innerHTML = '<span>👁️</span> Xem nội dung gốc';
};

async function callGeminiForAI(messageText) {
    aiTyping.classList.remove('hidden');
    aiChatBox.scrollTop = aiChatBox.scrollHeight;
    aiChatHistory.push({ role: "user", parts: [{ text: messageText }] });

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: aiChatHistory })
        });

        if (!response.ok) {
            appendAIMessage("Xin lỗi, hệ thống AI đang lỗi.", 'model');
            aiChatHistory.pop();
        } else {
            const data = await response.json();
            const textPart = data.candidates?.[0]?.content?.parts?.find(p => !p.thought);
            const botMessage = textPart?.text || data.candidates?.[0]?.content?.parts?.[0]?.text || "Không thể phân tích.";
            aiChatHistory.push({ role: "model", parts: [{ text: botMessage }] });
            appendAIMessage(botMessage, 'model');
        }
    } catch (err) {
        console.error(err);
        appendAIMessage("Lỗi mạng khi kết nối AI.", 'model');
    } finally {
        aiTyping.classList.add('hidden');
    }
}

function appendAIMessage(text, role) {
    const html = role === 'user'
        ? `<div class="flex items-start gap-2.5 max-w-[90%] ml-auto flex-row-reverse">
            <div class="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0 text-xs">CT</div>
            <div class="bg-amber-600 text-white px-3 py-2 rounded-2xl rounded-tr-none shadow-sm text-left text-sm leading-relaxed">${escapeHTML(text)}</div>
           </div>`
        : `<div class="flex items-start gap-2.5 max-w-[95%]">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shrink-0 text-sm">🤖</div>
            <div class="bg-white dark:bg-[#2B2930] border border-gray-100 dark:border-[#49454F]/50 text-gray-800 dark:text-[#E6E0E9] px-3 py-2.5 rounded-2xl rounded-tl-none shadow-sm leading-relaxed whitespace-pre-wrap text-sm">
                <span class="text-xs font-bold text-amber-600 block mb-1">Trợ lý AI:</span>
                ${escapeHTML(text)}
            </div>
           </div>`;
    aiChatBox.insertAdjacentHTML('beforeend', html);
    aiChatBox.scrollTop = aiChatBox.scrollHeight;
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t] || t));
}
