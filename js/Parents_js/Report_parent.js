import { db, ref, get, set, onValue } from '/js/script.js';

/**
 * Report_parent.js
 * Phụ huynh xem báo cáo của con em từ Firebase
 * Hàm này được gọi từ load_components.js sau khi load modal
 */
function initReportForm() {
    setTimeout(() => {
        const modalWrapper = document.querySelector('#modal-container > div');
        const mainContent = document.querySelector('#modal-container main');

        if (modalWrapper && mainContent) {
            modalWrapper.classList.add('transition-opacity', 'duration-300', 'opacity-0');
            mainContent.classList.add('transition-all', 'duration-300', 'transform', 'opacity-0', 'translate-y-8', 'scale-95');
            setTimeout(() => {
                modalWrapper.classList.remove('opacity-0');
                modalWrapper.classList.add('opacity-100');
                mainContent.classList.remove('opacity-0', 'translate-y-8', 'scale-95');
                mainContent.classList.add('opacity-100', 'translate-y-0', 'scale-100');
            }, 20);
        }

        const isAnonymousCheckbox = document.getElementById('isAnonymous');
        const nameContainer = document.getElementById('student-name-container');
        const reportForm = document.getElementById('incident-report-form');
        const formContainer = document.getElementById('report-form-container');
        const successContainer = document.getElementById('success-container');

        function toggleAnonymousFields() {
            if (isAnonymousCheckbox && nameContainer) {
                if (isAnonymousCheckbox.checked) {
                    nameContainer.classList.add('hidden');
                } else {
                    nameContainer.classList.remove('hidden');
                }
            }
        }

        if (isAnonymousCheckbox && nameContainer) {
            toggleAnonymousFields();
            isAnonymousCheckbox.addEventListener('change', toggleAnonymousFields);
        }

        if (reportForm && formContainer && successContainer) {
            formContainer.classList.add('transition-all', 'duration-300', 'transform');
            successContainer.classList.add('transition-all', 'duration-300', 'transform', 'opacity-0', 'scale-95');

            reportForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                
                const submitBtn = document.getElementById('submit-btn');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '⏳ Đang gửi phản ánh...';
                }

                // Đã xóa reCAPTCHA

                try {
                    const isAnonymous = isAnonymousCheckbox ? isAnonymousCheckbox.checked : true;
                    const studentName = isAnonymous ? 'Ẩn danh' : document.getElementById('student-name').value;
                    const phone = document.getElementById('student-phone').value;
                    const gender = document.getElementById('student-gender').value;
                    const studentClass = document.getElementById('student-class').value;
                    const school = document.getElementById('student-school').value;
                    const content = document.getElementById('incident-content').value;
                    const isUrgent = document.getElementById('isUrgent').checked;
                    
                    const reportId = 'REP-' + Math.floor(100000 + Math.random() * 900000);
                    const currentUser = localStorage.getItem('currentUser') || 'AnonymousParent';
                    
                    let isSuspectedFake = false;
                    let involvedStudents = [];
                    
                    try {
                        const aiRes = await fetch('http://localhost:5000/api/ai/analyze-report', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content: content })
                        });
                        const aiData = await aiRes.json();
                        if (aiData.reply) {
                            const parsed = JSON.parse(aiData.reply);
                            isSuspectedFake = parsed.isSpam || false;
                            involvedStudents = parsed.involvedStudents || [];
                        }
                    } catch (aiErr) {
                        console.error("Lỗi phân tích AI:", aiErr);
                    }

                    // Tạm thời chưa import 'set', ta có thể gọi thông qua script.js hoặc dùng hàm có sẵn.
                    // Oh wait, Report_parent.js imports: import { db, ref, get, onValue } from '/js/script.js';
                    // We need to import 'set'. Let's assume we can fetch it dynamically or we just add it to import.
                    // Ghi vào db
                    await set(ref(db, 'reports/' + reportId), {
                        id: reportId,
                        senderId: currentUser,
                        senderName: studentName + " (Phụ huynh)",
                        phone: phone,
                        gender: gender,
                        studentClass: studentClass,
                        school: school,
                        content: content,
                        priority: isUrgent ? 'urgent' : 'regular',
                        status: 'received',
                        createdAt: new Date().toISOString(),
                        source: 'parent',
                        isSuspectedFake: isSuspectedFake,
                        feedback: "Nhà trường đã tiếp nhận phản ánh từ phụ huynh."
                    });

                    // Gửi thông báo cho học sinh liên quan
                    if (involvedStudents.length > 0) {
                        try {
                            const usersSnap = await get(ref(db, 'users'));
                            if (usersSnap.exists()) {
                                const usersData = usersSnap.val();
                                for (const [uid, uData] of Object.entries(usersData)) {
                                    if (uData.role === 'student' && involvedStudents.some(name => uData.name && uData.name.toLowerCase().includes(name.toLowerCase()))) {
                                        // Gửi thông báo cho học sinh bị báo cáo
                                        const notifId = 'NOTIF-' + Date.now();
                                        await set(ref(db, `notifications/${uid}/${notifId}`), {
                                            id: notifId,
                                            title: "⚠️ Cảnh báo an toàn",
                                            message: `Bạn được nhắc đến trong một phản ánh (Mã: ${reportId}). Kháng cáo nếu có nhầm lẫn.`,
                                            date: new Date().toISOString(),
                                            isRead: false,
                                            type: "warning",
                                            reportId: reportId
                                        });
                                    }
                                }
                            }
                        } catch (err) {
                            console.error("Lỗi gửi thông báo AI:", err);
                        }
                    }

                    formContainer.classList.add('opacity-0', 'scale-95');
                    setTimeout(() => {
                        formContainer.classList.add('hidden');
                        successContainer.classList.remove('hidden');
                        setTimeout(() => {
                            successContainer.classList.remove('opacity-0', 'scale-95');
                            successContainer.classList.add('opacity-100', 'scale-100');
                        }, 20);
                    }, 300);
                } catch (error) {
                    console.error("Lỗi khi gửi báo cáo: ", error);
                    alert("Có lỗi xảy ra khi gửi báo cáo. Vui lòng thử lại!");
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '🛡️ Gửi Phản Ánh Bảo Mật';
                    }
                }
            });

            const newReportBtn = document.getElementById('btn-new-report-parent') || successContainer.querySelector('button');
            if (newReportBtn) {
                newReportBtn.addEventListener('click', function () {
                    successContainer.classList.remove('opacity-100', 'scale-100');
                    successContainer.classList.add('opacity-0', 'scale-95');
                    setTimeout(() => {
                        reportForm.reset();
                        toggleAnonymousFields();
                        successContainer.classList.add('hidden');
                        formContainer.classList.remove('hidden');
                        setTimeout(() => {
                            formContainer.classList.remove('opacity-0', 'scale-95');
                            formContainer.classList.add('opacity-100', 'scale-100');
                        }, 20);
                    }, 300);
                });
            }
        }
    }, 50);
}

