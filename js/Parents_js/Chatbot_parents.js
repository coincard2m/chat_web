import { db, ref, set, push, update, onValue } from '/js/script.js';

const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const typingIndicator = document.getElementById('typing-indicator');
const quickSuggestions = document.getElementById('quick-suggestions');
const fileInput = document.getElementById('file-input');

// === 1. KHỞI TẠO PHIÊN CHAT (SESSION) CHO PHỤ HUYNH ===
let currentChatId = sessionStorage.getItem('currentParentChatId');
if (!currentChatId) {
    currentChatId = 'PARENT-SESSION-' + Date.now();
    sessionStorage.setItem('currentParentChatId', currentChatId);
}

// Lấy thông tin phụ huynh
const currentUser = localStorage.getItem('currentUser') || 'anonymous_parent';
const currentName = localStorage.getItem('currentUserName') || 'Phụ huynh';



let chatHistory = [
    {
        role: "user",
        parts: [{ text: `Bạn là AI Tư vấn Phụ huynh của hệ thống StopBully. Nhiệm vụ của bạn là hỗ trợ phụ huynh trong việc nắm bắt tình hình của con, nhận biết dấu hiệu bạo lực học đường, và cách đồng hành cùng con. Xưng hô thân thiện, tôn trọng. Trả lời hoàn toàn bằng Tiếng Việt. KHÔNG hiển thị suy nghĩ nội tâm bằng tiếng Anh.` }]
    },
    {
        role: "model",
        parts: [{ text: "Xin chào quý phụ huynh! Tôi là AI Tư vấn của StopBully. Tôi luôn sẵn sàng hỗ trợ quý vị trong việc bảo vệ và đồng hành cùng con em. Quý vị có câu hỏi hay lo lắng gì hôm nay không?" }]
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

    // Đường dẫn riêng biệt cho phụ huynh: parent_chats/...
    const chatRef = ref(db, `parent_chats/${currentUser}/sessions/${currentChatId}`);
    const msgsRef = ref(db, `parent_chats/${currentUser}/sessions/${currentChatId}/messages`);

    update(chatRef, {
        id: currentChatId,
        name: currentName,
        email: currentUser,
        lastMessage: messageText,
        timestamp: new Date().toISOString(),
        roleClass: 'Phụ huynh'
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
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `flex items-start gap-3.5 max-w-[85%] md:max-w-[70%] animate-fade-in ${sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`;

    const avatar = sender === 'user'
        ? `<div class="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm font-bold shrink-0">👤</div>`
        : `<div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white text-lg shrink-0">🤖</div>`;

    const contentBg = sender === 'user'
        ? `bg-emerald-600 text-white rounded-tr-none`
        : `bg-gray-100 text-gray-900 dark:text-[#E6E0E9] rounded-tl-none`;

    messageWrapper.innerHTML = `
        ${avatar}
        <div class="space-y-1.5 ${sender === 'user' ? 'text-right' : ''}">
            <div class="${contentBg} px-4 py-3 rounded-2xl text-sm md:text-base leading-relaxed text-left shadow-sm">
                ${text}
            </div>
            <span class="text-xs text-gray-400 pl-1">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
        appendFileMessage(file);
        fileInput.value = '';
    });
}

function appendFileMessage(file) {
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `flex items-start gap-3.5 max-w-[85%] md:max-w-[70%] ml-auto flex-row-reverse`;

    const fileIcon = getFileIcon(file.name);
    const fileSize = (file.size / 1024 / 1024).toFixed(2) + ' MB';

    messageWrapper.innerHTML = `
        <div class="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm font-bold shrink-0">👤</div>
        <div class="space-y-1.5 text-right">
            <div class="bg-emerald-600 text-white px-4 py-3 rounded-2xl rounded-tr-none shadow-sm">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">${fileIcon}</span>
                    <div class="text-left">
                        <p class="font-medium text-sm">${file.name}</p>
                        <p class="text-xs text-emerald-100 opacity-75">${fileSize}</p>
                    </div>
                </div>
            </div>
            <span class="text-xs text-gray-400">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
    `;

    if (typingIndicator) chatBox.insertBefore(messageWrapper, typingIndicator);
    else chatBox.appendChild(messageWrapper);
    chatBox.scrollTop = chatBox.scrollHeight;

    setTimeout(() => {
        if (typingIndicator) typingIndicator.classList.remove('hidden');
        chatBox.scrollTop = chatBox.scrollHeight;
        setTimeout(() => {
            if (typingIndicator) typingIndicator.classList.add('hidden');
            appendMessage("Cảm ơn quý phụ huynh đã chia sẻ tài liệu. Mình đã nhận được và sẽ hỗ trợ phân tích nếu cần thiết.", 'bot');
        }, 1200);
    }, 800);
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
    if (['pdf'].includes(ext)) return '📕';
    if (['doc', 'docx'].includes(ext)) return '📘';
    return '📄';
}

// === 3. TẢI DANH SÁCH LỊCH SỬ PHIÊN CHAT RA SIDEBAR ===
const parentSessionsRef = ref(db, `parent_chats/${currentUser}/sessions`);
const studentListEl = document.getElementById('chat-history-list');

onValue(parentSessionsRef, (snapshot) => {
    if (!studentListEl) return;
    studentListEl.innerHTML = '';

    if (!snapshot.exists()) {
        studentListEl.innerHTML = '<div class="text-center text-sm text-gray-400 py-4">Chưa có lịch sử tư vấn.</div>';
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
            sessionStorage.setItem('currentParentChatId', chat.id);
            location.reload();
        };

        div.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 shrink-0 text-sm">
                    👨‍👩‍👧
                </div>
                <div class="flex-1 min-w-0 space-y-1">
                    <div class="flex justify-between items-center gap-1">
                        <h4 class="font-bold text-gray-800 dark:text-[#E6E0E9] text-sm truncate">Tư vấn phụ huynh</h4>
                        <span class="text-xs text-gray-400 shrink-0">${dateStr}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
                        <p class="text-xs text-gray-500 dark:text-[#CAC4D0] truncate flex-1">${chat.lastMessage || '...'}</p>
                    </div>
                </div>
            </div>
        `;
        studentListEl.appendChild(div);
    });
});

// === 4. TẢI NỘI DUNG TIN NHẮN CŨ KHI BẤM VÀO LỊCH SỬ ===
const currentMessagesRef = ref(db, `parent_chats/${currentUser}/sessions/${currentChatId}/messages`);
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

// === 5. HÀM TẠO ĐOẠN CHAT MỚI CHO PHỤ HUYNH ===
window.createNewChat = function() {
    sessionStorage.removeItem('currentParentChatId');
    location.reload();
}