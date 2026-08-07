import { db, ref, set, get, onValue, remove, child } from '/js/script.js';

window.accountsData = {
    teacher: [],
    student: [],
    parent: []
};

window.currentTab = 'teacher';
window.currentSearchQuery = '';
window.currentFilterExtra = 'all';
window.currentFilterGender = 'all';

// Firebase Realtime Listener
const usersRef = ref(db, 'users');
onValue(usersRef, (snapshot) => {
    window.accountsData = { teacher: [], student: [], parent: [], specialist: [] };
    if (snapshot.exists()) {
        const users = snapshot.val();
        for (const username in users) {
            const user = users[username];
            const item = {
                id: username,
                name: user.name || '',
                gender: user.gender || '',
                roleClass: user.roleClass || '',
                email: username,
                phone: user.phone || '',
                password: user.password || '',
                linkedParent: user.linkedParent || '',
                role: user.role || ''
            };
            if (user.role === 'teacher' || user.role === 'admin') window.accountsData.teacher.push(item);
            else if (user.role === 'student') window.accountsData.student.push(item);
            else if (user.role === 'parent') window.accountsData.parent.push(item);
            else if (user.role === 'specialist') window.accountsData.specialist.push(item);
        }
    }
    updateSidebarCounts();
    renderAccounts();
});

document.addEventListener("DOMContentLoaded", function () {
    updateSidebarCounts();
    initViewModal();
});