/**
 * Hàm load và hiển thị danh sách báo cáo của con em trong modal
 * Gọi từ nút "Xem báo cáo của con" nếu có
 */
async function loadChildReports(containerId = 'modal-container') {
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) {
        alert('Bạn cần đăng nhập để xem báo cáo.');
        return;
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <div class="bg-white dark:bg-[#211F26] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div class="px-6 py-4 border-b border-gray-100 dark:border-[#49454F]/50 flex items-center justify-between">
                    <h3 class="font-bold text-gray-900 dark:text-[#E6E0E9] text-base">📋 Báo cáo liên quan đến con em</h3>
                    <button onclick="window.closeModal && window.closeModal()" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 dark:text-[#CAC4D0] font-bold transition">✕</button>
                </div>
                <div id="child-reports-content" class="p-6 overflow-y-auto">
                    <div class="text-center py-8 text-gray-400">Đang tải báo cáo...</div>
                </div>
            </div>
        </div>
    `;

    const contentEl = document.getElementById('child-reports-content');

    try {
        // Tìm học sinh liên kết với phụ huynh này
        const usersSnap = await get(ref(db, 'users'));
        const reportsSnap = await get(ref(db, 'reports'));

        if (!usersSnap.exists()) {
            contentEl.innerHTML = '<p class="text-center text-gray-500 dark:text-[#CAC4D0]">Không tìm thấy dữ liệu học sinh.</p>';
            return;
        }

        const users = usersSnap.val();
        const studentIds = Object.keys(users).filter(k => users[k].linkedParent === currentUser);
        const studentNames = studentIds.map(k => users[k].name).join(', ');

        if (studentIds.length === 0) {
            contentEl.innerHTML = '<p class="text-center text-gray-500 dark:text-[#CAC4D0] py-8">Bạn chưa liên kết với học sinh nào.</p>';
            return;
        }

        let reports = [];
        if (reportsSnap.exists()) {
            const reportData = reportsSnap.val();
            reports = Object.values(reportData).filter(r => studentIds.includes(r.senderId));
            reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        if (reports.length === 0) {
            contentEl.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-3">✅</div>
                    <p class="font-semibold text-gray-700 dark:text-[#CAC4D0]">Con em (${studentNames}) chưa có báo cáo nào</p>
                    <p class="text-sm text-gray-500 dark:text-[#CAC4D0] mt-1">Đây là điều tốt — con em đang ổn!</p>
                </div>
            `;
            return;
        }

        const html = reports.map(r => {
            let statusBadge = '';
            if (r.status === 'received') statusBadge = `<span class="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold">Mới tiếp nhận</span>`;
            else if (r.status === 'processing') statusBadge = `<span class="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold">Đang xử lý</span>`;
            else if (r.status === 'resolved') statusBadge = `<span class="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold">Đã giải quyết</span>`;

            const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '--';
            return `
                <div class="border border-gray-100 dark:border-[#49454F]/50 rounded-2xl p-4 hover:shadow-sm transition">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-mono text-xs font-bold text-indigo-600">${r.id}</span>
                        <div class="flex gap-1.5">${statusBadge}</div>
                    </div>
                    <p class="text-sm text-gray-700 dark:text-[#CAC4D0] leading-relaxed mb-2">${r.content || ''}</p>
                    ${r.feedback ? `<div class="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-xs text-emerald-800"><span class="font-bold">Phản hồi nhà trường:</span> ${r.feedback}</div>` : ''}
                    <p class="text-xs text-gray-400 mt-2">📅 ${dateStr}</p>
                </div>
            `;
        }).join('');

        contentEl.innerHTML = `
            <p class="text-xs text-gray-500 dark:text-[#CAC4D0] mb-4">Hiển thị <strong>${reports.length}</strong> báo cáo liên quan đến <strong>${studentNames}</strong></p>
            <div class="space-y-3">${html}</div>
        `;
    } catch (err) {
        contentEl.innerHTML = `<p class="text-center text-red-500">Lỗi tải dữ liệu: ${err.message}</p>`;
    }
}

window.initReportForm = initReportForm;
window.loadChildReports = loadChildReports;
