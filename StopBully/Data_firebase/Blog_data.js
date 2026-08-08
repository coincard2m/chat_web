import { db, ref, onValue } from '/js/script.js';

const categoryMap = {
    'Knowledge': '📘 Kiến thức',
    'Prevention': '🛡️ Phòng ngừa',
    'Skills': '💪 Kỹ năng tự vệ',
    'Law': '⚖️ Pháp luật & Quy chế'
};

export function loadArticlesAndCarousel(onDataLoaded) {
    const propagandaRef = ref(db, 'bai_tuyen_truyen');
    
    // onValue giúp lắng nghe dữ liệu liên tục theo thời gian thực (realtime)
    onValue(propagandaRef, (snapshot) => {
        let allArticles = []; // Reset mảng tạm
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            // Duyệt qua từng bài viết được lưu trữ với ID tự động sinh bởi push()
            for (const key in data) {
                const item = data[key];
                allArticles.push({
                    id: key, // Lưu lại mã khóa Firebase (chứa chuỗi ngẫu nhiên độc nhất)
                    title: item.title || '',
                    summary: item.summary || '',
                    body: item.body || '',
                    image: item.image || '',
                    category: item.category || 'Prevention',
                    categoryName: categoryMap[item.category] || '🛡️ Phòng ngừa',
                    timeAgo: item.timeAgo || 'Vừa xong',
                    author: item.author || 'Ban biên tập'
                });
            }
        }
        // Sắp xếp bài mới nhất lên đầu (nếu có thời gian) và vẽ lại giao diện
        allArticles.reverse();

        // Cập nhật CAROUSEL tự động
        const latestThree = allArticles.slice(0, 3);
        let featuredSlides = []

        if (latestThree.length > 0) {
            featuredSlides = latestThree.map(art => ({
                id: art.id,
                title: art.title,
                description: art.summary,
                image: art.image || 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=1200&auto=format&fit=crop',
                tag: art.categoryName || '🔥 Tin mới',
                badgeColor: 'bg-indigo-600'
            }));
        } else {
            // Nếu Firebase trống, hiển thị slide mặc định
            featuredSlides = [{
                id: 'default',
                title: "Chào mừng đến với hệ thống tuyên truyền học đường",
                description: "Chưa có bài viết nào được đăng tải. Hãy thêm bài viết mới để hiển thị tại đây.",
                image: "https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=1200&auto=format&fit=crop",
                tag: "📢 Thông báo",
                badgeColor: "bg-gray-600"
            }];
        }

        if (typeof onDataLoaded === 'function') {
            onDataLoaded(allArticles, featuredSlides);
        }

    }, (error) => {
        console.error("Lỗi khi tải dữ liệu từ Firebase: ", error);
    });
}