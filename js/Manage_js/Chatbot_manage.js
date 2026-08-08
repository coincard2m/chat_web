import { db, ref, onValue, push, update, set } from '/js/script.js';

// Elements
const studentListEl = document.getElementById('student-list');
const studentCountEl = document.getElementById('student-count');

const currentChatAvatar = document.getElementById('current-chat-avatar');
const currentChatName = document.getElementById('current-chat-name');
const currentChatClass = document.getElementById('current-chat-class');
const btnResolveChat = document.getElementById('btn-resolve-chat');

const studentChatBox = document.getElementById('student-chat-box');
const studentChatInput = document.getElementById('student-chat-input');
const studentChatSubmit = document.getElementById('student-chat-submit');
const studentChatForm = document.getElementById('student-chat-form');

const btnAnalyzeChat = document.getElementById('btn-analyze-chat');
const aiChatBox = document.getElementById('ai-chat-box');
const aiChatInput = document.getElementById('ai-chat-input');
const aiChatForm = document.getElementById('ai-chat-form');
const aiTyping = document.getElementById('ai-typing');

// State
let allChats = [];
let currentStudentId = null;
let unsubscribeMessages = null;
let currentMessages = [];

// AI Config
const GEMINI_API_KEY = "AQ.Ab8RN6K9pEUdEUhQNUoJBvh_D6r6uNBQNPvvbQlvjmnz7QTvow";

let aiChatHistory = [
    { role: "user", parts: [{ text: "Bạn là AI Cố Vấn Sư Phạm. Nhiệm vụ của bạn là phân tích đoạn chat giữa học sinh và nhà trường, sau đó đưa ra lời khuyên xử lý và gợi ý câu trả lời. Giọng điệu chuyên nghiệp, thấu cảm. TUYỆT ĐỐI không hiển thị quá trình suy nghĩ, phân tích nội tâm hay bất kỳ đoạn văn bản tiếng Anh nào. CHỈ TRẢ VỀ KẾT QUẢ CUỐI CÙNG HOÀN TOÀN BẰNG TIẾNG VIỆT, trình bày rõ ràng, không dùng các ký hiệu thừa." }] },
    { role: "model", parts: [{ text: "Chào Thầy/Cô. Em là AI Cố Vấn. Em đã sẵn sàng hỗ trợ Thầy/Cô phân tích và đưa ra giải pháp hoàn toàn bằng Tiếng Việt." }] }
];

// 1. Fetch Chats
// 1. Fetch tất cả các cuộc trò chuyện từ mọi nguồn (Học sinh, Phụ huynh, Admin)
const chatsRef = ref(db, 'chats');
const parentChatsRef = ref(db, 'parent_chats');
const adminChatsRef = ref(db, 'admin_chats');

// Lắng nghe dữ liệu đồng thời từ các nhánh
function fetchAllSystemChats() {
    allChats = [];

    // 1. Lấy chat học sinh (chats/{user}/sessions/{sessionId})
    onValue(chatsRef, (snapshot) => {
        processChatSnapshot(snapshot, 'Học sinh', 'green');
    });

    // 2. Lấy chat phụ huynh (parent_chats/{user}/sessions/{sessionId})
    onValue(parentChatsRef, (snapshot) => {
        processChatSnapshot(snapshot, 'Phụ huynh', 'indigo');
    });

    // 3. Lấy chat admin (admin_chats/{user}/sessions/{sessionId})
    onValue(adminChatsRef, (snapshot) => {
        processChatSnapshot(snapshot, 'Giáo viên/Admin', 'purple');
    });
}

// Hàm phụ trợ bóc tách cấu trúc nested sessions trên Firebase
function processChatSnapshot(snapshot, defaultRoleClass, badgeColor) {
    if (!snapshot.exists()) return;

    snapshot.forEach(userSnap => {
        const userKey = userSnap.key; // ví dụ: email hoặc anonymous_id của user
        const sessionsSnap = userSnap.child('sessions');

        if (sessionsSnap.exists()) {
            // Trường hợp dữ liệu được chia theo cấu trúc sessions (như học sinh/phụ huynh mới)
            sessionsSnap.forEach(sessionSnap => {
                const chatData = sessionSnap.val();
                const chatId = sessionSnap.key;
                
                // Tránh trùng ID giữa các nhánh
                const uniqueId = `${userKey}_${chatId}`;

                // Kiểm tra xem chat này đã có trong mảng chưa, nếu có thì cập nhật, chưa thì thêm mới
                const existingIndex = allChats.findIndex(c => c.uniqueId === uniqueId);
                const formattedChat = {
                    uniqueId: uniqueId,
                    id: chatId, // ID gốc của session để query tin nhắn
                    userPathKey: userKey, // Đường dẫn user gốc để truy vấn đúng nhánh
                    category: defaultRoleClass,
                    name: chatData.name || userKey,
                    roleClass: chatData.roleClass || defaultRoleClass,
                    lastMessage: chatData.lastMessage || '...',
                    timestamp: chatData.timestamp || new Date().toISOString(),
                    status: chatData.status || 'green',
                    sourceType: defaultRoleClass === 'Học sinh' ? 'chats' : (defaultRoleClass === 'Phụ huynh' ? 'parent_chats' : 'admin_chats')
                };

                if (existingIndex > -1) {
                    allChats[existingIndex] = formattedChat;
                } else {
                    allChats.push(formattedChat);
                }
            });
        } else {
            // Trường hợp cấu trúc cũ (nếu có bảng ghi trực tiếp)
            const chatData = userSnap.val();
            if (chatData && typeof chatData === 'object' && !chatData.messages) {
                // ... Xử lý tương tự nếu hệ thống cũ còn sót lại bảng phẳng
            }
        }
    });

    renderStudentList();
}

