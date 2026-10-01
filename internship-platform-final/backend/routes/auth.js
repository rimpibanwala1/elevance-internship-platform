const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const auth = require("../middleware/auth");
const { generateOtp, verifyOtp } = require("../utils/otp");
const { sendOtpEmail, sendEmail } = require("../utils/email");
const { requestMeta, fingerprint } = require("../utils/security");

const loginChallenges = new Map();

function issueToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

async function recordLogin(userId, req, status) {
  const meta = requestMeta(req);
  await pool.query(
    `INSERT INTO login_history
     (user_id,browser,operating_system,device_type,device_model,ip_address,location,login_status,login_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
    [userId,meta.browser,meta.operatingSystem,meta.deviceType,meta.deviceModel,meta.ipAddress,meta.location,status]
  );
}

async function createSession(user, req, token) {
  const meta = requestMeta(req);
  await pool.query(
    `INSERT INTO user_sessions(user_id,token,fingerprint,browser,device_type,ip_address)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [user.id,token,fingerprint(meta),meta.browser,meta.deviceType,meta.ipAddress]
  );
}

router.post("/register", async (req,res)=>{
  try {
    const { fullName,email,mobile,password } = req.body;
    if (!fullName?.trim() || !email?.trim() || !password || password.length < 8)
      return res.status(400).json({message:"Name, email and a password of at least 8 characters are required."});
    const hash=await bcrypt.hash(password,12);
    const result=await pool.query(
      `INSERT INTO users(full_name,email,mobile,password_hash) VALUES($1,$2,$3,$4)
       RETURNING id,full_name,email,mobile,language`,
      [fullName.trim(),email.trim().toLowerCase(),mobile?.trim()||null,hash]
    );
    res.status(201).json({message:"Account created successfully",user:result.rows[0]});
  } catch(e) {
    if(e.code==="23505") return res.status(409).json({message:"Email or mobile already exists"});
    console.error("REGISTER",e); res.status(500).json({message:"Registration failed"});
  }
});

router.post("/login", async(req,res)=>{
  try {
    const {email,password}=req.body;
    const result=await pool.query("SELECT * FROM users WHERE email=$1",[email?.trim().toLowerCase()]);
    if(!result.rows.length) return res.status(401).json({message:"Invalid email or password"});
    const user=result.rows[0];
    const loginMeta=requestMeta(req);
    if(loginMeta.deviceType==="mobile"){
      const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
      const minutes=Number(parts.find(x=>x.type==="hour").value)*60+Number(parts.find(x=>x.type==="minute").value);
      if(minutes<600 || minutes>780){
        await recordLogin(user.id,req,"Rejected: mobile login outside 10:00 AM–1:00 PM IST");
        return res.status(403).json({message:"Mobile login is allowed only between 10:00 AM and 1:00 PM IST."});
      }
    }
    if(!await bcrypt.compare(password||"",user.password_hash)) {
      await recordLogin(user.id,req,"Failed");
      return res.status(401).json({message:"Invalid email or password"});
    }

    const meta=loginMeta, fp=fingerprint(meta);
    const trusted=await pool.query(
      "SELECT id FROM trusted_devices WHERE user_id=$1 AND fingerprint=$2",[user.id,fp]
    );
    const needsOtp=meta.browser==="Google Chrome" || trusted.rows.length===0;

    if(needsOtp){
      const challengeId=`${user.id}:${fp}:${Date.now()}`;
      const {otp}=generateOtp(challengeId,"login");
      loginChallenges.set(challengeId,{userId:user.id,email:user.email,fingerprint:fp,expiresAt:Date.now()+5*60*1000,meta});
      await sendOtpEmail(user.email,otp,"Login");
      await recordLogin(user.id,req,"OTP required");
      return res.json({requiresOtp:true,challengeId,message:"OTP verification required before access.",...(process.env.DEV_SHOW_OTP==="true"?{demoOtp:otp}: {})});
    }

    const token=issueToken(user);
    await createSession(user,req,token);
    await recordLogin(user.id,req,"Success");
    res.json({message:"Login successful",token,mustChangePassword:!!user.must_change_password,user:{id:user.id,fullName:user.full_name,email:user.email,mobile:user.mobile,language:user.language}});
  } catch(e){console.error("LOGIN",e);res.status(500).json({message:"Login failed"});}
});

