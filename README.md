# 🕌 Sajjda - Premium Daily Prayer Tracker

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![Style](https://img.shields.io/badge/style-Glassmorphism-purple.svg)

**Sajjda** is a modern, aesthetically pleasing web application designed to help you track your daily prayers with ease. Built with a focus on "Cool UI/UX", it features a glassmorphism design, interactive animations, and real-time functionality.

## ✨ Key Features

-   **🌍 Smart Geolocation**: Automatically detects your city and pulls accurate prayer times via the Aladhan API (ISNA method).
-   **⏱️ Next Prayer Countdown**: A real-time countdown timer that tells you exactly when the next prayer is due.
-   **⭕ Daily Progress Ring**: Visual circular progress bar that fills up as you complete your 5 daily prayers.
-   **🎉 Celebration Mode**: A satisfying confetti rain animation triggers when you hit 5/5 prayers!
-   **📱 Installable (PWA)**: Works like a native iOS/Android app. Add it to your home screen for a full-screen experience.
-   **💾 Persistence**: Never lose your streak. Data is saved locally and intelligently resets every midnight.
-   **🔔 Notifications**: Get browser alerts when it's time to pray.
-   **✨ Visual Polish**: Premium 3D tilt effects on cards and a glowing "Midnight & Violet" theme.

## 🚀 Deployment Guide

You can deploy this app for **free** in seconds.

### Method 1: Netlify Drop (Recommended)
1.  Visit [Netlify Drop](https://app.netlify.com/drop).
2.  Drag and drop the entire `PrayerTracker` folder onto the page.
3.  Your app is live! 🌐

### Method 2: Vercel
1.  Install Vercel CLI: `npm i -g vercel`.
2.  Run `vercel` inside the project folder.

## 📱 How to Install on Mobile

**Only takes 10 seconds!**

### iOS (iPhone)
1.  Open your deployed link in **Safari**.
2.  Tap the **Share** button (Square with up arrow).
3.  Scroll down and tap **"Add to Home Screen"**.
4.  Launch "Sajjda" from your home screen. It will look like a native app!

### Android
1.  Open the link in **Chrome**.
2.  Tap the three dots (Menu).
3.  Tap **"Install App"** or **"Add to Home Screen"**.

## 🛠️ Project Structure

```bash
📂 PrayerTracker
 ├── index.html        # Main App Structure (Semantic HTML5)
 ├── style.css         # Styling (Glassmorphism, Animations, Responsive)
 ├── app.js            # Logic (API, Geolocation, Notifications, PWA)
 ├── manifest.json     # PWA Configuration
 └── README.md         # Documentation
```

## 👨‍💻 Tech Stack

-   **HTML5**
-   **CSS3** (Variables, Flexbox, Grid, 3D Transforms)
-   **JavaScript** (ES6+, Fetch API, LocalStorage)
-   **API**: [Aladhan Prayer Times](https://aladhan.com/prayer-times-api)

---

*Made with ❤️ for the Ummah.*
