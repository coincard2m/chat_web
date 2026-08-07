import { loadArticlesAndCarousel } from '/Data_firebase/Blog_data.js';
import { db, ref, set, push, remove, update } from '/js/script.js';

// Dữ liệu cho các Slide nổi bật ở trên đầu trang
let featuredSlides = []
let allArticles = [];

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
        // Tạo HTML cho mỗi Slide
        const slideItem = document.createElement('div');
        slideItem.className = 'w-full h-full shrink-0 relative flex items-end cursor-pointer';
        slideItem.onclick = () => {
            // Nếu slide gắn với bài viết thường thì cho phép click mở xem chi tiết luôn
            const matchedArticle = allArticles.find(a => a.id === slide.id);
            if (matchedArticle) openArticleModal(slide.id);
        };
        slideItem.innerHTML = `
            <img src="${slide.image}" alt="${slide.title}" class="absolute inset-0 w-full h-full object-cover">
            <div class="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-950/40 to-transparent"></div>
            <div class="relative z-10 p-6 sm:p-8 text-white max-w-2xl space-y-2">
                <span class="px-2.5 py-1 ${slide.badgeColor} text-white text-xs font-bold rounded-lg uppercase tracking-wide">
                    ${slide.tag}
                </span>
                <h2 class="text-base sm:text-xl md:text-2xl font-bold line-clamp-1 sm:line-clamp-2 drop-shadow-sm">
                    ${slide.title}
                </h2>
                <p class="text-xs sm:text-sm text-gray-200 line-clamp-2 font-light hidden sm:block">
                    ${slide.description}
                </p>
            </div>
        `;
        wrapper.appendChild(slideItem);

        // Tạo các nút chấm tròn bên dưới slide
        const dot = document.createElement('button');
        dot.className = `w-2.5 h-2.5 rounded-full transition-all duration-300 ${index === 0 ? 'bg-emerald-500 w-6' : 'bg-white dark:bg-[#211F26]/50 hover:bg-white dark:bg-[#211F26]'}`;
        dot.onclick = () => goToSlide(index);
        indicators.appendChild(dot);
    });

    startAutoSlide();
}

function updateCarouselPosition() {
    const wrapper = document.getElementById('carousel-wrapper');
    if (!wrapper) return;
    wrapper.style.transform = `translateX(-${currentSlide * 100}%)`;

    // Cập nhật lại thanh trạng thái dấu chấm tròn active
    const dots = document.querySelectorAll('#carousel-indicators button');
    dots.forEach((dot, idx) => {
        if (idx === currentSlide) {
            dot.className = 'w-2.5 h-2.5 rounded-full transition-all duration-300 bg-emerald-500 w-6';
        } else {
            dot.className = 'w-2.5 h-2.5 rounded-full transition-all duration-300 bg-white dark:bg-[#211F26]/50 hover:bg-white dark:bg-[#211F26]';
        }
    });
}

function nextSlide() {
    currentSlide = (currentSlide + 1) % featuredSlides.length;
    updateCarouselPosition();
    resetAutoSlide();
}

function prevSlide() {
    currentSlide = (currentSlide - 1 + featuredSlides.length) % featuredSlides.length;
    updateCarouselPosition();
    resetAutoSlide();
}

function goToSlide(index) {
    currentSlide = index;
    updateCarouselPosition();
    resetAutoSlide();
}

function startAutoSlide() {
    carouselTimer = setInterval(nextSlide, 5000); // Tự động trượt sau mỗi 5 giây
}

function resetAutoSlide() {
    clearInterval(carouselTimer);
    startAutoSlide();
}


// 3. LOGIC LỌC, TÌM KIẾM VÀ HIỂN THỊ GRID BÀI VIẾT
let currentCategory = 'All';

