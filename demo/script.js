const STORAGE_KEY = 'doctorsuno-demo-v1';

const seedState = () => ({
    patients: [
        { id: 1, name: 'Arjun Sharma', lastVisit: '10:00 AM • 02 Jun', vitals: 148, lastLab: '5 mins ago', status: 'overdue' },
        { id: 2, name: 'Priya Patel', lastVisit: '11:00 AM • 01 Jun', vitals: 132, lastLab: '6 mins ago', status: 'overdue' },
        { id: 3, name: 'Vikram Singh', lastVisit: '9:00 AM • 31 May', vitals: 125, lastLab: '2 days ago', status: 'completed' }
    ],
    appointments: [
        { id: 1, name: 'Ananya Desai', time: '10:00 AM • Today', active: true },
        { id: 2, name: 'Rahul Verma', time: '11:30 AM • Today', active: false },
        { id: 3, name: 'Neha Gupta', time: '02:00 PM • Today', active: false },
        { id: 4, name: 'Kavita Reddy', time: '04:30 PM • Today', active: false }
    ],
    tasks: [
        { id: 1, title: 'Update OPD report', time: '15 mins ago', priority: 'medium', completed: true },
        { id: 2, title: 'Schedule appointment', time: '30 mins ago', priority: 'low', completed: false },
        { id: 3, title: 'Upload lab reports', time: '1 hour ago', priority: 'high', completed: false },
        { id: 4, title: 'View Nomination', time: '10 Nov, 4pm', priority: 'none', completed: false }
    ],
    staff: [
        { id: 1, name: 'Dr. Anjali Desai', role: 'Cardiologist' },
        { id: 2, name: 'Vikram Mehta', role: 'Head Nurse' }
    ],
    clinic: {
        name: 'DoctorSuno Primary Care',
        address: '123 Health Ave, Medical District',
        email: 'contact@doctorsuno.com'
    },
    view: 'dashboard-view',
    vitalsRange: 'All'
});

const loadState = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (saved && typeof saved === 'object') return { ...seedState(), ...saved };
    } catch { /* storage unavailable or corrupt: fall back to seed data */ }
    return seedState();
};

let appState = loadState();

const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appState)); } catch { /* private mode: keep in memory */ }
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (name) => name.replace(/^dr\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
const AVATAR_TONES = ['tone-1', 'tone-2', 'tone-3', 'tone-4', 'tone-5'];
const avatarTone = (name) => AVATAR_TONES[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % AVATAR_TONES.length];
const avatar = (name) => `<span class="avatar ${avatarTone(name)}">${esc(initials(name))}</span>`;
const statusBadge = (status) => `<span class="status-badge ${status}"><span class="status-dot"></span>${status === 'overdue' ? 'Overdue' : 'Completed'}</span>`;
const nextId = (list) => list.reduce((max, item) => Math.max(max, item.id), 0) + 1;

// Render Functions
function renderDashboardHistory() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    tbody.innerHTML = appState.patients.slice(0, 5).map(p => `
        <tr>
            <td><span class="cell-person">${avatar(p.name)}${esc(p.name)}</span></td>
            <td class="muted">${esc(p.lastVisit)}</td>
            <td class="num">${esc(p.vitals)}</td>
            <td class="muted">${esc(p.lastLab)}</td>
            <td>${statusBadge(p.status)}</td>
        </tr>
    `).join('') || `<tr><td colspan="5" class="table-empty">No patients yet.</td></tr>`;
}

