import { db, ref, push, update, onValue } from '/js/script.js';

const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const typingIndicator = document.getElementById('typing-indicator');
const quickSuggestions = document.getElementById('quick-suggestions');
const fileInput = document.getElementById('file-input');

// === 1. KHỞI TẠO PHIÊN CHAT (SESSION) RIÊNG CHO ADMIN ===
let currentChatId = sessionStorage.getItem('currentAdminChatId');
if (!currentChatId) {
    currentChatId = 'ADMIN-SESSION-' + Date.now();
    sessionStorage.setItem('currentAdminChatId', currentChatId);
}

// Lấy thông tin tài khoản admin/giáo viên
const currentUser = localStorage.getItem('currentUser') || 'anonymous_admin';
const currentName = localStorage.getItem('currentUserName') || 'Thầy/Cô giáo';



let chatHistory = [
    {
        role: "user",
        parts: [{ text: `Bạn là AI Cố Vấn Sư Phạm của hệ thống StopBully. Nhiệm vụ của bạn là hỗ trợ giáo viên trong việc xử lý tình huống lớp học, tư vấn phương pháp sư phạm, nhận biết học sinh có vấn đề tâm lý, và soạn thảo tài liệu. Xưng là em và gọi Thầy/Cô. Trả lời hoàn toàn bằng Tiếng Việt, rõ ràng, không hiển thị suy nghĩ nội tâm.` }]
    },
    {
        role: "model",
        parts: [{ text: "Em chào Thầy/Cô ạ! Em là AI Cố Vấn Sư Phạm của hệ thống StopBully. Thầy/Cô cần em hỗ trợ vấn đề gì hôm nay ạ?" }]
    }
];

async function callGeminiAPI(messageText) {
    try {
        // Gọi Backend thay vì gọi trực tiếp API của Google để bảo mật Key
        const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:5000/api/ai/chat' 
            : `http://${window.location.hostname}:5000/api/ai/chat`;

        const response = await fetch(serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: messageText })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.reply || "Xin lỗi, tôi không thể trả lời lúc này.";
    } catch (error) {
        console.error("Lỗi khi gọi Backend API:", error);
        return "Hệ thống AI đang bảo trì hoặc mất kết nối máy chủ. Vui lòng thử lại sau.";
    }
}

function sendQuickMessage(text) {
    if (!chatInput) return;
    chatInput.value = text;
    const chatForm = document.getElementById('chat-form');
    if (chatForm) chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
}
window.sendQuickMessage = sendQuickMessage;

// === 2. XỬ LÝ GỬI TIN NHẮN VÀ LƯU VÀO FIREBASE (THEO TỪNG SESSION) ===
window.handleChatSubmit = async function (event) {
    event.preventDefault();
    const messageText = chatInput.value.trim();
    if (!messageText) return;

    if (quickSuggestions) quickSuggestions.classList.add('hidden');
    appendMessage(messageText, 'user');
    chatInput.value = '';

    // Đường dẫn riêng biệt cho admin: admin_chats/...
    const chatRef = ref(db, `admin_chats/${currentUser}/sessions/${currentChatId}`);
    const msgsRef = ref(db, `admin_chats/${currentUser}/sessions/${currentChatId}/messages`);

    update(chatRef, {
        id: currentChatId,
        name: currentName,
        email: currentUser,
        lastMessage: messageText,
        timestamp: new Date().toISOString(),
        roleClass: 'Quản trị viên / Giáo viên'
    });

    push(msgsRef, {
        sender: 'user',
        text: messageText,
        timestamp: new Date().toISOString()
    });

    if (typingIndicator) typingIndicator.classList.remove('hidden');
    chatBox.scrollTop = chatBox.scrollHeight;

    const reply = await callGeminiAPI(messageText);

    if (typingIndicator) typingIndicator.classList.add('hidden');
    appendMessage(reply, 'bot');

    push(msgsRef, {
        sender: 'model',
        text: reply,
        timestamp: new Date().toISOString()
    });
};

