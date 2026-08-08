import { app, db, auth, ref, set, get, onValue, push, child } from '/js/script.js';

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
const chatInput = document.getElementById('chat-input');
const typingIndicator = document.getElementById('typing-indicator');
const quickSuggestions = document.getElementById('quick-suggestions');
const fileInput = document.getElementById('file-input');

//Tạo ID cho mỗi class
let currentChatId = sessionStorage.getItem('currentChatId');
if (!currentChatId) {
    currentChatId = 'SESSION-' + Date.now();
    sessionStorage.setItem('currentChatId', currentChatId);
}

// Thay đổi API KEY của bạn ở đây

const HARD_TRIGGERS = ["đánh", "giết", "tự tử", "bắt nạt", "chửi", "đe dọa", "tống tiền", "đâm", "chém", "tẩy chay", "cô lập"];

let chatHistory = [
    { role: "user", parts: [{ text: "Bạn là trợ lý AI học đường của Cổng thông tin StopBully. Nhiệm vụ của bạn là lắng nghe, tư vấn tâm lý học tập, và phát hiện bạo lực học đường. Hãy trả lời ngắn gọn, đồng cảm và thân thiện. Khuyên các em báo cáo nếu có dấu hiệu bạo lực." }] },
    { role: "model", parts: [{ text: "Chào em! Mình là trợ lý AI thân thiện của trường. Mình luôn sẵn sàng lắng nghe và chia sẻ cùng em mọi vấn đề." }] }
];

const currentUser = localStorage.getItem('currentUser') || 'anonymous_student';
const currentName = localStorage.getItem('currentUserName') || 'Học sinh ẩn danh';

// === XỬ LÝ ĐÓNG/MỞ SIDEBAR ===
const sidebar = document.getElementById('sidebar-left');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const sidebarToggleBtn = document.getElementById('sidebar-toggle');

window.toggleSidebar = function (isOpen) {
    if (!sidebar) return;
    if (isOpen) {
        sidebar.classList.remove('-translate-x-full');
        if (sidebarBackdrop) sidebarBackdrop.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        if (sidebarBackdrop) sidebarBackdrop.classList.add('hidden');
    }
}

if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', () => {
        toggleSidebar(true);
    });
}

// === GỌI GEMINI API ===
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
        
        const botMessage = data.reply || "Xin lỗi, tôi không thể trả lời lúc này.";
        chatHistory.push({ role: "model", parts: [{ text: botMessage }] });
        return botMessage;
        
    } catch (error) {
        console.error("Lỗi khi gọi Backend API:", error);
        return "Hệ thống AI đang bảo trì hoặc mất kết nối máy chủ. Vui lòng thử lại sau.";
    }
}

// === XỬ LÝ GỬI TIN NHẮN ===
window.sendQuickMessage = function (text) {
    if (!chatInput) return;
    chatInput.value = text;
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
    }
}

window.handleChatSubmit = async function (event) {
    event.preventDefault();
    const messageText = chatInput.value.trim();
    if (!messageText) return;

    if (quickSuggestions) quickSuggestions.classList.add('hidden');

    appendMessage(messageText, 'user');
    chatInput.value = '';

    // HARD-TRIGGER: Phát hiện từ nguy hiểm → Khuyên học sinh gửi báo cáo
    const triggerWord = HARD_TRIGGERS.find(word => messageText.toLowerCase().includes(word));

    // Firebase Integration: Save User Message
    const currentUser = localStorage.getItem('currentUser') || 'anonymous_student';
    const currentName = localStorage.getItem('currentUserName') || 'Học sinh ẩn danh';

    // Default status: yellow (pending) unless trigger word is found (red)
    let chatStatus = triggerWord ? 'red' : 'yellow';

    const chatRef = ref(db, `chats/${currentUser}/sessions/${currentChatId}`);
    const msgsRef = ref(db, `chats/${currentUser}/sessions/${currentChatId}/messages`);

    // Cập nhật thông tin phiên chat
    update(chatRef, {
        name: currentName,
        email: currentUser,
        lastMessage: messageText,
        timestamp: new Date().toISOString(),
        status: chatStatus,
        roleClass: localStorage.getItem('roleClass') || 'Chưa rõ'
    });

    // Lưu tin nhắn của user
    push(msgsRef, {
        sender: 'user',
        text: messageText,
        timestamp: new Date().toISOString()
    });

    if (typingIndicator) {
        typingIndicator.classList.remove('hidden');
    }
    chatBox.scrollTop = chatBox.scrollHeight;

    const reply = await callGeminiAPI(messageText);

    if (typingIndicator) {
        typingIndicator.classList.add('hidden');
    }

    appendMessage(reply, 'bot');

    // Lưu tin nhắn của bot (AI)
    push(msgsRef, {
        sender: 'model',
        text: reply,
        timestamp: new Date().toISOString()
    });

    // Nếu có trigger nguy hiểm, hiển thị card gợi ý gửi báo cáo
    if (triggerWord) {
        showReportSuggestionCard(triggerWord);
    }
}