router.post("/verify-login-otp", async(req,res)=>{
  try{
    const {challengeId,otp}=req.body;
    const challenge=loginChallenges.get(challengeId);
    if(!challenge || Date.now()>challenge.expiresAt) return res.status(400).json({message:"Login OTP expired. Please login again."});
    const check=verifyOtp(challengeId,"login",otp);
    if(!check.ok) return res.status(400).json({message:check.message});
    const result=await pool.query("SELECT * FROM users WHERE id=$1",[challenge.userId]);
    if(!result.rows.length) return res.status(404).json({message:"User not found"});
    const user=result.rows[0];
    await pool.query(
      `INSERT INTO trusted_devices(user_id,fingerprint,browser,device_type,ip_address)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(user_id,fingerprint) DO UPDATE SET last_seen=NOW(),ip_address=EXCLUDED.ip_address`,
      [user.id,challenge.fingerprint,challenge.meta.browser,challenge.meta.deviceType,challenge.meta.ipAddress]
    );
    const token=issueToken(user);
    await createSession(user,req,token);
    await recordLogin(user.id,req,"Success");
    loginChallenges.delete(challengeId);
    res.json({message:"Login successful",token,mustChangePassword:!!user.must_change_password,user:{id:user.id,fullName:user.full_name,email:user.email,mobile:user.mobile,language:user.language}});
  }catch(e){console.error("VERIFY LOGIN OTP",e);res.status(500).json({message:"Login verification failed"});}
});

router.get("/profile",auth,async(req,res)=>{
  try{
    const result=await pool.query(
      `SELECT u.id,u.username,u.full_name,u.email,u.mobile,u.language,u.profile_photo_url,u.created_at,
        (SELECT COUNT(*) FROM friendships f WHERE f.status='accepted' AND (f.sender_id=u.id OR f.receiver_id=u.id))::int AS friends,
        COALESCE((SELECT s.plan_name FROM subscriptions s WHERE s.user_id=u.id AND s.status='active' ORDER BY s.created_at DESC LIMIT 1),'Free') AS plan
       FROM users u WHERE u.id=$1`,[req.user.id]);
    if(!result.rows.length)return res.status(404).json({message:"User not found"});
    res.json(result.rows[0]);
  }catch(e){console.error(e);res.status(500).json({message:"Could not load profile"});}
});

router.put("/profile",auth,async(req,res)=>{
  try{
    const {fullName,mobile}=req.body;
    if(!fullName?.trim())return res.status(400).json({message:"Name is required"});
    const result=await pool.query(
      `UPDATE users SET full_name=$1,mobile=$2 WHERE id=$3
       RETURNING id,full_name,email,mobile,language`,
      [fullName.trim(),mobile?.trim()||null,req.user.id]);
    res.json({message:"Profile updated successfully",user:result.rows[0]});
  }catch(e){if(e.code==="23505")return res.status(409).json({message:"Mobile already exists"});res.status(500).json({message:"Profile update failed"});}
});

router.post("/change-password",auth,async(req,res)=>{
  try{
    const {currentPassword,newPassword}=req.body;
    if(!newPassword || newPassword.length<8)return res.status(400).json({message:"New password must be at least 8 characters"});
    const result=await pool.query("SELECT password_hash FROM users WHERE id=$1",[req.user.id]);
    if(!result.rows.length || !await bcrypt.compare(currentPassword||"",result.rows[0].password_hash))
      return res.status(400).json({message:"Current password is incorrect"});
    await pool.query("UPDATE users SET password_hash=$1,must_change_password=FALSE WHERE id=$2",[await bcrypt.hash(newPassword,12),req.user.id]);
    res.json({message:"Password changed successfully"});
  }catch(e){console.error(e);res.status(500).json({message:"Could not change password"});}
});

router.get("/login-history",auth,async(req,res)=>{
  const r=await pool.query(
    `SELECT id,browser,operating_system,device_type,device_model,ip_address,location,login_status,login_date
     FROM login_history WHERE user_id=$1 ORDER BY login_date DESC LIMIT 100`,[req.user.id]);
  res.json(r.rows);
});

router.delete("/sessions/other",auth,async(req,res)=>{
  await pool.query("UPDATE user_sessions SET revoked=TRUE WHERE user_id=$1 AND token<>$2",[req.user.id,req.token]);
  res.json({message:"Other devices signed out successfully 🔐"});
});

router.get("/sessions",auth,async(req,res)=>{
  const r=await pool.query(
    `SELECT id,browser,device_type,ip_address,created_at,revoked,
      CASE WHEN token=$2 THEN TRUE ELSE FALSE END AS current
     FROM user_sessions WHERE user_id=$1 ORDER BY created_at DESC`,
    [req.user.id,req.token]);
  res.json(r.rows);
});

module.exports=router;
