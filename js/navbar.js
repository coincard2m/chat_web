function initNavbar() {

    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const closeBtn = document.getElementById('close-sidebar');

    if (toggleBtn && sidebar) {
        // Mở sidebar
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.remove('-translate-x-full');
            toggleBtn.style.display = 'none';
        });
    }

    // Đóng sidebar
    function closeSidebar() {
        if(sidebar && toggleBtn) {
            sidebar.classList.add('-translate-x-full');
            toggleBtn.style.display = 'flex';
        }
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeSidebar);
    }

    // Click ra ngoài
    document.addEventListener('click', (e) => {
        if (sidebar && toggleBtn) {
            if (
                !sidebar.contains(e.target) &&
                !toggleBtn.contains(e.target)
            ) {
                closeSidebar();
            }
        }
    });

    // Cập nhật thông tin người dùng lên sidebar
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
        import('/js/script.js').then(({ db, ref, get }) => {
            get(ref(db, `users/${currentUser}`)).then(snapshot => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const nameEl = document.getElementById('sidebar-user-name');
                    const roleEl = document.getElementById('sidebar-user-role');
                    
                    if (nameEl) nameEl.textContent = data.name || currentUser;
                    if (roleEl) {
                        const roleMap = {
                            'admin': 'Quản trị viên',
                            'school': 'Ban Giám Hiệu / GV',
                            'parent': 'Phụ huynh',
                            'student': data.roleClass ? `Học sinh - ${data.roleClass}` : 'Học sinh'
                        };
                        roleEl.textContent = roleMap[data.role] || data.roleClass || 'Học sinh';
                    }
                    if (data.avatar) {
                        window.updateNavbarAvatar(data.avatar);
                    }
                }
            });
        }).catch(err => console.error("Lỗi cập nhật profile sidebar:", err));
    }

    // --- HIỆU ỨNG ACTIVE MENU ---
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('nav a:not(.logo-link), #sidebar a:not(.logo-link)');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && (href === currentPath || (currentPath === '' && href === 'index.html'))) {
            // Xóa các class mặc định
            link.classList.remove('text-gray-700', 'dark:text-[#CAC4D0]', 'hover:bg-indigo-50', 'dark:hover:bg-indigo-900/30', 'hover:text-indigo-700', 'dark:hover:text-indigo-400', 'font-medium');
            
            // Thêm class active
            link.classList.add('bg-indigo-100', 'text-indigo-800', 'dark:bg-indigo-900/60', 'dark:text-indigo-300', 'font-bold', 'shadow-sm');
        }
    });
}

window.handleLogout = function() {
    if (confirm('Bạn có chắc muốn đăng xuất khỏi hệ thống?')) {
        localStorage.clear();
        // Redirect to index.html at root
        window.location.href = '/index.html';
    }
};

// --- DARK MODE LOGIC ---
function toggleDarkMode() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
}
window.toggleDarkMode = toggleDarkMode;

// Khởi tạo trạng thái giao diện ban đầu
(function initTheme() {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    
    if (localStorage.getItem('lowPerformance') === 'true') {
        document.documentElement.classList.add('low-perf');
        if (document.body) document.body.classList.add('low-perf');
    } else {
        document.documentElement.classList.remove('low-perf');
        if (document.body) document.body.classList.remove('low-perf');
    }
})();

// Đồng bộ trạng thái low-perf sau khi body được render
document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem('lowPerformance') === 'true') {
        if (document.body) document.body.classList.add('low-perf');
    }
});

