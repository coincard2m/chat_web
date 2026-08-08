import { db, ref, update } from '/js/script.js';

window.submitChangePassword = function() {
    const newPass = document.getElementById('new-password-input').value;
    const confirmPass = document.getElementById('confirm-password-input').value;
    
    if (!newPass || !confirmPass) {
        alert("Vui lòng nhập đầy đủ mật khẩu mới và xác nhận.");
        return;
    }
    
    if (newPass !== confirmPass) {
        alert("Mật khẩu xác nhận không khớp!");
        return;
    }
    
    const currentUsername = localStorage.getItem('currentUser');
    if (!currentUsername) {
        alert("Không tìm thấy thông tin phiên đăng nhập. Vui lòng đăng nhập lại.");
        return;
    }
    
    const userRef = ref(db, 'users/' + currentUsername);
    update(userRef, {
        password: newPass
    }).then(() => {
        alert("Đổi mật khẩu thành công!");
        document.getElementById('change-password-section').classList.add('hidden');
        document.getElementById('new-password-input').value = '';
        document.getElementById('confirm-password-input').value = '';
    }).catch((err) => {
        alert("Có lỗi xảy ra: " + err.message);
    });
};

