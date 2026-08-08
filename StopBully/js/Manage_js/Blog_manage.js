import { loadArticlesAndCarousel } from '/Data_firebase/Blog_data.js';
import { db, ref, set, push, remove, update } from '/js/script.js';

// Danh sách các bài viết
let featuredSlides = []
let allArticles = [];

const ADMIN_PERMISSIONS = {
    canAdd: true,     
    canEdit: true,    
    canDelete: true   
};


// 1. LẤY DỮ LIỆU THỜI GIAN THỰC TỪ FIREBASE ('bai_tuyen_truyen')
document.addEventListener('DOMContentLoaded', () => {
    // Gọi hàm gộp chung, nhận về danh sách bài viết (articles) và danh sách slide (slides)
    loadArticlesAndCarousel((articles, slides) => {
        allArticles = articles;
        featuredSlides = slides;

        initCarousel();   // Vẽ lại Slider tự động
        renderArticles(); // Vẽ lại danh sách bài viết ngoài lưới
    });

    const btnAddArticle = document.getElementById('btn-add-article');
    if (btnAddArticle) {
        if (ADMIN_PERMISSIONS.canAdd) {
            btnAddArticle.style.display = 'flex';
            btnAddArticle.setAttribute('onclick', 'openCreateArticleModal()');
        } else {
            btnAddArticle.style.display = 'none';
        }
    }

    const modal = document.getElementById('article-modal');
    if (modal) { modal.addEventListener('click', (e) => { if (e.target === modal) closeArticleModal(); }); }
});

// 2. LOGIC ĐIỀU KHIỂN CAROUSEL (SLIDER)
let currentSlide = 0;
let carouselTimer = null;

function initCarousel() {
    const wrapper = document.getElementById('carousel-wrapper');
    const indicators = document.getElementById('carousel-indicators');
    if (!wrapper) return;

    wrapper.innerHTML = '';
    indicators.innerHTML = '';

    featuredSlides.forEach((slide, index) => {
        const slideItem = document.createElement('div');
        slideItem.className = 'w-full h-full shrink-0 relative flex items-end cursor-pointer';
        slideItem.onclick = () => {
            if (ADMIN_PERMISSIONS.canEdit) {
                openEditArticleModal(slide.id, true);
            } else {
                openArticleModal(slide.id);
            }
        };
        slideItem.innerHTML = `
            <img src="${slide.image}" alt="${slide.title}" class="absolute inset-0 w-full h-full object-cover">
            <div class="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-950/40 to-transparent"></div>
            <div class="relative z-10 p-6 sm:p-8 text-white max-w-2xl space-y-2">
                <span class="px-2.5 py-1 ${slide.badgeColor || 'bg-indigo-600'} text-white text-xs font-bold rounded-lg uppercase tracking-wide">
                    ${slide.tag}
                </span>
                <h2 class="text-base sm:text-xl md:text-2xl font-bold line-clamp-2 drop-shadow-sm">
                    ${slide.title}
                </h2>
                <p class="text-xs sm:text-sm text-gray-200 line-clamp-2 font-light hidden sm:block">
                    ${slide.description}
                </p>
            </div>
        `;
        wrapper.appendChild(slideItem);

        const dot = document.createElement('button');
        dot.className = `w-2.5 h-2.5 rounded-full transition-all duration-300 ${index === 0 ? 'bg-indigo-600 w-6' : 'bg-white dark:bg-[#211F26]/50 hover:bg-white dark:bg-[#211F26]'}`;
        dot.onclick = (e) => { e.stopPropagation(); goToSlide(index); };
        indicators.appendChild(dot);
    });
    startAutoSlide();
}

function updateCarouselPosition() {
    const wrapper = document.getElementById('carousel-wrapper');
    if (!wrapper) return;
    wrapper.style.transform = `translateX(-${currentSlide * 100}%)`;
    const dots = document.querySelectorAll('#carousel-indicators button');
    dots.forEach((dot, idx) => {
        dot.className = idx === currentSlide ? 'w-2.5 h-2.5 rounded-full transition-all duration-300 bg-indigo-600 w-6' : 'w-2.5 h-2.5 rounded-full transition-all duration-300 bg-white dark:bg-[#211F26]/50 hover:bg-white dark:bg-[#211F26]';
    });
}
function nextSlide() { if (featuredSlides.length === 0) return; currentSlide = (currentSlide + 1) % featuredSlides.length; updateCarouselPosition(); resetAutoSlide(); }
function prevSlide() { if (featuredSlides.length === 0) return; currentSlide = (currentSlide - 1 + featuredSlides.length) % featuredSlides.length; updateCarouselPosition(); resetAutoSlide(); }
function goToSlide(index) { currentSlide = index; updateCarouselPosition(); resetAutoSlide(); }
function startAutoSlide() { if (featuredSlides.length > 0) { carouselTimer = setInterval(nextSlide, 5000); } }
function resetAutoSlide() { clearInterval(carouselTimer); startAutoSlide(); }


