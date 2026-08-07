async function loadSetting_Page(containerId = "modal-container") {
    try {
        // Sử dụng dấu "/" ở đầu để đảm bảo dù đứng ở trang nào cũng load đúng từ thư mục gốc
        const response = await fetch("/Admin_components/Setting_admin.html");
        
        if (!response.ok) throw new Error("Không tải được trang cài đặt");

        const html = await response.text();
        document.getElementById(containerId).innerHTML = html;

        // Khởi tạo JS cho form sau khi load
        if (typeof initSettingsComponent === "function") {
            initSettingsComponent();
        }

    } catch (error) {
        console.error("Lỗi load trang cài đặt:", error);
        document.getElementById(containerId).innerHTML = `
            <p class="text-red-500 p-4">Không thể tải trang cài đặt. Vui lòng thử lại sau.</p>
        `;
    }
}

async function loadProfileView(containerId = "modal-container") {
    try {
        // Sử dụng dấu "/" ở đầu để đảm bảo dù đứng ở trang nào cũng load đúng từ thư mục gốc
        const response = await fetch("/Admin_components/Account_admin.html");
        
        if (!response.ok) throw new Error("Không tải được trang tài khoản người dùng");

        const html = await response.text();
        document.getElementById(containerId).innerHTML = html;

        // Khởi tạo JS cho form sau khi load
        // Tự động nạp Account.js nếu chưa có để đảm bảo initProfileComponent và handleAvatarUpload hoạt động
        if (typeof initProfileComponent === "function") {
            initProfileComponent();
        } else {
            const script = document.createElement('script');
            script.src = '/js/Account.js';
            script.onload = () => {
                if (typeof window.initProfileComponent === "function") window.initProfileComponent();
            };
            document.body.appendChild(script);
        }

    } catch (error) {
        console.error("Lỗi load trang tài khoản người dùng:", error);
        document.getElementById(containerId).innerHTML = `
            <p class="text-red-500 p-4">Không thể tải trang tài khoản người dùng. Vui lòng thử lại sau.</p>
        `;
    }
}

// Hàm load các thành phần chung như Navbar, Footer
async function loadComponent(id, file) {
    try {
        // Thêm dấu / vào đầu nếu file truyền vào chưa có, để tránh lỗi sai đường dẫn ở trang phụ
        const secureFile = file.startsWith('/') ? file : `/${file}`;
        const response = await fetch(secureFile);

        if (!response.ok) {
            throw new Error(`Không thể tải ${secureFile}`);
        }

        const html = await response.text();

        // Kiểm tra xem ID vùng chứa có tồn tại trên trang hiện tại không
        const container = document.getElementById(id);
        if (container) {
            container.innerHTML = html;
        }

        // Nếu vừa load Navbar thì khởi tạo JS của Navbar
        if (id === "navbar" && typeof initNavbar === "function") {
            initNavbar();
        }

    } catch (error) {
        console.error(error);
    }
}

function loadPage(file){
    loadComponent("modal-container", file);
}

function closeModal() {
    const modalWrapper = document.querySelector('#modal-container > div');
    const mainContent = document.querySelector('#modal-container main');

    if (modalWrapper && mainContent) {
        // Kích hoạt hiệu ứng mờ dần và thu nhỏ khi đóng
        modalWrapper.classList.remove('opacity-100');
        modalWrapper.classList.add('opacity-0');

        mainContent.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
        mainContent.classList.add('opacity-0', 'translate-y-4', 'scale-95');

        // Chờ hiệu ứng chạy xong 300ms rồi mới xóa hẳn HTML đi
        setTimeout(() => {
            document.getElementById('modal-container').innerHTML = '';
        }, 300);
    } else {
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) modalContainer.innerHTML = '';
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadComponent("navbar", "Admin_components/navbar.html");
    loadComponent("footer", "Admin_components/footer.html");
});

// Export các hàm để tất cả các file HTML hoặc thẻ điều hướng gọi được toàn cục
window.loadComponent = loadComponent;
window.loadPage = loadPage;
window.closeModal = closeModal;