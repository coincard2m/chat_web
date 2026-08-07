function initSettingsComponent() {
    setTimeout(() => {
        const btnCloseSetting = document.getElementById('btn-close-setting');
        const settingComponent = document.getElementById('setting-component');
        const modalContainer = document.getElementById('modal-container');

        // Thêm hiệu ứng transition mượt mà
        if (settingComponent) {
            settingComponent.classList.add('transition-all', 'duration-300', 'transform');
        }

        // ====================== NÚT ĐÓNG ======================
        if (btnCloseSetting) {
            btnCloseSetting.onclick = function (e) {
                e.stopPropagation();
                closeSettingsModal();
            };
        }

        // ====================== XỬ LÝ TOGGLE (nếu cần logic sau này) ======================
        const toggles = document.querySelectorAll('#setting-component input[type="checkbox"]');
        toggles.forEach(toggle => {
            if (toggle.id === 'toggle-low-perf') {
                toggle.checked = localStorage.getItem('lowPerformance') === 'true';
                toggle.addEventListener('change', function () {
                    if (this.checked) {
                        localStorage.setItem('lowPerformance', 'true');
                        document.documentElement.classList.add('low-perf');
                        if (document.body) document.body.classList.add('low-perf');
                    } else {
                        localStorage.setItem('lowPerformance', 'false');
                        document.documentElement.classList.remove('low-perf');
                        if (document.body) document.body.classList.remove('low-perf');
                    }
                });
            } else {
                toggle.addEventListener('change', function () {
                    console.log(`Đã chuyển toggle "${this.parentElement.previousElementSibling?.textContent || 'Không rõ'}" thành:`, this.checked);
                });
            }
        });

        // ====================== XỬ LÝ NÚT THEME (nếu muốn active) ======================
        const themeButtons = document.querySelectorAll('#setting-component .grid button');
        themeButtons.forEach((btn, index) => {
            btn.addEventListener('click', function () {
                // Bỏ active tất cả
                themeButtons.forEach(b => {
                    b.classList.remove('border-emerald-500', 'bg-emerald-50/30', 'text-emerald-700');
                    b.classList.add('border-gray-150', 'text-gray-700', 'dark:text-[#CAC4D0]');
                });

                // Active button được click
                this.classList.add('border-emerald-500', 'bg-emerald-50/30', 'text-emerald-700');
                this.classList.remove('border-gray-150', 'text-gray-700', 'dark:text-[#CAC4D0]');
                
                // Cập nhật giao diện thật
                if (index === 0) { // Sáng
                    document.documentElement.classList.remove('dark');
                    localStorage.setItem('theme', 'light');
                } else if (index === 1) { // Tối
                    document.documentElement.classList.add('dark');
                    localStorage.setItem('theme', 'dark');
                } else { // Hệ thống
                    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                        document.documentElement.classList.add('dark');
                    } else {
                        document.documentElement.classList.remove('dark');
                    }
                    localStorage.setItem('theme', 'system');
                }
            });
        });

        // Hỗ trợ nhấn ESC
        document.addEventListener('keydown', handleEscKeySettings);

        console.log('✅ Settings Component initialized successfully');
    }, 80);
}

// Hàm đóng modal
function closeSettingsModal() {
    const modalWrapper = document.querySelector('#modal-container > div');
    const settingComponent = document.getElementById('setting-component');

    if (modalWrapper) {
        modalWrapper.classList.add('opacity-0');
        modalWrapper.classList.remove('opacity-100');
    }

    if (settingComponent) {
        settingComponent.classList.add('opacity-0', 'scale-95', 'translate-y-4');
        settingComponent.classList.remove('scale-100', 'translate-y-0');
    }

    // Xóa modal sau animation
    setTimeout(() => {
        const container = document.getElementById('modal-container');
        if (container) container.innerHTML = '';

        document.removeEventListener('keydown', handleEscKeySettings);
    }, 280);
}

// ESC key support
function handleEscKeySettings(e) {
    if (e.key === "Escape") {
        closeSettingsModal();
    }
}

// Đăng ký toàn cục
window.initSettingsComponent = initSettingsComponent;
window.closeSettingsModal = closeSettingsModal;

    const lowPerfToggle = document.getElementById('toggle-low-perf');
    if (lowPerfToggle) {
        lowPerfToggle.checked = localStorage.getItem('lowPerformance') === 'true';
        lowPerfToggle.addEventListener('change', (e) => {
            localStorage.setItem('lowPerformance', e.target.checked);
            if (e.target.checked) document.body.classList.add('low-perf');
            else document.body.classList.remove('low-perf');
        });
    }
