import { db, ref, get } from '/js/script.js';

window.togglePinVisibility = function() {
    const pinInput = document.getElementById('pin-code');
    const eyeIcon = document.getElementById('pin-eye-icon');
    if (!pinInput || !eyeIcon) return;
    if (pinInput.type === 'password') {
        pinInput.type = 'text';
        eyeIcon.textContent = '🙈';
    } else {
        pinInput.type = 'password';
        eyeIcon.textContent = '👁️';
    }
};

function initReportTracker() {
    setTimeout(() => {
        const searchBox = document.getElementById('search-box');
        const resultBox = document.getElementById('result-box');
        const searchBtn = document.getElementById('search-submit-btn');
        const backBtn = document.getElementById('back-to-search-btn');
        const errorDiv = document.getElementById('search-error');

        // Bật transition mượt mà nếu tìm thấy box
        if (searchBox) searchBox.classList.add('transition-all', 'duration-300', 'transform');
        if (resultBox) resultBox.classList.add('transition-all', 'duration-300', 'transform');

        // Hàm đưa Timeline về trạng thái xám ban đầu an toàn
        function resetTimelineUI() {
            const d2 = document.getElementById('step-2-dot');
            const t2 = document.getElementById('step-2-title');
            const p2 = document.getElementById('step-2-desc');
            if (d2) {
                d2.textContent = "2";
                d2.className = "w-6 h-6 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center text-xs font-bold shrink-0 z-10 transition-colors duration-300";
            }
            if (t2) {
                t2.className = "font-bold text-sm text-gray-500 transition-colors duration-300";
            }
            if (p2) {
                p2.className = "text-xs text-gray-400 mt-0.5 leading-relaxed transition-colors duration-300";
            }

            const d3 = document.getElementById('step-3-dot');
            const t3 = document.getElementById('step-3-title');
            const p3 = document.getElementById('step-3-desc');
            if (d3) {
                d3.textContent = "3";
                d3.className = "w-6 h-6 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center text-xs font-bold shrink-0 z-10 transition-colors duration-300";
            }
            if (t3) {
                t3.className = "font-bold text-sm text-gray-500 transition-colors duration-300";
            }
            if (p3) {
                p3.className = "text-xs text-gray-400 mt-0.5 leading-relaxed transition-colors duration-300";
            }
        }

        // XỬ LÝ LỊCH SỬ TRA CỨU
        const historyBox = document.getElementById('history-box');
        const historyList = document.getElementById('history-list');
        try {
            const savedReports = JSON.parse(localStorage.getItem('userReports') || '[]');
            if (savedReports.length > 0 && historyBox && historyList) {
                historyBox.classList.remove('hidden');
                historyList.innerHTML = '';
                savedReports.forEach(r => {
                    const item = document.createElement('div');
                    item.className = "flex items-center justify-between p-3 bg-white dark:bg-[#211F26] border border-gray-200 dark:border-[#49454F]/50 rounded-xl hover:border-emerald-400 hover:shadow-sm cursor-pointer transition";
                    item.innerHTML = `
                        <div class="flex-1 min-w-0 pr-3">
                            <h4 class="font-mono text-xs font-bold text-emerald-700 truncate">${r.id}</h4>
                            <p class="text-xs text-gray-500 dark:text-[#CAC4D0] mt-0.5 truncate">${new Date(r.time).toLocaleDateString('vi-VN')} - ${r.contentSnippet || 'Không có tóm tắt'}</p>
                        </div>
                        <span class="text-gray-400 text-xs">➔</span>
                    `;
                    item.onclick = function() {
                        const repInput = document.getElementById('report-id');
                        const pinInput = document.getElementById('pin-code');
                        if (repInput) repInput.value = r.id;
                        if (pinInput) pinInput.value = r.pin;
                        if (searchBtn) searchBtn.click();
                    };
                    historyList.appendChild(item);
                });
            }
        } catch (e) {
            console.error("Lỗi đọc lịch sử", e);
        }

        // XỬ LÝ SỰ KIỆN TRA CỨU
        if (searchBtn) {
            searchBtn.onclick = async function() {
                const idInput = document.getElementById('report-id')?.value.trim() || "";
                const pinInput = document.getElementById('pin-code')?.value.trim() || "";

                if (errorDiv) errorDiv.classList.add('hidden');

                if (!idInput || !pinInput) {
                    if (errorDiv) {
                        errorDiv.textContent = "Vui lòng nhập đầy đủ Mã báo cáo và Mã PIN.";
                        errorDiv.classList.remove('hidden');
                    }
                    return;
                }

                try {
                    searchBtn.disabled = true;
                    searchBtn.innerHTML = 'Đang tra cứu...';

                    const snapshot = await get(ref(db, 'reports/' + idInput));
                    if (!snapshot.exists()) {
                        if (errorDiv) {
                            errorDiv.textContent = "Không tìm thấy mã báo cáo này.";
                            errorDiv.classList.remove('hidden');
                        }
                        return;
                    }

                    const report = snapshot.val();
                    if (report.pin !== pinInput) {
                        if (errorDiv) {
                            errorDiv.textContent = "Mã PIN không chính xác.";
                            errorDiv.classList.remove('hidden');
                        }
                        return;
                    }

                    // Cập nhật thông tin text an toàn
                    const resId = document.getElementById('res-id');
                    const resDate = document.getElementById('res-date');
                    const resFeedback = document.getElementById('res-feedback');
                    
                    if (resId) resId.textContent = idInput;
                    if (resDate) {
                        const dateObj = new Date(report.createdAt);
                        resDate.textContent = dateObj.toLocaleDateString('vi-VN');
                    }
                    if (resFeedback) resFeedback.textContent = `"${report.feedback || 'Đang chờ xử lý.'}"`;

                    resetTimelineUI();

                    const badge = document.getElementById('res-status-badge');
                    const d2 = document.getElementById('step-2-dot');
                    const t2 = document.getElementById('step-2-title');
                    const p2 = document.getElementById('step-2-desc');
                    const d3 = document.getElementById('step-3-dot');
                    const t3 = document.getElementById('step-3-title');
                    const p3 = document.getElementById('step-3-desc');

                    // CẬP NHẬT GIAO DIỆN THEO TRẠNG THÁI
                    if (report.status === "processing" || report.status === "received") {
                        if (badge) {
                            badge.textContent = "Đang xử lý";
                            badge.className = "px-3 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 animate-pulse";
                        }
                        
                        if (d2) {
                            d2.textContent = "▶";
                            d2.className = "w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0 z-10 animate-pulse";
                        }
                        if (t2) t2.className = "font-bold text-sm text-gray-900 dark:text-[#E6E0E9] transition-colors duration-300";
                        if (p2) p2.className = "text-xs text-gray-600 dark:text-[#CAC4D0] mt-0.5 leading-relaxed transition-colors duration-300";

                    } else if (report.status === "resolved") {
                        if (badge) {
                            badge.textContent = "Đã giải quyết";
                            badge.className = "px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800";
                        }
                        
                        // Bước 2 chuyển xanh hoàn thành
                        if (d2) {
                            d2.textContent = "✓";
                            d2.className = "w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0 z-10";
                        }
                        if (t2) t2.className = "font-bold text-sm text-gray-900 dark:text-[#E6E0E9] transition-colors duration-300";
                        if (p2) p2.className = "text-xs text-gray-600 dark:text-[#CAC4D0] mt-0.5 leading-relaxed transition-colors duration-300";

                        // Bước 3 chuyển xanh hoàn thành
                        if (d3) {
                            d3.textContent = "✓";
                            d3.className = "w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 z-10 shadow-md shadow-emerald-600/20";
                        }
                        if (t3) t3.className = "font-bold text-sm text-emerald-800 transition-colors duration-300";
                        if (p3) p3.className = "text-xs text-gray-600 dark:text-[#CAC4D0] mt-0.5 leading-relaxed transition-colors duration-300";
                    }

                    // THỰC HIỆN CHUYỂN TRANG
                    if (searchBox && resultBox) {
                        searchBox.classList.add('opacity-0', 'scale-95');
                        setTimeout(() => {
                            searchBox.classList.add('hidden');
                            resultBox.classList.remove('hidden');
                            resultBox.classList.add('opacity-0', 'scale-95');

                            requestAnimationFrame(() => {
                                requestAnimationFrame(() => {
                                    resultBox.classList.remove('opacity-0', 'scale-95');
                                    resultBox.classList.add('opacity-100', 'scale-100');
                                });
                            });
                        }, 300);
                    }
                } catch (error) {
                    console.error("Lỗi tra cứu: ", error);
                    if (errorDiv) {
                        errorDiv.textContent = "Có lỗi xảy ra khi kết nối. Vui lòng thử lại.";
                        errorDiv.classList.remove('hidden');
                    }
                } finally {
                    searchBtn.disabled = false;
                    searchBtn.innerHTML = 'Tra cứu tiến độ';
                }
            };
        }

        // QUAY LẠI HỘP TÌM KIẾM
        if (backBtn && searchBox && resultBox) {
            backBtn.onclick = function() {
                resultBox.classList.remove('opacity-100', 'scale-100');
                resultBox.classList.add('opacity-0', 'scale-95');

                setTimeout(() => {
                    resultBox.classList.add('hidden');
                    const repInput = document.getElementById('report-id');
                    const pinInput = document.getElementById('pin-code');
                    if (repInput) repInput.value = '';
                    if (pinInput) pinInput.value = '';

                    searchBox.classList.remove('hidden');
                    searchBox.classList.add('opacity-0', 'scale-95');

                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            searchBox.classList.remove('opacity-0', 'scale-95');
                            searchBox.classList.add('opacity-100', 'scale-100');
                        });
                    });
                }, 300);
            };
        }
    }, 50);
}

function closeModal() {
    const modalWrapper = document.querySelector('#modal-container > div');
    const mainContent = document.querySelector('#modal-container #tracker-component');

    if (modalWrapper && mainContent) {
        modalWrapper.classList.remove('opacity-100');
        modalWrapper.classList.add('opacity-0');

        mainContent.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
        mainContent.classList.add('opacity-0', 'translate-y-4', 'scale-95');

        setTimeout(() => {
            const container = document.getElementById('modal-container');
            if (container) container.innerHTML = '';
        }, 300);
    } else {
        const container = document.getElementById('modal-container');
        if (container) container.innerHTML = '';
    }
}

window.initReportTracker = initReportTracker;
window.closeModal = closeModal;