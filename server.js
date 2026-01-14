const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// DATABASE CONNECTION - UPDATE YOUR PASSWORD HERE
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Gopal7424', 
    database: 'edulearn'
});

// Connect to database
db.connect((err) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        console.log('\n🔧 Fix: Update password in server.js line 13');
        return;
    }
    console.log('✅ Connected to MySQL database');
    createTables();
});

// Create tables
function createTables() {
    const usersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            fullName VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            grade VARCHAR(50),
            role ENUM('student', 'teacher') NOT NULL,
            schoolName VARCHAR(255),
            subject VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    const resetTable = `
        CREATE TABLE IF NOT EXISTS password_resets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            code VARCHAR(4) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL
        )
    `;

    db.query(usersTable, (err) => {
        if (err) {
            console.error('❌ Error creating users table:', err.message);
        } else {
            console.log('✅ Users table ready');
        }
    });

    db.query(resetTable, (err) => {
        if (err) {
            console.error('❌ Error creating password_resets table:', err.message);
        } else {
            console.log('✅ Password resets table ready');
        }
    });
}

// REGISTER
app.post('/register', (req, res) => {
    const { fullName, email, password, grade, role, schoolName } = req.body;

    console.log('📝 Registration attempt:', email);

    // Check if user exists
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.json({ success: false, message: 'Database error' });
        }

        if (results.length > 0) {
            console.log('⚠️  Email already exists');
            return res.json({ success: false, message: 'Email already registered' });
        }

        // Insert new user
        const query = 'INSERT INTO users (fullName, email, password, grade, role, schoolName) VALUES (?, ?, ?, ?, ?, ?)';
        db.query(query, [fullName, email, password, grade, role, schoolName], (err) => {
            if (err) {
                console.error('❌ Insert error:', err);
                return res.json({ success: false, message: 'Registration failed' });
            }
            console.log('✅ User registered successfully');
            res.json({ success: true, message: 'Account created successfully!' });
        });
    });
});

// LOGIN
app.post('/login', (req, res) => {
    const { email, password, role } = req.body;

    console.log('🔑 Login attempt:', email, '- Role:', role);

    const query = 'SELECT * FROM users WHERE email = ? AND password = ? AND role = ?';
    db.query(query, [email, password, role], (err, results) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.json({ success: false, message: 'Database error' });
        }

        if (results.length === 0) {
            console.log('⚠️  Invalid credentials');
            return res.json({ success: false, message: 'Invalid credentials or role' });
        }

        const user = results[0];
        console.log('✅ Login successful');
        res.json({
            success: true,
            message: 'Login successful!',
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                grade: user.grade,
                schoolName: user.schoolName
            }
        });
    });
});

// FORGOT PASSWORD
app.post('/forgot-password', (req, res) => {
    const { email } = req.body;

    console.log('🔐 Password reset request:', email);

    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            return res.json({ success: false, message: 'Database error' });
        }

        if (results.length === 0) {
            console.log('⚠️  Email not found');
            return res.json({ success: false, message: 'Email not found' });
        }

        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        db.query('DELETE FROM password_resets WHERE email = ?', [email]);

        db.query(
            'INSERT INTO password_resets (email, code, expires_at) VALUES (?, ?, ?)',
            [email, code, expiresAt],
            (err) => {
                if (err) {
                    return res.json({ success: false, message: 'Failed to generate code' });
                }

                console.log(`🔑 Reset code for ${email}: ${code}`);
                res.json({
                    success: true,
                    message: `Code sent! Check console: ${code}`
                });
            }
        );
    });
});

// VERIFY CODE
app.post('/verify-code', (req, res) => {
    const { email, code } = req.body;

    console.log('🔍 Verifying code:', code, 'for', email);

    const query = 'SELECT * FROM password_resets WHERE email = ? AND code = ? AND expires_at > NOW()';
    db.query(query, [email, code], (err, results) => {
        if (err) {
            return res.json({ success: false, message: 'Database error' });
        }

        if (results.length === 0) {
            console.log('⚠️  Invalid or expired code');
            return res.json({ success: false, message: 'Invalid or expired code' });
        }

        console.log('✅ Code verified');
        res.json({ success: true, message: 'Code verified!' });
    });
});

// RESET PASSWORD
app.post('/reset-password', (req, res) => {
    const { email, code, newPassword } = req.body;

    console.log('🔄 Resetting password for:', email);

    const verifyQuery = 'SELECT * FROM password_resets WHERE email = ? AND code = ? AND expires_at > NOW()';
    db.query(verifyQuery, [email, code], (err, results) => {
        if (err || results.length === 0) {
            return res.json({ success: false, message: 'Invalid or expired code' });
        }

        db.query('UPDATE users SET password = ? WHERE email = ?', [newPassword, email], (err) => {
            if (err) {
                return res.json({ success: false, message: 'Failed to update password' });
            }

            db.query('DELETE FROM password_resets WHERE email = ?', [email]);

            console.log('✅ Password reset successful');
            res.json({ success: true, message: 'Password reset successfully!' });
        });
    });
});

// ADMIN - Get all users
app.get('/admin/users', (req, res) => {
    console.log('📊 Admin: Fetching all users');

    const query = 'SELECT id, fullName, email, role, grade, schoolName, subject, created_at FROM users ORDER BY created_at DESC';
    db.query(query, (err, results) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.json({ success: false, message: 'Failed to fetch users' });
        }

        console.log(`✅ Found ${results.length} users`);
        res.json({
            success: true,
            users: results
        });
    });
});

// Start server
const PORT = 5000;
app.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 Server running on http://localhost:' + PORT);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});