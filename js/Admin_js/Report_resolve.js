import { db, ref, onValue, update, remove } from '/js/script.js';

let reportsData = [];
let currentFilter = 'all';
let currentSearch = '';
let selectedReportId = null;

let violenceChartInstance = null;
let trendChartInstance = null;

document.addEventListener("DOMContentLoaded", function() {
    initCharts();
    fetchReports();
});

function fetchReports() {
    const reportsRef = ref(db, 'reports');
    onValue(reportsRef, (snapshot) => {
        reportsData = [];
        if (snapshot.exists()) {
            const userClass = localStorage.getItem('UserClass');
            snapshot.forEach((child) => {
                const r = child.val();
                if (userClass && userClass !== 'Ban Quản Trị') {
                    if (r.studentClass === userClass) {
                        reportsData.push(r);
                    }
                } else {
                    reportsData.push(r);
                }
            });
            // Sắp xếp: Mới nhất lên đầu. Nhưng nếu là Fake thì đẩy xuống cuối
            reportsData.sort((a, b) => {
                if (a.isSuspectedFake && !b.isSuspectedFake) return 1;
                if (!a.isSuspectedFake && b.isSuspectedFake) return -1;
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
        }
        renderReports();
    });
}

function renderReports() {
    const grid = document.getElementById('reports-grid');
    const emptyState = document.getElementById('empty-state');
    if (!grid || !emptyState) return;

    grid.innerHTML = '';

    const filtered = reportsData.filter(r => {
        const matchesStatus = currentFilter === 'all' || r.status === currentFilter;
        const matchesSearch = r.id.toLowerCase().includes(currentSearch.toLowerCase()) || 
                              r.content.toLowerCase().includes(currentSearch.toLowerCase()) ||
                              (r.senderName && r.senderName.toLowerCase().includes(currentSearch.toLowerCase()));
        return matchesStatus && matchesSearch;
    });

    if (filtered.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        filtered.forEach(r => {
            const card = document.createElement('div');
            card.className = "report-card bg-white dark:bg-[#211F26] p-5 rounded-3xl border border-gray-100 dark:border-[#49454F]/50 shadow-sm space-y-4 relative flex flex-col justify-between";
            
            let priorityBadge = '';
            if (r.isSuspectedFake) {
                priorityBadge = `<span class="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold uppercase border border-red-200">🚩 Nghi ngờ quấy rối</span>`;
                card.classList.add('opacity-80', 'bg-red-50/30 dark:bg-red-900/20');
            } else if (r.priority === 'urgent') {
                priorityBadge = `<span class="px-3 py-1 bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold uppercase">Khẩn cấp ⚡</span>`;
            } else {
                priorityBadge = `<span class="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-gray-500 dark:text-[#CAC4D0] dark:text-[#CAC4D0] rounded-lg text-xs font-bold uppercase">Thường</span>`;
            }

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
    currentSearch = document.getElementById('search-input').value;
    renderReports();
}

window.filterStatus = function(status, element) {
    currentFilter = status;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-indigo-600', 'text-white');
        btn.classList.add('bg-white', 'dark:bg-[#211F26]', 'text-gray-600', 'dark:text-[#CAC4D0]');
    });
    element.classList.remove('bg-white', 'dark:bg-[#211F26]', 'text-gray-600', 'dark:text-[#CAC4D0]');
    element.classList.add('active', 'bg-indigo-600', 'text-white');
    renderReports();
}

window.toggleStatsSection = function() {
    const section = document.getElementById('stats-section');
    section.classList.toggle('hidden');
}

function initCharts() {
    const ctxViolence = document.getElementById('violenceChart')?.getContext('2d');
    if (ctxViolence) {
        violenceChartInstance = new Chart(ctxViolence, {
            type: 'doughnut',
            data: {
                labels: ['Bạo lực mạng', 'Tẩy chay/Cô lập', 'Đe dọa/Hăm dọa'],
                datasets: [{
                    data: [5, 4, 3],
                    backgroundColor: ['#818cf8', '#c7d2fe', '#4f46e5'],
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

    const ctxTrend = document.getElementById('reportTrendChart')?.getContext('2d');
    if (ctxTrend) {
        trendChartInstance = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: ['Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7'],
                datasets: [{
                    label: 'Số lượng đơn nhận',
                    data: [3, 5, 4, 6],
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

window.updateChartData = function() {
    const vVal = parseInt(document.getElementById('input-violence-count').value) || 0;
    const rVal = parseInt(document.getElementById('input-report-count').value) || 0;

    if (violenceChartInstance && trendChartInstance) {
        const part1 = Math.round(vVal * 0.4);
        const part2 = Math.round(vVal * 0.35);
        const part3 = vVal - part1 - part2;
        violenceChartInstance.data.datasets[0].data = [part1, part2, part3];
        violenceChartInstance.update();

        trendChartInstance.data.datasets[0].data[3] = rVal;
        trendChartInstance.update();
        alert("Cập nhật số liệu biểu đồ lớp 9A3 thành công!");
    }
}

window.openDetailModal = function(id) {
    selectedReportId = id;
    const report = reportsData.find(r => r.id === id);
    if (!report) return;

    document.getElementById('modal-report-id').textContent = report.id;
    document.getElementById('modal-sender-name').textContent = report.senderName || 'Ẩn danh';
    document.getElementById('modal-sender-class').textContent = report.studentClass || 'Chưa rõ';
    document.getElementById('modal-sender-phone').textContent = report.phone || 'Không có';
    document.getElementById('modal-report-date').textContent = report.createdAt ? new Date(report.createdAt).toLocaleDateString('vi-VN') : '--/--/--';
    document.getElementById('modal-content-text').textContent = report.content;
    document.getElementById('modal-attachment-status').textContent = report.attachmentName || 'Không có tệp đính kèm';
    
    // Kháng cáo
    const appealSection = document.getElementById('modal-appeal-section');
    if (report.appeals) {
        const appealKeys = Object.keys(report.appeals);
        if (appealKeys.length > 0) {
            const firstAppeal = report.appeals[appealKeys[0]];
            appealSection.classList.remove('hidden');
            document.getElementById('modal-appeal-content').textContent = firstAppeal.content;
            document.getElementById('modal-appeal-summary').textContent = firstAppeal.aiSummary || 'Đang chờ phân tích...';
        } else {
            appealSection.classList.add('hidden');
        }
    } else {
        if (appealSection) appealSection.classList.add('hidden');
    }
    
    document.getElementById('update-status-select').value = report.status || 'received';
    document.getElementById('update-priority-select').value = report.priority || 'regular';
    document.getElementById('update-feedback-text').value = report.feedback || '';

    const badge = document.getElementById('modal-priority-badge');
    const rejectBtn = document.getElementById('btn-reject-report');
    
    if (report.isSuspectedFake) {
        badge.className = "px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200";
        badge.textContent = "🚩 Nghi ngờ quấy rối";
        rejectBtn.classList.remove('hidden');
    } else if (report.priority === 'urgent') {
        badge.className = "px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400";
        badge.textContent = "Khẩn cấp ⚡";
        rejectBtn.classList.add('hidden');
    } else {
        badge.className = "px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-gray-500 dark:text-[#CAC4D0]";
        badge.textContent = "Thường";
        rejectBtn.classList.add('hidden');
    }

    document.getElementById('detail-modal').classList.remove('hidden');
}

window.closeDetailModal = function() {
    document.getElementById('detail-modal').classList.add('hidden');
    selectedReportId = null;
}

window.submitStatusUpdate = async function() {
    if (!selectedReportId) return;
    const reportRef = ref(db, 'reports/' + selectedReportId);
    
    const newStatus = document.getElementById('update-status-select').value;
    const newPriority = document.getElementById('update-priority-select').value;
    const newFeedback = document.getElementById('update-feedback-text').value;

    try {
        await update(reportRef, {
            status: newStatus,
            priority: newPriority,
            feedback: newFeedback
        });
        alert(`Đã cập nhật đơn ${selectedReportId} thành công!`);
        window.closeDetailModal();
    } catch (e) {
        alert("Có lỗi xảy ra: " + e.message);
    }
}

window.rejectReport = async function() {
    if (!selectedReportId) return;
    if (confirm("Bạn có chắc chắn muốn xóa/từ chối báo cáo này?")) {
        try {
            await remove(ref(db, 'reports/' + selectedReportId));
            alert("Đã xóa báo cáo quấy rối thành công!");
            window.closeDetailModal();
        } catch (e) {
            alert("Lỗi khi xóa báo cáo: " + e.message);
        }
    }
}