// === HIỂN THỊ CARD GỢI Ý GỬI BÁO CÁO ===
function showReportSuggestionCard(triggerWord) {
    const card = document.createElement('div');
    card.className = 'mx-auto my-3 max-w-[90%] md:max-w-[75%]';
    card.innerHTML = `
        <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 shadow-sm">
            <div class="flex items-start gap-3">
                <span class="text-2xl">⚠️</span>
                <div>
                    <p class="text-sm font-bold text-amber-800">Phát hiện nội dung cần hỗ trợ</p>
                    <p class="text-xs text-amber-700 mt-1 leading-relaxed">
                        Mình nhận thấy bạn đang gặp khó khăn nghiêm trọng liên quan đến "<strong>${triggerWord}</strong>". 
                        Đừng một mình chịu đựng nhé! Hãy gửi báo cáo chính thức để thầy cô nhà trường có thể hỗ trợ bạn trực tiếp và bảo mật.
                    </p>
                </div>
            </div>
            <div class="flex gap-2 flex-wrap">
                <button onclick="loadReportForm('modal-container')" 
                    class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1">
                    📝 Gửi báo cáo ngay
                </button>
                <a href="../User_page.html" 
                    class="px-4 py-2 bg-white dark:bg-[#211F26] border border-amber-300 hover:bg-amber-50 text-amber-800 text-xs font-bold rounded-xl transition flex items-center gap-1">
                    🏠 Về trang chủ
                </a>
            </div>
        </div>
    `;

    if (typingIndicator) {
        chatBox.insertBefore(card, typingIndicator);
    } else {
        chatBox.appendChild(card);
    }
    chatBox.scrollTop = chatBox.scrollHeight;
}


function createUrgentReport(content, triggerWord) {
    const reportId = 'REP-' + Math.floor(100000 + Math.random() * 900000);
    const currentUser = localStorage.getItem('currentUser') || 'Anonymous';

    set(ref(db, 'reports/' + reportId), {
        id: reportId,
        senderId: currentUser,
        content: `[TỪ KHÓA NGUY HIỂM: ${triggerWord}] - ` + content,
        priority: 'urgent',
        status: 'received',
        createdAt: new Date().toISOString(),
        source: 'chatbot_trigger'
    }).then(() => {
        console.log("Đã tạo báo cáo khẩn cấp tự động: " + reportId);
    }).catch(err => console.error("Lỗi tạo báo cáo: ", err));
}