function switchTab(tabName) {
    window.currentTab = tabName;
    const activeClasses = ['bg-indigo-600', 'text-white', 'shadow-md'];
    const inactiveClasses = ['bg-gray-50', 'dark:bg-[#141218]', 'hover:bg-gray-100', 'dark:hover:bg-[#36343B]', 'text-gray-700', 'dark:text-[#CAC4D0]'];
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove(...activeClasses);
        // Also remove any stray classes from previous logic
        btn.classList.remove('bg-white', 'dark:bg-[#211F26]', 'text-gray-600');
        btn.classList.add(...inactiveClasses);
    });
    
    const activeBtn = document.getElementById(`tab-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.remove(...inactiveClasses);
        activeBtn.classList.add(...activeClasses);
    }
    updateExtraFilterOptions();
    renderAccounts();
    updateQuickStatistics();
}

function updateExtraFilterOptions() {
    const filterSelect = document.getElementById('filter-extra');
    if (!filterSelect) return;
    filterSelect.innerHTML = '<option value="all">Tất cả</option>';
    let options = [];
    if (window.currentTab === 'student') {
        options = ['9A1', '9A2', '9A3'];
    } else if (window.currentTab === 'teacher') {
        options = ['Toán', 'Văn', 'Anh', 'Lý', 'Hóa', 'Ban Giám Hiệu'];
    }
    options.forEach(opt => {
        filterSelect.innerHTML += `<option value="${opt}">${opt}</option>`;
    });
}

function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('filter-extra').value = 'all';
    document.getElementById('filter-gender').value = 'all';
    window.currentSearchQuery = '';
    window.currentFilterExtra = 'all';
    window.currentFilterGender = 'all';
    renderAccounts();
}

function handleSearch(event) {
    if (!event || !event.target) return;
    window.currentSearchQuery = event.target.value.toLowerCase().trim();
    renderAccounts();
}

function handleFilterChange() {
    window.currentFilterExtra = document.getElementById('filter-extra').value;
    window.currentFilterGender = document.getElementById('filter-gender').value;
    renderAccounts();
}

function updateStatistics(total, filteredCount) {
    const el = document.getElementById('pagination-info');
    if (el) el.innerText = `Hiển thị ${filteredCount} / ${total} tài khoản trong danh mục này`;
}

function updateSidebarCounts() {
    const teacherCount = window.accountsData.teacher.length;
    const studentCount = window.accountsData.student.length;
    const parentCount = window.accountsData.parent.length;
    const elT = document.getElementById('count-teacher');
    const elS = document.getElementById('count-student');
    const elP = document.getElementById('count-parent');
    if (elT) elT.innerText = teacherCount;
    if (elS) elS.innerText = studentCount;
    if (elP) elP.innerText = parentCount;
}

function renderAccounts() {
    const list = window.accountsData[window.currentTab] || [];
    let filtered = list.filter(item => {
        let matchSearch = item.name.toLowerCase().includes(window.currentSearchQuery) ||
            item.email.toLowerCase().includes(window.currentSearchQuery);
        let matchExtra = window.currentFilterExtra === 'all' || item.roleClass === window.currentFilterExtra;
        let matchGender = window.currentFilterGender === 'all' || item.gender === window.currentFilterGender;
        return matchSearch && matchExtra && matchGender;
    });

    const grid = document.getElementById('accounts-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-12 text-center">
                <div class="flex flex-col items-center justify-center">
                    <span class="text-4xl mb-3">👻</span>
                    <p class="text-sm text-gray-500 dark:text-[#CAC4D0] font-medium">Không tìm thấy tài khoản nào phù hợp!</p>
                </div>
            </div>
        `;
        updateStatistics(list.length, 0);
        return;
    }

    filtered.forEach(item => {
        let roleBadge = '';
        if (item.role === 'admin') roleBadge = `<span class="bg-red-50 text-red-600 px-3 py-1 rounded text-xs font-bold shrink-0">Admin</span>`;
        else if (item.role === 'teacher') roleBadge = `<span class="bg-purple-50 text-purple-600 px-3 py-1 rounded text-xs font-bold shrink-0">Giáo viên</span>`;
        else if (item.role === 'student') roleBadge = `<span class="bg-blue-50 text-blue-600 px-3 py-1 rounded text-xs font-bold shrink-0">Học sinh</span>`;
        else if (item.role === 'parent') roleBadge = `<span class="bg-green-50 text-green-600 px-3 py-1 rounded text-xs font-bold shrink-0">Phụ huynh</span>`;
        else if (item.role === 'specialist') roleBadge = `<span class="bg-amber-50 text-amber-600 px-3 py-1 rounded text-xs font-bold shrink-0">Chuyên trách</span>`;

        let linkedParentHtml = '';
        if (window.currentTab === 'student') {
            if (item.linkedParent) {
                linkedParentHtml = `<span class="text-xs bg-green-50 text-green-700 px-3 py-1 rounded border border-green-100 font-mono truncate max-w-[150px] block" title="${item.linkedParent}">Liên kết: ${item.linkedParent}</span>`;
            } else {
                linkedParentHtml = `<span class="text-xs bg-gray-50 dark:bg-[#141218] text-gray-400 px-3 py-1 rounded border border-gray-100 dark:border-[#49454F]/50 shrink-0">Chưa liên kết</span>`;
            }
        } else if (window.currentTab === 'parent') {
            const linkedStudents = window.accountsData.student.filter(s => s.linkedParent === item.email);
            if (linkedStudents.length > 0) {
                const names = linkedStudents.map(s => s.name).join(', ');
                linkedParentHtml = `<span class="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded border border-indigo-100 truncate max-w-[150px] block" title="${names}">Con: ${names}</span>`;
            } else {
                linkedParentHtml = `<span class="text-xs bg-gray-50 dark:bg-[#141218] text-gray-400 px-3 py-1 rounded border border-gray-100 dark:border-[#49454F]/50 shrink-0">Chưa có con</span>`;
            }
        } else {
            linkedParentHtml = `<span class="text-gray-300">-</span>`;
        }

        const card = document.createElement('div');
        card.className = "bg-white dark:bg-[#211F26] border border-gray-100 dark:border-[#49454F]/50 rounded-2xl p-4 shadow-sm hover:shadow-md transition group relative flex flex-col gap-3 min-w-0 overflow-hidden cursor-pointer";
        card.onclick = (e) => {
            if (!e.target.closest('button')) {
                viewAccount(item.id);
            }
        };

        card.innerHTML = `
            <div class="flex items-center gap-3 min-w-0 pr-12">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                    ${item.name.charAt(0).toUpperCase()}
                </div>
                <div class="min-w-0 flex-1">
                    <div class="text-sm font-bold text-gray-900 dark:text-[#E6E0E9] truncate" title="${item.name}">${item.name}</div>
                    <div class="text-xs text-gray-500 dark:text-[#CAC4D0] font-mono truncate" title="${item.email}">${item.email}</div>
                </div>
            </div>
            <div class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition flex gap-1 bg-white dark:bg-[#211F26]/95 backdrop-blur-sm p-1 rounded-lg shadow-sm z-20 border border-gray-100 dark:border-[#49454F]/50">
                <button onclick="viewAccount('${item.id}')" class="text-gray-600 dark:text-[#CAC4D0] hover:text-gray-900 dark:text-[#E6E0E9] bg-gray-50 dark:bg-[#141218] hover:bg-gray-100 dark:hover:bg-[#36343B] p-1.5 rounded-lg transition" title="Xem">👁️</button>
                <button onclick="openModal('${item.id}')" class="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-lg transition" title="Sửa">✏️</button>
                <button onclick="deleteAccount('${item.id}')" class="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition" title="Xóa">🗑️</button>
            </div>
            <div class="flex justify-between items-center text-xs text-gray-600 dark:text-[#CAC4D0] mt-1 min-w-0 gap-2">
                <span class="font-medium bg-gray-50 dark:bg-[#141218] px-2 py-1 rounded truncate max-w-[140px]">${item.roleClass}</span>
                <span class="shrink-0">${item.gender}</span>
            </div>
            <div class="flex justify-between items-center mt-auto pt-2 border-t border-gray-50 min-w-0 gap-2">
                ${roleBadge}
                ${linkedParentHtml}
            </div>
        `;
        grid.appendChild(card);
    });
    updateStatistics(list.length, filtered.length);
    updateQuickStatistics();
}

