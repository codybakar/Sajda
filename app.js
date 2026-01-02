console.log('Sajjda App Initialized');

// --- Configuration & State ---
let PRAYERS = [
    { name: 'Fajr', time: '--:--' },
    { name: 'Dhuhr', time: '--:--' },
    { name: 'Asr', time: '--:--' },
    { name: 'Maghrib', time: '--:--' },
    { name: 'Isha', time: '--:--' }
];

// Load from LocalStorage
let prayerStatus = JSON.parse(localStorage.getItem('prayerStatus')) || [false, false, false, false, false];
let lastDate = localStorage.getItem('lastDate');



// DOM Elements
const dateEl = document.getElementById('current-date');
const statusEl = document.getElementById('status-display');
const themeBtn = document.getElementById('theme-toggle');
const countdownEl = document.getElementById('countdown');
const nextPrayerNameEl = document.getElementById('next-prayer-name');
const progressCircle = document.querySelector('.progress-ring__circle');
const completedCountEl = document.getElementById('completed-count');
const cards = document.querySelectorAll('.prayer-card');

// --- Initialization ---

let loadingTimeout; // Safety mechanism

function init() {
    setupTheme();
    checkDailyReset(); 
    setupDate();
    setupCards();
    updateProgress(); 
    
    // Check Notification Permissions
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    // SAFETY CHECK: If nothing loads in 4 seconds, force defaults
    loadingTimeout = setTimeout(() => {
        if (statusEl.textContent.includes("Locating")) {
            console.warn("Taking too long. Forcing defaults.");
            statusEl.textContent = "GPS Slow. Using Defaults.";
            restoreDefaultTimes();
        }
    }, 4000);

    // OFFLINE CACHE CHECK
    const todayStr = new Date().toDateString();
    const cachedDate = localStorage.getItem('cachedDate');
    
    if (cachedDate === todayStr) {
        // Load from Cache
        console.log("Loading from Cache");
        const cachedPrayers = JSON.parse(localStorage.getItem('cachedPrayerData'));
        const cachedLoc = localStorage.getItem('cachedLocationName');
        
        if (cachedPrayers) {
            clearTimeout(loadingTimeout); // Cache loaded, cancel safety
            PRAYERS = cachedPrayers;
            updateUIWithTimes();
            statusEl.textContent = cachedLoc || "Offline Mode";
            updateProgress(); 
            
            // Start Timer
            findNextPrayer(); 
            setInterval(findNextPrayer, 1000);
            return; 
        }
    }

    // Start Location & Data Fetch (If no cache)
    getUserLocation();

    // Start Timer
    findNextPrayer(); 
}

// --- Theme & Daily Reset Logic ---

function setupTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.add(savedTheme);
    
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = document.body.classList.contains('dark') ? 'dark' : 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            document.body.classList.remove('dark', 'light');
            document.body.classList.add(newTheme);
            localStorage.setItem('theme', newTheme);
            
            themeBtn.textContent = newTheme === 'dark' ? '🌙' : '☀️';
        });
        
        themeBtn.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
    }
}

function checkDailyReset() {
    const today = new Date().toDateString();
    
    if (lastDate && lastDate !== today) {
        console.log("New day detected. Resetting progress.");
        prayerStatus = [false, false, false, false, false];
        localStorage.setItem('prayerStatus', JSON.stringify(prayerStatus));
    }
    
    localStorage.setItem('lastDate', today);
    lastDate = today;
}

// --- Logic: Data Fetching ---

function getUserLocation() {
    if (navigator.geolocation) {
        statusEl.textContent = "Locating via GPS...";
        const options = {
            enableHighAccuracy: true,
            timeout: 5000, 
            maximumAge: 0
        };
        navigator.geolocation.getCurrentPosition(onLocationSuccess, handleError, options);
    } else {
        handleError({ message: "Not Supported" });
    }
}

function onLocationSuccess(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    
    // 1. Get Name (Non-blocking)
    getCityName(lat, lng);
    
    // 2. Get Times
    fetchPrayerTimes(lat, lng);
}

function getCityName(lat, lng) {
    // Free Reverse Geocoding API (BigDataCloud)
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    
    fetch(url)
        .then(res => res.json())
        .then(data => {
            const city = data.city || data.locality || data.principalSubdivision || "Unknown";
            statusEl.textContent = city;
            localStorage.setItem('cachedLocationName', city);
        })
        .catch(err => {
            console.log("Geo Error:", err);
            statusEl.textContent = "Location Found"; 
        });
}

function handleError(error) {
    console.warn("GPS Error:", error.message);
    statusEl.textContent = "GPS Failed";
    clearTimeout(loadingTimeout); // Cancel safety, we are handling it
    restoreDefaultTimes();
}

