import { app, db, auth, ref, set, get, onValue, push, child, update, remove } from '/js/script.js';

window.userAvatarUrl = null;
const currentUserForAvatar = localStorage.getItem('currentUser');
if (currentUserForAvatar) {
    get(ref(db, `users/${currentUserForAvatar}`)).then(snapshot => {
        if (snapshot.exists() && snapshot.val().avatar) {
            window.userAvatarUrl = snapshot.val().avatar;
        }
    });
}

const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

const currentUser = localStorage.getItem('currentUser') || 'anonymous_' + Math.random().toString(36).substr(2, 9);
const currentName = localStorage.getItem('currentUserName') || 'Học sinh ẩn danh';
const roleClass = localStorage.getItem('roleClass') || 'Chưa rõ';

const msgsRef = ref(db, `chats/${currentUser}/sessions/direct/messages`);
const chatRef = ref(db, `chats/${currentUser}/sessions/direct`);

let isClaimed = false;
onValue(chatRef, (snapshot) => {
    if (snapshot.exists()) {
        const data = snapshot.val();
        isClaimed = !!data.claimedBy;
    }
});

// Đăng ký thông tin chat
update(chatRef, {
    name: currentName,
    email: currentUser,
    roleClass: roleClass,
    status: 'yellow', // Cần hỗ trợ
});

function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Render messages
onValue(msgsRef, (snapshot) => {
    const cacheKey = `chat_cache_${currentUser}`;
    let localMessages = JSON.parse(localStorage.getItem(cacheKey) || '[]');

    let dbMessages = [];
    let messagesToDelete = [];
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;

    if (snapshot.exists()) {
        snapshot.forEach(childSnap => {
            const msg = childSnap.val();
            dbMessages.push(msg);
            if (isClaimed && msg.timestamp) {
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

    chatBox.innerHTML = `
        <div class="text-center my-6">
            <span class="px-4 py-1.5 bg-gray-200/60 dark:bg-[#36343B] text-gray-500 dark:text-[#CAC4D0] text-xs font-bold rounded-full">Hôm nay</span>
        </div>
        <div class="flex items-start gap-3 max-w-[85%] md:max-w-[70%]">
            <div class="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl shrink-0 shadow-sm">👨‍🏫</div>
            <div class="space-y-1">
                <div class="bg-white dark:bg-[#211F26] border border-gray-100 dark:border-[#49454F]/50 px-4 py-3 rounded-2xl rounded-tl-none text-sm text-gray-800 dark:text-[#E6E0E9] shadow-sm leading-relaxed">
                    Chào em! Thầy/Cô là chuyên viên an toàn học đường. Em đang cần hỗ trợ vấn đề gì hãy nhắn tin ở đây nhé. Mọi thông tin đều được bảo mật tuyệt đối.
                </div>
            </div>
        </div>
    `;

    if (localMessages.length > 0) {
        localMessages.forEach(msg => {
            appendMessage(msg);
        });
        scrollToBottom();
    }

    if (messagesToDelete.length > 0) {
        messagesToDelete.forEach(msgKey => {
            remove(ref(db, `chats/${currentUser}/sessions/direct/messages/${msgKey}`));
        });
    }
});

function appendMessage(msg) {
    const isUser = msg.sender === 'user';
    const isAdmin = msg.sender === 'admin' || msg.sender === 'specialist';
    const isModel = msg.sender === 'model';
    const isSystem = msg.sender === 'system';
    
    const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';

    let bubble = '';
    if (isUser) {
        bubble = `
            <div class="flex items-start gap-3 max-w-[85%] md:max-w-[70%] ml-auto flex-row-reverse animate-fade-in">
                ${window.userAvatarUrl 
                    ? `<img src="${window.userAvatarUrl}" class="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover shrink-0 shadow-sm">`
                    : `<div class="w-8 h-8 md:w-10 md:h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs md:text-sm shrink-0 shadow-sm">EM</div>`
                }
                <div class="space-y-1 text-right">
                    <div class="bg-emerald-600 text-white px-4 py-2.5 md:py-3 rounded-2xl rounded-tr-none text-sm shadow-sm leading-relaxed text-left">
                        ${escapeHTML(msg.text)}
                    </div>
                    <div class="text-xs text-gray-400 pr-1">${timeStr}</div>
                </div>
            </div>
        `;
    } else if (isSystem) {
        bubble = `
            <div class="flex items-start gap-3 max-w-[85%] md:max-w-[70%] animate-fade-in mx-auto justify-center w-full">
                <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-2 rounded-2xl text-[13px] text-amber-800 dark:text-amber-400 shadow-sm text-center">
                    🚨 ${escapeHTML(msg.text)}
                </div>
            </div>
        `;
    } else if (isAdmin) {
        const senderLabel = msg.sender === 'specialist' ? 'Chuyên viên' : 'Giáo viên';
        bubble = `
            <div class="flex items-start gap-3 max-w-[85%] md:max-w-[70%] animate-fade-in">
                <div class="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg md:text-xl shrink-0 shadow-sm">👨‍🏫</div>
                <div class="space-y-1">
                    <div class="bg-white dark:bg-[#211F26] border border-gray-100 dark:border-[#49454F]/50 px-4 py-2.5 md:py-3 rounded-2xl rounded-tl-none text-sm text-gray-800 dark:text-[#E6E0E9] shadow-sm leading-relaxed">
                        <span class="text-xs font-bold text-indigo-600 block mb-1">${senderLabel}:</span>
                        ${escapeHTML(msg.text)}
                    </div>
                    <div class="text-xs text-gray-400 pl-1">${timeStr}</div>
                </div>
            </div>
        `;
    } else if (isModel) {
        bubble = `
            <div class="flex items-start gap-3 max-w-[85%] md:max-w-[70%] animate-fade-in opacity-80">
                <div class="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-tr from-teal-400 to-emerald-500 text-white flex items-center justify-center text-lg md:text-xl shrink-0 shadow-sm">🤖</div>
                <div class="space-y-1">
                    <div class="bg-teal-50 border border-teal-100 px-4 py-2.5 md:py-3 rounded-2xl rounded-tl-none text-sm text-teal-900 shadow-sm leading-relaxed">
                        <span class="text-xs font-bold text-teal-700 block mb-1">AI Trả lời trước đó:</span>
                        ${escapeHTML(msg.text)}
                    </div>
                    <div class="text-xs text-gray-400 pl-1">${timeStr}</div>
                </div>
            </div>
        `;
    }
    chatBox.insertAdjacentHTML('beforeend', bubble);
}

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    const now = new Date().toISOString();
    push(msgsRef, {
        sender: 'user',
        text: text,
        timestamp: now
    });

    update(chatRef, {
        lastMessage: text,
        timestamp: now,
        status: 'yellow' // Khi có tin nhắn mới từ hs, đẩy lên yellow (cần xử lý)
    });

    chatInput.value = '';
    
    // Auto reply logic
    setTimeout(() => {
        if (isClaimed) return;
        push(msgsRef, {
            sender: 'system',
            text: "Đang chờ chuyên viên tâm lý tiếp nhận. Trong trường hợp khẩn cấp, vui lòng gọi 111 để nhận hỗ trợ ngay lập tức.",
            timestamp: new Date().toISOString()
        });
    }, 1500);
});

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