// === XEM CHI TIẾT (ĐẦY ĐỦ THÔNG TIN NHƯ BẢNG SỬA) ===
function initViewModal() {
    if (document.getElementById('view-account-modal')) return;

    const modalHtml = `
        <div id="view-account-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div class="bg-white dark:bg-[#211F26] w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[95vh]">
                <div class="px-6 py-4 border-b border-gray-100 dark:border-[#49454F]/50 flex items-center justify-between bg-indigo-50/50">
                    <h3 class="text-base font-bold text-gray-900 dark:text-[#E6E0E9]">Chi tiết tài khoản</h3>
                    <button onclick="closeViewModal()" class="text-gray-400 hover:text-gray-600 dark:text-[#CAC4D0] p-1 rounded-lg transition font-bold">✕</button>
                </div>
                
                <div class="p-6 space-y-4 overflow-y-auto text-sm">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-[#CAC4D0] mb-1">Họ và tên</label>
                        <input id="view-input-name" type="text" readonly class="w-full px-3 py-2 bg-gray-50 dark:bg-[#141218] border border-gray-200 dark:border-[#49454F]/50 rounded-xl text-gray-800 dark:text-[#E6E0E9] text-xs font-medium focus:outline-none">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-700 dark:text-[#CAC4D0] mb-1">Giới tính</label>
                            <input id="view-input-gender" type="text" readonly class="w-full px-3 py-2 bg-gray-50 dark:bg-[#141218] border border-gray-200 dark:border-[#49454F]/50 rounded-xl text-gray-800 dark:text-[#E6E0E9] text-xs font-medium focus:outline-none">
                        </div>
                        <div id="view-group-class-field">
                            <label class="block text-xs font-bold text-gray-700 dark:text-[#CAC4D0] mb-1">Lớp / Môn học</label>
                            <input id="view-input-class" type="text" readonly class="w-full px-3 py-2 bg-gray-50 dark:bg-[#141218] border border-gray-200 dark:border-[#49454F]/50 rounded-xl text-gray-800 dark:text-[#E6E0E9] text-xs font-medium focus:outline-none">
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-[#CAC4D0] mb-1">Tên đăng nhập / Email</label>
                        <input id="view-input-email" type="text" readonly class="w-full px-3 py-2 bg-gray-50 dark:bg-[#141218] border border-gray-200 dark:border-[#49454F]/50 rounded-xl text-gray-800 dark:text-[#E6E0E9] text-xs font-medium font-mono focus:outline-none">
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-[#CAC4D0] mb-1">Số điện thoại</label>
                        <input id="view-input-phone" type="text" readonly class="w-full px-3 py-2 bg-gray-50 dark:bg-[#141218] border border-gray-200 dark:border-[#49454F]/50 rounded-xl text-gray-800 dark:text-[#E6E0E9] text-xs font-medium font-mono focus:outline-none">
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-[#CAC4D0] mb-1">Mật khẩu</label>
                        <div class="relative">
                            <input id="view-input-password" type="password" readonly class="w-full px-3 py-2 bg-gray-50 dark:bg-[#141218] border border-gray-200 dark:border-[#49454F]/50 rounded-xl text-gray-800 dark:text-[#E6E0E9] text-xs font-medium font-mono focus:outline-none pr-10">
                            <button type="button" onclick="toggleViewPasswordVisibility()" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-[#CAC4D0] text-xs">
                                <span id="view-eye-icon">👁️</span>
                            </button>
                        </div>
                    </div>

                    <div id="view-parent-link-wrapper">
                        <label class="block text-xs font-bold text-gray-700 dark:text-[#CAC4D0] mb-1">Phụ huynh liên kết</label>
                        <input id="view-input-linked-parent" type="text" readonly class="w-full px-3 py-2 bg-gray-50 dark:bg-[#141218] border border-gray-200 dark:border-[#49454F]/50 rounded-xl text-gray-800 dark:text-[#E6E0E9] text-xs font-medium font-mono focus:outline-none">
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-[#CAC4D0] mb-1">Vai trò hệ thống (Role)</label>
                        <input id="view-input-role" type="text" readonly class="w-full px-3 py-2 bg-gray-50 dark:bg-[#141218] border border-gray-200 dark:border-[#49454F]/50 rounded-xl text-gray-800 dark:text-[#E6E0E9] text-xs font-medium focus:outline-none">
                    </div>
                </div>

                <div class="px-6 py-3 border-t border-gray-100 dark:border-[#49454F]/50 bg-gray-50 dark:bg-[#141218] flex justify-end">
                    <button onclick="closeViewModal()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition">Đóng</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function viewAccount(id) {
    initViewModal();
    const list = window.accountsData[window.currentTab] || [];
    const item = list.find(x => x.id === id);
    if (!item) return;

    const wrapper = document.getElementById('view-parent-link-wrapper');
    const classField = document.getElementById('view-group-class-field');

    if (window.currentTab === 'student') {
        wrapper.style.display = 'block';
        classField.style.display = 'block';
    } else if (window.currentTab === 'teacher') {
        wrapper.style.display = 'none';
        classField.style.display = 'block';
    } else {
        wrapper.style.display = 'none';
        classField.style.display = 'none';
    }

    document.getElementById('view-input-name').value = item.name;
    document.getElementById('view-input-gender').value = item.gender;
    document.getElementById('view-input-class').value = item.roleClass;
    document.getElementById('view-input-email').value = item.email;
    document.getElementById('view-input-password').value = item.password || '';
    document.getElementById('view-input-role').value = item.role;
    document.getElementById('view-input-phone').value = item.phone || 'Chưa cập nhật';

    // Hiển thị thông tin liên kết rõ ràng
    let linkedText = 'Không liên kết / Tự lập';
    if (window.currentTab === 'student') {
        if (item.linkedParent) {
            const p = window.accountsData.parent.find(x => x.email === item.linkedParent);
            linkedText = p ? `${p.name} (${p.email})` : item.linkedParent;
        } else {
            linkedText = 'Chưa liên kết phụ huynh';
        }
    } else if (window.currentTab === 'parent') {
        const linkedStudents = window.accountsData.student.filter(s => s.linkedParent === item.email);
        linkedText = linkedStudents.length > 0 ? linkedStudents.map(s => `${s.name} (${s.email})`).join(', ') : 'Chưa có con liên kết';
    }
    document.getElementById('view-input-linked-parent').value = linkedText;

    // Reset lại trạng thái mật khẩu về ẩn khi mở
    document.getElementById('view-input-password').type = 'password';
    document.getElementById('view-eye-icon').textContent = '👁️';

    document.getElementById('view-account-modal').classList.remove('hidden');
}

function closeViewModal() {
    const modal = document.getElementById('view-account-modal');
    if (modal) modal.classList.add('hidden');
}

function toggleViewPasswordVisibility() {
    const input = document.getElementById('view-input-password');
    const icon = document.getElementById('view-eye-icon');
    if (!input || !icon) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = '🙈';
    } else {
        input.type = 'password';
        icon.textContent = '👁️';
    }
}

// === QUẢN LÝ CUSTOM DROPDOWN PHỤ HUYNH ===
function toggleParentDropdown() {
    const dropdown = document.getElementById('parent-search-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
    if (!dropdown.classList.contains('hidden')) {
        document.getElementById('parent-search-input').focus();
    }
}

function filterParentList() {
    const query = document.getElementById('parent-search-input').value.toLowerCase();
    renderParentOptions(query);
}

function selectParentOption(value, label) {
    document.getElementById('input-linked-parent').value = value;
    document.getElementById('parent-select-label').textContent = label;
    document.getElementById('parent-search-dropdown').classList.add('hidden');
}

function renderParentOptions(query = '') {
    const list = document.getElementById('parent-options-list');
    if (!list) return;
    list.innerHTML = `<div onclick="selectParentOption('', '-- Không liên kết / Tự lập --')" class="px-4 py-2.5 hover:bg-indigo-50 cursor-pointer text-xs font-medium text-gray-700 dark:text-[#CAC4D0] transition">-- Không liên kết / Tự lập --</div>`;

    const parents = window.accountsData.parent || [];
    parents.forEach(p => {
        const searchStr = `${p.name} ${p.email} ${p.phone}`.toLowerCase();
        if (searchStr.includes(query)) {
            const el = document.createElement('div');
            el.className = "px-4 py-2.5 hover:bg-indigo-50 cursor-pointer border-t border-gray-50 transition min-w-0";
            el.innerHTML = `
                <div class="text-xs font-bold text-gray-800 dark:text-[#E6E0E9] truncate">${p.name}</div>
                <div class="text-xs text-gray-500 dark:text-[#CAC4D0] font-mono break-all">${p.email} | ${p.phone}</div>
            `;
            el.onclick = () => selectParentOption(p.email, `${p.name} (${p.email})`);
            list.appendChild(el);
        }
    });
}

document.addEventListener('click', function (e) {
    const wrapper = document.getElementById('parent-link-wrapper');
    const dropdown = document.getElementById('parent-search-dropdown');
    if (wrapper && dropdown && !wrapper.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

function openModal(id = null) {
    const modal = document.getElementById('account-modal');
    const title = document.getElementById('modal-title');
    const wrapper = document.getElementById('parent-link-wrapper');
    const classField = document.getElementById('group-class-field');

    if (window.currentTab === 'student') {
        wrapper.style.display = 'block';
        classField.style.display = 'block';
    } else if (window.currentTab === 'teacher') {
        wrapper.style.display = 'none';
        classField.style.display = 'block';
    } else {
        wrapper.style.display = 'none';
        classField.style.display = 'none';
    }

    renderParentOptions();
    document.getElementById('parent-search-input').value = '';

    if (id && id !== 'add') {
        if (title) title.innerText = `Chỉnh sửa tài khoản`;
        const list = window.accountsData[window.currentTab] || [];
        const item = list.find(x => x.id === id);
        if (item) {
            document.getElementById('edit-id').value = item.id;
            document.getElementById('input-name').value = item.name;
            document.getElementById('input-gender').value = item.gender;
            document.getElementById('input-class').value = item.roleClass;
            document.getElementById('input-email').value = item.email;
            document.getElementById('input-role').value = item.role;
            document.getElementById('input-password').value = item.password || '';
            document.getElementById('input-phone').value = item.phone || '';

            if (item.linkedParent) {
                const p = window.accountsData.parent.find(x => x.email === item.linkedParent);
                if (p) selectParentOption(p.email, `${p.name} (${p.email})`);
                else selectParentOption(item.linkedParent, item.linkedParent);
            } else {
                selectParentOption('', '-- Không liên kết / Tự lập --');
            }
        }
    } else {
        if (title) title.innerText = `Thêm tài khoản mới`;
        document.getElementById('edit-id').value = '';
        document.getElementById('input-name').value = '';
        document.getElementById('input-gender').value = 'Nam';
        document.getElementById('input-class').value = window.currentTab === 'student' ? '9A1' : (window.currentTab === 'teacher' ? 'Toán' : 'Phụ huynh');
        document.getElementById('input-email').value = '';
        document.getElementById('input-role').value = window.currentTab === 'teacher' ? 'school' : window.currentTab;
        document.getElementById('input-password').value = '';
        selectParentOption('', '-- Không liên kết / Tự lập --');
    }

    if (modal) {
        modal.classList.remove('hidden');
    }
}

function handleFormSubmit(event) {
    event.preventDefault();
    const editId = document.getElementById('edit-id').value;
    const name = document.getElementById('input-name').value;
    const gender = document.getElementById('input-gender').value;
    const roleClass = document.getElementById('input-class').value;
    const email = document.getElementById('input-email').value;
    const password = document.getElementById('input-password').value;
    const linkedParent = document.getElementById('input-linked-parent').value;
    const role = document.getElementById('input-role').value;
    const phone = document.getElementById('input-phone').value;

    if (!email || !password) {
        alert("Tên đăng nhập và mật khẩu không được để trống!");
        return;
    }

    if (editId && editId !== email) {
        remove(ref(db, 'users/' + editId)).catch(e => console.error("Không thể xóa user cũ", e));
    }

    set(ref(db, 'users/' + email), {
        name,
        gender,
        roleClass,
        phone,
        password,
        linkedParent,
        role
    }).then(() => {
        alert(editId ? "Cập nhật tài khoản thành công!" : "Thêm tài khoản mới thành công!");
        close_create();
    }).catch(err => {
        alert("Có lỗi xảy ra: " + err.message);
    });
}

function deleteAccount(id) {
    if (confirm("Bạn có chắc chắn muốn xóa tài khoản này khỏi hệ thống?")) {
        remove(ref(db, 'users/' + id)).then(() => {
            alert("Đã xóa tài khoản thành công!");
        }).catch(err => {
            alert("Có lỗi xảy ra: " + err.message);
        });
    }
}

function toggleSidebar(open) {
    const sidebar = document.getElementById('sidebar-left');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;
    if (open) {
        sidebar.classList.remove('-translate-x-full');
        backdrop.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        backdrop.classList.add('hidden');
    }
}

function close_create() {
    const modal = document.getElementById('account-modal');
    if (modal) modal.classList.add('hidden');
}

function updateQuickStatistics() {
    const currentList = window.accountsData[window.currentTab] || [];
    
    // Tính tổng số lượng trong tab hiện tại
    const totalEl = document.getElementById('stat-total');
    if (totalEl) totalEl.innerText = currentList.length;

    // Thống kê giới tính (Nam / Nữ)
    let maleCount = 0;
    let femaleCount = 0;
    
    // Thống kê phân bổ lớp / môn học
    const classCounts = {};

    currentList.forEach(item => {
        if (item.gender === 'Nam') maleCount++;
        if (item.gender === 'Nữ') femaleCount++;

        if (item.roleClass) {
            classCounts[item.roleClass] = (classCounts[item.roleClass] || 0) + 1;
        }
    });

    const maleEl = document.getElementById('stat-male');
    const femaleEl = document.getElementById('stat-female');
    if (maleEl) maleEl.innerText = maleCount;
    if (femaleEl) femaleEl.innerText = femaleCount;

    // Hiển thị phân bổ lớp / nhóm
    const classesEl = document.getElementById('stat-classes');
    if (classesEl) {
        const classEntries = Object.entries(classCounts);
        if (classEntries.length === 0) {
            classesEl.innerText = 'Trống';
            classesEl.title = 'Không có dữ liệu lớp';
        } else if (classEntries.length === 1) {
            classesEl.innerText = classEntries[0][0];
            classesEl.title = classEntries[0][0];
        } else {
            // Hiển thị dạng ngắn gọn hoặc tổng số lớp khác nhau
            const summaryText = classEntries.map(([cls, count]) => `${cls} (${count})`).join(', ');
            classesEl.innerText = `${classEntries.length} phân loại`;
            classesEl.title = summaryText;
        }
    }

    // Cập nhật khối học linh hoạt theo tab
    const blockEl = document.getElementById('stat-block');
    if (blockEl) {
        if (window.currentTab === 'student') blockEl.innerText = 'Khối học sinh';
        else if (window.currentTab === 'teacher') blockEl.innerText = 'Giáo viên/BGH';
        else if (window.currentTab === 'parent') blockEl.innerText = 'Phụ huynh';
    }
}

// Window attachments for inline event handlers
window.switchTab = switchTab;
window.updateExtraFilterOptions = updateExtraFilterOptions;
window.resetFilters = resetFilters;
window.handleSearch = handleSearch;
window.handleFilterChange = handleFilterChange;
window.renderAccounts = renderAccounts;
window.updateStatistics = updateStatistics;
window.updateSidebarCounts = updateSidebarCounts;
window.openModal = openModal;
window.handleFormSubmit = handleFormSubmit;
window.deleteAccount = deleteAccount;
window.toggleSidebar = toggleSidebar;
window.close_create = close_create;
window.toggleParentDropdown = toggleParentDropdown;
window.filterParentList = filterParentList;
window.selectParentOption = selectParentOption;
window.viewAccount = viewAccount;
window.closeViewModal = closeViewModal;
window.toggleViewPasswordVisibility = toggleViewPasswordVisibility;
window.updateQuickStatistics = updateQuickStatistics();
window.toggleAccPasswordVisibility = function () {
    const input = document.getElementById('input-password');
    const icon = document.getElementById('acc-eye-icon');
    if (!input || !icon) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = '👁️';
    } else {
        input.type = 'password';
        icon.textContent = '🙈';
    }
};