function appendMessage(text, sender) {
    const isUser = sender === 'user';
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `flex items-start gap-3.5 max-w-[85%] md:max-w-[70%] animate-fade-in ${isUser ? 'ml-auto flex-row-reverse' : ''}`;

    const avatar = isUser
        ? `<div class="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center text-xs font-bold shrink-0">GV</div>`
        : `<div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg shrink-0">🤖</div>`;

    const contentBg = isUser
        ? `bg-indigo-600 text-white rounded-tr-none`
        : `bg-gray-100 text-gray-900 dark:text-[#E6E0E9] rounded-tl-none`;

    messageWrapper.innerHTML = `
        ${avatar}
        <div class="space-y-1.5 ${isUser ? 'text-right' : ''}">
            <div class="${contentBg} px-4 py-3 rounded-2xl text-sm md:text-base leading-relaxed text-left shadow-sm">
                ${text.trim()}
            </div>
            <span class="text-xs text-gray-400 ${isUser ? 'pr-1' : 'pl-1'}">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
    `;

    if (typingIndicator) {
        chatBox.insertBefore(messageWrapper, typingIndicator);
    } else {
        chatBox.appendChild(messageWrapper);
    }
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Xử lý tải file
if (fileInput) {
    fileInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        if (quickSuggestions) quickSuggestions.classList.add('hidden');
        alert(`Thầy/Cô đã chọn tệp đính kèm: ${file.name}.`);
        fileInput.value = '';
    });
}

// === 3. TẢI DANH SÁCH LỊCH SỬ PHIÊN CHAT RA SIDEBAR ===
const adminSessionsRef = ref(db, `admin_chats/${currentUser}/sessions`);
const studentListEl = document.getElementById('chat-history-list');

onValue(adminSessionsRef, (snapshot) => {
    if (!studentListEl) return;
    studentListEl.innerHTML = '';

    if (!snapshot.exists()) {
        studentListEl.innerHTML = '<div class="text-center text-sm text-gray-400 py-4">Chưa có lịch sử tư vấn sư phạm.</div>';
        return;
    }

    let sessions = [];
    snapshot.forEach(childSnapshot => {
        const chatData = childSnapshot.val();
        chatData.id = childSnapshot.key;
        sessions.push(chatData);
    });

    sessions.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    sessions.forEach(chat => {
        const dateStr = chat.timestamp ? new Date(chat.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
        const isSelected = chat.id === currentChatId;
        
        let bgClass = isSelected ? 'bg-indigo-50 border-indigo-200 dark:bg-[#36343B] dark:border-indigo-500/50' : 'bg-white dark:bg-[#211F26] border-gray-200 dark:border-[#49454F]/50 hover:bg-gray-50 dark:bg-[#141218] dark:hover:bg-[#36343B] dark:bg-[#141218]';

        const div = document.createElement('div');
        div.className = `p-3 rounded-2xl border ${bgClass} shadow-sm text-xs transition cursor-pointer mb-2`;
        
        div.onclick = () => {
            sessionStorage.setItem('currentAdminChatId', chat.id);
            location.reload();
        };

        div.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 shrink-0 text-sm">
                    📚
                </div>
                <div class="flex-1 min-w-0 space-y-1">
                    <div class="flex justify-between items-center gap-1">
                        <h4 class="font-bold text-gray-800 dark:text-[#E6E0E9] text-sm truncate">Tư vấn sư phạm</h4>
                        <span class="text-xs text-gray-400 shrink-0">${dateStr}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0"></span>
                        <p class="text-xs text-gray-500 dark:text-[#CAC4D0] truncate flex-1">${chat.lastMessage || '...'}</p>
                    </div>
                </div>
            </div>
        `;
        studentListEl.appendChild(div);
    });
});

// === 4. TẢI NỘI DUNG TIN NHẮN CŨ KHI BẤM VÀO LỊCH SỬ ===
const currentMessagesRef = ref(db, `admin_chats/${currentUser}/sessions/${currentChatId}/messages`);
let isFirstLoad = true;

onValue(currentMessagesRef, (snapshot) => {
    if (!snapshot.exists()) return;

    if (isFirstLoad) {
        if (chatBox) {
            const typingEl = document.getElementById('typing-indicator');
            chatBox.innerHTML = '';
            if (typingEl) chatBox.appendChild(typingEl);
        }

        snapshot.forEach(childSnapshot => {
            const msg = childSnapshot.val();
            const senderType = (msg.sender === 'model') ? 'bot' : msg.sender;
            appendMessage(msg.text, senderType);
        });

        isFirstLoad = false;
    }
});

//5. HÀM TẠO ĐOẠN CHAT MỚI CHO ADMIN 
window.createNewChat = function() {
    sessionStorage.removeItem('currentAdminChatId');
    location.reload();
}

// Sidebar mobile toggle
function toggleSidebar(isOpen) {
    const sidebar = document.getElementById('sidebar-left');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;
    if (isOpen) {
        sidebar.classList.remove('-translate-x-full');
        backdrop.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } else {
        sidebar.classList.add('-translate-x-full');
        backdrop.classList.add('hidden');
        document.body.style.overflow = '';
    }
}
window.toggleSidebar = toggleSidebar;