function renderArticles(filterText = '') {
    const grid = document.getElementById('articles-grid');
    const countSpan = document.getElementById('article-count');
    const emptyState = document.getElementById('empty-state');
    if (!grid) return;

    grid.innerHTML = '';
    
    // Lọc theo danh mục nút bấm và ô tìm kiếm chữ dữ liệu
    const filtered = allArticles.filter(art => {
        const matchesCategory = currentCategory === 'All' || art.category === currentCategory;
        const matchesSearch = art.title.toLowerCase().includes(filterText.toLowerCase()) || 
                             art.summary.toLowerCase().includes(filterText.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    countSpan.textContent = filtered.length;

    if (filtered.length === 0) {
        grid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    grid.classList.remove('hidden');
    emptyState.classList.add('hidden');

    filtered.forEach(art => {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-[#211F26] border border-gray-100 dark:border-[#49454F]/50 rounded-2xl shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col group';
        card.innerHTML = `
            <div class="relative aspect-video w-full overflow-hidden bg-gray-100 dark:bg-[#211F26]">
                <img src="${art.image}" alt="${art.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <span class="absolute top-3 left-3 px-2.5 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg uppercase tracking-wider">
                    ${art.categoryName}
                </span>
            </div>
            <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div class="space-y-2">
                    <h3 class="text-base md:text-lg font-bold text-gray-900 dark:text-[#E6E0E9] group-hover:text-emerald-700 transition-colors line-clamp-2">
                        ${art.title}
                    </h3>
                    <p class="text-xs md:text-sm text-gray-500 dark:text-[#CAC4D0] line-clamp-3 leading-relaxed">
                        ${art.summary}
                    </p>
                </div>
                <div class="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-[#49454F]/50">
                    <span class="text-xs text-gray-400 font-medium">⏱️ ${art.timeAgo}</span>
                    <button onclick="openArticleModal('${art.id}')" class="px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-95 rounded-xl text-xs font-semibold transition-all flex items-center gap-1">
                        Xem chi tiết ➜
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function handleSearch() {
    const text = document.getElementById('search-input').value;
    renderArticles(text);
}

function filterCategory(category) {
    currentCategory = category;
    
    // Thay đổi style nút đang được chọn tích cực
    const buttons = document.querySelectorAll('.category-btn');
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick').includes(category)) {
            btn.className = 'category-btn px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold transition-all active:scale-95';
        } else {
            btn.className = 'category-btn px-4 py-2 bg-white dark:bg-[#211F26] border border-gray-100 dark:border-[#49454F]/50 text-gray-600 dark:text-[#CAC4D0] hover:bg-gray-50 dark:bg-[#141218] dark:hover:bg-[#36343B] dark:bg-[#141218] rounded-xl text-xs font-semibold transition-all active:scale-95';
        }
    });

    const text = document.getElementById('search-input').value;
    renderArticles(text);
}

// 4. LOGIC ĐÓNG MỞ MODAL XEM CHI TIẾT (TÊN RIÊNG BIỆT)
function openArticleModal(id) {
    const article = allArticles.find(a => a.id === id) || featuredSlides.find(s => s.id === id);
    if (!article) return;

    const modal = document.getElementById('article-modal');
    const modalContent = modal.querySelector('.dynamic-modal-content');
    
    // Gán dữ liệu động vào Modal cấu trúc
    document.getElementById('modal-title').textContent = article.title;
    document.getElementById('modal-image').src = article.image;
    document.getElementById('modal-body').innerHTML = article.body || `<p>${article.description || 'Nội dung chi tiết đang được cập nhật...'}</p>`;
    document.getElementById('modal-badge').textContent = article.categoryName || article.tag || 'Cẩm nang';
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    setTimeout(() => {
        if (modalContent) {
            modalContent.classList.remove('scale-95', 'opacity-0');
            modalContent.classList.add('scale-100', 'opacity-100');
        }
    }, 20);
}

function closeArticleModal() {
    const modal = document.getElementById('article-modal');
    if (!modal) return;
    
    const modalContent = modal.querySelector('.dynamic-modal-content');
    if (modalContent) {
        modalContent.classList.remove('scale-100', 'opacity-100');
        modalContent.classList.add('scale-95', 'opacity-0');
    }
    
    setTimeout(() => {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }, 250);
}

// 5. LẮNG NGHE KHỞI CHẠY TRANG
document.addEventListener('DOMContentLoaded', () => {

    loadArticlesAndCarousel((articles, slides) => {
        allArticles = articles;
        featuredSlides = slides;
        initCarousel();   // Vẽ lại Slider tự động
        renderArticles(); // Vẽ lại danh sách bài viết ngoài lưới
    });

    const modal = document.getElementById('article-modal');
    if (modal) { modal.addEventListener('click', (e) => { if (e.target === modal) closeArticleModal(); }); }
});

window.initCarousel = initCarousel;
window.updateCarouselPosition = updateCarouselPosition;
window.renderArticles = renderArticles;
window.handleSearch = handleSearch;
window.openArticleModal = openArticleModal;
window.closeArticleModal = closeArticleModal;
window.nextSlide = nextSlide;
window.prevSlide = prevSlide;
window.goToSlide = goToSlide;
window.startAutoSlide = startAutoSlide;
window.resetAutoSlide = resetAutoSlide;
window.filterCategory = filterCategory;