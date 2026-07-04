// Central State Management
const appState = {
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
        { id: 1, title: 'Update OPD report', time: '15 mins ago', colorClass: 'yellow', completed: true },
        { id: 2, title: 'Schedule appointment', time: '30 mins ago', colorClass: 'light-blue', completed: false },
        { id: 3, title: 'Upload lab reports', time: '1 hour ago', colorClass: 'red', completed: false },
        { id: 4, title: 'View Nomination', time: '10 Nov, 4pm', colorClass: 'grey', completed: false }
    ],
    staff: [
        { id: 1, name: 'Dr. Anjali Desai', role: 'Cardiologist' },
        { id: 2, name: 'Vikram Mehta', role: 'Head Nurse' }
    ]
};

// Render Functions
function renderDashboardHistory() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    tbody.innerHTML = appState.patients.map(p => `
        <tr>
            <td>${p.name}</td>
            <td>${p.lastVisit}</td>
            <td>${p.vitals}</td>
            <td>${p.lastLab}</td>
            <td><span class="status-badge ${p.status}">${p.status === 'overdue' ? '⚠ Overdue' : '✓ Completed'}</span></td>
        </tr>
    `).join('');
}

function renderUpcomingAppointments() {
    const container = document.getElementById('appointments-list-container');
    if (!container) return;
    container.innerHTML = appState.appointments.map(a => `
        <div class="appointment-card ${a.active ? 'active' : ''}" data-id="${a.id}">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(a.name)}&background=random&rounded=true" alt="${a.name}" class="appt-avatar">
            <div class="appt-info">
                <h4>${a.name}</h4>
                <p>${a.time}</p>
            </div>
            ${a.active ? '<span class="material-symbols-outlined arrow">chevron_right</span>' : ''}
        </div>
    `).join('');

    // Attach listeners
    container.querySelectorAll('.appointment-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = parseInt(card.getAttribute('data-id'));
            appState.appointments.forEach(appt => {
                appt.active = (appt.id === id);
            });
            renderUpcomingAppointments();
        });
    });
}

function renderTasks() {
    const container = document.getElementById('tasks-list-container');
    if (!container) return;
    
    // Load state from localStorage if available
    const savedTasks = JSON.parse(localStorage.getItem('docScribeTasks') || '{}');
    appState.tasks.forEach((t, i) => {
        if (savedTasks[i] !== undefined) t.completed = savedTasks[i];
    });

    container.innerHTML = appState.tasks.map((t, index) => `
        <label class="task-item" style="opacity: ${t.completed ? '0.5' : '1'}">
            <input type="checkbox" data-index="${index}" ${t.completed ? 'checked' : ''}>
            <div class="task-content">
                <h4 style="text-decoration: ${t.completed ? 'line-through' : 'none'}">${t.title}</h4>
                <p>${t.time}</p>
            </div>
            <span class="dot ${t.colorClass}"></span>
        </label>
    `).join('');

    container.querySelectorAll('input[type="checkbox"]').forEach(box => {
        box.addEventListener('change', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            appState.tasks[idx].completed = e.target.checked;
            
            // Save state
            const currentSaved = JSON.parse(localStorage.getItem('docScribeTasks') || '{}');
            currentSaved[idx] = e.target.checked;
            localStorage.setItem('docScribeTasks', JSON.stringify(currentSaved));
            
            renderTasks();
        });
    });
}

function updateDashboardMetrics() {
    // Simple mock update based on patients length
    const totalSeen = 2611 + appState.patients.length; // baseline 2611 + current active mock data
    const metricValueEl = document.querySelector('.metric-card.primary-card #patients-seen-value');
    if (metricValueEl) {
        metricValueEl.textContent = totalSeen.toLocaleString();
    }
}

function renderPatientsDirectory(filterStatus = 'All', searchQuery = '') {
    const tbody = document.getElementById('patients-directory-body');
    if (!tbody) return;

    let filtered = appState.patients;
    if (filterStatus !== 'All') {
        filtered = filtered.filter(p => p.status === filterStatus);
    }
    if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
    }

    tbody.innerHTML = filtered.map(p => `
        <tr>
            <td>${p.name}</td>
            <td>${p.lastVisit}</td>
            <td>${p.vitals}</td>
            <td>${p.lastLab}</td>
            <td><span class="status-badge ${p.status}">${p.status === 'overdue' ? '⚠ Overdue' : '✓ Completed'}</span></td>
        </tr>
    `).join('');
}

