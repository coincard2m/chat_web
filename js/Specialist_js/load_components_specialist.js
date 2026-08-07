// Load components for Specialist pages
function loadProfileView(containerId = "modal-container") {
    loadComponent(containerId, "/Manage_components/Account_manage.html");
}
function loadSetting_Page(containerId = "modal-container") {
    loadComponent(containerId, "/Admin_components/Setting_admin.html");
}

function closeModal(containerId = "modal-container") {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
}

async function loadComponent(id, file) {
    const secureFile = file.startsWith('/') ? file : ('/' + file);
    try {
        const response = await fetch(secureFile);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const container = document.getElementById(id);
        if (container) {
            container.innerHTML = html;
            const scripts = container.querySelectorAll('script');
            scripts.forEach(s => {
                const newScript = document.createElement('script');
                if (s.src) newScript.src = s.src;
                else newScript.textContent = s.textContent;
                document.body.appendChild(newScript);
            });
        }
    } catch (err) {
        console.error('Error loading component:', err);
    }
}

// Load navbar
(function() {
    loadComponent("navbar", "/Specialist_components/navbar.html");
    setTimeout(() => {
        if (typeof initNavbar === "function") initNavbar();
    }, 300);
})();
