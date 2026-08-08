import { db, ref, onValue, push, remove } from '/js/script.js';
import { loadNotifications } from '/Data_firebase/Notification_data.js';

// 1. Dữ liệu Firebase (sẽ ghi đè mảng placeholder khi tải xong)
let notifications = [];
const currentUserGroup = "all_teachers"; 

const mentionDatabase = [
    { id: "all_students", name: "toàn thể học sinh", type: "Nhóm đối tượng" },
    { id: "all_teachers", name: "giáo viên", type: "Nhóm đối tượng" },
    { id: "all_parents", name: "phụ huynh", type: "Nhóm đối tượng" },
    { id: "all_admins", name: "quản trị", type: "Nhóm đối tượng" },
    { id: "all", name: "tất cả", type: "Toàn trường" }
];


// Danh sách phụ huynh lớp chủ nhiệm (Phục vụ tính năng nhắc tên bằng @)
let parentDatabase = [];
let allStudentsData = []; // Lưu tạm danh sách học sinh để dò tên con

// Lắng nghe dữ liệu tài khoản từ Firebase để đồng bộ danh sách Phụ huynh & Học sinh
const usersRef = ref(db, 'users');
onValue(usersRef, (snapshot) => {
    parentDatabase = [];
    allStudentsData = [];
    
    if (snapshot.exists()) {
        const users = snapshot.val();
        
        // Bước gom dữ liệu học sinh trước để mapping tìm tên con
        for (const username in users) {
            const user = users[username];
            if (user.role === 'student') {
                allStudentsData.push({
                    email: username,
                    name: user.name || '',
                    linkedParent: user.linkedParent || ''
                });
            }
        }

        // Bước lọc ra danh sách phụ huynh
        for (const username in users) {
            const user = users[username];
            if (user.role === 'parent') {
                // Tìm học sinh nào có liên kết với email/username của phụ huynh này
                const matchedStudent = allStudentsData.find(s => s.linkedParent === username);
                
                parentDatabase.push({
                    id: username,
                    name: user.name || username,
                    child: matchedStudent ? matchedStudent.name : "Chưa cập nhật"
                });
            }
        }
    }
});

function filterNotificationsByRole(notificationsList, userGroup) {
    const groupInfo = mentionDatabase.find(g => g.id === userGroup);

    const currentRole = localStorage.getItem('role'); 
    const currentUsername = localStorage.getItem('currentUser');
    const teacherInputEl = localStorage.getItem('currentUserName');
    const teacherFullName = teacherInputEl;
    return notificationsList.filter(item => {
        if (item.sender && (item.sender === teacherFullName || item.sender === currentUsername)) {
            return true;
        }

        const targetValue = (item.target || "").toLowerCase();

        if (targetValue.includes("tất cả") || targetValue.includes("all")) {
            return true;
        }


        if (currentUsername && targetValue === currentUsername.toLowerCase()) {
            return true;
        }

        if (groupInfo) {
            return targetValue.includes(groupInfo.name.toLowerCase()) || targetValue.includes(groupInfo.id.toLowerCase());
        }

        return false;
    });
}

// Biến toàn cục theo dõi trạng thái bộ gõ @ (Tách riêng cho các ô nhập liệu)
let activeMentionField = null; 
let atMentionState = {
    isActive: false,
    startPos: -1,
    searchQuery: ""
};

