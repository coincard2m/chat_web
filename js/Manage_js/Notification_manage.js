import { db, ref, onValue, push, remove } from '/js/script.js';
import { loadNotifications } from '/Data_firebase/Notification_data.js';

// 1. Dữ liệu thông báo (khởi tạo rỗng, sẽ cập nhật từ Firebase)
let notifications = [];

// Lắng nghe Firebase realtime
document.addEventListener('DOMContentLoaded', () => {
    loadNotifications((notificationsList) => {
        // Lưu dữ liệu nhận được từ file data vào biến toàn cục
        notifications = notificationsList;
        // Tiến hành vẽ danh sách ra màn hình (Quản trị viên thấy toàn bộ)
        renderNotificationList();
    });
});


// Danh sách các đối tượng khi gõ @
const mentionDatabase = [
    { id: "all_students", name: "toàn thể học sinh", type: "Nhóm đối tượng" },
    { id: "all_teachers", name: "giáo viên", type: "Nhóm đối tượng" },
    { id: "all_parents", name: "phụ huynh", type: "Nhóm đối tượng" },
    { id: "all_admins", name: "quản trị", type: "Nhóm đối tượng" },
    { id: "all", name: "tất cả", type: "Toàn trường" }
];

// Biến toàn cục theo dõi trạng thái bộ gõ @
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
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
        <div id="notif-modal" class="fixed inset-0 z-[50] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm opacity-0 transition-opacity duration-300">
            <div class="bg-white dark:bg-[#211F26] rounded-3xl shadow-xl w-full max-w-lg overflow-hidden transform scale-95 transition-transform duration-300">
                
                <div class="bg-indigo-950 text-white p-5 flex items-center justify-between">
                    <div>
                        <h3 class="text-lg font-bold">Gửi thông báo quản trị</h3>
                        <p class="text-xs text-indigo-200 mt-0.5">Kênh thông báo chính thức từ Nhà trường</p>
                    </div>
                    <button onclick="closeNotifModal()" class="text-white/70 hover:text-white text-xl">✕</button>
                </div>

                <form id="create-notif-form" class="p-6 space-y-4" onsubmit="handleSendNotification(event)">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-[#CAC4D0] uppercase tracking-wider mb-1.5">Tiêu đề thông báo</label>
                        <input type="text" id="notif-title" required placeholder="Ví dụ: Thông báo lịch nghỉ học toàn trường..." 
                            class="w-full px-4 py-2.5 border border-gray-200 dark:border-[#49454F]/50 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                    </div>

                    <!-- Ô NHẬP NGƯỜI NHẬN RIÊNG BIỆT -->
                    <div class="relative">
                        <label class="block text-xs font-bold text-gray-700 dark:text-[#CAC4D0] uppercase tracking-wider mb-1.5">Đến (Người nhận) - Gõ @ để chọn</label>
                        <input type="text" id="notif-receiver" required value="Toàn thể phụ huynh học sinh" 
                            placeholder="Gõ @ để chọn đối tượng nhận..." 
                            class="w-full px-4 py-2.5 border border-gray-200 dark:border-[#49454F]/50 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            oninput="handleFieldInput(this, 'receiver')"
                            onkeydown="handleFieldKeyDown(event, this)"/>
                        
                        <div id="receiver-dropdown" class="hidden absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#211F26] border border-gray-200 dark:border-[#49454F]/50 rounded-2xl shadow-xl max-h-48 overflow-y-auto z-[65]"></div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-[#CAC4D0] uppercase tracking-wider mb-1.5">Người gửi</label>
                        <input type="text" id="notif-sender" value="Quản trị viên nhà trường" required readonly
                            class="w-full px-4 py-2.5 border border-gray-100 dark:border-[#49454F]/50 bg-gray-50 dark:bg-[#141218] text-gray-500 dark:text-[#CAC4D0] rounded-xl text-sm focus:outline-none" />
                    </div>

                    <!-- Khung Nội dung -->
                    <div class="relative">
                        <label class="block text-xs font-bold text-gray-700 dark:text-[#CAC4D0] uppercase tracking-wider mb-1.5">Nội dung chi tiết</label>
                        <textarea id="notif-content" rows="4" required 
                            placeholder="Nhập nội dung thông báo từ Nhà trường, gõ @ để nhắc đến nhóm đối tượng..." 
                            class="w-full px-4 py-2.5 border border-gray-200 dark:border-[#49454F]/50 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                            oninput="handleFieldInput(this, 'content')"
                            onkeydown="handleFieldKeyDown(event, this)"></textarea>
                        
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
    }, 20);
}