function appendMessage(text, sender) {
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `flex items-start gap-3.5 max-w-[85%] md:max-w-[70%] ${sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`;

    const avatar = sender === 'user'
        ? (window.userAvatarUrl 
            ? `<img src="${window.userAvatarUrl}" class="w-10 h-10 rounded-2xl object-cover shrink-0 shadow-sm">`
            : `<div class="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm font-bold shrink-0 shadow-sm">👤</div>`)
        : `<div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white text-lg shrink-0 shadow-sm">🤖</div>`;

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

// === XỬ LÝ TẢI FILE ===
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
            <span class="text-xs text-gray-400 pr-1">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
    `;

    if (typingIndicator) {
        chatBox.insertBefore(messageWrapper, typingIndicator);
    } else {
        chatBox.appendChild(messageWrapper);
    }
    chatBox.scrollTop = chatBox.scrollHeight;

    setTimeout(() => {
        if (typingIndicator) {
            typingIndicator.classList.remove('hidden');
        }
        chatBox.scrollTop = chatBox.scrollHeight;

        setTimeout(() => {
            if (typingIndicator) {
                typingIndicator.classList.add('hidden');
            }
            appendMessage("Thầy cô đã nhận được file đính kèm của em rồi nhé. Nếu đây là bằng chứng, em có thể tạo một báo cáo chính thức ở trang chủ.", 'bot');
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


// === TẢI DANH SÁCH CÁC PHIÊN CHAT LÊN #chat-history-list ===
const chatsRef = ref(db, `chats/${currentUser}/sessions`);
const studentListEl = document.getElementById('chat-history-list');

onValue(chatsRef, (snapshot) => {
    if (!studentListEl) return;
    studentListEl.innerHTML = '';

    if (!snapshot.exists()) {
        studentListEl.innerHTML = '<div class="text-center text-sm text-gray-400 py-4">Chưa có lịch sử trò chuyện.</div>';
        return;
    }

    let sessions = [];
    snapshot.forEach(childSnapshot => {
        const chatData = childSnapshot.val();
        chatData.id = childSnapshot.key; // Gắn thêm id phiên
        sessions.push(chatData);
    });

    // Sắp xếp phiên mới nhất lên đầu dựa vào timestamp
    sessions.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    sessions.forEach(chat => {
        const dateStr = chat.timestamp ? new Date(chat.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
        const isSelected = chat.id === currentChatId;
        
        let bgClass = isSelected ? 'bg-indigo-50 border-indigo-200 dark:bg-[#36343B] dark:border-indigo-500/50' : 'bg-white dark:bg-[#211F26] border-gray-200 dark:border-[#49454F]/50 hover:bg-gray-50 dark:bg-[#141218] dark:hover:bg-[#36343B] dark:bg-[#141218]';

        const div = document.createElement('div');
        div.className = `p-3 rounded-2xl border ${bgClass} shadow-sm text-xs transition cursor-pointer mb-2`;
        
        // Khi bấm vào một phiên cũ trong lịch sử, chuyển sang phiên đó
        div.onclick = () => {
            sessionStorage.setItem('currentChatId', chat.id);
            location.reload();
        };

        div.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 shrink-0 text-sm">
                    ${chat.name ? chat.name.charAt(0).toUpperCase() : '👤'}
                </div>
                <div class="flex-1 min-w-0 space-y-1">
                    <div class="flex justify-between items-center gap-1">
                        <h4 class="font-bold text-gray-800 dark:text-[#E6E0E9] text-sm truncate">${chat.name || currentUser}</h4>
                        <span class="text-xs text-gray-400 shrink-0">${dateStr}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0"></span>
                        <p class="text-xs text-gray-500 dark:text-[#CAC4D0] truncate flex-1">${chat.lastMessage || '...'}</p>
                    </div>
                </div>
            </div>
        `;
        studentListEl.appendChild(div);
    });
});

// Hàm tạo đoạn chat mới
window.createNewChat = function() {
    sessionStorage.removeItem('currentChatId');
    location.reload();
}


// === TẢI VÀ HIỂN THỊ TIN NHẮN CỦA PHIÊN HIỆN TẠI KHI MỞ TRANG ===
const currentMessagesRef = ref(db, `chats/${currentUser}/sessions/${currentChatId}/messages`);
let isFirstLoad = true;

onValue(currentMessagesRef, (snapshot) => {
    if (!snapshot.exists()) return;

    if (isFirstLoad) {
        if (chatBox) {
            const typingEl = document.getElementById('typing-indicator');
            chatBox.innerHTML = ''; // Làm trống khung chat để nạp tin nhắn cũ
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

// Sự kiện kích hoạt
div.onclick = () => {
    sessionStorage.setItem('currentChatId', chat.id);
    location.reload();
};