function fetchPrayerTimes(lat, lng) {
    const date = new Date(); 
    // Aladhan API (HTTPS)
    const apiURL = `https://api.aladhan.com/v1/timings/${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}?latitude=${lat}&longitude=${lng}&method=2`;

    fetch(apiURL)
        .then(response => response.json())
        .then(data => {
            clearTimeout(loadingTimeout); // Success! Cancel safety
            
            const timings = data.data.timings;
            PRAYERS[0].time = timings.Fajr;
            PRAYERS[1].time = timings.Dhuhr;
            PRAYERS[2].time = timings.Asr;
            PRAYERS[3].time = timings.Maghrib;
            PRAYERS[4].time = timings.Isha;

            updateUIWithTimes();
            
            // SAVE TO CACHE
            localStorage.setItem('cachedPrayerData', JSON.stringify(PRAYERS));
            localStorage.setItem('cachedDate', date.toDateString());
        })
        .catch(err => {
            console.error(err);
            statusEl.textContent = "Net Error";
            clearTimeout(loadingTimeout);
            restoreDefaultTimes();
        });
}

// ... updateUIWithTimes and formatTime12Hour remain same, ensure restoreDefaultTimes is below ...

function updateUIWithTimes() {
    cards.forEach((card, index) => {
        const timeEl = card.querySelector('.time');
        timeEl.textContent = formatTime12Hour(PRAYERS[index].time);
    });
    // Force re-check of next prayer with new times
    findNextPrayer(); 
}

function formatTime12Hour(time24) {
    if (!time24 || time24 === '--:--') return '--:--';
    const [h, m] = time24.split(':');
    let hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12; // the hour '0' should be '12'
    return `${hour}:${m} ${ampm}`;
}

function restoreDefaultTimes() {
     PRAYERS = [
        { name: 'Fajr', time: '05:30' },
        { name: 'Dhuhr', time: '13:15' },
        { name: 'Asr', time: '16:45' },
        { name: 'Maghrib', time: '18:50' },
        { name: 'Isha', time: '20:15' }
    ];
    updateUIWithTimes();
}

function setupDate() {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    const today = new Date();
    dateEl.textContent = today.toLocaleDateString('en-US', options);
}

function setupCards() {
    cards.forEach((card, index) => {
        const btn = card.querySelector('.check-btn');
        
        // Restore state
        if (prayerStatus[index]) {
            card.classList.add('completed');
        }

        // Click Handler
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling if card has click
            togglePrayer(index);
        });
        
        // Also allow clicking the whole card for better UX
        card.addEventListener('click', () => {
             togglePrayer(index);
        });
    });
}

// --- Logic: History & Stats ---

const statsBtn = document.getElementById('stats-btn');
const closeStatsBtn = document.getElementById('close-stats');
const statsModal = document.getElementById('stats-modal');

// Load History
let prayerHistory = JSON.parse(localStorage.getItem('prayerHistory')) || {};

function updateHistory() {
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const completedCount = prayerStatus.filter(Boolean).length;
    
    prayerHistory[todayStr] = completedCount;
    localStorage.setItem('prayerHistory', JSON.stringify(prayerHistory));
}

function togglePrayer(index) {
    prayerStatus[index] = !prayerStatus[index];
    cards[index].classList.toggle('completed');
    
    // Save state
    localStorage.setItem('prayerStatus', JSON.stringify(prayerStatus));
    
    // Trigger "Cool" updates
    updateProgress();
    updateHistory(); 
    
    // Trigger Confetti if all done
    const completed = prayerStatus.filter(Boolean).length;
    if (completed === PRAYERS.length) {
        startConfetti();
    }
}

// UI Logic for Modal
statsBtn.addEventListener('click', () => {
    renderStats();
    statsModal.classList.add('active');
});

closeStatsBtn.addEventListener('click', () => {
    statsModal.classList.remove('active');
});

statsModal.addEventListener('click', (e) => {
    if (e.target === statsModal) statsModal.classList.remove('active');
});

function renderStats() {
    // 1. Calculate Streak
    const streak = calculateStreak();
    document.getElementById('streak-count').textContent = streak;

    // 2. Calculate Total
    const total = Object.values(prayerHistory).reduce((a, b) => a + b, 0);
    document.getElementById('total-prayers').textContent = total;

    // 3. Render Weekly Chart
    renderWeeklyChart();

    // 4. Render Grid (Last 30 days)
    renderHistoryGrid();
}

function calculateStreak() {
    let currentStreak = 0;
    const today = new Date();
    
    // Check up to 365 days back
    for (let i = 0; i < 365; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        if (prayerHistory[dateStr] && prayerHistory[dateStr] > 0) {
            currentStreak++;
        } else if (i === 0 && (!prayerHistory[dateStr] || prayerHistory[dateStr] === 0)) {
            // If today is 0, don't break streak yet (user might pray later)
            continue; 
        } else {
            break;
        }
    }
    return currentStreak;
}

