import { db, ref, set, get, storage, storageRef, uploadBytes, getDownloadURL, push } from '/js/script.js';

// Định nghĩa hàm toàn cục để bên HTML gọi onclick="openSpecialistChatFromReport()" hoạt động chính xác
window.openSpecialistChatFromReport = function() {
    window.location.href = '/Pages/User_page/Chatbot_page.html';
};

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
        const submitBtn = document.getElementById('submit-btn');

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

            reportForm.addEventListener('submit', async function(e) {
                e.preventDefault();

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '⏳ Đang gửi báo cáo...';
                }

                try {
                    const isAnonymous = isAnonymousCheckbox ? isAnonymousCheckbox.checked : true;
                    const studentName = isAnonymous ? 'Ẩn danh' : document.getElementById('student-name').value;
                    const phone = document.getElementById('student-phone').value;
                    const gender = document.getElementById('student-gender').value;
                    const studentClass = document.getElementById('student-class').value;
                    const school = document.getElementById('student-school').value;
                    const content = document.getElementById('incident-content').value;
                    const isUrgent = document.getElementById('isUrgent').checked;
                    
                    const fileInput = document.getElementById('real-file-input');
                    const file = fileInput.files[0];
                    let fileUrl = null;

                    const reportId = 'REP-' + Math.floor(100000 + Math.random() * 900000);
                    const reportPin = Math.floor(100000 + Math.random() * 900000).toString();

                    if (file) {
                        const fileRef = storageRef(storage, `reports/${reportId}/${file.name}`);
                        await uploadBytes(fileRef, file);
                        fileUrl = await getDownloadURL(fileRef);
                    }

                    const currentUser = localStorage.getItem('currentUser') || 'Anonymous';
                    
                    const lowerContent = content.toLowerCase();
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
                        // Fallback
                        const spamKeywords = ["test", "đùa", "haha", "hihi", "ê tày", "123", "abc", "không có gì", "chửi"];
                        if (content.length < 10 || spamKeywords.some(kw => lowerContent.includes(kw))) {
                            isSuspectedFake = true;
                        }
                    }

                    await set(ref(db, 'reports/' + reportId), {
                        id: reportId,
                        pin: reportPin,
                        senderId: currentUser,
                        senderName: studentName,
                        phone: phone,
                        gender: gender,
                        studentClass: studentClass,
                        school: school,
                        content: content,
                        priority: isUrgent ? 'urgent' : 'regular',
                        status: 'received',
                        createdAt: new Date().toISOString(),
                        attachmentUrl: fileUrl,
                        attachmentName: file ? file.name : null,
                        source: 'manual',
                        isSuspectedFake: isSuspectedFake,
                        feedback: "Cảm ơn em đã gửi báo cáo. Nhà trường đã tiếp nhận và đang tiến hành xác minh thông tin."
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
                                            message: `Bạn được nhắc đến trong một báo cáo sự việc (Mã: ${reportId}). Nếu bạn thấy đây là hiểu lầm, vui lòng gửi kháng cáo.`,
                                            date: new Date().toISOString(),
                                            isRead: false,
                                            type: "warning",
                                            reportId: reportId
                                        });

                                        // Gửi cho phụ huynh liên kết (nếu có)
                                        if (uData.linkedParent) {
                                            const pNotifId = 'NOTIF-P-' + Date.now();
                                            await set(ref(db, `notifications/${uData.linkedParent}/${pNotifId}`), {
                                                id: pNotifId,
                                                title: "⚠️ Thông báo từ nhà trường",
                                                message: `Con em bạn (${uData.name}) có liên quan đến một báo cáo (Mã: ${reportId}).`,
                                                date: new Date().toISOString(),
                                                isRead: false,
                                                type: "warning",
                                                reportId: reportId
                                            });
                                        }
                                    }
                                }
                            }
                        } catch (err) {
                            console.error("Lỗi gửi thông báo AI:", err);
                        }
                    }

                    // Tự động tạo đoạn chat mới trên Firebase cho quản trị viên
                    try {
                        const userPathKey = reportId.replace(/[^a-zA-Z0-9]/g, "_");
                        const sessionKey = "session_" + Date.now();
                        
                        // Đồng bộ đẩy vào nhánh 'chats' (hoặc cấu trúc mà chatbot đang quản lý danh sách học sinh)
                        const sessionRef = ref(db, `chats/${userPathKey}/sessions/${sessionKey}`);
                        
                        await set(sessionRef, {
                            id: sessionKey,
                            name: studentName,
                            roleClass: `Lớp ${studentClass} - Mã BC: ${reportId}`,
                            sourceType: "chats",
                            userPathKey: userPathKey,
                            timestamp: new Date().toISOString(),
                            lastMessage: `[Báo cáo ${reportId}]: ${content.substring(0, 30)}...`
                        });

                        // Gửi tin nhắn mở đầu tự động vào phiên
                        const messagesRef = ref(db, `chats/${userPathKey}/sessions/${sessionKey}/messages`);
                        const newMsgRef = push(messagesRef);
                        await set(newMsgRef, {
                            sender: "system",
                            text: `Xin chào thầy/cô, em cần hỗ trợ về nội dung báo cáo mã số: ${reportId}. Nội dung: "${content}"`,
                            timestamp: new Date().toISOString()
                        });

                        // Lưu lại thông tin active session để trang chatbot tự động chọn đúng phiên này
                        localStorage.setItem('active_specialist_session', JSON.stringify({
                            sourceType: "chats",
                            userPathKey: userPathKey,
                            sessionId: sessionKey
                        }));
                    } catch (chatErr) {
                        console.error("Lỗi khi tự động tạo phiên chat:", chatErr);
                    }

                    const savedReports = JSON.parse(localStorage.getItem('userReports') || '[]');
                    savedReports.unshift({
                        id: reportId,
                        pin: reportPin,
                        time: new Date().toISOString(),
                        contentSnippet: content.substring(0, 30) + '...'
                    });
                    localStorage.setItem('userReports', JSON.stringify(savedReports));

                    const idSpan = document.getElementById('success-report-id');
                    const pinSpan = document.getElementById('success-report-pin');
                    if(idSpan) idSpan.innerText = reportId;
                    if(pinSpan) pinSpan.innerText = reportPin;

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
                        submitBtn.innerHTML = '🛡️ Gửi Báo Cáo Bảo Mật';
                    }
                }
            });

            const newReportBtn = document.getElementById('btn-new-report') || successContainer.querySelector('button');
            if (newReportBtn) {
                newReportBtn.addEventListener('click', function() {
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

window.initReportForm = initReportForm;