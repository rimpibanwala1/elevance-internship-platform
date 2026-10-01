-- Internship Platform - complete PostgreSQL schema/migration
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  mobile VARCHAR(20) UNIQUE,
  password_hash TEXT NOT NULL,
  language VARCHAR(30) DEFAULT 'English',
  must_change_password BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(30) DEFAULT 'English';
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
UPDATE users SET username='student'||id WHERE username IS NULL;

-- Migrate the older requester_id naming used by earlier versions.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='friendships' AND column_name='requester_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='friendships' AND column_name='sender_id') THEN
    ALTER TABLE friendships RENAME COLUMN requester_id TO sender_id;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sender_id, receiver_id),
  CHECK (sender_id <> receiver_id)
);

CREATE TABLE IF NOT EXISTS followers (
  id SERIAL PRIMARY KEY,
  follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  text_content TEXT,
  hashtag VARCHAR(100),
  media_url TEXT,
  media_type VARCHAR(30),
  media_hash VARCHAR(128),
  privacy VARCHAR(20) DEFAULT 'public',
  friend_count_at_post INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS text_content TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hashtag VARCHAR(100);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_hash VARCHAR(128);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS privacy VARCHAR(20) DEFAULT 'public';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS friend_count_at_post INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS post_likes (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS comment TEXT;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='post_comments' AND column_name='comment_text') THEN
    UPDATE post_comments SET comment=comment_text WHERE comment IS NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS saved_posts (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_shares (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
DELETE FROM post_shares a USING post_shares b WHERE a.id>b.id AND a.post_id=b.post_id AND a.user_id=b.user_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_shares_user_post ON post_shares(post_id,user_id);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(50),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'system';

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  plan_name VARCHAR(50) NOT NULL DEFAULT 'Free',
  amount NUMERIC(10,2) DEFAULT 0,
  application_limit INTEGER,
  applications_used INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  renewal_date TIMESTAMP
);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_name VARCHAR(50) DEFAULT 'Free';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS application_limit INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS applications_used INTEGER DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewal_date TIMESTAMP;

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  plan_name VARCHAR(80),
  transaction_id VARCHAR(150),
  provider_order_id VARCHAR(150),
  provider_payment_id VARCHAR(150),
  status VARCHAR(30) DEFAULT 'created',
  invoice_number VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(150);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(150);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS internship_applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  internship_title VARCHAR(200) NOT NULL,
  company_name VARCHAR(200),
  application_url TEXT,
  resume_id INTEGER,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resumes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  template VARCHAR(50) DEFAULT 'ATS Template 1',
  color VARCHAR(30) DEFAULT '#1d4ed8',
  font VARCHAR(50) DEFAULT 'Helvetica',
  pdf_url TEXT,
  photo_url TEXT,
  full_name VARCHAR(150),
  email VARCHAR(150),
  phone VARCHAR(50),
  career_objective TEXT,
  education TEXT,
  skills TEXT,
  work_experience TEXT,
  internships TEXT,
  projects TEXT,
  certifications TEXT,
  achievements TEXT,
  languages TEXT,
  social_links TEXT,
  references_text TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS color VARCHAR(30) DEFAULT '#1d4ed8';
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS font VARCHAR(50) DEFAULT 'Helvetica';
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS email VARCHAR(150);
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS career_objective TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS education TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS skills TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS work_experience TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS internships TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS projects TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS certifications TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS achievements TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS languages TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS social_links TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS references_text TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS resume_payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  resume_id INTEGER REFERENCES resumes(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) DEFAULT 50,
  transaction_id VARCHAR(150),
  status VARCHAR(30) DEFAULT 'success',
  invoice_number VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resume_downloads (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  resume_id INTEGER REFERENCES resumes(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  browser VARCHAR(100),
  operating_system VARCHAR(100),
  device_type VARCHAR(30),
  device_model VARCHAR(100),
  ip_address VARCHAR(100),
  location VARCHAR(150),
  login_status VARCHAR(30),
  login_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE login_history ADD COLUMN IF NOT EXISTS browser VARCHAR(100);
ALTER TABLE login_history ADD COLUMN IF NOT EXISTS operating_system VARCHAR(100);
ALTER TABLE login_history ADD COLUMN IF NOT EXISTS device_type VARCHAR(30);
ALTER TABLE login_history ADD COLUMN IF NOT EXISTS device_model VARCHAR(100);
ALTER TABLE login_history ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);
ALTER TABLE login_history ADD COLUMN IF NOT EXISTS location VARCHAR(150);
ALTER TABLE login_history ADD COLUMN IF NOT EXISTS login_status VARCHAR(30);
ALTER TABLE login_history ADD COLUMN IF NOT EXISTS login_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  fingerprint VARCHAR(128),
  browser VARCHAR(100),
  device_type VARCHAR(30),
  ip_address VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked BOOLEAN DEFAULT FALSE
);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(128);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS browser VARCHAR(100);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS device_type VARCHAR(30);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);

CREATE TABLE IF NOT EXISTS trusted_devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  fingerprint VARCHAR(128) NOT NULL,
  browser VARCHAR(100),
  device_type VARCHAR(30),
  ip_address VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS password_reset_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reset_method VARCHAR(20),
  verification_status VARCHAR(30),
  ip_address VARCHAR(100),
  browser VARCHAR(100),
  device VARCHAR(100),
  otp_verified BOOLEAN DEFAULT FALSE,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);
ALTER TABLE password_reset_history ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);
ALTER TABLE password_reset_history ADD COLUMN IF NOT EXISTS browser VARCHAR(100);
ALTER TABLE password_reset_history ADD COLUMN IF NOT EXISTS device VARCHAR(100);
ALTER TABLE password_reset_history ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE password_reset_history ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE password_reset_history ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS language_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  selected_language VARCHAR(30) NOT NULL,
  ip_address VARCHAR(100),
  browser VARCHAR(100),
  device VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE language_history ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);
ALTER TABLE language_history ADD COLUMN IF NOT EXISTS browser VARCHAR(100);
ALTER TABLE language_history ADD COLUMN IF NOT EXISTS device VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_hashtag ON posts(hashtag);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, login_date DESC);
CREATE INDEX IF NOT EXISTS idx_reset_history_user ON password_reset_history(user_id, requested_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_payment ON payments(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_payment_tx ON resume_payments(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_share_user ON post_shares(post_id,user_id);
