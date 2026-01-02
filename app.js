// Sajjda App Initialized

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

    // SAFETY CHECK: If nothing loads in 20 seconds, force defaults
    loadingTimeout = setTimeout(() => {
        if (statusEl.textContent.includes("Locating") || statusEl.textContent.includes("Trying")) {
            console.warn("GPS timeout after 20 seconds. Using defaults.");
            statusEl.textContent = "GPS Timeout. Using Defaults.";
            if (!PRAYERS[0].time || PRAYERS[0].time === '--:--') {
                restoreDefaultTimes();
            }
        }
    }, 20000);

    // OFFLINE CACHE CHECK
    const todayStr = new Date().toDateString();
    const cachedDate = localStorage.getItem('cachedDate');
    
    if (cachedDate === todayStr) {
        // Load from Cache (same day)

        const cachedPrayers = JSON.parse(localStorage.getItem('cachedPrayerData'));
        const cachedLoc = localStorage.getItem('cachedLocationName');
        
        if (cachedPrayers && Array.isArray(cachedPrayers) && cachedPrayers.length === 5) {
            clearTimeout(loadingTimeout); // Cache loaded, cancel safety
            PRAYERS = cachedPrayers;
            updateUIWithTimes();
            statusEl.textContent = cachedLoc || "Cached Location";
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
    
    // Icons
    const MOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    const SUN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;

    const updateThemeButtons = () => {
        const themeBtns = [document.getElementById('theme-toggle'), document.getElementById('theme-toggle-stats')];
        const newIcon = document.body.classList.contains('dark') ? MOON_SVG : SUN_SVG;
        
        themeBtns.forEach(btn => {
            if (btn) btn.innerHTML = newIcon;
        });
    };
    
    // Initial Run
    updateThemeButtons();

    const handleThemeToggle = (btn) => {
        const currentTheme = document.body.classList.contains('dark') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.body.classList.remove('dark', 'light');
        document.body.classList.add(newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Add click animation
        btn.classList.add('clicked');
        setTimeout(() => btn.classList.remove('clicked'), 600);
        
        updateThemeButtons();
    };
    
    const themeBtns = [document.getElementById('theme-toggle'), document.getElementById('theme-toggle-stats')];
    themeBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => handleThemeToggle(btn));
        }
    });
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

const refreshBtn = document.getElementById('refresh-location');
if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        statusEl.textContent = "Retrying GPS...";
        
        // Spin animation class
        refreshBtn.style.transform = "rotate(360deg)";
        setTimeout(() => { refreshBtn.style.transform = "none"; }, 1000);

        // Force reload even if cache exists? Maybe just try GPS again.
        getUserLocation();
    });
}

function getUserLocation() {
    if (!navigator.geolocation) {
        console.error("Geolocation not supported");
        handleError({ message: "Not Supported" });
        return;
    }

    statusEl.textContent = "Locating (GPS)...";
    
    // Attempt 1: High Accuracy (GPS)
    navigator.geolocation.getCurrentPosition(
        onLocationSuccess,
        (err) => {
            console.warn("GPS High Accuracy failed:", err.code, err.message);
            statusEl.textContent = "Trying Network Loc...";
            
            // Attempt 2: Low Accuracy (Network/IP based)
            navigator.geolocation.getCurrentPosition(
                onLocationSuccess,
                (err2) => {
                    console.warn("GPS Low Accuracy also failed:", err2.code, err2.message);
                    handleError(err2);
                },
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
            );
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
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
            const city = data.city || data.locality || data.principalSubdivision || "Unknown Location";
            statusEl.textContent = city;
            localStorage.setItem('cachedLocationName', city);
            
            // Revert Button Icon
            if(refreshBtn) {
                refreshBtn.style.transform = "none";
            }
        })
        .catch(err => {
            console.log("Geo Error:", err);
            statusEl.textContent = "Location Found"; 
        });
}

function handleError(error) {
    console.error("GPS Error Code:", error.code, "Message:", error.message);
    
    // Error codes: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
    let errorMsg = "GPS Failed";
    if (error.code === 1) errorMsg = "GPS Permission Denied";
    else if (error.code === 2) errorMsg = "GPS Unavailable";
    else if (error.code === 3) errorMsg = "GPS Timeout";
    
    statusEl.textContent = errorMsg;
    clearTimeout(loadingTimeout);
    
    // Use defaults so app is still functional
    restoreDefaultTimes();
    
    if(refreshBtn) {
        refreshBtn.style.transform = "none";
    }
}