// Hàm khởi tạo danh sách thông báo bên trái
function renderNotificationList() {
    const listContainer = document.getElementById('message-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    let unreadCount = 0;

    const sortedNotifications = [...notifications].reverse();

    sortedNotifications.forEach(item => {
        if (item.isUnread) unreadCount++;

        const itemDiv = document.createElement('div');
        itemDiv.className = `p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
            item.isUnread ? 'bg-indigo-50 dark:bg-[#36343B]/60 border-indigo-200 dark:border-indigo-500/50 hover:bg-indigo-100 dark:hover:bg-[#36343B]' : 'bg-white dark:bg-[#211F26] border-gray-100 dark:border-[#49454F]/50 hover:bg-gray-50 dark:hover:bg-[#36343B]'
        }`;
        
        itemDiv.onclick = () => selectNotification(item.id);
        itemDiv.innerHTML = `
            <div class="flex items-start justify-between gap-3">
                <h4 class="font-bold text-gray-900 dark:text-[#E6E0E9] text-sm md:text-base leading-snug ${item.isUnread ? 'text-indigo-950 dark:text-indigo-300' : ''}">
                    ${item.title}
                </h4>
                ${item.isUnread ? '<span class="w-2.5 h-2.5 bg-indigo-600 rounded-full mt-1.5 shrink-0"></span>' : ''}
            </div>
            <p class="text-xs text-gray-500 dark:text-[#CAC4D0] font-medium">Người gửi: ${item.sender} • Nhận: <span class="text-indigo-600">${item.target}</span></p>
            <p class="text-xs md:text-sm text-gray-600 dark:text-[#CAC4D0] line-clamp-2 mt-0.5">${item.summary}</p>
            <span class="text-xs text-gray-400 mt-1 block">${item.time}</span>
        `;
        listContainer.appendChild(itemDiv);
    });

    const unreadBadge = document.getElementById('unread-count');
    if (unreadBadge) {
        unreadBadge.textContent = `${unreadCount} Thông báo`;
        unreadBadge.style.display = unreadCount === 0 ? 'none' : 'inline-block';
    }
}

// Xem chi tiết tin nhắn
function selectNotification(id) {
    const item = notifications.find(n => n.id === id);
    if (!item) return;

    if (item.isUnread) {
        item.isUnread = false;
        renderNotificationList();
    }

    const detailContainer = document.getElementById('message-detail');
    if (!detailContainer) return;

    detailContainer.className = "bg-white dark:bg-[#211F26] rounded-3xl border border-gray-100 dark:border-[#49454F]/50/80 shadow-sm p-6 min-h-[460px] flex flex-col justify-between transition-all sticky top-24";
    detailContainer.innerHTML = `
        <div class="space-y-4">
            <div class="border-b border-gray-100 dark:border-[#49454F]/50 pb-4">
                <span class="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">🎯 Gửi tới: ${item.target}</span>
                <h2 class="text-xl font-bold text-gray-950 dark:text-[#E6E0E9] mt-3">${item.title}</h2>
                <div class="flex justify-between text-xs text-gray-400 mt-2 font-medium">
                    <span>Người gửi: <b>${item.sender}</b></span>
                    <span>${item.time}</span>
                </div>
            </div>
            <div class="text-gray-700 dark:text-[#CAC4D0] text-sm md:text-base leading-relaxed whitespace-pre-line">${item.content}</div>
        </div>
        <div class="border-t border-gray-50 pt-4 mt-6 flex justify-end">
            <button onclick="deleteNotification('${item.id}')" class="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-xl transition">🗑️ Thu hồi</button>
        </div>
    `;
}

// Xóa/Thu hồi thông báo
function deleteNotification(id) {
    if (confirm("Bạn có chắc chắn muốn thu hồi thông báo này?")) {
        remove(ref(db, 'notifications/' + id)).catch(e => console.error('Lỗi xóa:', e));
        
        const detailContainer = document.getElementById('message-detail');
        if (detailContainer) {
            detailContainer.className = "bg-white dark:bg-[#211F26] rounded-3xl border border-gray-100 dark:border-[#49454F]/50/80 shadow-sm p-6 min-h-[460px] flex flex-col items-center justify-center text-center text-gray-400 font-medium transition-all sticky top-24";
            detailContainer.innerHTML = `
                <div class="w-16 h-16 bg-indigo-50/60 text-indigo-500 rounded-2xl flex items-center justify-center text-2xl mb-4 border border-indigo-100/30">✉️</div>
                <p class="text-sm max-w-xs text-gray-500 dark:text-[#CAC4D0] leading-relaxed">Chọn một tin nhắn bất kỳ từ danh sách bên cạnh để xem nội dung chi tiết.</p>
            `;
        }
    }
}

// Mở Modal gửi thông báo
function openCreateNotificationModal() {
    selectedTargetId = null;
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
        <div id="notif-modal" class="fixed inset-0 z-[50] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm opacity-0 transition-opacity duration-300">
            <div class="bg-white dark:bg-[#211F26] rounded-3xl shadow-xl w-full max-w-lg overflow-hidden transform scale-95 transition-transform duration-300">
                
                <div class="bg-indigo-950 text-white p-5 flex items-center justify-between">
                    <div>
                        <h3 class="text-lg font-bold">Gửi thông báo lớp chủ nhiệm</h3>
                        <p class="text-xs text-indigo-200 mt-0.5">Kênh liên lạc Giáo viên Lớp 8A -> Phụ huynh</p>
                    </div>
                    <button onclick="closeNotifModal()" class="text-white/70 hover:text-white text-xl">✕</button>
                </div>

                <form id="create-notif-form" class="p-6 space-y-4" onsubmit="handleSendNotification(event)">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-[#CAC4D0] uppercase tracking-wider mb-1.5">Tiêu đề</label>
                        <input type="text" id="notif-title" required placeholder="Ví dụ: Nhắc nhở họp phụ huynh đột xuất..." 
                            class="w-full px-4 py-2.5 border border-gray-200 dark:border-[#49454F]/50 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                    </div>

                    <!-- Ô NHẬP NGƯỜI NHẬN RIÊNG BIỆT (Có tích hợp @) -->
                    <div class="relative">
                        <label class="block text-xs font-bold text-gray-700 dark:text-[#CAC4D0] uppercase tracking-wider mb-1.5">Đến (Người nhận) - Gõ @ để chọn</label>
                        <input type="text" id="notif-receiver" required value="Tất cả phụ huynh Lớp 8A" 
                            placeholder="Gõ @ để tìm phụ huynh hoặc giữ nguyên để gửi cả lớp..." 
                            class="w-full px-4 py-2.5 border border-gray-200 dark:border-[#49454F]/50 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            oninput="handleFieldInput(this, 'receiver')"
                            onkeydown="handleFieldKeyDown(event, this)"/>
                        
                        <!-- Dropdown gợi ý cho ô Người Nhận -->
                        <div id="receiver-dropdown" class="hidden absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#211F26] border border-gray-200 dark:border-[#49454F]/50 rounded-2xl shadow-xl max-h-48 overflow-y-auto z-[65]"></div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-[#CAC4D0] uppercase tracking-wider mb-1.5">Giáo viên gửi</label>
                        <input type="text" id="notif-sender" required readonly
                            class="w-full px-4 py-2.5 border border-gray-100 dark:border-[#49454F]/50 bg-gray-50 dark:bg-[#141218] text-gray-500 dark:text-[#CAC4D0] rounded-xl text-sm focus:outline-none" />
                    </div>

                    <!-- Khung Nội dung -->
                    <div class="relative">
                        <label class="block text-xs font-bold text-gray-700 dark:text-[#CAC4D0] uppercase tracking-wider mb-1.5">Nội dung</label>
                        <textarea id="notif-content" rows="4" required 
                            placeholder="Kính gửi quý phụ huynh, gõ @ để nhắc tên phụ huynh nếu cần..." 
                            class="w-full px-4 py-2.5 border border-gray-200 dark:border-[#49454F]/50 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                            oninput="handleFieldInput(this, 'content')"
                            onkeydown="handleFieldKeyDown(event, this)"></textarea>
                        
                        <!-- Dropdown gợi ý cho ô Nội Dung -->
                        <div id="content-dropdown" class="hidden absolute left-0 right-0 bottom-full mb-1 bg-white dark:bg-[#211F26] border border-gray-200 dark:border-[#49454F]/50 rounded-2xl shadow-xl max-h-48 overflow-y-auto z-[60]"></div>
                    </div>

                    <div class="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-[#49454F]/50">
                        <button type="button" onclick="closeNotifModal()" class="px-4 py-2 text-sm font-medium text-gray-500 dark:text-[#CAC4D0] hover:bg-gray-50 dark:bg-[#141218] dark:hover:bg-[#36343B] dark:bg-[#141218] rounded-xl transition">Hủy</button>
                        <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition shadow-sm">Gửi thông báo</button>
                    </div>
                </form>

            </div>
        </div>
    `;

    setTimeout(() => {
        const modal = document.getElementById('notif-modal');
        modal.classList.remove('opacity-0');
        modal.firstElementChild.classList.remove('scale-95');

        const senderInput = document.getElementById('notif-sender');
        if (senderInput) {
            senderInput.value = localStorage.getItem('currentUserName') || "Cô Nguyễn Minh Thư (GVCN)";
        }

    }, 20);
}

// BỘ HÀM LOGIC XỬ LÝ BỘ GÕ MENTION @ (ĐÃ ĐƯỢC TỐI ƯU & FIX LỖI)

// 1. Hàm ẩn dropdown - Bảo đảm ẩn sạch mọi dropdown bằng cả class Tailwind lẫn CSS inline
function hideAllDropdowns() {
    const dropdownIds = ['receiver-dropdown', 'content-dropdown', 'ann-receiver-dropdown', 'ann-body-dropdown'];
    dropdownIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.style.display = 'none'; 
        }
    });
    
    if (typeof atMentionState !== 'undefined') {
        atMentionState.isActive = false;
    }
    activeMentionField = null;
}

// 2. Hàm chèn tên - Định dạng văn bản chèn và đóng bảng ngay, loại bỏ trigger lặp vô hạn
let selectedTargetId = null;

function insertMention(name, element, fieldType, parentId = null) {
    const text = element.value;
    const cursorPos = element.selectionStart;
    
    const textBeforeCursor = text.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
        const beforeAt = text.substring(0, atIndex);
        const afterCursor = text.substring(cursorPos);
        
        let replacement = "";
        if (fieldType === 'receiver' || fieldType === 'ann-receiver') {
            replacement = `Phụ huynh ${name} `;
            selectedTargetId = parentId;
            
            // Nếu ô nhận đang giữ giá trị mặc định, thay thế toàn bộ luôn
            if (text.startsWith("")) {
                element.value = replacement;
                hideAllDropdowns();
                element.focus();
                return;
            }
        } else {
            replacement = `[Phụ huynh: ${name}] `;
        }
        
        element.value = beforeAt + replacement + afterCursor;
        
        element.focus();
        const newCursorPos = atIndex + replacement.length;
        element.setSelectionRange(newCursorPos, newCursorPos);
    }
    
    hideAllDropdowns();
}

// 3. Hàm kiểm tra sự kiện gõ phím ô nhập liệu
function handleFieldInput(element, fieldType) {
    const text = element.value;
    const caretPos = element.selectionStart;
    
    const lastAtIndex = text.lastIndexOf('@', caretPos - 1);
    
    if (lastAtIndex !== -1 && (lastAtIndex === 0 || text[lastAtIndex - 1] === ' ' || text[lastAtIndex - 1] === '\n')) {
        const query = text.substring(lastAtIndex + 1, caretPos);
        
        if (!query.includes(' ')) {
            activeMentionField = fieldType;
            atMentionState.isActive = true;
            atMentionState.startPos = lastAtIndex;
            atMentionState.searchQuery = query;
            showMentionDropdown(query, element, fieldType);
            return;
        }
    }
    
    hideAllDropdowns();
}

// 4. Hàm kết xuất danh sách giao diện Dropdown
function showMentionDropdown(query, element, fieldType) {
    const dropdown = document.getElementById(`${fieldType}-dropdown`);
    if (!dropdown) return;

    const filtered = parentDatabase.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) || 
        p.child.toLowerCase().includes(query.toLowerCase())
    );

    if (filtered.length === 0) {
        dropdown.classList.add('hidden');
        dropdown.style.display = 'none';
        return;
    }

    dropdown.innerHTML = '';
    dropdown.classList.remove('hidden');
    dropdown.style.display = 'block'; // Hiện lại danh sách công khai bằng CSS inline

    filtered.forEach((parent, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `w-full text-left px-4 py-2.5 text-xs md:text-sm hover:bg-indigo-50 text-gray-700 dark:text-[#CAC4D0] flex items-center justify-between border-b border-gray-50 last:border-none ${index === 0 ? 'bg-indigo-50/30' : ''}`;
        
        btn.innerHTML = `
            <div>
                <span class="font-bold text-gray-900 dark:text-[#E6E0E9]">Phụ huynh: ${parent.name}</span>
                <span class="block text-xs text-gray-400">Học sinh: ${parent.child}</span>
            </div>
            <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-md">Chọn</span>
        `;
        
        // Bọc trong function để thực thi đồng thời chèn nội dung và dập tắt dropdown lập tức
        btn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            insertMention(parent.name, element, fieldType, parent.id);
            hideAllDropdowns();
        };
        
        dropdown.appendChild(btn);
    });
}

// Đóng nhanh bằng phím Esc
function handleFieldKeyDown(event, element) {
    if (atMentionState.isActive && event.key === 'Escape') {
        event.preventDefault();
        hideAllDropdowns();
    }
}

// Đóng modal
function closeNotifModal() {
    const modal = document.getElementById('notif-modal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    modal.firstElementChild.classList.add('scale-95');
    setTimeout(() => { document.getElementById('modal-container').innerHTML = ''; }, 300);
}

// Phát hành thông báo (Modal)
function handleSendNotification(event) {
    event.preventDefault();

    const title = document.getElementById('notif-title').value;
    const receiver = document.getElementById('notif-receiver').value; 
    const sender = document.getElementById('notif-sender').value;
    const content = document.getElementById('notif-content').value; 

    const now = new Date();

    const newNotif = {
        title: title,
        author: sender,
        createdAt: now.toISOString(),
        summary: content.length > 70 ? content.substring(0, 70) + "..." : content,
        body: content,
        receiver: selectedTargetId || receiver
    };

    push(ref(db, 'notifications'), newNotif)
        .then(() => {
            closeNotifModal();
            
            alert("Đã gửi thông báo thành công!");
        })
        .catch(e => alert("Lỗi khi gửi: " + e.message));
}

// Đăng thông báo nhanh (Quick Form)
function postAnnouncement(event) {
    event.preventDefault();

    const title = document.getElementById('ann-title').value;
    const receiver = document.getElementById('ann-receiver').value;
    const summary = document.getElementById('ann-summary').value;
    const body = document.getElementById('ann-body').value;
    const category = document.getElementById('ann-category').value;

    let catPrefix = "";
    if (category === "urgent") catPrefix = "⚠️ [KHẨN CẤP] ";
    if (category === "system") catPrefix = "🔒 [BẢO MẬT] ";

    const now = new Date();

    const newNotif = {
        title: catPrefix + title,
        author: sender, 
        createdAt: now.toISOString(),
        summary: summary,
        body: body,
        receiver: selectedTargetId || receiver
    };

    push(ref(db, 'notifications'), newNotif)
        .then(() => {
            document.getElementById('announcement-form').reset();
            document.getElementById('ann-receiver').value = "Lớp chủ nhiệm (9A1)"; 

            const successAlert = document.getElementById('announce-success');
            if (successAlert) {
                successAlert.classList.remove('hidden');
                setTimeout(() => {
                    successAlert.classList.add('hidden');
                }, 3000);
            }
        })
        .catch(e => alert("Lỗi khi gửi: " + e.message));
}

// Kích hoạt nạp dữ liệu lần đầu
document.addEventListener('DOMContentLoaded', () => {
    renderNotificationList();
});

document.addEventListener('DOMContentLoaded', () => {
    loadNotifications((notificationsList) => {
        const filteredList = filterNotificationsByRole(notificationsList, currentUserGroup);
        notifications = filteredList; 
        
        // 2. Tiến hành vẽ danh sách đã lọc lên màn hình
        renderNotificationList(filteredList);
    });
});

// Gắn hàm vào window để gọi từ HTML
window.deleteNotification = deleteNotification;
window.openCreateNotificationModal = openCreateNotificationModal;
window.closeNotifModal = closeNotifModal;
window.handleSendNotification = handleSendNotification;
window.postAnnouncement = postAnnouncement;
window.handleFieldInput = handleFieldInput;
window.handleFieldKeyDown = handleFieldKeyDown;