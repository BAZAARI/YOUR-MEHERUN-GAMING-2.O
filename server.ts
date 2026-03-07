import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase Configuration
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

let db: admin.firestore.Firestore | null = null;
let auth: admin.auth.Auth | null = null;

if (projectId && clientEmail && privateKey) {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
    db = admin.firestore();
    auth = admin.auth();
    console.log("Firebase Admin initialized successfully");
  } catch (err) {
    console.error("Failed to initialize Firebase Admin:", err);
  }
} else {
  console.warn("Firebase credentials missing. Backend will not function correctly.");
}

const JWT_SECRET = process.env.JWT_SECRET || "ff-arena-secret-key-123";

const app = express();

async function startServer() {
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // Middleware to check if Firebase is initialized
  const checkFirebase = (req: any, res: any, next: any) => {
    if (!db || !auth) {
      return res.status(503).json({ 
        error: "Database connection not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in the Secrets panel." 
      });
    }
    next();
  };

  // Auth Middleware (Using Firebase ID Tokens)
  const authenticateToken = async (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      if (!auth) throw new Error("Firebase Admin Auth not initialized");
      const decodedToken = await auth.verifyIdToken(token);
      req.user = { id: decodedToken.uid, email: decodedToken.email };
      next();
    } catch (err: any) {
      console.error("Token verification error:", err.message);
      return res.status(403).json({ error: "Forbidden: " + err.message });
    }
  };

  const isAdmin = async (req: any, res: any, next: any) => {
    if (!db) return res.status(503).json({ error: "Database not available" });
    
    // Hardcoded admin emails for safety
    const adminEmails = ['yourmeherun007@gmail.com', 'rafiyajannat404@gmail.com', 'yoursmeherun007@gmail.com'];
    
    const userDoc = await db.collection("users").doc(req.user.id).get();
    const userData = userDoc.data();

    if (userData && (userData.is_admin === 1 || adminEmails.includes(userData.email.toLowerCase()))) {
      next();
    } else {
      res.status(403).json({ error: "Admin access required" });
    }
  };

  // OTP Auth Endpoints
  app.post("/api/auth/otp/send", checkFirebase, async (req, res) => {
    const { email } = req.body;
    try {
      if (!db) throw new Error("Database not initialized");
      
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60000); // 5 minutes expiry

      // Store OTP in Firestore
      await db.collection("otps").doc(email).set({
        otp,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      // Send Email (Using Nodemailer)
      // Note: User needs to provide SMTP credentials in .env
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const mailOptions = {
        from: `"yoursmeherungaming" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Your Verification Code",
        text: `Your OTP for yoursmeherungaming is: ${otp}. It will expire in 5 minutes.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; background: #f4f4f4;">
            <div style="max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 10px;">
              <h2 style="color: #ea580c;">Verification Code</h2>
              <p>Hello,</p>
              <p>Your one-time password (OTP) for <b>yoursmeherungaming</b> is:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #ea580c; margin: 20px 0; text-align: center;">
                ${otp}
              </div>
              <p>This code will expire in 5 minutes.</p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
          </div>
        `,
      };

      // Only attempt to send if credentials exist
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        await transporter.sendMail(mailOptions);
        res.json({ message: "OTP sent successfully to " + email });
      } else {
        console.log(`[DEV MODE] OTP for ${email}: ${otp}`);
        res.json({ 
          message: "OTP generated (Dev Mode). Check server logs.", 
          dev_otp: otp // In production, never return the OTP in the response!
        });
      }
    } catch (error: any) {
      console.error("OTP Send error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/otp/verify", checkFirebase, async (req, res) => {
    const { email, otp } = req.body;
    try {
      if (!db || !auth) throw new Error("Firebase not initialized");

      const otpDoc = await db.collection("otps").doc(email).get();
      if (!otpDoc.exists) {
        return res.status(400).json({ error: "OTP not found or expired" });
      }

      const data = otpDoc.data();
      const now = new Date();
      
      if (data?.otp !== otp) {
        return res.status(400).json({ error: "Invalid OTP" });
      }

      if (data?.expiresAt.toDate() < now) {
        return res.status(400).json({ error: "OTP expired" });
      }

      // OTP is valid, delete it
      await db.collection("otps").doc(email).delete();

      // Get or Create user in Firebase Auth
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email);
      } catch (e: any) {
        if (e.code === 'auth/user-not-found') {
          userRecord = await auth.createUser({
            email,
            emailVerified: true,
          });
        } else {
          throw e;
        }
      }

      // Create Custom Token
      const customToken = await auth.createCustomToken(userRecord.uid);
      
      // Get user data from Firestore
      const userDoc = await db.collection("users").doc(userRecord.uid).get();
      let userData = userDoc.data();

      if (!userDoc.exists) {
        // Initialize user record if missing
        const adminEmails = ['yourmeherun007@gmail.com', 'rafiyajannat404@gmail.com', 'yoursmeherun007@gmail.com'];
        const isAdmin = adminEmails.includes(email.toLowerCase());
        
        userData = {
          id: userRecord.uid,
          username: email.split('@')[0],
          email: email.toLowerCase(),
          ff_id: 'N/A',
          first_name: isAdmin ? 'Admin' : 'User',
          last_name: '',
          balance: 0,
          is_admin: isAdmin ? 1 : 0,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        await db.collection("users").doc(userRecord.uid).set(userData);
      }

      res.json({ 
        token: customToken,
        user: {
          id: userRecord.uid,
          username: userData?.username,
          email: userData?.email,
          balance: userData?.balance,
          is_admin: userData?.is_admin
        }
      });
    } catch (error: any) {
      console.error("OTP Verify error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/firebase-check", async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ 
          status: "error", 
          message: "Firebase Admin is NOT initialized. Check your environment variables (FIREBASE_PROJECT_ID, etc.)" 
        });
      }
      
      // Try a simple read to verify Firestore connectivity
      // We'll just check if the collection exists or do a dummy query
      await db.collection("settings").limit(1).get();
      res.json({ 
        status: "ok", 
        message: "Firebase Admin is initialized and Firestore is reachable.",
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    } catch (error: any) {
      res.status(500).json({ 
        status: "error", 
        message: "Firebase connection failed: " + error.message 
      });
    }
  });

  app.get("/api/test", (req, res) => {
    res.json({ message: "API is working" });
  });

  app.post("/api/test-post", (req, res) => {
    res.json({ message: "POST works", body: req.body });
  });

  // API Routes
  app.post("/api/auth/firebase-signup", checkFirebase, async (req, res) => {
    const { idToken, username, ff_id, first_name, last_name } = req.body;
    try {
      if (!auth || !db) throw new Error("Firebase not initialized");
      
      // Verify the ID token
      const decodedToken = await auth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const email = decodedToken.email;

      // Create user in Firestore
      await db.collection("users").doc(uid).set({
        id: uid,
        username,
        email,
        ff_id,
        first_name,
        last_name,
        balance: 0,
        is_admin: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(201).json({ message: "User record created", id: uid });
    } catch (error: any) {
      console.error("Firebase Signup error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/firebase-login", checkFirebase, async (req, res) => {
    const { idToken } = req.body;
    console.log("Firebase login attempt received");
    try {
      if (!auth || !db) throw new Error("Firebase not initialized");
      
      if (!idToken) {
        return res.status(400).json({ error: "ID Token is missing" });
      }

      // Verify the ID token
      console.log("Verifying ID token...");
      const decodedToken = await auth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      console.log("Token verified for UID:", uid);

      const userDoc = await db.collection("users").doc(uid).get();
      
      if (!userDoc.exists) {
        console.log("User record missing in Firestore, creating one for UID:", uid);
        const adminEmails = ['yourmeherun007@gmail.com', 'rafiyajannat404@gmail.com', 'yoursmeherun007@gmail.com'];
        const email = decodedToken.email || "";
        const isAdmin = adminEmails.includes(email.toLowerCase());
        
        const newUserData = {
          id: uid,
          username: email.split('@')[0] || "user_" + uid.substring(0, 5),
          email: email.toLowerCase(),
          ff_id: 'N/A',
          first_name: isAdmin ? 'Admin' : 'User',
          last_name: '',
          balance: 0,
          is_admin: isAdmin ? 1 : 0,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection("users").doc(uid).set(newUserData);
        const updatedDoc = await db.collection("users").doc(uid).get();
        const user = updatedDoc.data();
        
        return res.json({ 
          token: idToken,
          user: { 
            id: uid, 
            username: user?.username, 
            email: user?.email, 
            ff_id: user?.ff_id, 
            balance: user?.balance, 
            is_admin: user?.is_admin 
          } 
        });
      }

      const user = userDoc.data();
      
      console.log("Login successful, sending response");
      res.json({ 
        token: idToken, // Return the same ID token to be used on client
        user: { 
          id: uid, 
          username: user?.username, 
          email: user?.email, 
          ff_id: user?.ff_id, 
          balance: user?.balance, 
          is_admin: user?.is_admin 
        } 
      });
    } catch (error: any) {
      console.error("Firebase Login error:", error);
      res.status(401).json({ error: "Authentication failed: " + error.message });
    }
  });

  app.post("/api/auth/signup", checkFirebase, async (req, res) => {
    const { username, email, password, ff_id, first_name, last_name } = req.body;
    try {
      if (!auth || !db) throw new Error("Firebase not initialized");
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user in Firebase Auth
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: username,
      });

      // Create user in Firestore
      await db.collection("users").doc(userRecord.uid).set({
        id: userRecord.uid,
        username,
        email,
        password: hashedPassword,
        ff_id,
        first_name,
        last_name,
        balance: 0,
        is_admin: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(201).json({ message: "User created", id: userRecord.uid });
    } catch (error: any) {
      console.error("Signup error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", checkFirebase, async (req, res) => {
    const { email, password } = req.body;
    try {
      if (!db) throw new Error("Database not initialized");
      
      const usersRef = db.collection("users");
      const snapshot = await usersRef.where("email", "==", email).limit(1).get();
      
      if (snapshot.empty) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const userDoc = snapshot.docs[0];
      const user = userDoc.data();

      if (!(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { id: user.id, username: user.username, email: user.email, ff_id: user.ff_id, balance: user.balance, is_admin: user.is_admin } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/tournaments", checkFirebase, async (req, res) => {
    try {
      if (!db) throw new Error("Database not initialized");
      const snapshot = await db.collection("tournaments").orderBy("start_date", "asc").get();
      const tournaments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(tournaments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/user/profile", authenticateToken, checkFirebase, async (req: any, res) => {
    try {
      if (!db) throw new Error("Database not initialized");
      const userDoc = await db.collection("users").doc(req.user.id).get();
      if (!userDoc.exists) return res.status(404).json({ error: "User not found" });
      
      const userData = userDoc.data();
      if (userData) {
        const adminEmails = ['yourmeherun007@gmail.com', 'rafiyajannat404@gmail.com', 'yoursmeherun007@gmail.com'];
        if (adminEmails.includes(userData.email)) {
          userData.is_admin = 1;
        }
      }
      
      res.json(userData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/user/profile", authenticateToken, checkFirebase, async (req: any, res) => {
    const { username, ff_id, profile_picture, first_name, last_name } = req.body;
    const userId = req.user.id;
    
    try {
      if (!db) throw new Error("Database not initialized");
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();
      const currentUser = userDoc.data();

      if (!currentUser) return res.status(404).json({ error: "User not found" });
      
      let updateData: any = { ff_id, profile_picture, first_name, last_name };

      if (username && username !== currentUser.username) {
        const existing = await db.collection("users").where("username", "==", username).limit(1).get();
        if (!existing.empty) return res.status(400).json({ error: "Username already taken" });

        if (currentUser.last_username_change) {
          const lastChange = currentUser.last_username_change.toDate();
          const now = new Date();
          const diffDays = Math.ceil((now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < 30) {
            return res.status(400).json({ error: `Wait ${30 - diffDays} more days.` });
          }
        }
        updateData.username = username;
        updateData.last_username_change = admin.firestore.FieldValue.serverTimestamp();
      }

      await userRef.update(updateData);
      res.json({ message: "Profile updated successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/user/registrations", authenticateToken, checkFirebase, async (req: any, res) => {
    try {
      if (!db) throw new Error("Database not initialized");
      const snapshot = await db.collection("registrations").where("user_id", "==", req.user.id).get();
      const registrations = await Promise.all(snapshot.docs.map(async (doc) => {
        const reg = doc.data();
        const tDoc = await db!.collection("tournaments").doc(reg.tournament_id).get();
        const tData = tDoc.data();
        return {
          ...reg,
          id: doc.id,
          tournament_title: tData?.title,
          start_date: tData?.start_date
        };
      }));
      res.json(registrations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tournaments/:id/register", authenticateToken, checkFirebase, async (req: any, res) => {
    const { team_name } = req.body;
    const tournamentId = req.params.id;
    
    try {
      if (!db) throw new Error("Database not initialized");
      const regSnapshot = await db.collection("registrations")
        .where("user_id", "==", req.user.id)
        .where("tournament_id", "==", tournamentId)
        .limit(1).get();

      if (!regSnapshot.empty) return res.status(400).json({ error: "Already registered" });

      const tRef = db.collection("tournaments").doc(tournamentId);
      const tDoc = await tRef.get();
      const tournament = tDoc.data();

      if (!tournament) return res.status(404).json({ error: "Tournament not found" });

      if (tournament.slots_filled >= tournament.slots_total) {
        return res.status(400).json({ error: "Tournament is full" });
      }

      const userRef = db.collection("users").doc(req.user.id);
      const userDoc = await userRef.get();
      const user = userDoc.data();

      if (!user) return res.status(404).json({ error: "User not found" });

      if (tournament.entry_fee !== "Free") {
        const fee = typeof tournament.entry_fee === 'number' 
          ? tournament.entry_fee 
          : parseInt(String(tournament.entry_fee).replace(/[^0-9]/g, ''));
        if (user.balance < fee) return res.status(400).json({ error: "Insufficient balance" });
        await userRef.update({ balance: user.balance - fee });
      }

      await db.collection("registrations").add({
        user_id: req.user.id,
        tournament_id: tournamentId,
        team_name,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      await tRef.update({ slots_filled: (tournament.slots_filled || 0) + 1 });
      res.json({ message: "Registered successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/wallet/deposit", authenticateToken, checkFirebase, async (req: any, res) => {
    const { amount, method, sender_number, transaction_id } = req.body;
    try {
      if (!db) throw new Error("Database not initialized");
      await db.collection("transactions").add({
        user_id: req.user.id,
        type: 'deposit',
        amount,
        method,
        sender_number,
        transaction_id,
        status: 'pending',
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ message: "Deposit request submitted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/wallet/transactions", authenticateToken, checkFirebase, async (req: any, res) => {
    try {
      if (!db) throw new Error("Database not initialized");
      // Remove orderBy from query to avoid composite index requirement
      const snapshot = await db.collection("transactions")
        .where("user_id", "==", req.user.id)
        .get();
      
      const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort in memory instead
      transactions.sort((a: any, b: any) => {
        const dateA = a.created_at?.toDate?.() || new Date(a.created_at);
        const dateB = b.created_at?.toDate?.() || new Date(b.created_at);
        return dateB.getTime() - dateA.getTime();
      });

      res.json(transactions);
    } catch (error: any) {
      console.error("Fetch transactions error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/notices", checkFirebase, async (req, res) => {
    try {
      if (!db) throw new Error("Database not initialized");
      const snapshot = await db.collection("notices").orderBy("created_at", "desc").limit(10).get();
      const notices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(notices);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin API Routes
  app.get("/api/admin/stats", authenticateToken, isAdmin, checkFirebase, async (req, res) => {
    try {
      if (!db) throw new Error("Database not initialized");
      const users = await db.collection("users").get();
      const tournaments = await db.collection("tournaments").get();
      const pending = await db.collection("transactions").where("status", "==", "pending").get();
      
      res.json({
        users: users.size,
        tournaments: tournaments.size,
        pending: pending.size
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/users", authenticateToken, isAdmin, checkFirebase, async (req, res) => {
    try {
      if (!db) throw new Error("Database not initialized");
      const snapshot = await db.collection("users").get();
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/users/:id/balance", authenticateToken, isAdmin, checkFirebase, async (req, res) => {
    const { balance } = req.body;
    try {
      if (!db) throw new Error("Database not initialized");
      await db.collection("users").doc(req.params.id).update({ balance });
      res.json({ message: "Balance updated" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/transactions", authenticateToken, isAdmin, checkFirebase, async (req, res) => {
    try {
      if (!db) throw new Error("Database not initialized");
      const snapshot = await db.collection("transactions").where("status", "==", "pending").get();
      const transactions = await Promise.all(snapshot.docs.map(async (doc) => {
        const tx = doc.data();
        const userDoc = await db!.collection("users").doc(tx.user_id).get();
        const userData = userDoc.data();
        return {
          id: doc.id,
          ...tx,
          username: userData?.username,
          email: userData?.email
        };
      }));
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/transactions/:id/:action", authenticateToken, isAdmin, checkFirebase, async (req, res) => {
    const { id, action } = req.params;
    try {
      if (!db) throw new Error("Database not initialized");
      const txRef = db.collection("transactions").doc(id);
      const txDoc = await txRef.get();
      const tx = txDoc.data();

      if (!tx || tx.status !== 'pending') return res.status(400).json({ error: "Invalid transaction" });

      if (action === 'approve') {
        const userRef = db.collection("users").doc(tx.user_id);
        const userDoc = await userRef.get();
        const user = userDoc.data();
        if (user) {
          const newBalance = tx.type === 'deposit' ? user.balance + tx.amount : user.balance - tx.amount;
          await userRef.update({ balance: newBalance });
        }
      }

      await txRef.update({ status: action === 'approve' ? 'approved' : 'rejected' });
      res.json({ message: `Transaction ${action}d` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/notices", authenticateToken, isAdmin, checkFirebase, async (req, res) => {
    const { content } = req.body;
    try {
      if (!db) throw new Error("Database not initialized");
      await db.collection("notices").add({
        content,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ message: "Notice posted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/initialize", authenticateToken, isAdmin, checkFirebase, async (req, res) => {
    try {
      if (!db) throw new Error("Database not initialized");
      
      console.log("Initializing app data...");
      
      // Create a sample tournament
      const tournament = {
        title: "Grand Opening Tournament",
        description: "Welcome to our new platform! Join this tournament to win big.",
        type: "Classic",
        mode: "Solo",
        entry_fee: 50,
        prize_pool: 1000,
        start_date: new Date(Date.now() + 86400000).toISOString(),
        slots_total: 48,
        slots_filled: 0,
        image: "https://picsum.photos/seed/gaming/800/400",
        created_at: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await db.collection("tournaments").add(tournament);
      console.log("Sample tournament created");
      
      // Create default settings
      await db.collection("settings").doc("general").set({
        logo_url: "https://selected-red-tipf2l6h7a.edgeone.app/ChatGPT%20Image%20Feb%2027,%202026,%2002_52_07%20AM.png",
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log("Default settings created");
      
      res.json({ message: "App initialized successfully" });
    } catch (error: any) {
      console.error("Initialization error:", error);
      res.status(500).json({ error: "Initialization failed: " + error.message });
    }
  });

  app.post("/api/admin/cleanup", authenticateToken, isAdmin, checkFirebase, async (req, res) => {
    try {
      if (!db) throw new Error("Database not initialized");
      
      const collections = ['tournaments', 'registrations', 'transactions', 'notices'];
      const adminEmails = ['yourmeherun007@gmail.com', 'rafiyajannat404@gmail.com', 'yoursmeherun007@gmail.com'];
      
      for (const coll of collections) {
        const snapshot = await db.collection(coll).get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
      
      // Delete non-admin users
      const usersSnapshot = await db.collection("users").get();
      const userBatch = db.batch();
      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        if (!adminEmails.includes(userData.email)) {
          userBatch.delete(doc.ref);
        }
      });
      await userBatch.commit();
      
      res.json({ message: "Database cleaned successfully. All non-admin data removed." });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/tournaments", authenticateToken, isAdmin, checkFirebase, async (req, res) => {
    const tournamentData = req.body;
    try {
      if (!db) throw new Error("Database not initialized");
      await db.collection("tournaments").add({
        ...tournamentData,
        slots_filled: 0,
        status: 'open',
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ message: "Tournament created" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/settings", async (req, res) => {
    try {
      if (!db) throw new Error("Database not initialized");
      const doc = await db.collection("settings").doc("general").get();
      if (!doc.exists) {
        return res.json({ logo_url: "https://picsum.photos/seed/gaming-logo/200/200" });
      }
      res.json(doc.data());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/settings", authenticateToken, isAdmin, checkFirebase, async (req, res) => {
    const { logo_url, site_name, hero_title, hero_subtitle } = req.body;
    try {
      if (!db) throw new Error("Database not initialized");
      const settings = {
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      } as any;
      
      if (logo_url !== undefined) settings.logo_url = logo_url;
      if (site_name !== undefined) settings.site_name = site_name;
      if (hero_title !== undefined) settings.hero_title = hero_title;
      if (hero_subtitle !== undefined) settings.hero_subtitle = hero_subtitle;

      await db.collection("settings").doc("general").set(settings, { merge: true });
      res.json({ message: "Settings updated" });
    } catch (error: any) {
      console.error("Settings update error:", error);
      res.status(500).json({ error: "Failed to save settings: " + error.message });
    }
  });

  // Catch-all for API routes to prevent HTML fallback
  app.all("/api/*", (req, res) => {
    console.log(`API 404: ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
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

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  startServer();
}

export default app;