// 3. LOGIC LỌC, TÌM KIẾM VÀ RENDER GRID

let currentCategory = 'All';

function renderArticles(filterText = '') {
    const grid = document.getElementById('articles-grid');
    const countSpan = document.getElementById('article-count');
    const emptyState = document.getElementById('empty-state');
    if (!grid) return;

    grid.innerHTML = '';
    
    const filtered = allArticles.filter(art => {
        const matchesCategory = currentCategory === 'All' || art.category === currentCategory;
        const matchesSearch = art.title.toLowerCase().includes(filterText.toLowerCase()) || art.summary.toLowerCase().includes(filterText.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    countSpan.textContent = filtered.length;
    if (filtered.length === 0) { grid.classList.add('hidden'); emptyState.classList.remove('hidden'); return; }
    grid.classList.remove('hidden'); emptyState.classList.add('hidden');

    filtered.forEach(art => {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-[#211F26] border border-gray-100 dark:border-[#49454F]/50 rounded-2xl shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col group';
        
        // Hiện nút Xóa nếu có quyền
        const deleteButtonHtml = ADMIN_PERMISSIONS.canDelete 
            ? `<button onclick="deleteArticleWithReason(event, '${art.id}')" class="absolute top-3 right-3 w-8 h-8 rounded-xl bg-white dark:bg-[#211F26]/90 backdrop-blur-md text-red-500 hover:bg-red-50 hover:text-red-600 shadow-sm flex items-center justify-center transition active:scale-90" title="Xóa bài viết">🗑️</button>` 
            : '';

        // Hiện nút Sửa nếu có quyền
        const editButtonHtml = ADMIN_PERMISSIONS.canEdit 
            ? `<button onclick="openEditArticleModal('${art.id}', false)" class="px-3 py-1.5 border border-indigo-100 text-indigo-600 hover:bg-indigo-50 active:scale-95 rounded-xl text-xs font-semibold transition-all">✏️ Sửa</button>` 
            : '';

        card.innerHTML = `
            <div class="relative aspect-video w-full overflow-hidden bg-gray-100 dark:bg-[#211F26]">
                <img src="${art.image || 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=600&auto=format&fit=crop'}" alt="${art.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <span class="absolute top-3 left-3 px-2.5 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg uppercase tracking-wider">
                    ${art.categoryName}
                </span>
                ${deleteButtonHtml}
            </div>
            <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div class="space-y-2">
                    <h3 class="text-base md:text-lg font-bold text-gray-900 dark:text-[#E6E0E9] group-hover:text-indigo-700 transition-colors line-clamp-2">
                        ${art.title}
                    </h3>
                    <p class="text-xs md:text-sm text-gray-500 dark:text-[#CAC4D0] line-clamp-3 leading-relaxed">
                        ${art.summary}
                    </p>
                </div>
                <div class="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-[#49454F]/50">
                    <span class="text-xs text-gray-400 font-medium">⏱️ ${art.timeAgo || 'Vừa xong'}</span>
                    <div class="flex gap-2">
                        ${editButtonHtml}
                        <button onclick="openArticleModal('${art.id}')" class="px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:scale-95 rounded-xl text-xs font-semibold transition-all flex items-center gap-1">
                            Xem Chi Tiết ➜
                        </button>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function handleSearch() { renderArticles(document.getElementById('search-input').value); }
function filterCategory(category) {
    currentCategory = category;
    const buttons = document.querySelectorAll('.category-btn');
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick').includes(category)) {
            btn.className = 'category-btn px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold transition-all active:scale-95';
        } else {
            btn.className = 'category-btn px-4 py-2 bg-white dark:bg-[#211F26] border border-gray-100 dark:border-[#49454F]/50 text-gray-600 dark:text-[#CAC4D0] hover:bg-gray-50 dark:bg-[#141218] dark:hover:bg-[#36343B] dark:bg-[#141218] rounded-xl text-xs font-semibold transition-all active:scale-95';
        }
    });
    renderArticles(document.getElementById('search-input').value);
}


// 4. LOGIC THÊM MỚI BÀI VIẾT & SỬA MODAL

// Mở form trống để THÊM MỚI BÀI VIẾT hoàn toàn
function openCreateArticleModal() {
    const modal = document.getElementById('article-modal');
    const modalContent = modal.querySelector('.dynamic-modal-content');

    // Reset sạch các trường dữ liệu đầu vào trong form
    document.getElementById('article-id').value = ''; // ID rỗng biểu thị đây là tạo mới bài viết
    document.getElementById('input-title').value = '';
    document.getElementById('input-image').value = '';
    document.getElementById('input-category').value = 'Prevention';
    document.getElementById('input-content').value = '';

    // Cấu hình giao diện sang chế độ form điền thông tin
    document.getElementById('modal-read-container').classList.add('hidden');
    document.getElementById('article-form').classList.remove('hidden');
    document.getElementById('btn-admin-submit').classList.remove('hidden');
    
    document.getElementById('modal-badge').textContent = "Tạo bài tuyên truyền mới";
    document.getElementById('modal-image').src = '';

    showModalEffect(modal, modalContent);
}

// Mở form Sửa bài viết hiện có
function openEditArticleModal(id, isSlide = false) {
    const article = isSlide ? featuredSlides.find(s => s.id === id) : allArticles.find(a => a.id === id);
    if (!article) return;

    const modal = document.getElementById('article-modal');
    const modalContent = modal.querySelector('.dynamic-modal-content');

    document.getElementById('article-id').value = article.id;
    document.getElementById('input-title').value = article.title;
    document.getElementById('input-image').value = article.image;
    document.getElementById('input-category').value = article.category || 'Prevention';
    document.getElementById('input-content').value = (article.body || article.description || '').replace(/<[^>]*>/g, '');

    const inputAuthor = document.getElementById('input-author');
    if (inputAuthor) {
        inputAuthor.value = article.author || '';
    }

    const inputSummary = document.getElementById('input-summary');
    if (inputSummary) {
        inputSummary.value = article.summary || '';
    }

    document.getElementById('modal-read-container').classList.add('hidden');
    document.getElementById('article-form').classList.remove('hidden');
    document.getElementById('btn-admin-submit').classList.remove('hidden');
    
    document.getElementById('modal-badge').textContent = "Chế độ hiệu chỉnh";
    document.getElementById('modal-image').src = article.image || 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=600&auto=format&fit=crop';

    showModalEffect(modal, modalContent);
}

// Lưu dữ liệu (Hỗ trợ cả THÊM bài mới và SỬA bài cũ)
function saveArticle(event) {
    event.preventDefault();
    const id = document.getElementById('article-id').value;
    const title = document.getElementById('input-title').value;
    const image = document.getElementById('input-image').value || 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=600&auto=format&fit=crop';
    const category = document.getElementById('input-category').value;
    const content = document.getElementById('input-content').value;
    const author = document.getElementById('input-author') ? document.getElementById('input-author').value : 'Ban biên tập';

    const summaryInput = document.getElementById('input-summary');
    const summary = summaryInput && summaryInput.value.trim() !== '' 
        ? summaryInput.value 
        : summaryInput.substring(0, 150) + '...';
    if (id) {
        // SỬA BÀI CŨ
        const articleRef = ref(db, `bai_tuyen_truyen/${id}`);
        update(articleRef, {
            title: title,
            image: image,
            category: category,
            summary: summary,
            author: author,
            body: `<p>${content}</p>`,
            timeAgo: "Đã cập nhật"
        }).then(() => {
            alert("Đã cập nhật bài tuyên truyền thành công!");
            closeArticleModal();
        }).catch(err => alert("Lỗi: " + err.message));
    } else {
        // --- [THÊM BÀI MỚI HOÀN TOÀN] ---
        const propagandaRef = ref(db, 'bai_tuyen_truyen');
        const newArticleRef = push(propagandaRef);
        set(newArticleRef, {
            title: title,
            summary: content.substring(0, 150) + '...',
            body: `<p>${content}</p>`,
            image: image,
            category: category,
            summary: summary,
            author: author,
            timeAgo: "Vừa xong"
        }).then(() => {
            alert("Đã thêm bài tuyên truyền thành công lên Firebase!");
            closeArticleModal();
        });
    }
}


// 5. LOGIC XÓA BÀI VIẾT KÈM LÝ DO THU HỒI
function deleteArticleWithReason(event, id) {
    event.stopPropagation(); // Ngăn sự kiện click lan ra thẻ bọc ngoài

    const targetArticle = allArticles.find(art => art.id === id);
    if (!targetArticle) return;

    // Hiển thị hộp thoại Input gốc của trình duyệt để yêu cầu nhập lý do xóa bài viết
    const reason = prompt(`Bạn đang yêu cầu xóa bài viết:\n"${targetArticle.title}"\n\nVui lòng ghi rõ lý do xóa bài viết này để lưu nhật ký hệ thống:`);
    
    // Nếu người quản trị nhấn Hủy (Cancel) hoặc không ghi bất kỳ lý do gì
    if (reason === null) return;
    if (reason.trim() === "") {
        alert("Thao tác hủy bỏ! Bắt buộc phải nhập lý do cụ thể mới có thể tiến hành xóa bài viết.");
        return;
    }

    // Thực hiện xóa bài viết khỏi danh sách mảng tạm nội bộ Local
    const articleRef = ref(db, `bai_tuyen_truyen/${id}`);
    remove(articleRef).then(() => {
        // Lưu lịch sử lý do xóa vào thư mục 'logs_deletion'
        const logRef = ref(db, 'logs_deletion');
        push(logRef, {
            articleId: id,
            title: targetArticle.title,
            reason: reason,
            deletedAt: new Date().toISOString()
        });

        alert(`Hệ thống đã thực thi xóa bài viết thành công!\nLý do ghi nhận: "${reason}"`);
    }).catch((error) => {
        alert("Lỗi khi xóa: " + error.message);
    });

    
}

// 6. KHỞI TẠO ĐỒNG BỘ GIAO DIỆN
function openArticleModal(id) {
    const article = allArticles.find(a => a.id === id) || featuredSlides.find(s => s.id === id);
    if (!article) return;
    const modal = document.getElementById('article-modal');
    const modalContent = modal.querySelector('.dynamic-modal-content');
    document.getElementById('article-form').classList.add('hidden');
    document.getElementById('modal-read-container').classList.remove('hidden');
    document.getElementById('btn-admin-submit').classList.add('hidden');
    document.getElementById('modal-title').textContent = article.title;
    document.getElementById('modal-image').src = article.image || 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=600&auto=format&fit=crop';
    document.getElementById('modal-body').innerHTML = article.body || `<p>${article.description || 'Nội dung đang được cập nhật...'}</p>`;
    document.getElementById('modal-badge').textContent = article.categoryName || article.tag || 'Cẩm nang';
    document.getElementById('modal-time').innerHTML = `⏱️ ${article.timeAgo || '5 phút đọc'}`;
    showModalEffect(modal, modalContent);
}

function closeArticleModal() {
    const modal = document.getElementById('article-modal');
    if (!modal) return;
    const modalContent = modal.querySelector('.dynamic-modal-content');
    if (modalContent) { modalContent.classList.remove('scale-100', 'opacity-100'); modalContent.classList.add('scale-95', 'opacity-0'); }
    setTimeout(() => { modal.classList.remove('flex'); modal.classList.add('hidden'); }, 250);
}
function showModalEffect(modal, modalContent) {
    modal.classList.remove('hidden'); modal.classList.add('flex');
    setTimeout(() => { if (modalContent) { modalContent.classList.remove('scale-95', 'opacity-0'); modalContent.classList.add('scale-100', 'opacity-100'); } }, 20);
}

window.initCarousel = initCarousel;
window.updateCarouselPosition = updateCarouselPosition;
window.renderArticles = renderArticles;
window.handleSearch = handleSearch;
window.openCreateArticleModal = openCreateArticleModal;
window.openEditArticleModal = openEditArticleModal;
window.saveArticle = saveArticle;
window.deleteArticleWithReason = deleteArticleWithReason;
window.openArticleModal = openArticleModal;
window.closeArticleModal = closeArticleModal;
window.showModalEffect = showModalEffect;
window.nextSlide = nextSlide;
window.prevSlide = prevSlide;
window.goToSlide = goToSlide;
window.startAutoSlide = startAutoSlide;
window.resetAutoSlide = resetAutoSlide;
window.filterCategory = filterCategory;