function renderUpcomingAppointments() {
    const container = document.getElementById('appointments-list-container');
    if (!container) return;
    container.innerHTML = appState.appointments.map(a => `
        <button type="button" class="appointment-row ${a.active ? 'active' : ''}" data-id="${a.id}" aria-pressed="${a.active}">
            ${avatar(a.name)}
            <span class="appt-info">
                <strong>${esc(a.name)}</strong>
                <span>${esc(a.time)}</span>
            </span>
            <span class="material-symbols-outlined appt-arrow">chevron_right</span>
        </button>
    `).join('');
    document.getElementById('appointments-count').textContent = `${appState.appointments.length} today`;

    container.querySelectorAll('.appointment-row').forEach(row => {
        row.addEventListener('click', () => {
            const id = parseInt(row.getAttribute('data-id'));
            appState.appointments.forEach(appt => { appt.active = (appt.id === id); });
            save();
            renderUpcomingAppointments();
        });
    });
}

function renderTasks() {
    const container = document.getElementById('tasks-list-container');
    if (!container) return;

    container.innerHTML = appState.tasks.map(t => `
        <div class="task-row ${t.completed ? 'done' : ''}">
            <label class="task-check">
                <input type="checkbox" data-id="${t.id}" ${t.completed ? 'checked' : ''}>
                <span class="task-text">
                    <strong>${esc(t.title)}</strong>
                    <span>${esc(t.time)}</span>
                </span>
            </label>
            <span class="priority ${t.priority}" title="${t.priority === 'none' ? 'No priority' : t.priority + ' priority'}"></span>
            <button type="button" class="icon-btn sm row-remove" data-remove-task="${t.id}" aria-label="Remove task ${esc(t.title)}">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>
    `).join('') || `<p class="list-empty">No tasks. Add one below.</p>`;

    const open = appState.tasks.filter(t => !t.completed).length;
    document.getElementById('tasks-count').textContent = `${open} open`;

    container.querySelectorAll('input[type="checkbox"]').forEach(box => {
        box.addEventListener('change', (e) => {
            const task = appState.tasks.find(t => t.id === parseInt(e.target.getAttribute('data-id')));
            task.completed = e.target.checked;
            save();
            renderTasks();
        });
    });
    container.querySelectorAll('[data-remove-task]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.getAttribute('data-remove-task'));
            appState.tasks = appState.tasks.filter(t => t.id !== id);
            save();
            renderTasks();
        });
    });
}

function updateDashboardMetrics() {
    const totalSeen = 2611 + appState.patients.length;
    const el = document.getElementById('patients-seen-value');
    if (el) el.textContent = totalSeen.toLocaleString();
    const navCount = document.getElementById('nav-patients-count');
    if (navCount) navCount.textContent = appState.patients.length;
}

function renderPatientsDirectory() {
    const tbody = document.getElementById('patients-directory-body');
    if (!tbody) return;
    const filterStatus = document.getElementById('patients-filter')?.value || 'All';
    const q = (document.getElementById('patients-search')?.value || '').trim().toLowerCase();

    let filtered = appState.patients;
    if (filterStatus !== 'All') filtered = filtered.filter(p => p.status === filterStatus);
    if (q) filtered = filtered.filter(p => p.name.toLowerCase().includes(q));

    tbody.innerHTML = filtered.map(p => `
        <tr>
            <td><span class="cell-person">${avatar(p.name)}${esc(p.name)}</span></td>
            <td class="muted">${esc(p.lastVisit)}</td>
            <td class="num">${esc(p.vitals)}</td>
            <td class="muted">${esc(p.lastLab)}</td>
            <td>${statusBadge(p.status)}</td>
            <td class="actions-col">
                <button type="button" class="icon-btn sm row-remove" data-remove-patient="${p.id}" aria-label="Remove ${esc(p.name)}">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </td>
        </tr>
    `).join('') || `<tr><td colspan="6" class="table-empty">No patients match your search.</td></tr>`;

    const total = appState.patients.length;
    document.getElementById('patients-count').textContent = `${total} ${total === 1 ? 'patient' : 'patients'}`;
    document.getElementById('patients-foot').textContent = `Showing ${filtered.length} of ${total}`;

    tbody.querySelectorAll('[data-remove-patient]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.getAttribute('data-remove-patient'));
            appState.patients = appState.patients.filter(p => p.id !== id);
            save();
            renderPatientData();
        });
    });
}

