import { db, ref, onValue, update } from '/js/script.js';

let reportsData = [];
let currentFilter = 'all';
let currentSearch = '';
let selectedReportId = null;
let currentStatsClass = 'all';

let violenceChartInstance = null;
let trendChartInstance = null;

document.addEventListener("DOMContentLoaded", function() {
    initCharts();
    
    onValue(ref(db, 'reports'), (snapshot) => {
        reportsData = [];
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const data = childSnapshot.val();
                reportsData.push({
                    id: data.id,
                    senderName: data.senderName || 'Ẩn danh',
                    senderClass: data.studentClass || 'Không rõ',
                    phone: data.phone || 'Không rõ',
                    date: new Date(data.createdAt).toLocaleDateString('vi-VN'),
                    content: data.content,
                    priority: data.priority || 'regular',
                    status: data.status || 'received',
                    attachment: data.attachmentName || 'Không có tệp',
                    attachmentUrl: data.attachmentUrl || null,
                    feedback: data.feedback || ''
                });
            });
            // Sắp xếp khẩn cấp lên đầu
            reportsData.sort((a, b) => {
                if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
                if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
                return b.id.localeCompare(a.id);
            });
        }
        renderReports();
        updateChartStatsAutomatically();
    });
});

function renderReports() {
    const grid = document.getElementById('reports-grid');
    const emptyState = document.getElementById('empty-state');
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = reportsData.filter(r => {
        const matchesStatus = currentFilter === 'all' || r.status === currentFilter;
        const matchesClass = currentStatsClass === 'all' || r.senderClass === currentStatsClass;
        const matchesSearch = r.id.toLowerCase().includes(currentSearch.toLowerCase()) || 
                              r.content.toLowerCase().includes(currentSearch.toLowerCase()) ||
                              r.senderName.toLowerCase().includes(currentSearch.toLowerCase());
        return matchesStatus && matchesClass && matchesSearch;
    });

    if (filtered.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
    } else {
        if (emptyState) emptyState.classList.add('hidden');
        filtered.forEach(r => {
            const card = document.createElement('div');
            card.className = "report-card bg-white dark:bg-[#211F26] p-5 rounded-3xl border border-gray-100 dark:border-[#49454F]/50 shadow-sm space-y-4 relative flex flex-col justify-between";
            
            const priorityBadge = r.priority === 'urgent' 
                ? `<span class="px-3 py-1 bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold uppercase">Khẩn cấp ⚡</span>`
                : `<span class="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-gray-500 dark:text-[#CAC4D0] dark:text-[#CAC4D0] rounded-lg text-xs font-bold uppercase">Thường</span>`;

            let statusBadge = '';
            if (r.status === 'received') statusBadge = `<span class="px-2.5 py-1 bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full text-xs font-bold">Mới tiếp nhận</span>`;
            else if (r.status === 'processing') statusBadge = `<span class="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 rounded-full text-xs font-bold">Đang xử lý</span>`;
            else if (r.status === 'resolved') statusBadge = `<span class="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-bold">Đã giải quyết</span>`;

            card.innerHTML = `
                <div class="space-y-4">
                    <div class="flex items-start justify-between border-b border-gray-50 dark:border-[#49454F]/50 pb-3">
                        <div>
                            <span class="font-mono text-indigo-700 dark:text-indigo-400 font-extrabold text-[13px] tracking-tight block">${r.id}</span>
                            <div class="mt-1">${statusBadge}</div>
                        </div>
                        <div class="shrink-0">${priorityBadge}</div>
                    </div>
                    <p class="text-[13px] text-gray-600 dark:text-[#CAC4D0] leading-relaxed line-clamp-3 min-h-[3.75rem]">${r.content}</p>
                </div>
                <div class="flex items-center justify-between pt-4 mt-2">
                    <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold">👤</div>
                        <div class="text-[11px] text-gray-400 leading-tight">Người gửi:<br><strong class="text-gray-800 dark:text-[#E6E0E9] font-medium">${r.senderName}</strong></div>
                    </div>
                    <button onclick="openDetailModal('${r.id}')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition active:scale-95 shadow-md shadow-indigo-200 dark:shadow-none">
                        Xem chi tiết →
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });
    }
}

window.handleSearch = function() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        currentSearch = searchInput.value;
        renderReports();
    }
}

window.filterStatus = function(status, element) {
    currentFilter = status;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-white', 'dark:bg-[#36343B]', 'text-indigo-700', 'dark:text-indigo-400', 'shadow-sm');
        btn.classList.add('text-gray-500', 'dark:text-[#CAC4D0]', 'hover:bg-white/50', 'dark:hover:bg-[#211F26]');
    });
    if (element) {
        element.classList.remove('text-gray-500', 'dark:text-[#CAC4D0]', 'hover:bg-white/50', 'dark:hover:bg-[#211F26]');
        element.classList.add('active', 'bg-white', 'dark:bg-[#36343B]', 'text-indigo-700', 'dark:text-indigo-400', 'shadow-sm');
    }
    renderReports();
}

window.toggleStatsDropdown = function() {
    const menu = document.getElementById('statsDropdownMenu');
    if (!menu) return;
    menu.classList.toggle('hidden');
    if (!menu.classList.contains('hidden')) {
        const input = document.getElementById('classSearchInput');
        if (input) {
            input.value = '';
            input.focus();
            filterClassesByChar('');
        }
    }
}

window.handleSingleCharInput = function(input) {
    let val = input.value;
    if (val.length > 1) {
        val = val.charAt(val.length - 1);
        input.value = val;
    }
    filterClassesByChar(val.toLowerCase());
}

function filterClassesByChar(char) {
    const items = document.querySelectorAll('#classListContainer .class-item');
    items.forEach(btn => {
        const text = btn.innerText.toLowerCase();
        if (char === '' || text.includes(char)) {
            btn.style.display = 'flex';
        } else {
            btn.style.display = 'none';
        }
    });
}

window.chooseClassForStats = function(classCode, labelName) {
    currentStatsClass = classCode;
    const labelEl = document.getElementById('selectedClassLabel');
    if (labelEl) labelEl.innerText = `(${labelName})`;
    const menu = document.getElementById('statsDropdownMenu');
    if (menu) menu.classList.add('hidden');
    renderReports();
    
    const statsSection = document.getElementById('stats-section');
    if (statsSection) statsSection.classList.remove('hidden');
}

window.addEventListener('click', function(e) {
    const dropdown = document.getElementById('statsDropdownMenu');
    if (dropdown && !dropdown.parentElement.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

function initCharts() {
    const ctxViolenceEl = document.getElementById('violenceChart');
    const ctxTrendEl = document.getElementById('reportTrendChart');

    if (ctxViolenceEl) {
        const ctxViolence = ctxViolenceEl.getContext('2d');
        violenceChartInstance = new Chart(ctxViolence, {
            type: 'doughnut',
            data: {
                labels: ['Bạo lực mạng', 'Tẩy chay/Cô lập', 'Đe dọa/Hăm dọa', 'Khác'],
                datasets: [{
                    data: [0, 0, 0, 0], 
                    backgroundColor: ['#6366f1', '#3b82f6', '#ec4899', '#10b981'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Be Vietnam' } } } }
            }
        });
    }

    if (ctxTrendEl) {
        const ctxTrend = ctxTrendEl.getContext('2d');
        trendChartInstance = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: ['Tất cả báo cáo'],
                datasets: [{
                    label: 'Số lượng đơn nhận',
                    data: [0],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, grid: { color: '#f3f4f6' } }, x: { grid: { display: false } } }
            }
        });
    }
}

function updateChartStatsAutomatically() {
    let cyber = 0, isolate = 0, threaten = 0, other = 0;
    reportsData.forEach(r => {
        const txt = r.content.toLowerCase();
        if(txt.includes('mạng') || txt.includes('online') || txt.includes('facebook')) cyber++;
        else if(txt.includes('tẩy chay') || txt.includes('cô lập')) isolate++;
        else if(txt.includes('đe dọa') || txt.includes('đánh') || txt.includes('giết')) threaten++;
        else other++;
    });

    if (violenceChartInstance) {
        violenceChartInstance.data.datasets[0].data = [cyber, isolate, threaten, other];
        violenceChartInstance.update();
    }
    if (trendChartInstance) {
        trendChartInstance.data.datasets[0].data = [reportsData.length];
        trendChartInstance.update();
    }
}

window.updateChartData = function() {
    const vInput = document.getElementById('input-violence-count');
    const rInput = document.getElementById('input-report-count');
    if (!vInput || !rInput) return;
    const vVal = parseInt(vInput.value) || 0;
    const rVal = parseInt(rInput.value) || 0;

    if (violenceChartInstance && trendChartInstance) {
        const part1 = Math.round(vVal * 0.4);
        const part2 = Math.round(vVal * 0.35);
        const part3 = vVal - part1 - part2;
        
        violenceChartInstance.data.datasets[0].data = [part1, part2, part3, 0];
        violenceChartInstance.update();

        trendChartInstance.data.datasets[0].data = [rVal];
        trendChartInstance.update();

        alert("Cập nhật số liệu biểu đồ thủ công thành công!");
    }
}

window.openDetailModal = function(id) {
    selectedReportId = id;
    const report = reportsData.find(r => r.id === id);
    if (!report) return;

    const setText = (elemId, val) => {
        const el = document.getElementById(elemId);
        if (el) el.textContent = val;
    };

    setText('modal-report-id', report.id);
    setText('modal-sender-name', report.senderName);
    setText('modal-sender-class', report.senderClass);
    setText('modal-sender-phone', report.phone);
    setText('modal-report-date', report.date);
    setText('modal-content-text', report.content);
    setText('modal-attachment-status', report.attachment);

    const downloadBtn = document.getElementById('btn-download-attachment');
    if (downloadBtn) {
        if (report.attachmentUrl) {
            downloadBtn.href = report.attachmentUrl;
            downloadBtn.style.display = 'inline-flex';
            downloadBtn.target = "_blank";
        } else {
            downloadBtn.style.display = 'none';
        }
    }
    
    const statusSelect = document.getElementById('update-status-select');
    const prioritySelect = document.getElementById('update-priority-select');
    const feedbackText = document.getElementById('update-feedback-text');
    
    if (statusSelect) statusSelect.value = report.status;
    if (prioritySelect) prioritySelect.value = report.priority;
    if (feedbackText) feedbackText.value = report.feedback;

    const badge = document.getElementById('modal-priority-badge');
    if (badge) {
        if (report.priority === 'urgent') {
            badge.className = "px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400";
            badge.textContent = "Khẩn cấp ⚡";
        } else {
            badge.className = "px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-gray-500 dark:text-[#CAC4D0]";
            badge.textContent = "Thường";
        }
    }

    const modal = document.getElementById('detail-modal');
    if (modal) modal.classList.remove('hidden');
}

window.closeDetailModal = function() {
    const modal = document.getElementById('detail-modal');
    if (modal) modal.classList.add('hidden');
    selectedReportId = null;
}

window.submitStatusUpdate = async function() {
    if (!selectedReportId) return;
    const statusSelect = document.getElementById('update-status-select');
    const prioritySelect = document.getElementById('update-priority-select');
    const feedbackText = document.getElementById('update-feedback-text');

    const newStatus = statusSelect ? statusSelect.value : 'received';
    const newPriority = prioritySelect ? prioritySelect.value : 'regular';
    const newFeedback = feedbackText ? feedbackText.value : '';

    try {
        await update(ref(db, 'reports/' + selectedReportId), {
            status: newStatus,
            priority: newPriority,
            feedback: newFeedback,
            updatedAt: new Date().toISOString()
        });
        alert(`Đã cập nhật trạng thái đơn ${selectedReportId} thành công!`);
        window.closeDetailModal();
    } catch (error) {
        console.error("Lỗi cập nhật:", error);
        alert("Lỗi khi cập nhật trạng thái trên Firebase.");
    }
}