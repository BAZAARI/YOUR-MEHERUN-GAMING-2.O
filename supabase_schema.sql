-- SQL Schema for Supabase (PostgreSQL)

-- Users Table
CREATE TABLE users (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  ff_id TEXT,
  first_name TEXT,
  last_name TEXT,
  balance INTEGER DEFAULT 0,
  profile_picture TEXT,
  is_admin INTEGER DEFAULT 0,
  last_username_change TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournaments Table
CREATE TABLE tournaments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title TEXT NOT NULL,
  description TEXT,
  prize_pool TEXT,
  entry_fee TEXT,
  start_date TIMESTAMPTZ,
  slots_total INTEGER,
  slots_filled INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open'
);

-- Registrations Table
CREATE TABLE registrations (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  tournament_id BIGINT REFERENCES tournaments(id) ON DELETE CASCADE,
  team_name TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions Table
CREATE TABLE transactions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'deposit' or 'withdraw'
  amount INTEGER NOT NULL,
  method TEXT,
  sender_number TEXT,
  transaction_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notices Table
CREATE TABLE notices (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) - Optional but recommended
-- For now, we'll keep it simple and assume the server uses the service role key for admin tasks
-- or we can disable RLS for simplicity if the user is just starting.
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ... add policies ...

-- Seed initial data (Optional)
-- INSERT INTO tournaments (title, description, prize_pool, entry_fee, start_date, slots_total)
-- VALUES 
-- ('FF Pro League Season 1', 'The ultimate battle for glory.', '৳10,000', 'Free', '2026-03-10 18:00:00', 48),
-- ('Weekend Clash', 'Fast-paced tournament for everyone.', '৳2,000', '৳50', '2026-03-07 20:00:00', 24),
-- ('Elite Squad Showdown', 'Only for the best squads.', '৳5,000', '৳100', '2026-03-15 15:00:00', 12);