function renderStaffList() {
    const container = document.getElementById('staff-list-container');
    if (!container) return;
    container.innerHTML = appState.staff.map(s => `
        <div class="staff-row">
            ${avatar(s.name)}
            <span class="staff-info">
                <strong>${esc(s.name)}</strong>
                <span>${esc(s.role)}</span>
            </span>
            <button type="button" class="icon-btn sm row-remove" data-remove-staff="${s.id}" aria-label="Remove ${esc(s.name)}">
                <span class="material-symbols-outlined">delete</span>
            </button>
        </div>
    `).join('') || `<p class="list-empty">No staff added yet.</p>`;

    container.querySelectorAll('[data-remove-staff]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.getAttribute('data-remove-staff'));
            appState.staff = appState.staff.filter(s => s.id !== id);
            save();
            renderStaffList();
        });
    });
}

function renderClinic() {
    const { name, address, email } = appState.clinic;
    document.getElementById('sb-clinic-name').textContent = name;
    document.getElementById('sb-clinic-email').textContent = email;
    document.getElementById('clinic-name').value = name;
    document.getElementById('clinic-address').value = address;
    document.getElementById('clinic-email').value = email;
}

function renderPatientData() {
    renderDashboardHistory();
    renderPatientsDirectory();
    updateDashboardMetrics();
}

function renderAll() {
    renderPatientData();
    renderUpcomingAppointments();
    renderTasks();
    renderStaffList();
    renderClinic();
}

const VITALS_DATA = {
    All: [20, 58, 48, 85, 50, 100, 110, 75, 70],
    '1M': [30, 45, 40, 60, 50, 80, 90, 70, 65],
    '6M': [60, 75, 70, 90, 80, 110, 120, 100, 95]
};