function fetchPrayerTimes(lat, lng) {
    const date = new Date(); 
    // Aladhan API (HTTPS)
    const apiURL = `https://api.aladhan.com/v1/timings/${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}?latitude=${lat}&longitude=${lng}&method=2`;


    
    fetch(apiURL, { timeout: 10000 })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (!data.data || !data.data.timings) {
                throw new Error("Invalid API response");
            }
            
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
            console.error("Prayer times fetch error:", err);
            statusEl.textContent = "API Error - Using Defaults";
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
        // Restore state
        if (prayerStatus[index]) {
            card.classList.add('completed');
        }

        // --- INTERACTION: Click (Squish) ---
        card.addEventListener('click', () => {
             // Add a tiny vibration
             if (navigator.vibrate) navigator.vibrate(10); 
             togglePrayer(index);
        });

        // --- INTERACTION: Swipe to Complete (Touch) ---
        let startX = 0;
        let currentX = 0;
        let isSwiping = false;

        card.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isSwiping = true;
            card.style.transition = 'none'; // Instant movement
        }, { passive: true });

        card.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            currentX = e.touches[0].clientX;
            const diff = currentX - startX;

            // Only allow right swipe
            if (diff > 0 && diff < 150) {
                card.style.transform = `translateX(${diff}px) scale(0.98)`; // Move + slight shrink
                card.style.opacity = `${1 - diff/300}`; // Fade slightly
            }
        }, { passive: true });

        card.addEventListener('touchend', () => {
            if (!isSwiping) return;
            isSwiping = false;
            card.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'; // Restore bounce
            card.style.opacity = '1';

            const diff = currentX - startX;
            if (diff > 100) { // Threshold met
                // Success Swipe!
                if (!prayerStatus[index]) { // Only if not already done
                    togglePrayer(index);
                    if (navigator.vibrate) navigator.vibrate([10, 30, 10]); 
                }
                card.style.transform = 'translateX(0)';
            } else {
                // Reset (Rubber band back)
                card.style.transform = 'translateX(0)';
            }
        });
    });
}

// --- Logic: History & Stats ---

const navHome = document.getElementById('nav-home');
const navStats = document.getElementById('nav-stats');
const homePage = document.getElementById('home-page');
const statsPage = document.getElementById('stats-page');

// Load History
let prayerHistory = JSON.parse(localStorage.getItem('prayerHistory')) || {};
let prayerDetails = JSON.parse(localStorage.getItem('prayerDetails')) || {};

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

// Navigation Logic
function navigateTo(page) {
    homePage.classList.remove('active');
    statsPage.classList.remove('active');
    navHome.classList.remove('active');
    navStats.classList.remove('active');
    
    if (page === 'home') {
        homePage.classList.add('active');
        navHome.classList.add('active');
    } else if (page === 'stats') {
        renderStats();
        statsPage.classList.add('active');
        navStats.classList.add('active');
    }
}

navHome.addEventListener('click', () => navigateTo('home'));
navStats.addEventListener('click', () => navigateTo('stats'));

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
        const dayName = i === 0 ? 'Today' : days[d.getDay()][0]; // Just first letter for cleaner look
        const count = prayerHistory[dateStr] || 0;
        
        const height = (count / 5) * 100; // Percentage
        
        const barContainer = document.createElement('div');
        barContainer.className = 'bar-container';
        
        // Add filled class if height > 0 for gradient
        const filledClass = height > 0 ? 'filled' : '';
        const todayClass = i === 0 ? 'today' : '';
        
        barContainer.innerHTML = `
            <div class="bar ${filledClass} ${todayClass}" style="height: ${height}%" title="${count} Prayers"></div>
            <span class="day-label">${dayName}</span>
        `;
        chartEl.appendChild(barContainer);
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

// Calendar Picker Functions
const calendarToggleBtn = document.getElementById('toggle-calendar');
const calendarPanel = document.getElementById('calendar-panel');
const prayerSelectorPanel = document.getElementById('prayer-selector-panel');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const currentMonthSpan = document.getElementById('current-month');
const calendarGridEl = document.getElementById('calendar-grid');
const closeSelBtn = document.getElementById('close-prayer-selector');
const savePrayersBtn = document.getElementById('save-prayer-selector');

let currentCalendarDate = new Date();
let selectedDateForPrayers = null;

