document.addEventListener('DOMContentLoaded', () => {
    // Vitals Chart Initialization
    const vitalsCtx = document.getElementById('vitalsChart');
    if (vitalsCtx) {
        new Chart(vitalsCtx, {
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
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        titleColor: '#1E293B',
                        bodyColor: '#64748B',
                        borderColor: '#E2E8F0',
                        borderWidth: 1,
                        padding: 10,
                        boxPadding: 4
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

    // Efficiency Gauge Initialization
    const efficiencyCtx = document.getElementById('efficiencyChart');
    if (efficiencyCtx) {
        new Chart(efficiencyCtx, {
            type: 'doughnut',
            data: {
                labels: ['Efficiency', 'Remaining'],
                datasets: [{
                    data: [90, 10],
                    backgroundColor: [
                        '#3B82F6', // Blue
                        '#F1F5F9'  // Grey background
                    ],
                    borderWidth: 0,
                    circumference: 180,
                    rotation: 270,
                    cutout: '80%',
                    borderRadius: [10, 0] // Rounded ends for the blue bar
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                animation: {
                    animateRotate: true,
                    animateScale: false
                }
            }
        });
    }

    // Interactive Tasks with localStorage
    const checkboxes = document.querySelectorAll('.task-item input[type="checkbox"]');
    const savedTasks = JSON.parse(localStorage.getItem('docScribeTasks') || '{}');
    
    checkboxes.forEach((box, index) => {
        // Load initial state
        if (savedTasks[index] !== undefined) {
            box.checked = savedTasks[index];
        }

        // Apply styles based on current state (whether from HTML or localStorage)
        const item = box.closest('.task-item');
        const title = item.querySelector('.task-content h4');
        if (box.checked) {
            item.style.opacity = '0.5';
            if(title) title.style.textDecoration = 'line-through';
        }

        box.addEventListener('change', (e) => {
            const item = e.target.closest('.task-item');
            const title = item.querySelector('.task-content h4');
            if(e.target.checked) {
                item.style.opacity = '0.5';
                if(title) title.style.textDecoration = 'line-through';
            } else {
                item.style.opacity = '1';
                if(title) title.style.textDecoration = 'none';
            }
            // Save state
            savedTasks[index] = e.target.checked;
            localStorage.setItem('docScribeTasks', JSON.stringify(savedTasks));
        });
    });

    // Sidebar Navigation Logic
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const viewSections = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetId = item.getAttribute('data-target');
            if (!targetId) return; // Ignore links like 'Back to Home'

            e.preventDefault();

            // Update active nav class
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Show target view, hide others
            viewSections.forEach(view => {
                if (view.id === targetId) {
                    view.style.display = 'block';
                    
                    // For dashboard, make it grid so layout doesn't break
                    if (targetId === 'dashboard-view') {
                        view.style.display = ''; // let css handle it
                        view.classList.add('active');
                    }
                } else {
                    view.style.display = 'none';
                    view.classList.remove('active');
                }
            });
        });
    });

    // Scribing Feature is now handled via iframe.
});