// Ẩn tất cả Dropdown
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

// Hàm chèn tên đối tượng đã được SỬA LỖI
function insertMention(name, element, fieldType) {
    const text = element.value;
    const cursorPos = element.selectionStart;
    
    const textBeforeCursor = text.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
        const beforeAt = text.substring(0, atIndex);
        const afterCursor = text.substring(cursorPos);
        
        // Viết hoa chữ cái đầu cho đẹp văn bản
        const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
        let replacement = "";

        if (fieldType === 'receiver' || fieldType === 'ann-receiver') {
            replacement = `${formattedName} `;
            // Nếu ô nhận đang giữ giá trị mặc định thì thay thế toàn bộ luôn
            if (text === "Toàn thể phụ huynh học sinh" || text.startsWith("Tất cả")) {
                element.value = replacement;
                hideAllDropdowns();
                element.focus();
                return;
            }
        } else {
            replacement = `[@${formattedName}] `;
        }
        
        element.value = beforeAt + replacement + afterCursor;
        
        element.focus();
        const newCursorPos = atIndex + replacement.length;
        element.setSelectionRange(newCursorPos, newCursorPos);
    }
    
    hideAllDropdowns();
}

// Kiểm tra sự kiện gõ phím ô nhập liệu
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

// Kết xuất danh sách giao diện Dropdown
function showMentionDropdown(query, element, fieldType) {
    const dropdown = document.getElementById(`${fieldType}-dropdown`);
    if (!dropdown) return;

    const filtered = mentionDatabase.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) || 
        p.type.toLowerCase().includes(query.toLowerCase())
    );

    if (filtered.length === 0) {
        dropdown.classList.add('hidden');
        dropdown.style.display = 'none';
        return;
    }

    dropdown.innerHTML = '';
    dropdown.classList.remove('hidden');
    dropdown.style.display = 'block';

    filtered.forEach((item, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `w-full text-left px-4 py-2.5 text-xs md:text-sm hover:bg-indigo-50 text-gray-700 dark:text-[#CAC4D0] flex items-center justify-between border-b border-gray-50 last:border-none ${index === 0 ? 'bg-indigo-50/30' : ''}`;
        
        btn.innerHTML = `
            <div>
                <span class="font-bold text-gray-900 dark:text-[#E6E0E9]">${item.name}</span>
                <span class="block text-xs text-gray-400">${item.type}</span>
            </div>
            <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-md">Chọn</span>
        `;
        
        btn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            insertMention(item.name, element, fieldType);
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
    const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} - ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    const newNotif = {
        title: title,
        author: sender,
        createdAt: now.toISOString(),
        summary: content.length > 70 ? content.substring(0, 70) + "..." : content,
        body: content,
        receiver: receiver 
    };

    push(ref(db, 'notifications'), newNotif)
        .then(() => {
            closeNotifModal();
            alert("Đã gửi thông báo thành công!");
        })
        .catch(e => alert("Lỗi khi gửi: " + e.message));
}

// Đăng thông báo nhanh (Quick Form) - Đã sửa người gửi & mặc định
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
    const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} - ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    const newNotif = {
        title: catPrefix + title,
        author: "Quản trị viên nhà trường", 
        createdAt: now.toISOString(),
        summary: summary,
        body: body,
        receiver: receiver
    };

    push(ref(db, 'notifications'), newNotif)
        .then(() => {
            document.getElementById('announcement-form').reset();
            document.getElementById('ann-receiver').value = "Toàn thể phụ huynh học sinh"; 

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

// Lắng nghe click toàn màn hình để tự đóng dropdown khi click ra ngoài
document.addEventListener('click', (e) => {
    if (!e.target.closest('.relative')) {
        hideAllDropdowns();
    }
});

// Kích hoạt nạp dữ liệu lần đầu
document.addEventListener('DOMContentLoaded', () => {
    renderNotificationList();
});

// Gắn hàm vào window để gọi từ HTML
window.deleteNotification = deleteNotification;
window.openCreateNotificationModal = openCreateNotificationModal;
window.closeNotifModal = closeNotifModal;
window.handleSendNotification = handleSendNotification;
window.postAnnouncement = postAnnouncement;
window.handleFieldInput = handleFieldInput;
window.handleFieldKeyDown = handleFieldKeyDown;