document.addEventListener('DOMContentLoaded', () => {
    renderAll();

    const css = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue('--primary').trim() || '#5E4AD1';
    const muted = '#94A3B8';
    Chart.defaults.font.family = "'Geist', system-ui, sans-serif";

    const sparklineCtx = document.getElementById('patientsSeenSparkline');
    if (sparklineCtx) {
        new Chart(sparklineCtx, {
            type: 'line',
            data: {
                labels: ['1', '2', '3', '4', '5', '6', '7'],
                datasets: [{
                    data: [10, 25, 20, 45, 30, 55, 50],
                    borderColor: primary,
                    backgroundColor: 'rgba(94, 74, 209, 0.08)',
                    fill: true,
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { x: { display: false }, y: { display: false } },
                layout: { padding: 2 }
            }
        });
    }

    const externalTooltipHandler = (context) => {
        const { chart, tooltip } = context;
        const tooltipEl = document.getElementById('chartjs-tooltip');
        if (tooltip.opacity === 0) {
            tooltipEl.style.opacity = 0;
            return;
        }
        if (tooltip.body) {
            const point = tooltip.dataPoints[0];
            tooltipEl.innerHTML = `
                <div class="tooltip-title">${esc(point.label)}</div>
                <div class="tooltip-body">Heart Rate: ${esc(point.formattedValue)} bpm</div>
            `;
        }
        const rect = chart.canvas.getBoundingClientRect();
        tooltipEl.style.opacity = 1;
        tooltipEl.style.left = rect.left + window.scrollX + tooltip.caretX + 'px';
        tooltipEl.style.top = rect.top + window.scrollY + tooltip.caretY - 64 + 'px';
    };

    const vitalsCtx = document.getElementById('vitalsChart');
    let vitalsChart = null;
    if (vitalsCtx) {
        const gradient = vitalsCtx.getContext('2d').createLinearGradient(0, 0, 0, 280);
        gradient.addColorStop(0, 'rgba(94, 74, 209, 0.18)');
        gradient.addColorStop(1, 'rgba(94, 74, 209, 0)');
        vitalsChart = new Chart(vitalsCtx, {
            type: 'line',
            data: {
                labels: ['Jun 01', 'Jun 05', 'Jun 10', 'Jun 15', 'Jun 20', 'Jun 25', 'Jun 30', 'Jul 05', 'Jul 10'],
                datasets: [
                    {
                        label: 'Vitals',
                        data: VITALS_DATA[appState.vitalsRange] || VITALS_DATA.All,
                        borderColor: primary,
                        backgroundColor: gradient,
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: primary,
                        pointHoverBorderWidth: 2
                    },
                    {
                        label: 'Mapping',
                        data: [30, 60, 40, 65, 55, 90, 80, 100, 95],
                        borderColor: '#B6ABEF',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.4,
                        fill: false,
                        pointRadius: 0,
                        pointHoverRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false, external: externalTooltipHandler, filter: (item) => item.datasetIndex === 0 }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 125,
                        border: { display: false },
                        ticks: { stepSize: 25, color: muted, font: { size: 11 }, padding: 8 },
                        grid: { color: '#EEF0F4' }
                    },
                    x: {
                        border: { display: false },
                        ticks: { color: muted, font: { size: 11 } },
                        grid: { display: false }
                    }
                },
                interaction: { mode: 'index', intersect: false }
            }
        });
    }

    const rangeGroup = document.getElementById('vitalsTimeFilter');
    const setRange = (range) => {
        rangeGroup.querySelectorAll('button').forEach(b => {
            const on = b.dataset.range === range;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', String(on));
        });
        if (vitalsChart) {
            vitalsChart.data.datasets[0].data = VITALS_DATA[range];
            vitalsChart.update();
        }
    };
    setRange(appState.vitalsRange);
    rangeGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-range]');
        if (!btn) return;
        appState.vitalsRange = btn.dataset.range;
        save();
        setRange(btn.dataset.range);
    });

    const efficiencyCtx = document.getElementById('efficiencyChart');
    if (efficiencyCtx) {
        new Chart(efficiencyCtx, {
            type: 'doughnut',
            data: {
                labels: ['Efficiency', 'Remaining'],
                datasets: [{ data: [92, 8], backgroundColor: [primary, '#EEF0F4'], borderWidth: 0, borderRadius: 4 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '74%',
                rotation: -90,
                circumference: 180,
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        });
    }

    // Views
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const viewSections = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('page-title');

    const switchView = (targetId) => {
        if (!document.getElementById(targetId)) targetId = 'dashboard-view';
        navItems.forEach(nav => {
            const on = nav.getAttribute('data-target') === targetId;
            nav.classList.toggle('active', on);
            if (on) {
                nav.setAttribute('aria-current', 'page');
                pageTitle.textContent = [...nav.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim();
            } else {
                nav.removeAttribute('aria-current');
            }
        });
        viewSections.forEach(view => {
            const on = view.id === targetId;
            view.style.display = on ? '' : 'none';
            view.classList.toggle('active', on);
        });
        appState.view = targetId;
        save();
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetId = item.getAttribute('data-target');
            if (!targetId) return;
            e.preventDefault();
            switchView(targetId);
        });
    });
    document.querySelectorAll('[data-goto]').forEach(el => {
        el.addEventListener('click', () => switchView(el.getAttribute('data-goto')));
    });
    switchView(appState.view);

    // Patients directory filters
    document.getElementById('patients-search')?.addEventListener('input', renderPatientsDirectory);
    document.getElementById('patients-filter')?.addEventListener('change', renderPatientsDirectory);

    // Modals
    const patientModal = document.getElementById('patient-modal');
    const staffModal = document.getElementById('staff-modal');
    const openModal = (modal) => {
        modal.classList.add('active');
        modal.querySelector('input')?.focus();
    };
    document.getElementById('btn-add-patient')?.addEventListener('click', () => openModal(patientModal));
    document.getElementById('btn-add-staff')?.addEventListener('click', () => openModal(staffModal));
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => e.target.closest('.modal-overlay').classList.remove('active'));
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    });

    document.getElementById('form-add-patient')?.addEventListener('submit', (e) => {
        e.preventDefault();
        appState.patients.unshift({
            id: nextId(appState.patients),
            name: document.getElementById('p-name').value.trim(),
            lastVisit: document.getElementById('p-visit').value.trim(),
            vitals: document.getElementById('p-vitals').value,
            lastLab: 'Just now',
            status: document.getElementById('p-status').value
        });
        save();
        renderPatientData();
        patientModal.classList.remove('active');
        e.target.reset();
    });

    document.getElementById('form-add-staff')?.addEventListener('submit', (e) => {
        e.preventDefault();
        appState.staff.push({
            id: nextId(appState.staff),
            name: document.getElementById('s-name').value.trim(),
            role: document.getElementById('s-role').value.trim()
        });
        save();
        renderStaffList();
        staffModal.classList.remove('active');
        e.target.reset();
    });

    document.getElementById('form-add-task')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('task-title');
        const title = input.value.trim();
        if (!title) return;
        appState.tasks.push({ id: nextId(appState.tasks), title, time: 'Just now', priority: 'none', completed: false });
        save();
        renderTasks();
        input.value = '';
    });

    document.getElementById('form-clinic')?.addEventListener('submit', (e) => {
        e.preventDefault();
        appState.clinic = {
            name: document.getElementById('clinic-name').value.trim(),
            address: document.getElementById('clinic-address').value.trim(),
            email: document.getElementById('clinic-email').value.trim()
        };
        save();
        renderClinic();
        const note = document.getElementById('clinic-saved');
        note.hidden = false;
        setTimeout(() => { note.hidden = true; }, 2000);
    });

    const resetBtn = document.getElementById('btn-reset-demo');
    let resetArmed = false;
    resetBtn?.addEventListener('click', () => {
        const label = resetBtn.lastChild;
        if (!resetArmed) {
            resetArmed = true;
            label.textContent = ' Click again to reset';
            setTimeout(() => { resetArmed = false; label.textContent = ' Reset demo data'; }, 4000);
            return;
        }
        resetArmed = false;
        label.textContent = ' Reset demo data';
        const view = appState.view;
        appState = { ...seedState(), view };
        save();
        renderAll();
        setRange(appState.vitalsRange);
    });

    // Global search jumps to the directory
    const globalSearchInput = document.querySelector('.top-header .search-bar input');
    globalSearchInput?.addEventListener('input', (e) => {
        switchView('patients-view');
        const searchPatients = document.getElementById('patients-search');
        searchPatients.value = e.target.value;
        renderPatientsDirectory();
    });

    // Dropdowns
    const toggleDropdown = (triggerId, dropdownId) => {
        const trigger = document.getElementById(triggerId);
        const dropdown = document.getElementById(dropdownId);
        if (!trigger || !dropdown) return;
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown-menu').forEach(d => { if (d.id !== dropdownId) d.classList.remove('active'); });
            dropdown.classList.toggle('active');
        });
    };
    toggleDropdown('btn-notifications', 'dropdown-notifications');
    toggleDropdown('btn-user-menu', 'dropdown-user');
    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('active'));
    });

    // Mobile sidebar drawer
    const btnToggle = document.getElementById('btn-sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (btnToggle && sidebar && backdrop) {
        const toggleDrawer = (open) => {
            sidebar.classList.toggle('drawer-open', open);
            backdrop.classList.toggle('active', open);
        };
        btnToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDrawer(!sidebar.classList.contains('drawer-open'));
        });
        backdrop.addEventListener('click', () => toggleDrawer(false));
        sidebar.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => toggleDrawer(false)));
    }
});
