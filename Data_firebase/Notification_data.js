import { db, ref, onValue, push, remove } from '/js/script.js';

/**
 * Lắng nghe và tải danh sách thông báo từ Firebase theo thời gian thực
 * @param {Function} onDataLoaded - Hàm nhận dữ liệu mảng thông báo sau khi đã xử lý
 */

export function loadNotifications(onDataLoaded) {
    onValue(ref(db, 'notifications'), (snapshot) => {
        let notifications = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const v = child.val();
                notifications.push({
                    id: child.key,
                    title: v.title,
                    sender: v.author || 'Hệ thống',
                    time: v.createdAt ? new Date(v.createdAt).toLocaleString('vi-VN') : '--',
                    summary: v.summary || '',
                    content: v.body || v.summary || '',
                    isUnread: true,
                    target: v.receiver || 'Tất cả',
                    firebaseKey: child.key
                });
            });
            // Sắp xếp bài mới nhất lên đầu
            notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        
        // Trả dữ liệu sạch về cho file giao diện hiển thị
        if (typeof onDataLoaded === 'function') {
            onDataLoaded(notifications);
        }
    });
}