function renderWeeklyChart() {
    const chartEl = document.getElementById('weekly-chart');
    chartEl.innerHTML = '';
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(new Date().getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayName = i === 0 ? 'Today' : days[d.getDay()];
        const count = prayerHistory[dateStr] || 0;
        
        const height = (count / 5) * 100; // Percentage
        
        const barGroup = document.createElement('div');
        barGroup.className = 'bar-group';
        
        barGroup.innerHTML = `
            <div class="bar ${i === 0 ? 'today' : ''}" style="height: ${height}%"></div>
            <span class="bar-label">${dayName}</span>
        `;
        chartEl.appendChild(barGroup);
    }
}

function renderHistoryGrid() {
    const gridEl = document.getElementById('history-grid');
    gridEl.innerHTML = '';
    
    // Last 28 days (4 weeks)
    for (let i = 27; i >= 0; i--) {
        const d = new Date();
        d.setDate(new Date().getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const count = prayerHistory[dateStr] || 0;
        
        const box = document.createElement('div');
        box.className = 'day-box';
        
        if (count === 0) box.classList.add('level-0');
        else if (count <= 2) box.classList.add('level-1');
        else if (count <= 4) box.classList.add('level-2');
        else box.classList.add('level-3'); // 5
        
        box.title = `${dateStr}: ${count} Prayers`;
        gridEl.appendChild(box);
    }
}

// Start
// --- Logic: Progress ---

function updateProgress() {
    const completed = prayerStatus.filter(Boolean).length;
    const total = PRAYERS.length;
    
    completedCountEl.textContent = completed;
    
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (completed / total) * circumference;
    
    progressCircle.style.strokeDashoffset = offset;
}

// --- Logic: Countdown & Next Prayer ---

function findNextPrayer() {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    let nextPrayerIndex = -1;
    let minDiff = Infinity;
    
    PRAYERS.forEach((prayer, index) => {
        if(prayer.time === '--:--') return; 

        const [h, m] = prayer.time.split(':').map(Number);
        const prayerTime = h * 60 + m; 
        
        if (prayerTime > currentTime) {
            if (prayerTime - currentTime < minDiff) {
                minDiff = prayerTime - currentTime;
                nextPrayerIndex = index;
            }
        }
    });

    if (nextPrayerIndex === -1) {
        nextPrayerIndex = 0; 
        nextPrayerNameEl.textContent = "Fajr (Tomorrow)";
        countdownEl.textContent = "See you tomorrow";
        return;
    }

    const nextPrayer = PRAYERS[nextPrayerIndex];
    nextPrayerNameEl.textContent = nextPrayer.name;
    
    cards.forEach(c => c.classList.remove('next-active'));
    cards[nextPrayerIndex].classList.add('next-active');

    const [targetH, targetM] = nextPrayer.time.split(':').map(Number);
    const targetDate = new Date();
    targetDate.setHours(targetH, targetM, 0);
    
    const diffMs = targetDate - now;
    
    if (diffMs > 0) {
        const h = Math.floor(diffMs / (1000 * 60 * 60));
        const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diffMs % (1000 * 60)) / 1000);
        
        countdownEl.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;

        if (h === 0 && m === 0 && s === 0) {
            sendNotification(nextPrayer.name);
        }

    } else {
        countdownEl.textContent = "It's time!";
    }
}

function sendNotification(prayerName) {
    if (Notification.permission === "granted") {
        new Notification("Prayer Time!", {
            body: `It is now time for ${prayerName}.`,
            icon: 'https://cdn-icons-png.flaticon.com/512/2884/2884666.png'
        });
    }
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

// --- Visual Polish: 3D Tilt Effect ---

function setupTiltEffect() {
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = ((y - centerY) / centerY) * -10; 
            const rotateY = ((x - centerX) / centerX) * 10;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
        });
    });
}

// --- Visual Polish: Confetti ---
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
let animationId;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function startConfetti() {
    if (animationId) return;
    
    for (let i = 0; i < 150; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height, 
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            size: Math.random() * 5 + 2,
            speedY: Math.random() * 3 + 2,
            speedX: Math.random() * 2 - 1
        });
    }
    
    animateConfetti();
    
    setTimeout(() => {
        cancelAnimationFrame(animationId);
        animationId = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles = [];
    }, 5000);
}

function animateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach((p, index) => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.speedY += 0.05; 
        
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        
        if (p.y > canvas.height) {
            p.y = -10;
            p.x = Math.random() * canvas.width;
        }
    });
    
    animationId = requestAnimationFrame(animateConfetti);
}

// Start
init();
setupTiltEffect();
