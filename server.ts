import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Backend will not function correctly.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const JWT_SECRET = process.env.JWT_SECRET || "ff-arena-secret-key-123";

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

  const isAdmin = async (req: any, res: any, next: any) => {
    const { data: user, error } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", req.user.id)
      .single();

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
      const { data, error } = await supabase
        .from("users")
        .insert([{ username, email, password: hashedPassword, ff_id, first_name, last_name }])
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ message: "User created", id: data.id });
    } catch (error: any) {
      console.error("Signup error:", error);
      res.status(400).json({ error: error.message.includes("duplicate") ? "Username or Email already exists" : `Signup failed: ${error.message}` });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, ff_id: user.ff_id, balance: user.balance, is_admin: user.is_admin } });
  });

  app.get("/api/tournaments", async (req, res) => {
    const { data: tournaments, error } = await supabase
      .from("tournaments")
      .select("*")
      .order("start_date", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(tournaments);
  });

  app.get("/api/user/profile", authenticateToken, async (req: any, res) => {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, email, ff_id, first_name, last_name, balance, profile_picture, is_admin, last_username_change")
      .eq("id", req.user.id)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(user);
  });

  app.post("/api/user/profile", authenticateToken, async (req: any, res) => {
    const { username, ff_id, profile_picture, first_name, last_name } = req.body;
    const userId = req.user.id;
    
    try {
      const { data: currentUser, error: fetchError } = await supabase
        .from("users")
        .select("username, last_username_change")
        .eq("id", userId)
        .single();

      if (fetchError) throw fetchError;
      
      let updateUsername = currentUser.username;
      let lastUsernameChange = currentUser.last_username_change;

      if (username && username !== currentUser.username) {
        // Check if username is unique
        const { data: existing } = await supabase
          .from("users")
          .select("id")
          .eq("username", username)
          .neq("id", userId)
          .single();

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

      const { error: updateError } = await supabase
        .from("users")
        .update({ username: updateUsername, ff_id, profile_picture, first_name, last_name, last_username_change: lastUsernameChange })
        .eq("id", userId);

      if (updateError) throw updateError;
        
      res.json({ message: "Profile updated successfully" });
    } catch (error: any) {
      console.error("Profile update error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/user/registrations", authenticateToken, async (req: any, res) => {
    const { data: registrations, error } = await supabase
      .from("registrations")
      .select(`
        *,
        tournaments (
          title,
          start_date
        )
      `)
      .eq("user_id", req.user.id);

    if (error) return res.status(500).json({ error: error.message });

    // Flatten the result to match existing frontend expectations
    const flattened = registrations.map((reg: any) => ({
      ...reg,
      tournament_title: reg.tournaments?.title,
      start_date: reg.tournaments?.start_date
    }));

    res.json(flattened);
  });

  app.post("/api/tournaments/:id/register", authenticateToken, async (req: any, res) => {
    const { team_name } = req.body;
    const tournamentId = req.params.id;
    
    try {
      const { data: existing } = await supabase
        .from("registrations")
        .select("*")
        .eq("user_id", req.user.id)
        .eq("tournament_id", tournamentId)
        .single();

      if (existing) return res.status(400).json({ error: "Already registered" });

      const { data: tournament, error: tError } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", tournamentId)
        .single();

      if (tError) throw tError;

      if (tournament.slots_filled >= tournament.slots_total) {
        return res.status(400).json({ error: "Tournament is full" });
      }

      // Check balance if entry fee is not free
      if (tournament.entry_fee !== "Free") {
        const fee = parseInt(tournament.entry_fee.replace(/[^0-9]/g, ''));
        const { data: user, error: uError } = await supabase
          .from("users")
          .select("balance")
          .eq("id", req.user.id)
          .single();

        if (uError) throw uError;

        if (user.balance < fee) {
          return res.status(400).json({ error: "Insufficient balance" });
        }

        // Deduct balance
        const { error: balanceError } = await supabase
          .from("users")
          .update({ balance: user.balance - fee })
          .eq("id", req.user.id);

        if (balanceError) throw balanceError;
      }

      const { error: regError } = await supabase
        .from("registrations")
        .insert([{ user_id: req.user.id, tournament_id: tournamentId, team_name }]);

      if (regError) throw regError;
      
      const { error: slotError } = await supabase
        .from("tournaments")
        .update({ slots_filled: tournament.slots_filled + 1 })
        .eq("id", tournamentId);

      if (slotError) throw slotError;
      
      res.json({ message: "Registered successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Wallet Endpoints
  app.post("/api/wallet/deposit", authenticateToken, async (req: any, res) => {
    const { amount, method, sender_number, transaction_id } = req.body;
    if (amount < 50 || amount > 5000) return res.status(400).json({ error: "Invalid amount" });
    
    try {
      const { error } = await supabase
        .from("transactions")
        .insert([{ user_id: req.user.id, type: 'deposit', amount, method, sender_number, transaction_id }]);

      if (error) throw error;
      res.json({ message: "Deposit request submitted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/wallet/withdraw", authenticateToken, async (req: any, res) => {
    const { amount, method, sender_number } = req.body;
    
    try {
      const { data: user, error: uError } = await supabase
        .from("users")
        .select("balance")
        .eq("id", req.user.id)
        .single();

      if (uError) throw uError;
      
      if (user.balance < amount) return res.status(400).json({ error: "Insufficient balance" });
      
      const { error: transError } = await supabase
        .from("transactions")
        .insert([{ user_id: req.user.id, type: 'withdraw', amount, method, sender_number }]);

      if (transError) throw transError;

      // Deduct balance immediately
      const { error: balanceError } = await supabase
        .from("users")
        .update({ balance: user.balance - amount })
        .eq("id", req.user.id);

      if (balanceError) throw balanceError;

      res.json({ message: "Withdrawal request submitted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/wallet/transactions", authenticateToken, async (req: any, res) => {
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(transactions);
  });

  // Notice Endpoints
  app.get("/api/notices", async (req, res) => {
    const { data: notices, error } = await supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) return res.status(500).json({ error: error.message });
    res.json(notices);
  });

  // Admin Endpoints
  app.get("/api/admin/transactions", authenticateToken, isAdmin, async (req, res) => {
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select(`
        *,
        users (
          username,
          email
        )
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    // Flatten
    const flattened = transactions.map((t: any) => ({
      ...t,
      username: t.users?.username,
      email: t.users?.email
    }));

    res.json(flattened);
  });

  app.post("/api/admin/transactions/:id/approve", authenticateToken, isAdmin, async (req, res) => {
    const transactionId = req.params.id;
    
    try {
      const { data: transaction, error: tError } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .single();

      if (tError || !transaction || transaction.status !== 'pending') {
        return res.status(400).json({ error: "Invalid transaction" });
      }
      
      const { error: updateError } = await supabase
        .from("transactions")
        .update({ status: 'approved' })
        .eq("id", transactionId);

      if (updateError) throw updateError;

      if (transaction.type === 'deposit') {
        const { data: user } = await supabase.from("users").select("balance").eq("id", transaction.user_id).single();
        await supabase
          .from("users")
          .update({ balance: (user?.balance || 0) + transaction.amount })
          .eq("id", transaction.user_id);
      }
      
      res.json({ message: "Transaction approved" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/transactions/:id/reject", authenticateToken, isAdmin, async (req, res) => {
    const transactionId = req.params.id;
    
    try {
      const { data: transaction, error: tError } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .single();

      if (tError || !transaction || transaction.status !== 'pending') {
        return res.status(400).json({ error: "Invalid transaction" });
      }
      
      const { error: updateError } = await supabase
        .from("transactions")
        .update({ status: 'rejected' })
        .eq("id", transactionId);

      if (updateError) throw updateError;

      if (transaction.type === 'withdraw') {
        // Refund balance
        const { data: user } = await supabase.from("users").select("balance").eq("id", transaction.user_id).single();
        await supabase
          .from("users")
          .update({ balance: (user?.balance || 0) + transaction.amount })
          .eq("id", transaction.user_id);
      }
      res.json({ message: "Transaction rejected" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/notices", authenticateToken, isAdmin, async (req, res) => {
    const { content } = req.body;
    const { error } = await supabase.from("notices").insert([{ content }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Notice posted" });
  });

  app.get("/api/admin/users", authenticateToken, isAdmin, async (req, res) => {
    const { data: users, error } = await supabase
      .from("users")
      .select("id, username, email, ff_id, first_name, last_name, balance, is_admin, created_at")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(users);
  });

  app.get("/api/admin/stats", authenticateToken, isAdmin, async (req, res) => {
    try {
      const { count: userCount } = await supabase.from("users").select("*", { count: 'exact', head: true });
      const { count: tournamentCount } = await supabase.from("tournaments").select("*", { count: 'exact', head: true });
      const { count: pendingTransactions } = await supabase.from("transactions").select("*", { count: 'exact', head: true }).eq("status", "pending");
      
      res.json({
        users: userCount || 0,
        tournaments: tournamentCount || 0,
        pending: pendingTransactions || 0
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
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