// Gọi hàm fetch lúc khởi động
fetchAllSystemChats();

function getStatusWeight(status) {
    if (status === 'red') return 3;
    if (status === 'yellow') return 2;
    return 1; // green
}

function renderStudentList() {
    allChats.sort((a, b) => {
        const weightA = getStatusWeight(a.status);
        const weightB = getStatusWeight(b.status);
        if (weightA !== weightB) return weightB - weightA;
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    });

    studentCountEl.textContent = allChats.length;
    studentListEl.innerHTML = '';

    if (allChats.length === 0) {
        studentListEl.innerHTML = '<div class="text-center text-sm text-gray-400 py-4">Chưa có dữ liệu hội thoại nào.</div>';
        return;
    }

    allChats.forEach(chat => {
        const div = document.createElement('div');
        const isSelected = chat.uniqueId === currentStudentId;
        
        let borderClass = 'border-transparent hover:border-gray-200 dark:border-[#49454F]/50 hover:bg-gray-50 dark:bg-[#141218] dark:hover:bg-[#36343B] dark:bg-[#141218]';
        let statusDot = '<span class="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)] shrink-0"></span>';
        let bgClass = isSelected ? 'bg-indigo-50 border-indigo-200 dark:bg-[#36343B] dark:border-indigo-500/50' : 'bg-white dark:bg-[#211F26]';
        
        if (chat.status === 'red') {
            borderClass = 'border-red-200 dark:border-red-800 hover:bg-red-50/50 dark:hover:bg-red-900/30';
            bgClass = isSelected ? 'bg-red-50 border-red-300 dark:bg-red-900/40 dark:border-red-700/50' : 'bg-red-50/30 dark:bg-red-900/20';
            statusDot = '<span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)] shrink-0"></span>';
        } else if (chat.status === 'yellow') {
            borderClass = 'border-amber-200 hover:bg-amber-50/50';
            bgClass = isSelected ? 'bg-amber-50 border-amber-300 dark:bg-amber-900/40 dark:border-amber-700/50' : 'blink-bg';
            statusDot = '<span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)] shrink-0"></span>';
        }

        const dateStr = chat.timestamp ? new Date(chat.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';

        // Badge phân biệt nguồn (Học sinh / Phụ huynh / Admin)
        let badgeColorBg = 'bg-emerald-100 text-emerald-800';
        if (chat.category === 'Phụ huynh') badgeColorBg = 'bg-blue-100 text-blue-800';
        if (chat.category === 'Giáo viên/Admin') badgeColorBg = 'bg-purple-100 text-purple-800';

        div.className = `p-3 rounded-2xl border cursor-pointer transition ${bgClass} ${borderClass} mb-2`;
        div.onclick = () => selectStudent(chat.uniqueId);
        
        div.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-100 to-gray-200 flex items-center justify-center font-bold text-gray-600 dark:text-[#CAC4D0] shrink-0 text-sm">
                    ${chat.name ? chat.name.charAt(0).toUpperCase() : '👤'}
                </div>
                <div class="flex-1 min-w-0 space-y-1">
                    <div class="flex justify-between items-center gap-1">
                        <h4 class="font-bold text-gray-800 dark:text-[#E6E0E9] text-sm truncate" title="${chat.name}">${chat.name || chat.id}</h4>
                        <span class="text-xs text-gray-400 shrink-0">${dateStr}</span>
                    </div>
                    <div class="flex items-center justify-between gap-1">
                        <div class="flex items-center gap-2 min-w-0">
                            ${statusDot}
                            <p class="text-xs text-gray-500 dark:text-[#CAC4D0] truncate flex-1">${chat.lastMessage || '...'}</p>
                        </div>
                        <span class="text-xs px-1.5 py-0.5 rounded-full font-medium ${badgeColorBg} shrink-0">${chat.category}</span>
                    </div>
                </div>
            </div>
        `;
        studentListEl.appendChild(div);
    });
}

// 2. Chat phiên làm việc
window.selectStudent = function(uniqueId) {
    currentStudentId = uniqueId;
    const chat = allChats.find(c => c.uniqueId === uniqueId);
    if (!chat) return;

    renderStudentList(); // Cập nhật lại giao diện active trên danh sách sidebar

    // Hiển thị thông tin tiêu đề khung chat bên phải
    currentChatName.textContent = chat.name || chat.id;
    currentChatClass.textContent = chat.roleClass || 'Người dùng';
    currentChatAvatar.textContent = chat.name ? chat.name.charAt(0).toUpperCase() : '👤';

    // Mở khóa các ô nhập liệu và nút chức năng
    studentChatInput.disabled = false;
    studentChatSubmit.disabled = false;
    btnResolveChat.classList.remove('hidden');
    btnAnalyzeChat.disabled = false;

    // Hủy lắng nghe tin nhắn của phiên cũ (nếu có) để tránh xung đột dữ liệu
    if (unsubscribeMessages) unsubscribeMessages();

    // Xác định chính xác đường dẫn Firebase dựa vào sourceType của phiên chat được chọn
    const dbPath = `${chat.sourceType}/${chat.userPathKey}/sessions/${chat.id}/messages`;
    const msgsRef = ref(db, dbPath);

    // Lắng nghe và load toàn bộ tin nhắn của phiên này lên khung chat
    unsubscribeMessages = onValue(msgsRef, (snapshot) => {
        currentMessages = [];
        studentChatBox.innerHTML = '';
        
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const msg = child.val();
                currentMessages.push(msg);
                appendStudentMessage(msg);
            });
            studentChatBox.scrollTop = studentChatBox.scrollHeight;
        } else {
            studentChatBox.innerHTML = '<div class="text-center text-sm text-gray-400 py-10 relative z-10">Chưa có tin nhắn nào trong phiên này.</div>';
        }
    });
}

function appendStudentMessage(msg) {
    const isUser = msg.sender === 'user' || msg.sender === 'Học sinh';
    const isAdmin = msg.sender === 'admin' || msg.sender === 'Quản trị viên' || msg.sender === 'Giáo viên';
    const isModel = msg.sender === 'model' || msg.sender === 'AI tự động';
    
    const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';

    let bubble = '';
    if (isUser) {
        bubble = `
            <div class="flex items-start gap-3 max-w-[85%] md:max-w-[75%] relative z-10">
                <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">HS</div>
                <div class="space-y-1">
                    <div class="bg-white dark:bg-[#2B2930] border border-gray-100 dark:border-[#49454F]/50 px-4 py-2.5 rounded-2xl rounded-tl-none text-sm text-gray-800 dark:text-[#E6E0E9] shadow-sm leading-relaxed">
                        ${escapeHTML(msg.text || '')}
                    </div>
                    <div class="text-xs text-gray-400 pl-1">${timeStr}</div>
                </div>
            </div>
        `;
    } else if (isAdmin) {
        bubble = `
            <div class="flex items-start gap-3 max-w-[85%] md:max-w-[75%] ml-auto flex-row-reverse relative z-10">
                <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">GV</div>
                <div class="space-y-1 text-right">
                    <div class="bg-indigo-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-none text-sm shadow-sm leading-relaxed text-left">
                        ${escapeHTML(msg.text || '')}
                    </div>
                    <div class="text-xs text-gray-400 pr-1">${timeStr}</div>
                </div>
            </div>
        `;
    } else {
        bubble = `
            <div class="flex items-start gap-3 max-w-[85%] md:max-w-[75%] relative z-10 ml-[44px]">
                <div class="space-y-1 text-left">
                    <div class="bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800 text-teal-900 dark:text-[#E6E0E9] px-4 py-2.5 rounded-2xl text-sm shadow-sm leading-relaxed">
                        <span class="text-xs font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1 mb-1"><span class="text-xs">🤖</span> AI tư vấn:</span>
                        ${escapeHTML(msg.text || '')}
                    </div>
                    <div class="text-xs text-gray-400 pl-1">${timeStr}</div>
                </div>
            </div>
        `;
    }
    
    if (studentChatBox.innerHTML.includes('Chưa có tin nhắn')) {
        studentChatBox.innerHTML = '';
    }
    studentChatBox.insertAdjacentHTML('beforeend', bubble);
}

window.handleStudentChatSubmit = function(e) {
    e.preventDefault();
    if (!currentStudentId) return;
    const text = studentChatInput.value.trim();
    if (!text) return;

    // Tìm thông tin chi tiết của phiên chat đang chọn trong mảng allChats
    const chat = allChats.find(c => c.uniqueId === currentStudentId);
    if (!chat) {
        console.error("Không tìm thấy thông tin phiên chat hiện tại!");
        return;
    }

    // Xác định đúng đường dẫn Firebase dựa vào sourceType và userPathKey của phiên đó
    const dbPath = `${chat.sourceType}/${chat.userPathKey}/sessions/${chat.id}/messages`;
    const chatRef = ref(db, `${chat.sourceType}/${chat.userPathKey}/sessions/${chat.id}`);

    const msgsRef = ref(db, dbPath);
    const now = new Date().toISOString();

    // 1. Đẩy tin nhắn phản hồi của giáo viên lên Firebase
    push(msgsRef, {
        sender: 'admin',
        text: text,
        timestamp: now
    });

    // 2. Cập nhật lại trạng thái tin nhắn cuối cùng (lastMessage) của phiên chat đó
    update(chatRef, {
        lastMessage: "Quản trị viên: " + text,
        timestamp: now
    });

    // 3. Xóa nội dung ô nhập liệu
    studentChatInput.value = '';
}

window.resolveCurrentChat = function() {
    if (!currentStudentId) return;
    update(ref(db, `chats/${currentStudentId}`), {
        status: 'green'
    }).then(() => {
        alert("Đã đánh dấu xử lý xong!");
    });
}

// 3. AI Assistant Logic
window.handleAIChatSubmit = async function(e) {
    e.preventDefault();
    const text = aiChatInput.value.trim();
    if (!text) return;

    appendAIMessage(text, 'user');
    aiChatInput.value = '';
    
    await callGeminiForAI(text);
}

window.analyzeCurrentChat = async function() {
    if (!currentStudentId || currentMessages.length === 0) return;
    
    let context = "Đây là đoạn chat giữa học sinh và hệ thống:\n\n";
    currentMessages.forEach(m => {
        let senderName = m.sender === 'user' ? 'Học sinh' : (m.sender === 'admin' ? 'Giáo viên' : 'AI tự động');
        context += `[${senderName}]: ${m.text}\n`;
    });
    
    context += "\nXin hãy phân tích tình huống này: Học sinh đang gặp vấn đề gì? Mức độ nghiêm trọng? Gợi ý cách Giáo viên nên trả lời học sinh để hỗ trợ tốt nhất (viết sẵn nội dung tin nhắn có thể copy).";

    appendAIMessage("Đang yêu cầu AI phân tích cuộc trò chuyện...", 'user');
    await callGeminiForAI(context);
}

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
            appendAIMessage("Xin lỗi, hệ thống AI đang lỗi hoặc API Key bị giới hạn.", 'model');
            aiChatHistory.pop();
        } else {
            const data = await response.json();
            const textPart = data.candidates?.[0]?.content?.parts?.find(p => !p.thought);
            const botMessage = textPart ? textPart.text : (data.candidates?.[0]?.content?.parts?.[0]?.text || "Không thể phân tích.");
            aiChatHistory.push({ role: "model", parts: [{ text: botMessage }] });
            appendAIMessage(botMessage, 'model');
        }
    } catch (error) {
        console.error(error);
        appendAIMessage("Lỗi mạng khi kết nối AI.", 'model');
    } finally {
        aiTyping.classList.add('hidden');
    }
}

function appendAIMessage(text, role) {
    let html = '';
    if (role === 'user') {
        html = `
            <div class="flex items-start gap-2.5 max-w-[90%] ml-auto flex-row-reverse">
                <div class="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0 shadow-sm text-xs">GV</div>
                <div class="bg-indigo-600 text-white px-3 py-2 rounded-2xl rounded-tr-none shadow-sm text-left">
                    ${escapeHTML(text)}
                </div>
            </div>
        `;
    } else {
        html = `
            <div class="flex items-start gap-2.5 max-w-[95%]">
                <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-sm text-sm">🤖</div>
                <div class="bg-white dark:bg-[#2B2930] border border-gray-100 dark:border-[#49454F]/50 text-gray-800 dark:text-[#E6E0E9] px-3 py-2.5 rounded-2xl rounded-tl-none shadow-sm leading-relaxed whitespace-pre-wrap">
                    ${escapeHTML(text)}
                </div>
            </div>
        `;
    }
    aiChatBox.insertAdjacentHTML('beforeend', html);
    aiChatBox.scrollTop = aiChatBox.scrollHeight;
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// Khởi tạo Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Prevent forms default if not handled
});