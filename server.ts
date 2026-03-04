import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("database.db");
const JWT_SECRET = process.env.JWT_SECRET || "ff-arena-secret-key-123";

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    ff_id TEXT,
    first_name TEXT,
    last_name TEXT,
    balance INTEGER DEFAULT 0,
    profile_picture TEXT,
    is_admin INTEGER DEFAULT 0,
    last_username_change DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Ensure columns exist (in case table was created with older schema)
try { db.exec("ALTER TABLE users ADD COLUMN first_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN last_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN ff_id TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN last_username_change DATETIME"); } catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    prize_pool TEXT,
    entry_fee TEXT,
    start_date DATETIME,
    slots_total INTEGER,
    slots_filled INTEGER DEFAULT 0,
    status TEXT DEFAULT 'open'
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    tournament_id INTEGER,
    team_name TEXT,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(tournament_id) REFERENCES tournaments(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    amount INTEGER,
    method TEXT,
    sender_number TEXT,
    transaction_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed admin user if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO users (username, email, password, ff_id, first_name, last_name, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)").run("admin", "admin@ffedena.com", hashedPassword, "ADMIN001", "System", "Admin", 1);
}

// Seed some initial tournaments if empty
const tournamentCount = db.prepare("SELECT COUNT(*) as count FROM tournaments").get() as { count: number };
if (tournamentCount.count === 0) {
  const insert = db.prepare(`
    INSERT INTO tournaments (title, description, prize_pool, entry_fee, start_date, slots_total)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insert.run("FF Pro League Season 1", "The ultimate battle for glory.", "৳10,000", "Free", "2026-03-10 18:00:00", 48);
  insert.run("Weekend Clash", "Fast-paced tournament for everyone.", "৳2,000", "৳50", "2026-03-07 20:00:00", 24);
  insert.run("Elite Squad Showdown", "Only for the best squads.", "৳5,000", "৳100", "2026-03-15 15:00:00", 12);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Unauthorized" });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: "Forbidden" });
      req.user = user;
      next();
    });
  };

  const isAdmin = (req: any, res: any, next: any) => {
    const user = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(req.user.id) as any;
    if (user && user.is_admin === 1) {
      next();
    } else {
      res.status(403).json({ error: "Admin access required" });
    }
  };

  // API Routes
  app.post("/api/auth/signup", async (req, res) => {
    const { username, email, password, ff_id, first_name, last_name } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO users (username, email, password, ff_id, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?)");
      const result = stmt.run(username, email, hashedPassword, ff_id, first_name, last_name);
      res.status(201).json({ message: "User created", id: result.lastInsertRowid });
    } catch (error: any) {
      console.error("Signup error:", error);
      res.status(400).json({ error: error.message.includes("UNIQUE") ? "Username or Email already exists" : `Signup failed: ${error.message}` });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, ff_id: user.ff_id, balance: user.balance, is_admin: user.is_admin } });
  });

  app.get("/api/tournaments", (req, res) => {
    const tournaments = db.prepare("SELECT * FROM tournaments ORDER BY start_date ASC").all();
    res.json(tournaments);
  });

  app.get("/api/user/profile", authenticateToken, (req: any, res) => {
    const user = db.prepare("SELECT id, username, email, ff_id, first_name, last_name, balance, profile_picture, is_admin, last_username_change FROM users WHERE id = ?").get(req.user.id);
    res.json(user);
  });

  app.post("/api/user/profile", authenticateToken, (req: any, res) => {
    const { username, ff_id, profile_picture, first_name, last_name } = req.body;
    const userId = req.user.id;
    
    try {
      const currentUser = db.prepare("SELECT username, last_username_change FROM users WHERE id = ?").get(userId) as any;
      
      let updateUsername = currentUser.username;
      let lastUsernameChange = currentUser.last_username_change;

      if (username && username !== currentUser.username) {
        // Check if username is unique
        const existing = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, userId);
        if (existing) return res.status(400).json({ error: "Username already taken" });

        // Check 30 day restriction
        if (currentUser.last_username_change) {
          const lastChange = new Date(currentUser.last_username_change);
          const now = new Date();
          const diffDays = Math.ceil((now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < 30) {
            return res.status(400).json({ error: `You can only change your username once every 30 days. Please wait ${30 - diffDays} more days.` });
          }
        }
        updateUsername = username;
        lastUsernameChange = new Date().toISOString();
      }

      db.prepare("UPDATE users SET username = ?, ff_id = ?, profile_picture = ?, first_name = ?, last_name = ?, last_username_change = ? WHERE id = ?")
        .run(updateUsername, ff_id, profile_picture, first_name, last_name, lastUsernameChange, userId);
        
      res.json({ message: "Profile updated successfully" });
    } catch (error: any) {
      console.error("Profile update error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/user/registrations", authenticateToken, (req: any, res) => {
    const registrations = db.prepare(`
      SELECT r.*, t.title as tournament_title, t.start_date
      FROM registrations r
      JOIN tournaments t ON r.tournament_id = t.id
      WHERE r.user_id = ?
    `).all(req.user.id);
    res.json(registrations);
  });

  app.post("/api/tournaments/:id/register", authenticateToken, (req: any, res) => {
    const { team_name } = req.body;
    const tournamentId = req.params.id;
    
    try {
      const existing = db.prepare("SELECT * FROM registrations WHERE user_id = ? AND tournament_id = ?").get(req.user.id, tournamentId);
      if (existing) return res.status(400).json({ error: "Already registered" });

      const tournament = db.prepare("SELECT * FROM tournaments WHERE id = ?").get(tournamentId) as any;
      if (tournament.slots_filled >= tournament.slots_total) {
        return res.status(400).json({ error: "Tournament is full" });
      }

      // Check balance if entry fee is not free
      if (tournament.entry_fee !== "Free") {
        const fee = parseInt(tournament.entry_fee.replace(/[^0-9]/g, ''));
        const user = db.prepare("SELECT balance FROM users WHERE id = ?").get(req.user.id) as any;
        if (user.balance < fee) {
          return res.status(400).json({ error: "Insufficient balance" });
        }
        db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(fee, req.user.id);
      }

      const stmt = db.prepare("INSERT INTO registrations (user_id, tournament_id, team_name) VALUES (?, ?, ?)");
      stmt.run(req.user.id, tournamentId, team_name);
      
      db.prepare("UPDATE tournaments SET slots_filled = slots_filled + 1 WHERE id = ?").run(tournamentId);
      
      res.json({ message: "Registered successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Wallet Endpoints
  app.post("/api/wallet/deposit", authenticateToken, (req: any, res) => {
    const { amount, method, sender_number, transaction_id } = req.body;
    if (amount < 50 || amount > 5000) return res.status(400).json({ error: "Invalid amount" });
    
    try {
      db.prepare("INSERT INTO transactions (user_id, type, amount, method, sender_number, transaction_id) VALUES (?, 'deposit', ?, ?, ?, ?)")
        .run(req.user.id, amount, method, sender_number, transaction_id);
      res.json({ message: "Deposit request submitted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/wallet/withdraw", authenticateToken, (req: any, res) => {
    const { amount, method, sender_number } = req.body;
    const user = db.prepare("SELECT balance FROM users WHERE id = ?").get(req.user.id) as any;
    
    if (user.balance < amount) return res.status(400).json({ error: "Insufficient balance" });
    
    try {
      db.prepare("INSERT INTO transactions (user_id, type, amount, method, sender_number) VALUES (?, 'withdraw', ?, ?, ?)")
        .run(req.user.id, amount, method, sender_number);
      // Deduct balance immediately for withdrawal request? 
      // User said "If your balance is sufficient... within 24 hours you will receive". 
      // Usually we deduct immediately to prevent double spending.
      db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(amount, req.user.id);
      res.json({ message: "Withdrawal request submitted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/wallet/transactions", authenticateToken, (req: any, res) => {
    const transactions = db.prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
    res.json(transactions);
  });

  // Notice Endpoints
  app.get("/api/notices", (req, res) => {
    const notices = db.prepare("SELECT * FROM notices ORDER BY created_at DESC LIMIT 10").all();
    res.json(notices);
  });

  // Admin Endpoints
  app.get("/api/admin/transactions", authenticateToken, isAdmin, (req, res) => {
    const transactions = db.prepare(`
      SELECT t.*, u.username, u.email 
      FROM transactions t 
      JOIN users u ON t.user_id = u.id 
      WHERE t.status = 'pending'
      ORDER BY t.created_at ASC
    `).all();
    res.json(transactions);
  });

  app.post("/api/admin/transactions/:id/approve", authenticateToken, isAdmin, (req, res) => {
    const transactionId = req.params.id;
    const transaction = db.prepare("SELECT * FROM transactions WHERE id = ?").get(transactionId) as any;
    
    if (!transaction || transaction.status !== 'pending') return res.status(400).json({ error: "Invalid transaction" });
    
    try {
      db.prepare("UPDATE transactions SET status = 'approved' WHERE id = ?").run(transactionId);
      if (transaction.type === 'deposit') {
        db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(transaction.amount, transaction.user_id);
      }
      // For withdrawal, balance was already deducted on request.
      res.json({ message: "Transaction approved" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/transactions/:id/reject", authenticateToken, isAdmin, (req, res) => {
    const transactionId = req.params.id;
    const transaction = db.prepare("SELECT * FROM transactions WHERE id = ?").get(transactionId) as any;
    
    if (!transaction || transaction.status !== 'pending') return res.status(400).json({ error: "Invalid transaction" });
    
    try {
      db.prepare("UPDATE transactions SET status = 'rejected' WHERE id = ?").run(transactionId);
      if (transaction.type === 'withdraw') {
        // Refund balance if withdrawal rejected
        db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(transaction.amount, transaction.user_id);
      }
      res.json({ message: "Transaction rejected" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/notices", authenticateToken, isAdmin, (req, res) => {
    const { content } = req.body;
    db.prepare("INSERT INTO notices (content) VALUES (?)").run(content);
    res.json({ message: "Notice posted" });
  });

  app.get("/api/admin/users", authenticateToken, isAdmin, (req, res) => {
    const users = db.prepare("SELECT id, username, email, ff_id, first_name, last_name, balance, is_admin, created_at FROM users ORDER BY created_at DESC").all();
    res.json(users);
  });

  app.get("/api/admin/stats", authenticateToken, isAdmin, (req, res) => {
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
    const tournamentCount = db.prepare("SELECT COUNT(*) as count FROM tournaments").get() as { count: number };
    const pendingTransactions = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE status = 'pending'").get() as { count: number };
    res.json({
      users: userCount.count,
      tournaments: tournamentCount.count,
      pending: pendingTransactions.count
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
