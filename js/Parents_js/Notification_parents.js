import { db, ref, onValue, push, remove } from '/js/script.js';
import { loadNotifications } from '/Data_firebase/Notification_data.js';

const listEl = document.getElementById('message-list');
const detailEl = document.getElementById('message-detail');
const unreadCountEl = document.getElementById('unread-count');

let readSet = new Set(JSON.parse(localStorage.getItem('parent_read_notifs') || '[]'));

const currentUserGroup = "all_parents"; 
let notifications = [];

const mentionDatabase = [
    { id: "all_students", name: "toàn thể học sinh", type: "Nhóm đối tượng" },
    { id: "all_teachers", name: "giáo viên", type: "Nhóm đối tượng" },
    { id: "all_parents", name: "phụ huynh", type: "Nhóm đối tượng" },
    { id: "all_admins", name: "quản trị", type: "Nhóm đối tượng" },
    { id: "all", name: "tất cả", type: "Toàn trường" }
];

// Live listen
document.addEventListener('DOMContentLoaded', () => {
    loadNotifications((notificationsList) => {
        const filteredList = filterNotificationsByRole(notificationsList, currentUserGroup);
        notifications = filteredList; 
        
        // 2. Tiến hành vẽ danh sách đã lọc lên màn hình
        renderMessages(filteredList);
    });
});

function filterNotificationsByRole(notificationsList, userGroup) {
    const groupInfo = mentionDatabase.find(g => g.id === userGroup);

    const currentRole = localStorage.getItem('role'); 
    const currentUsername = localStorage.getItem('currentUser');

    return notificationsList.filter(item => {
        const targetValue = (item.target || "").toLowerCase();

        if (targetValue.includes("tất cả") || targetValue.includes("all")) {
            return true;
        }
        // Kiểm tra xem target của thông báo có khớp với tên hoặc id nhóm quyền không
        if (groupInfo) {
            if (targetValue.includes(groupInfo.name.toLowerCase()) || targetValue.includes(groupInfo.id.toLowerCase())){
                return true;
            }
        }

        if (item.target) {
            // Phụ huynh phải đúng là chủ nhân của target mới được xem, sai tài khoản -> CẤM TUYỆT ĐỐI
            return item.target === currentUsername;
        }

        return false;
    });
}

function renderMessages(notifications) {
    if (!listEl) return;
    listEl.innerHTML = '';
    let unread = 0;

    if (notifications.length === 0) {
        listEl.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">Chưa có thông báo nào.</div>`;
        if (unreadCountEl) unreadCountEl.textContent = '0 chưa đọc';
        return;
    }
    
    const sortedNotifications = [...notifications].reverse();
    
    sortedNotifications.forEach(msg => {
        const isUnread = !readSet.has(msg.id);
        if (isUnread) unread++;

        const button = document.createElement('button');
        button.className = `w-full text-left rounded-2xl p-4 border transition-all ${isUnread ? 'bg-emerald-50/60 border-emerald-100' : 'bg-white dark:bg-[#211F26] border-gray-100 dark:border-[#49454F]/50'} hover:shadow-sm`;

        const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleDateString('vi-VN') : '';
        button.innerHTML = `
            <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                    <div class="font-semibold text-gray-900 dark:text-[#E6E0E9] text-sm flex items-center gap-2">
                        ${isUnread ? '<span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0 inline-block"></span>' : ''}
                        ${msg.title || 'Thông báo'}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-[#CAC4D0] mt-0.5">${msg.author || 'Hệ thống'} → <span class="text-emerald-600 font-medium">${msg.target || 'Tất cả'}</span></div>
                    <div class="text-sm text-gray-600 dark:text-[#CAC4D0] mt-1.5 line-clamp-2">${msg.summary || ''}</div>
                </div>
                <div class="text-xs text-gray-400 whitespace-nowrap shrink-0">${timeStr}</div>
            </div>
        `;
        button.addEventListener('click', () => showDetail(msg));
        listEl.appendChild(button);
    });

    if (unreadCountEl) unreadCountEl.textContent = `${unread} thông báo`;
}

function showDetail(msg) {
    if (!detailEl) return;
    readSet.add(msg.id);
    localStorage.setItem('parent_read_notifs', JSON.stringify([...readSet]));

    const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleString('vi-VN') : '';
    detailEl.innerHTML = `
        <div class="w-full">
            <div class="border-b border-gray-100 dark:border-[#49454F]/50 pb-4 mb-4">
                <span class="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg inline-block mb-3">🎯 Gửi tới: ${msg.target || 'Tất cả'}</span>
                <h4 class="text-xl font-bold text-gray-900 dark:text-[#E6E0E9]">${msg.title || 'Thông báo'}</h4>
                <div class="flex justify-between text-xs text-gray-400 mt-2 font-medium">
                    <span>Người gửi: <b>${msg.author || 'Hệ thống'}</b></span>
                    <span>${timeStr}</span>
                </div>
            </div>
            <div class="rounded-2xl bg-emerald-50 p-4 text-gray-700 dark:text-[#CAC4D0] leading-relaxed whitespace-pre-line">${msg.body || msg.summary || ''}</div>
        </div>
    `;
    // Re-render to update unread dots
    onValue(ref(db, 'notifications'), (snapshot) => {
        const all = [];
        if (snapshot.exists()) snapshot.forEach(c => all.push({ id: c.key, ...c.val() }));
        all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        renderMessages(all);
    }, { onlyOnce: true });
}