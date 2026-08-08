import { db, ref, onValue } from '/js/script.js';

export function loadReportsAndTeacherData(onDataLoaded) {
    const reportsRef = ref(db, 'reports');

    // Lắng nghe dữ liệu báo cáo trực tiếp từ Firebase không cần điều kiện phụ
    onValue(reportsRef, (snapshot) => {
        let allReports = []; 

        if (snapshot.exists()) {
            const data = snapshot.val();
            for (const key in data) {
                allReports.push({ ...data[key], _key: key });
            }
        }

        // Sắp xếp: Khẩn cấp lên trước, sau đó đến mới nhất
        allReports.sort((a, b) => {
            if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
            if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
            return new Date(b.createdAt || 0) > new Date(a.createdAt || 0) ? -1 : 1;
        });

        // Trả dữ liệu về giao diện (để teacherClass tạm thời là rỗng để hiện tất cả báo cáo)
        if (typeof onDataLoaded === 'function') {
            onDataLoaded(allReports, '');
        }

    }, (error) => {
        console.error("Lỗi khi tải dữ liệu báo cáo từ Firebase: ", error);
    });
}