const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// --- CONFIGURATION ---
const SECRET_KEY = process.env.JWT_SECRET || 'SUPER_SECRET_KEY';
const PORT = process.env.PORT || 5000;

app.use(express.json()); 
app.use(cookieParser());

// 1. UPDATE CORS: Add your Render frontend URL here
const allowedOrigins = [
    "http://localhost:5173", // Local development
    "https://your-frontend-app.onrender.com" // Replace with your actual Render frontend URL
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS policy violation'), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

// --- MONGODB CONNECTION ---
// Ensure you set MONGO_URI in Render dashboard to your MongoDB Atlas string
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hospitalDB')
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Error:", err));

// --- USER MODEL ---
const User = mongoose.model('User', new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }
}));

// --- ROUTES ---

app.get('/api/verify', (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        res.json({ status: 'ok', userId: decoded.id });
    });
});

app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) return res.status(409).json({ error: 'Email already registered.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ email: email.toLowerCase().trim(), password: hashedPassword });
        
        res.status(201).json({ status: 'ok' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user._id }, SECRET_KEY, { expiresIn: '1h' });
            
            // 2. UPDATE COOKIE: Secure and SameSite for production
            res.cookie('token', token, {
                httpOnly: true,
                secure: true,   // Set to true for Render (HTTPS)
                sameSite: 'none', // Required for cross-site cookies on Render
                path: '/',
                maxAge: 3600000 
            });
            
            return res.json({ status: 'ok' });
        }
        res.status(401).json({ error: 'Invalid credentials' });
    } catch (err) {
        res.status(500).json({ error: 'Internal error' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: true, 
        sameSite: 'none',
        path: '/'
    });
    res.status(200).json({ status: 'logged out' });
});

// 3. BIND TO 0.0.0.0: Render requirement
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend running on port ${PORT}`);
});