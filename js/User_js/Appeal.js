import { db, ref, set, get, onValue } from '/js/script.js';

let currentAppealReportId = null;

// Hàm mở Modal Kháng Cáo (được gọi khi bấm vào thông báo)
window.openAppealModal = function(reportId) {
    currentAppealReportId = reportId;
    fetch('/components/Appeal_modal.html')
        .then(response => response.text())
        .then(html => {
            let container = document.getElementById('modal-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'modal-container';
                document.body.appendChild(container);
            }
            container.innerHTML = html;
            document.getElementById('appeal-report-id').textContent = reportId;
        })
        .catch(error => console.error('Lỗi khi tải modal kháng cáo:', error));
};

window.closeAppealModal = function() {
    const container = document.getElementById('modal-container');
    if (container) {
        container.innerHTML = '';
    }
    currentAppealReportId = null;
};

window.submitAppeal = async function() {
    const contentInput = document.getElementById('appeal-content');
    const content = contentInput.value.trim();
    const errorMsg = document.getElementById('appeal-error');
    const submitBtn = document.getElementById('submit-appeal-btn');

    if (!content) {
        errorMsg.classList.remove('hidden');
        return;
    }
    
    errorMsg.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Đang xử lý...';

    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) {
        alert("Vui lòng đăng nhập.");
        return;
    }

    try {
        // Lấy thông tin user
        const userSnap = await get(ref(db, `users/${currentUser}`));
        const userData = userSnap.exists() ? userSnap.val() : {};
        const userName = userData.name || "Học sinh";

        // Lấy báo cáo gốc
        const reportSnap = await get(ref(db, `reports/${currentAppealReportId}`));
        if (!reportSnap.exists()) {
            alert("Không tìm thấy báo cáo gốc.");
            return;
        }
        const originalContent = reportSnap.val().content;

        // Gọi AI để tóm tắt đối chiếu
        const aiRes = await fetch('http://localhost:5000/api/ai/summarize-appeal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ original: originalContent, appeal: content })
        });
        const aiData = await aiRes.json();
        const summary = aiData.summary || "Lỗi tóm tắt từ AI.";

        // Lưu kháng cáo
        const appealRef = ref(db, `reports/${currentAppealReportId}/appeals/${currentUser}`);
        await set(appealRef, {
            studentName: userName,
            content: content,
            aiSummary: summary,
            timestamp: new Date().toISOString()
        });

        alert("Đã gửi kháng cáo thành công. Ban giám hiệu sẽ xem xét lại sự việc này.");
        closeAppealModal();
    } catch (err) {
        console.error("Lỗi khi gửi kháng cáo:", err);
        alert("Lỗi khi gửi kháng cáo. Vui lòng thử lại.");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Gửi Kháng Cáo';
        }
    }
};
