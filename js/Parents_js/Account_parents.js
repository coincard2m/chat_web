function initProfileComponent() {
    setTimeout(async () => {
        const btnClose = document.getElementById('btn-close-profile');
        const profileCard = document.getElementById('account-component');

        if (profileCard) {
            profileCard.classList.add('transition-all', 'duration-300', 'transform');
        }

        if (btnClose) {
            btnClose.onclick = function () { closeModal(); };
        }

        document.addEventListener('keydown', handleEscKey);

        // Load dữ liệu thực từ Firebase
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
            try {
                const { db, ref, get } = await import('/js/script.js');
                const snapshot = await get(ref(db, `users/${currentUser}`));
                if (snapshot.exists()) {
                    const data = snapshot.val();

                    if (data.avatar) {
                        const imgEl = document.getElementById('profile-avatar-img');
                        const placeholder = document.getElementById('profile-avatar-placeholder');
                        if (imgEl && placeholder) {
                            imgEl.src = data.avatar;
                            imgEl.classList.remove('hidden');
                            placeholder.classList.add('hidden');
                        }
                    }
            

                    // Tên người dùng
                    const nameEls = document.querySelectorAll('#account-component .name-field');
                    nameEls.forEach(el => el.textContent = data.name || currentUser);

                    // Trường hợp không có class, fallback tìm vị trí thứ nhất
                    const allFields = document.querySelectorAll('#account-component .profile-field');
                    if (allFields.length > 0) {
                        // Đặt các giá trị động nếu có phần tử target
                    }

                    // Tìm và cập nhật tên
                    fillField('profile-name', data.name || currentUser);
                    fillField('profile-phone', data.phone || '—');
                    fillField('profile-gender', data.gender || '—');
                    fillField('profile-class', data.roleClass || '—');
                    fillField('profile-role', translateRole(data.role));

                    // Nếu là phụ huynh: tìm học sinh liên kết
                    if (data.role === 'parent') {
                        const usersSnap = await get(ref(db, 'users'));
                        if (usersSnap.exists()) {
                            const allUsers = usersSnap.val();
                            const linked = Object.values(allUsers).find(u => u.linkedParent === currentUser);
                            fillField('profile-child', linked ? linked.name : 'Chưa liên kết');
                        }
                    }
                }
            } catch (e) {
                console.error('Lỗi load profile:', e);
            }
        }

        console.log('✅ Profile Component initialized');
    }, 50);
}

function fillField(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function translateRole(role) {
    const map = { admin: 'Quản trị viên', school: 'Giáo viên / Nhà trường', parent: 'Phụ huynh', student: 'Học sinh' };
    return map[role] || role;
}

function closeModal() {
    const modalWrapper = document.querySelector('#modal-container > div');
    const profileCard = document.getElementById('account-component');

    if (modalWrapper && profileCard) {
        modalWrapper.classList.remove('opacity-100');
        modalWrapper.classList.add('opacity-0');
        profileCard.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
        profileCard.classList.add('opacity-0', 'translate-y-4', 'scale-95');

        setTimeout(() => {
            const container = document.getElementById('modal-container');
            if (container) container.innerHTML = '';
            document.removeEventListener('keydown', handleEscKey);
        }, 300);
    } else {
        const container = document.getElementById('modal-container');
        if (container) container.innerHTML = '';
    }
}

function handleEscKey(e) {
    if (e.key === "Escape") closeModal();
}

window.initProfileComponent = initProfileComponent;
window.closeModal = closeModal;

window.handleAvatarUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) return;
    
    const loadingEl = document.getElementById('avatar-upload-loading');
    if(loadingEl) loadingEl.classList.remove('hidden');
    
    try {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await new Promise(resolve => img.onload = resolve);
        
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 150;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
            if (width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
            }
        } else {
            if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
            }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        
        const { storage, storageRef, uploadBytes, getDownloadURL, db, ref, update } = await import('/js/script.js');
        const fileRef = storageRef(storage, `avatars/${currentUser}.jpg`);
        await uploadBytes(fileRef, blob);
        const downloadURL = await getDownloadURL(fileRef);
        
        await update(ref(db, `users/${currentUser}`), {
            avatar: downloadURL
        });
        
        const imgEl = document.getElementById('profile-avatar-img');
        const placeholder = document.getElementById('profile-avatar-placeholder');
        if (imgEl && placeholder) {
            imgEl.src = downloadURL;
            imgEl.classList.remove('hidden');
            placeholder.classList.add('hidden');
        }
        
        if (typeof window.updateNavbarAvatar === 'function') {
            window.updateNavbarAvatar(downloadURL);
        }
        
    } catch (e) {
        console.error("Lỗi upload avatar:", e);
        alert("Có lỗi xảy ra khi tải ảnh lên!");
    } finally {
        if(loadingEl) loadingEl.classList.add('hidden');
    }
};
