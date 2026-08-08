import { db, ref, onValue, update, push } from '/js/script.js';

let allReports = [];
let activeFilter = 'all';
let currentSelectedReportId = null;
window.reportChart = null;

// === KHỞI TẠO BIỂU ĐỒ ===
function initChart() {
    const ctx = document.getElementById('reportChart');
    if (!ctx) return;
    window.reportChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6'],
            datasets: [{
                label: 'Số báo cáo',
                data: [0, 0, 0, 0, 0, 0],
                backgroundColor: '#4f46e5',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

function updateChart(newData) {
    if (window.reportChart) {
        window.reportChart.data.datasets[0].data = newData;
        window.reportChart.update();
    }
}

// === KẾT NỐI FIREBASE REALTIME ===
const reportsRef = ref(db, 'reports');
onValue(reportsRef, (snapshot) => {
    allReports = [];
    if (snapshot.exists()) {
        const data = snapshot.val();
        for (const key in data) {
            allReports.push({ ...data[key], _key: key });
        }
        allReports.sort((a, b) => {
            if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
            if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
    }
    updateStatsUI();
    renderReports();
    updateChartFromData();
});

function updateChartFromData() {
    const now = new Date();
    const monthCounts = [0, 0, 0, 0, 0, 0];
    allReports.forEach(rep => {
        const date = new Date(rep.createdAt || Date.now());
        const diff = (now.getMonth() - date.getMonth() + 12) % 12;
        const idx = 5 - diff;
        if (idx >= 0 && idx < 6) monthCounts[idx]++;
    });
    updateChart(monthCounts);
}

// === RENDER BÁO CÁO ===
function renderReports() {
    const container = document.getElementById('reports-container');
    if (!container) return;
    container.innerHTML = '';

    const filtered = allReports.filter(rep => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'urgent') return rep.priority === 'urgent';
        return rep.status === activeFilter;
    });

    updateStatsUI();

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 bg-white dark:bg-[#211F26] rounded-3xl border border-gray-100 dark:border-[#49454F]/50">
                <div class="text-3xl mb-2">📭</div>
                <p class="text-xs text-gray-400 font-medium">Không có báo cáo nào trùng khớp bộ lọc này.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(rep => {
        const priorityBadge = rep.priority === 'urgent' 
            ? `<span class="px-3 py-1 bg-red-50 border border-red-100 text-red-700 text-xs font-bold uppercase rounded-full animate-pulse">⚡ Khẩn cấp</span>`
            : `<span class="px-3 py-1 bg-gray-50 dark:bg-[#141218] border border-gray-100 dark:border-[#49454F]/50 text-gray-500 dark:text-[#CAC4D0] text-xs font-bold uppercase rounded-full">Thường</span>`;

        let statusBadge = '';
        if (rep.status === 'received') {
            statusBadge = `<span class="px-3 py-1 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold uppercase rounded-full">Chưa xử lý</span>`;
        } else if (rep.status === 'processing') {
            statusBadge = `<span class="px-3 py-1 bg-amber-50 border border-amber-100 text-amber-700 text-xs font-bold uppercase rounded-full">Đang xử lý</span>`;
        } else if (rep.status === 'resolved') {
            statusBadge = `<span class="px-3 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold uppercase rounded-full">Đã giải quyết</span>`;
        }

        const attachmentIndicator = rep.attachmentUrl 
            ? `<span class="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg flex items-center gap-1 shrink-0">📎 Có đính kèm</span>`
            : '';

        const isAnon = rep.isAnonymous !== false;
        const nameDisplay = isAnon ? "🔒 Ẩn danh bảo mật" : `👤 ${rep.senderName || rep.senderId}`;
        const dateDisplay = rep.createdAt ? new Date(rep.createdAt).toLocaleDateString('vi-VN') : '—';
        const classDisplay = rep.senderClass || '—';
        const repId = rep.id || rep._key;

        const cardHtml = `
            <div onclick="openDetailModal('${repId}')" class="bg-white dark:bg-[#211F26] border border-gray-100 dark:border-[#49454F]/50 hover:border-indigo-200 rounded-3xl p-5 md:p-6 shadow-3xs hover:shadow-2xs transition duration-200 cursor-pointer text-left flex flex-col justify-between gap-3">
                <div class="space-y-2">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs text-gray-400 font-mono font-bold">${repId}</span>
                            <span class="text-xs text-gray-300">•</span>
                            <span class="text-xs text-gray-400">${dateDisplay}</span>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            ${priorityBadge}
                            ${statusBadge}
                        </div>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-[#CAC4D0] leading-relaxed line-clamp-2">${rep.content || ''}</p>
                </div>
                <div class="pt-3 border-t border-gray-50 flex items-center justify-between gap-4">
                    <div class="flex items-center gap-2.5 text-xs">
                        <span class="font-bold text-gray-700 dark:text-[#CAC4D0]">${nameDisplay}</span>
                        <span class="text-gray-300">|</span>
                        <span class="text-gray-500 dark:text-[#CAC4D0]">Lớp: <strong class="text-indigo-900 font-bold">${classDisplay}</strong></span>
                    </div>
                    ${attachmentIndicator}
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHtml);
    });
}

window.filterReports = function(status) {
    activeFilter = status;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.className = "filter-btn px-3.5 py-1.5 bg-white dark:bg-[#211F26] border border-gray-100 dark:border-[#49454F]/50 hover:bg-gray-100 dark:hover:bg-[#36343B] text-gray-600 dark:text-[#CAC4D0] text-xs font-bold rounded-xl transition";
    });
    const activeBtn = document.getElementById(`filter-${status}`);
    if (activeBtn) activeBtn.className = "filter-btn px-3.5 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl transition";
    renderReports();
};

function updateStatsUI() {
    const total = allReports.length;
    const urgent = allReports.filter(r => r.priority === 'urgent').length;
    const resolved = allReports.filter(r => r.status === 'resolved').length;
    const statEls = { 'stat-total': total, 'stat-urgent': urgent, 'stat-resolved': resolved };
    for (const [id, val] of Object.entries(statEls)) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
}

// === MODAL CHI TIẾT ===
window.openDetailModal = function(id) {
    const rep = allReports.find(r => r.id === id || r._key === id);
    if (!rep) return;
    currentSelectedReportId = rep._key || rep.id;

    document.getElementById('modal-report-id').textContent = rep.id || rep._key;
    document.getElementById('modal-sender-name').textContent = rep.isAnonymous !== false ? "🔒 Ẩn danh" : (rep.senderName || rep.senderId);
    document.getElementById('modal-sender-class').textContent = rep.senderClass || '—';
    document.getElementById('modal-sender-phone').textContent = rep.senderPhone || '—';
    document.getElementById('modal-report-date').textContent = rep.createdAt ? new Date(rep.createdAt).toLocaleDateString('vi-VN') : '—';
    document.getElementById('modal-content-text').textContent = rep.content || '';

    const attachContainer = document.getElementById('modal-attachment-container');
    const downloadBtn = document.getElementById('btn-download-attachment');
    if (rep.attachmentUrl) {
        if (attachContainer) attachContainer.classList.remove('hidden');
        document.getElementById('modal-attachment-status').textContent = rep.attachmentName || 'Tệp đính kèm';
        if (downloadBtn) downloadBtn.href = rep.attachmentUrl;
    } else {
        if (attachContainer) attachContainer.classList.add('hidden');
    }

    document.getElementById('update-status-select').value = rep.status || 'received';
    document.getElementById('update-priority-select').value = rep.priority || 'regular';
    document.getElementById('update-feedback-text').value = rep.feedback || '';

    const badge = document.getElementById('modal-priority-badge');
    if (rep.priority === 'urgent') {
        badge.textContent = "⚡ Khẩn cấp";
        badge.className = "px-2.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold uppercase rounded-full";
    } else {
        badge.textContent = "Báo cáo thường";
        badge.className = "px-2.5 py-0.5 bg-gray-100 text-gray-600 dark:text-[#CAC4D0] text-[10px] font-bold uppercase rounded-full";
    }

    document.getElementById('detail-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
};

window.closeDetailModal = function() {
    document.getElementById('detail-modal').classList.add('hidden');
    document.body.style.overflow = 'auto';
    currentSelectedReportId = null;
};

window.submitStatusUpdate = function() {
    if (!currentSelectedReportId) return;
    const newStatus = document.getElementById('update-status-select').value;
    const newPriority = document.getElementById('update-priority-select').value;
    const newFeedback = document.getElementById('update-feedback-text').value.trim();

    update(ref(db, `reports/${currentSelectedReportId}`), {
        status: newStatus,
        priority: newPriority,
        feedback: newFeedback,
        updatedAt: new Date().toISOString()
    }).then(() => {
        closeDetailModal();
        alert('✅ Đã cập nhật thành công!');
    }).catch(err => alert('❌ Lỗi: ' + err.message));
};

// === ĐĂNG THÔNG BÁO → FIREBASE ===
window.postAnnouncement = function(e) {
    e.preventDefault();
    const title = document.getElementById('ann-title').value.trim();
    const receiver = document.getElementById('ann-receiver') ? document.getElementById('ann-receiver').value : 'Tất cả';
    const category = document.getElementById('ann-category').value;
    const summary = document.getElementById('ann-summary').value.trim();
    const body = document.getElementById('ann-body').value.trim();

    if (!title || !summary || !body) {
        alert('Vui lòng điền đầy đủ thông tin!');
        return;
    }

    push(ref(db, 'notifications'), {
        title, receiver: receiver || 'Tất cả', category, summary, body,
        createdAt: new Date().toISOString(),
        author: localStorage.getItem('currentUserName') || 'Admin'
    }).then(() => {
        const s = document.getElementById('announce-success');
        if (s) { s.classList.remove('hidden'); setTimeout(() => s.classList.add('hidden'), 3000); }
        document.getElementById('announcement-form').reset();
    }).catch(err => alert('Lỗi: ' + err.message));
};

// Đóng modal khi click ngoài
const detailModal = document.getElementById('detail-modal');
if (detailModal) {
    detailModal.addEventListener('click', e => { if (e.target === detailModal) closeDetailModal(); });
}

// Khởi tạo chart sau khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', initChart);