function renderStaffList() {
    const container = document.getElementById('staff-list-container');
    if (!container) return;
    container.innerHTML = appState.staff.map(s => `
        <div class="staff-item">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random&rounded=true" alt="${s.name}" class="appt-avatar">
            <div class="staff-info">
                <h4>${s.name}</h4>
                <p>${s.role}</p>
            </div>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    // Initial Render
    renderDashboardHistory();
    renderUpcomingAppointments();
    renderTasks();
    updateDashboardMetrics();
    renderPatientsDirectory();
    renderStaffList();

    // Patients Seen Sparkline Initialization
    const sparklineCtx = document.getElementById('patientsSeenSparkline');
    if (sparklineCtx) {
        new Chart(sparklineCtx, {
            type: 'line',
            data: {
                labels: ['1', '2', '3', '4', '5', '6', '7'],
                datasets: [{
                    data: [10, 25, 20, 45, 30, 55, 50],
                    borderColor: 'rgba(255, 255, 255, 0.8)',
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
                layout: { padding: 0 }
            }
        });
    }

    // Custom Tooltip Handler for Vitals Chart
    const externalTooltipHandler = (context) => {
        const {chart, tooltip} = context;
        const tooltipEl = document.getElementById('chartjs-tooltip');

        if (tooltip.opacity === 0) {
            tooltipEl.style.opacity = 0;
            return;
        }

        if (tooltip.body) {
            const bodyLines = tooltip.body.map(b => b.lines);
            const val = bodyLines[0][0].split(': ')[1] || bodyLines[0]; 
            
            tooltipEl.innerHTML = `
                <div class="tooltip-title">Heart Rate: ${val} bpm</div>
                <div class="tooltip-body">10:00 AM - 11:50 pm</div>
            `;
        }

        const {offsetLeft: positionX, offsetTop: positionY} = chart.canvas;
        tooltipEl.style.opacity = 1;
        tooltipEl.style.left = positionX + tooltip.caretX + 'px';
        tooltipEl.style.top = positionY + tooltip.caretY + 'px';
    };

    // Vitals Chart Initialization
    const vitalsCtx = document.getElementById('vitalsChart');
    let vitalsChartInstance = null;
    if (vitalsCtx) {
        vitalsChartInstance = new Chart(vitalsCtx, {
            type: 'line',
            data: {
                labels: ['Jun 01', 'Jun 05', 'Jun 10', 'Jun 15', 'Jun 20', 'Jun 25', 'Jun 30', 'Jul 05', 'Jul 10'],
                datasets: [
                    {
                        label: 'Vitals',
                        data: [20, 58, 48, 85, 50, 100, 110, 75, 70],
                        borderColor: '#3B82F6', // Blue
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#3B82F6',
                        pointRadius: 4
                    },
                    {
                        label: 'Mapping',
                        data: [30, 60, 40, 65, 55, 90, 80, 100, 95],
                        borderColor: '#93C5FD', // Light Blue
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.4,
                        fill: false,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // We use custom HTML legend
                    },
                    tooltip: {
                        enabled: false,
                        external: externalTooltipHandler
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 125,
                        ticks: {
                            stepSize: 25,
                            color: '#94A3B8',
                            font: { size: 11 }
                        },
                        grid: {
                            color: '#F1F5F9',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            color: '#94A3B8',
                            font: { size: 11 }
                        },
                        grid: {
                            display: false,
                            drawBorder: false
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    // Vitals Filter Logic
    const vitalsFilter = document.getElementById('vitalsTimeFilter');
    if (vitalsFilter && vitalsChartInstance) {
        vitalsFilter.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === '1M') {
                vitalsChartInstance.data.datasets[0].data = [30, 45, 40, 60, 50, 80, 90, 70, 65];
            } else if (val === '6M') {
                vitalsChartInstance.data.datasets[0].data = [60, 75, 70, 90, 80, 110, 120, 100, 95];
            } else {
                vitalsChartInstance.data.datasets[0].data = [20, 58, 48, 85, 50, 100, 110, 75, 70];
            }
            vitalsChartInstance.update();
        });
    }


    // Premium Efficiency Gauge Initialization
    const efficiencyCtx = document.getElementById('efficiencyChart');
    if (efficiencyCtx) {
        // Register custom plugin to draw text in the middle
        const gaugeTextPlugin = {
            id: 'gaugeText',
            beforeDraw: (chart) => {
                if (chart.canvas.id !== 'efficiencyChart') return;
                const { width, height, ctx } = chart;
                ctx.restore();
                
                // Calculate position - for half doughnut, center is at bottom
                const textX = Math.round(width / 2);
                const textY = height - 10; 

                // Draw percentage
                ctx.font = "800 36px 'Manrope', sans-serif";
                ctx.textBaseline = "bottom";
                ctx.textAlign = "center";
                ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-main').trim() || '#0f172a';
                ctx.fillText("92%", textX, textY - 20);
                
                // Draw subtitle
                ctx.font = "600 13px 'Manrope', sans-serif";
                ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#64748b';
                ctx.fillText("Overall Efficiency", textX, textY);
                ctx.save();
            }
        };

        // Create gradient
        const ctx2d = efficiencyCtx.getContext('2d');
        let gradient = ctx2d.createLinearGradient(0, 0, efficiencyCtx.width || 300, 0);
        gradient.addColorStop(0, '#5E4AD1');
        gradient.addColorStop(1, '#A855F7');

        new Chart(efficiencyCtx, {
            type: 'doughnut',
            data: {
                labels: ['Efficiency', 'Remaining'],
                datasets: [{
                    data: [92, 8],
                    backgroundColor: [gradient, '#F1F5F9'],
                    borderWidth: 0,
                    borderRadius: 20
                }]
            },
            plugins: [gaugeTextPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '82%',
                rotation: -90,
                circumference: 180,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                layout: {
                    padding: { bottom: 20 }
                }
            }
        });
    }

    // Interactive Tasks logic has been moved to renderTasks()

    // Sidebar Navigation Logic
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const viewSections = document.querySelectorAll('.view-section');

    const switchView = (targetId) => {
        navItems.forEach(nav => {
            if(nav.getAttribute('data-target') === targetId) {
                nav.classList.add('active');
            } else {
                nav.classList.remove('active');
            }
        });

        viewSections.forEach(view => {
            if (view.id === targetId) {
                view.style.display = 'block';
                if (targetId === 'dashboard-view') {
                    view.style.display = ''; 
                    view.classList.add('active');
                }
            } else {
                view.style.display = 'none';
                view.classList.remove('active');
            }
        });
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetId = item.getAttribute('data-target');
            if (!targetId) return; 
            e.preventDefault();
            switchView(targetId);
        });
    });

    // Patients Directory Logic
    const searchPatients = document.getElementById('patients-search');
    const filterPatients = document.getElementById('patients-filter');

    if (searchPatients && filterPatients) {
        const updateDirectory = () => {
            renderPatientsDirectory(filterPatients.value, searchPatients.value);
        };
        searchPatients.addEventListener('input', updateDirectory);
        filterPatients.addEventListener('change', updateDirectory);
    }

    // Modal Logic
    const patientModal = document.getElementById('patient-modal');
    const staffModal = document.getElementById('staff-modal');
    
    document.getElementById('btn-add-patient')?.addEventListener('click', () => {
        patientModal.classList.add('active');
    });
    
    document.getElementById('btn-add-staff')?.addEventListener('click', () => {
        staffModal.classList.add('active');
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal-overlay').classList.remove('active');
        });
    });

    // Forms
    document.getElementById('form-add-patient')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('p-name').value;
        const visit = document.getElementById('p-visit').value;
        const vitals = document.getElementById('p-vitals').value;
        const status = document.getElementById('p-status').value;

        appState.patients.unshift({
            id: Date.now(),
            name,
            lastVisit: visit,
            vitals,
            lastLab: 'Just now',
            status
        });

        renderDashboardHistory();
        renderPatientsDirectory(filterPatients.value, searchPatients.value);
        updateDashboardMetrics();
        
        patientModal.classList.remove('active');
        e.target.reset();
    });

    document.getElementById('form-add-staff')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('s-name').value;
        const role = document.getElementById('s-role').value;

        appState.staff.push({
            id: Date.now(),
            name,
            role
        });

        renderStaffList();
        staffModal.classList.remove('active');
        e.target.reset();
    });

    // Global Search
    const globalSearchInput = document.querySelector('.top-header .search-bar input');
    if (globalSearchInput) {
        globalSearchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            switchView('patients-view');
            if (searchPatients) {
                searchPatients.value = query;
                renderPatientsDirectory(filterPatients ? filterPatients.value : 'All', query);
            }
        });
    }

    // Dropdowns
    const toggleDropdown = (triggerId, dropdownId) => {
        const trigger = document.getElementById(triggerId);
        const dropdown = document.getElementById(dropdownId);
        if(trigger && dropdown) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.dropdown-menu').forEach(d => {
                    if (d.id !== dropdownId) d.classList.remove('active');
                });
                dropdown.classList.toggle('active');
            });
        }
    };
    
    toggleDropdown('btn-notifications', 'dropdown-notifications');
    toggleDropdown('btn-user-menu', 'dropdown-user');

    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('active'));
    });

    // Scribing Feature is now handled via iframe.
});
