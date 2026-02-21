import express from 'express';
import cors from 'cors';
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: './.env.local' });

const app = express();

// ESM Fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists (Note: Vercel filesystem is read-only in production)
const DATA_DIR = '/tmp'; // Use /tmp for ephemeral storage on Vercel if needed
const DATA_FILE = path.join(DATA_DIR, 'users.json');

app.use(cors());
app.use(express.json());

// Persistence Helpers
const loadUsers = () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Error loading users data:", error);
    }
    return {};
};

const saveUsers = (usersData) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(usersData, null, 2));
    } catch (error) {
        console.error("Error saving users data:", error);
    }
};

// Initialize users
let users = loadUsers();

app.post('/api/send-email', async (req, res) => {
    const { to, subject, text, html } = req.body;
    const apiKey = process.env.VITE_SENDGRID_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "Server misconfiguration: Missing API Key" });
    }

    sgMail.setApiKey(apiKey);

    const msg = {
        to: to,
        from: 'Ganeshgouli204@gmail.com',
        subject: subject,
        text: text,
        html: html,
    };

    try {
        await sgMail.send(msg);
        res.status(200).json({ message: "Email sent successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to send email", details: error.message });
    }
});

const getToday = () => new Date().toISOString().split('T')[0];

const sendEmail = async (to, subject, text) => {
    const apiKey = process.env.VITE_SENDGRID_API_KEY;
    if (!apiKey) return;
    sgMail.setApiKey(apiKey);
    const msg = {
        to,
        from: 'Ganeshgouli204@gmail.com',
        subject,
        text,
        html: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>Health Hub AI Reminder</h2><p>${text}</p></div>`
    };
    try {
        await sgMail.send(msg);
    } catch (error) {
        console.error(`Failed to send email to ${to}`, error);
    }
};

app.post('/api/register-user', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    if (!users[email]) {
        users[email] = { registeredAt: new Date(), logs: {}, sentReminders: {} };
        saveUsers(users);
    }

    res.status(200).json({ message: "Registered" });
});

app.post('/api/log-food', (req, res) => {
    const { email, details } = req.body;
    if (!email || !users[email]) return res.status(404).json({ error: "User not found or not registered" });

    const today = getToday();
    if (!users[email].logs[today]) users[email].logs[today] = { breakfast: false, lunch: false, dinner: false, anyLog: false, caloriesIn: 0, caloriesOut: 0, loggedFoods: [] };

    const log = users[email].logs[today];
    log.anyLog = true;

    if (details && details.totalCalories) {
        log.caloriesIn = (log.caloriesIn || 0) + details.totalCalories;
    }

    if (details && details.items) {
        log.loggedFoods = [...(log.loggedFoods || []), ...details.items];
    }

    const hour = new Date().getHours();
    if (hour < 11) log.breakfast = true;
    else if (hour < 16) log.lunch = true;
    else log.dinner = true;

    saveUsers(users);
    res.status(200).json({ message: "Logged", currentLog: log });
});

app.post('/api/log-workout', (req, res) => {
    const { email, caloriesBurned } = req.body;
    if (!email || !users[email]) return res.status(404).json({ error: "User not found or not registered" });

    const today = getToday();
    if (!users[email].logs[today]) users[email].logs[today] = { breakfast: false, lunch: false, dinner: false, anyLog: false, caloriesIn: 0, caloriesOut: 0, loggedFoods: [] };

    const log = users[email].logs[today];
    log.caloriesOut = (log.caloriesOut || 0) + (parseFloat(caloriesBurned) || 0);

    saveUsers(users);
    res.status(200).json({ message: "Workout Logged", currentLog: log });
});

app.get('/api/user-activity', (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(404).json({ error: "User not found" });

    const userEmail = email.toLowerCase();
    if (!users[userEmail]) return res.status(404).json({ error: "User not found" });

    const allLogs = users[userEmail].logs;
    const history = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const log = allLogs[dateStr] || { caloriesIn: 0, caloriesOut: 0, loggedFoods: [] };

        history.push({
            date: dateStr,
            caloriesIn: log.caloriesIn || 0,
            caloriesOut: log.caloriesOut || 0,
            loggedFoods: log.loggedFoods || []
        });
    }

    res.status(200).json({ history });
});

export default app;
