function initSettingsComponent() {
    setTimeout(() => {
        const btnCloseSetting = document.getElementById('btn-close-setting');
        const settingComponent = document.getElementById('setting-component');
        const modalContainer = document.getElementById('modal-container');

        // Thêm hiệu ứng transition mượt mà
        if (settingComponent) {
            settingComponent.classList.add('transition-all', 'duration-300', 'transform');
        }

        // ====================== NÚT ĐÓNG BÊN DƯỚI ======================
        if (btnCloseSetting) {
            btnCloseSetting.onclick = function (e) {
                e.stopPropagation();
                closeSettingsModal();
            };
        }

        // ====================== XỬ LÝ TOGGLE LOGIC HỆ THỐNG ======================
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
                    const titleText = this.parentElement.previousElementSibling?.querySelector('h4')?.textContent 
                                   || this.parentElement.previousElementSibling?.textContent 
                                   || 'Không rõ';
                    console.log(`[Admin Settings] Đã chuyển toggle "${titleText.trim()}" thành:`, this.checked);
                });
            }
        });

        // ====================== XỬ LÝ NÚT THEME GIAO DIỆN (ĐỒNG BỘ MÀU TÍM INDIGO) ======================
        const themeButtons = document.querySelectorAll('#setting-component .grid button');
        themeButtons.forEach((btn, index) => {
            btn.addEventListener('click', function () {
                // Bỏ trạng thái active màu tím của tất cả các nút
                themeButtons.forEach(b => {
                    b.classList.remove('border-indigo-500', 'bg-indigo-50/30', 'text-indigo-700', 'border-2');
                    b.classList.add('border', 'border-gray-150', 'text-gray-700', 'dark:text-[#CAC4D0]');
                });

                // Kích hoạt trạng thái active màu tím (Indigo) cho nút được click
                this.classList.add('border-indigo-500', 'bg-indigo-50/30', 'text-indigo-700', 'border-2');
                this.classList.remove('border', 'border-gray-150', 'text-gray-700', 'dark:text-[#CAC4D0]');
                
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

        // Hỗ trợ nhấn phím ESC để thoát nhanh
        document.addEventListener('keydown', handleEscKeySettings);

        console.log('✅ [Admin] Settings Component initialized successfully');
    }, 80);
}

// Hàm đóng hộp thoại cài đặt
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

    // Xóa trắng modal container sau khi hiệu ứng biến mất hoàn tất
    setTimeout(() => {
        const container = document.getElementById('modal-container');
        if (container) container.innerHTML = '';

        document.removeEventListener('keydown', handleEscKeySettings);
    }, 280);
}

// Hỗ trợ bắt phím ESC
function handleEscKeySettings(e) {
    if (e.key === "Escape") {
        closeSettingsModal();
    }
}

// Bổ sung hàm chung closeModal() dự phòng để khớp hoàn toàn với thuộc tính onclick="closeModal()" trong file HTML của bạn
function closeModal() {
    closeSettingsModal();
}

// Đăng ký các hàm vào đối tượng window toàn cục
window.initSettingsComponent = initSettingsComponent;
window.closeSettingsModal = closeSettingsModal;
window.closeModal = closeModal;

    const lowPerfToggle = document.getElementById('toggle-low-perf');
    if (lowPerfToggle) {
        lowPerfToggle.checked = localStorage.getItem('lowPerformance') === 'true';
        lowPerfToggle.addEventListener('change', (e) => {
            localStorage.setItem('lowPerformance', e.target.checked);
            if (e.target.checked) document.body.classList.add('low-perf');
            else document.body.classList.remove('low-perf');
        });
    }