function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    currentMonthSpan.textContent = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);
    
    const firstDayOfWeek = firstDay.getDay();
    const lastDateOfMonth = lastDay.getDate();
    const prevLastDate = prevLastDay.getDate();
    
    // Calculate allowed date range (today to today + 2 days)
    const today = new Date();
    const minDate = new Date(today);
    minDate.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 2);
    maxDate.setHours(23, 59, 59, 999);
    
    // Check if next month button should be disabled
    const firstDayOfNextMonth = new Date(year, month + 1, 1);
    if (firstDayOfNextMonth > maxDate) {
        nextMonthBtn.disabled = true;
        nextMonthBtn.style.opacity = '0.5';
        nextMonthBtn.style.cursor = 'not-allowed';
    } else {
        nextMonthBtn.disabled = false;
        nextMonthBtn.style.opacity = '1';
        nextMonthBtn.style.cursor = 'pointer';
    }
    
    // Check if prev month button should be disabled
    if (year < today.getFullYear() || 
        (year === today.getFullYear() && month <= today.getMonth())) {
        prevMonthBtn.disabled = true;
        prevMonthBtn.style.opacity = '0.5';
        prevMonthBtn.style.cursor = 'not-allowed';
    } else {
        prevMonthBtn.disabled = false;
        prevMonthBtn.style.opacity = '1';
        prevMonthBtn.style.cursor = 'pointer';
    }
    
    let html = '';
    
    // Previous month's days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        html += `<div class="calendar-day other-month">${prevLastDate - i}</div>`;
    }
    
    // Current month's days
    for (let date = 1; date <= lastDateOfMonth; date++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
        const currentDate = new Date(year, month, date);
        currentDate.setHours(0, 0, 0, 0);
        
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === date;
        const isSelected = selectedDateForPrayers && selectedDateForPrayers === dateStr;
        const isOutOfRange = currentDate < minDate || currentDate > maxDate;
        
        let className = 'calendar-day';
        if (isToday) className += ' today';
        if (isSelected) className += ' selected';
        if (isOutOfRange) className += ' disabled';
        
        const clickHandler = isOutOfRange ? '' : `onclick="selectDateForPrayers('${dateStr}')"`;
        html += `<div class="calendar-day ${className}" ${clickHandler}>${date}</div>`;
    }
    
    // Next month's days
    const totalCells = firstDayOfWeek + lastDateOfMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let date = 1; date <= remainingCells; date++) {
        html += `<div class="calendar-day other-month">${date}</div>`;
    }
    
    calendarGridEl.innerHTML = html;
}

function selectDateForPrayers(dateStr) {
    selectedDateForPrayers = dateStr;
    renderCalendar();
    
    // Load saved prayers for this date
    const date = new Date(dateStr);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    document.getElementById('selected-day-title').textContent = `${dayName} - Select Prayers`;
    
    // Uncheck all first
    document.querySelectorAll('.prayer-select').forEach(input => input.checked = false);
    
    // Check saved prayers
    if (prayerDetails[dateStr]) {
        prayerDetails[dateStr].forEach(prayer => {
            const checkbox = document.querySelector(`input[data-prayer="${prayer}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }
    
    prayerSelectorPanel.classList.remove('hidden');
}

function savePrayersForDay() {
    if (!selectedDateForPrayers) return;
    
    const selectedPrayers = [];
    document.querySelectorAll('.prayer-select:checked').forEach(input => {
        selectedPrayers.push(input.getAttribute('data-prayer'));
    });
    
    prayerDetails[selectedDateForPrayers] = selectedPrayers;
    prayerHistory[selectedDateForPrayers] = selectedPrayers.length;
    
    localStorage.setItem('prayerDetails', JSON.stringify(prayerDetails));
    localStorage.setItem('prayerHistory', JSON.stringify(prayerHistory));
    
    prayerSelectorPanel.classList.add('hidden');
    selectedDateForPrayers = null;
    renderCalendar();
    renderStats();
}

calendarToggleBtn.addEventListener('click', () => {
    calendarPanel.classList.toggle('hidden');
    if (!calendarPanel.classList.contains('hidden')) {
        renderCalendar();
    }
});

prevMonthBtn.addEventListener('click', () => {
    const newDate = new Date(currentCalendarDate);
    newDate.setMonth(newDate.getMonth() - 1);
    
    const today = new Date();
    if (newDate.getFullYear() > today.getFullYear() || 
        (newDate.getFullYear() === today.getFullYear() && newDate.getMonth() >= today.getMonth())) {
        currentCalendarDate = newDate;
        renderCalendar();
    }
});

nextMonthBtn.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderCalendar();
});

closeSelBtn.addEventListener('click', () => {
    prayerSelectorPanel.classList.add('hidden');
    selectedDateForPrayers = null;
    renderCalendar();
});

savePrayersBtn.addEventListener('click', savePrayersForDay);

// Start
// --- Logic: Progress ---

function updateProgress() {
    const completed = prayerStatus.filter(Boolean).length;
    const total = PRAYERS.length;
    
 
    
    const radius = 82;
    const circumference = 2 * Math.PI * radius; // ~515.22
    
    // Offset logic:
    // If 0 done: offset = circumference (Hidden / Empty)
    // If 5 done: offset = 0 (Full)
    const offset = circumference - (completed / total) * circumference;
    
    progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
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
