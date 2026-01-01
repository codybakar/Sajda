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

    // Start Location & Data Fetch
    getUserLocation();

    // Start Timer
    findNextPrayer(); 
    setInterval(findNextPrayer, 1000); 
}

// --- Logic: Theme ---
function setupTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

    themeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    });
}

function checkDailyReset() {
    const todayStr = new Date().toDateString(); 
    
    if (lastDate !== todayStr) {
        prayerStatus = [false, false, false, false, false];
        localStorage.setItem('prayerStatus', JSON.stringify(prayerStatus));
        localStorage.setItem('lastDate', todayStr);
    }
}

// --- Logic: Data Fetching ---

function getUserLocation() {
    if (navigator.geolocation) {
        statusEl.textContent = "Locating...";
        navigator.geolocation.getCurrentPosition(fetchPrayerTimes, handleError);
    } else {
        statusEl.textContent = "Loc Disabled";
    }
}

function handleError(error) {
    console.error(error);
    statusEl.textContent = "Using Defaults";
    restoreDefaultTimes();
}

function fetchPrayerTimes(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const date = new Date(); 
    
    statusEl.textContent = "Fetching...";

    // Aladhan API (HTTPS)
    const apiURL = `https://api.aladhan.com/v1/timings/${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}?latitude=${lat}&longitude=${lng}&method=2`;

    fetch(apiURL)
        .then(response => response.json())
        .then(data => {
            const timings = data.data.timings;
            PRAYERS[0].time = timings.Fajr;
            PRAYERS[1].time = timings.Dhuhr;
            PRAYERS[2].time = timings.Asr;
            PRAYERS[3].time = timings.Maghrib;
            PRAYERS[4].time = timings.Isha;

            statusEl.textContent = data.data.meta.timezone.split('/')[1] || 'Local';
            updateUIWithTimes();
        })
        .catch(err => {
            console.error(err);
            statusEl.textContent = "API Error";
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

function togglePrayer(index) {
    prayerStatus[index] = !prayerStatus[index];
    cards[index].classList.toggle('completed');
    
    // Save state
    localStorage.setItem('prayerStatus', JSON.stringify(prayerStatus));
    
    // Trigger "Cool" updates
    updateProgress();
    
    // Trigger Confetti if all done
    const completed = prayerStatus.filter(Boolean).length;
    if (completed === PRAYERS.length) {
        startConfetti();
    }
}

// --- Logic: Progress ---

function updateProgress() {
    const completed = prayerStatus.filter(Boolean).length;
    const total = PRAYERS.length;
    
    // Text Update
    completedCountEl.textContent = completed;
    
    // Ring Animation
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
    
    // Find the next upcoming prayer
    PRAYERS.forEach((prayer, index) => {
        if(prayer.time === '--:--') return; // Skip if not loaded

        const [h, m] = prayer.time.split(':').map(Number);
        const prayerTime = h * 60 + m; // Minutes
        
        if (prayerTime > currentTime) {
            if (prayerTime - currentTime < minDiff) {
                minDiff = prayerTime - currentTime;
                nextPrayerIndex = index;
            }
        }
    });

    // If all prayers passed today, next is Fajr tomorrow
    if (nextPrayerIndex === -1) {
        nextPrayerIndex = 0; // Fajr
        nextPrayerNameEl.textContent = "Fajr (Tomorrow)";
        countdownEl.textContent = "See you tomorrow";
        return;
    }

    const nextPrayer = PRAYERS[nextPrayerIndex];
    nextPrayerNameEl.textContent = nextPrayer.name;
    
    // Highlight the card
    cards.forEach(c => c.classList.remove('next-active'));
    cards[nextPrayerIndex].classList.add('next-active');

    // Countdown Logic
    const [targetH, targetM] = nextPrayer.time.split(':').map(Number);
    const targetDate = new Date();
    targetDate.setHours(targetH, targetM, 0);
    
    const diffMs = targetDate - now;
    
    if (diffMs > 0) {
        const h = Math.floor(diffMs / (1000 * 60 * 60));
        const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diffMs % (1000 * 60)) / 1000);
        
        countdownEl.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;

        // NOTIFICATION TRIGGER (Simple check)
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
            icon: 'https://cdn-icons-png.flaticon.com/512/2884/2884666.png' // Generic icon
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
            
            const rotateX = ((y - centerY) / centerY) * -10; // Max 10deg rotation
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
    // Only start if not already running
    if (animationId) return;
    
    // Create particles
    for (let i = 0; i < 150; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height, // Start above
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            size: Math.random() * 5 + 2,
            speedY: Math.random() * 3 + 2,
            speedX: Math.random() * 2 - 1
        });
    }
    
    animateConfetti();
    
    // Stop after 5 seconds
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
        p.speedY += 0.05; // Gravity
        
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Reset if out of bounds (loop for a bit)
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
