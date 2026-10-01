const router=require("express").Router();
const bcrypt=require("bcryptjs");
const pool=require("../db");
const crypto=require("crypto");
const {generateOtp,verifyOtp}=require("../utils/otp");
const {sendOtpEmail,sendEmail}=require("../utils/email");
const {requestMeta,randomLetters}=require("../utils/security");

const challenges=new Map();

async function sendToContact(method,contact,otp){
  if(method==="email") return sendOtpEmail(contact,otp,"Password reset");
  if(process.env.SMS_WEBHOOK_URL){
    try{
      await fetch(process.env.SMS_WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:contact,message:`Internship Platform password reset OTP: ${otp}`})});
      return;
    }catch(e){console.error("SMS WEBHOOK",e);}
  }
  console.log(`[SMS DEMO] To ${contact}: OTP ${otp}`);
}

router.post("/request",async(req,res)=>{
  try{
    const {identifier,method="email"}=req.body;
    if(!identifier || !["email","mobile"].includes(method))return res.status(400).json({message:"Email/mobile and reset method are required"});
    const field=method==="email"?"email":"mobile";
    const value=identifier.trim().toLowerCase();
    const user=await pool.query(`SELECT id,email,mobile FROM users WHERE ${field}=$1`,[value]);
    if(!user.rows.length)return res.status(404).json({message:"No account found for those details"});

    const recent=await pool.query(
      `SELECT id FROM password_reset_history WHERE user_id=$1 AND requested_at > NOW()-INTERVAL '24 hours' LIMIT 1`,
      [user.rows[0].id]);
    if(recent.rows.length)return res.status(429).json({message:"You can use this option only once per day."});

    const meta=requestMeta(req);
    const challengeId=crypto.randomUUID();
    const {otp}=generateOtp(challengeId,"password");
    challenges.set(challengeId,{userId:user.rows[0].id,method,contact:value,expiresAt:Date.now()+5*60*1000,meta});
    await pool.query(
      `INSERT INTO password_reset_history(user_id,reset_method,verification_status,ip_address,browser,device,otp_verified)
       VALUES($1,$2,'requested',$3,$4,$5,FALSE)`,
      [user.rows[0].id,method,meta.ipAddress,meta.browser,`${meta.deviceType}${meta.deviceModel?` (${meta.deviceModel})`:""}`]);
    await sendToContact(method,value,otp);
    res.json({message:`OTP sent to your ${method}.`,challengeId,...(process.env.DEV_SHOW_OTP==="true"?{demoOtp:otp}: {})});
  }catch(e){
    if(e.code==="OTP_COOLDOWN")return res.status(429).json({message:e.message});
    console.error("PASSWORD REQUEST",e);res.status(500).json({message:"Could not start password reset"});
  }
});

router.post("/verify",async(req,res)=>{
  try{
    const {challengeId,otp}=req.body;
    const c=challenges.get(challengeId);
    if(!c || Date.now()>c.expiresAt)return res.status(400).json({message:"OTP expired. Please start again."});
    const result=verifyOtp(challengeId,"password",otp);
    if(!result.ok)return res.status(400).json({message:result.message});
    c.verified=true;
    challenges.set(challengeId,c);
    await pool.query(
      `UPDATE password_reset_history SET verification_status='verified',otp_verified=TRUE
       WHERE user_id=$1 AND requested_at=(SELECT MAX(requested_at) FROM password_reset_history WHERE user_id=$1)`,
      [c.userId]);
    res.json({message:"OTP verified successfully"});
  }catch(e){console.error(e);res.status(500).json({message:"OTP verification failed"});}
});

router.post("/complete",async(req,res)=>{
  try{
    const {challengeId}=req.body;
    const c=challenges.get(challengeId);
    if(!c || !c.verified)return res.status(400).json({message:"Verify OTP first"});
    const password=randomLetters(12);
    await pool.query(
      "UPDATE users SET password_hash=$1,must_change_password=TRUE WHERE id=$2",
      [await bcrypt.hash(password,12),c.userId]);
    await pool.query(
      `UPDATE password_reset_history SET verification_status='completed',completed_at=NOW()
       WHERE user_id=$1 AND requested_at=(SELECT MAX(requested_at) FROM password_reset_history WHERE user_id=$1)`,
      [c.userId]);

    const message=`<div style="font-family:Arial"><h2>Internship Platform</h2><p>Your password has been reset.</p><p>Temporary password:</p><h2>${password}</h2><p>This password contains only English letters. You must change it after your next login.</p></div>`;
    if(c.method==="email") await sendEmail(c.contact,"Your temporary password",message);
    else if(process.env.SMS_WEBHOOK_URL){
      await fetch(process.env.SMS_WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:c.contact,message:`Your Internship Platform temporary password is: ${password}. Change it after login.`})});
    } else console.log(`[SMS DEMO] Temporary password for ${c.contact}: ${password}`);
    challenges.delete(challengeId);
    res.json({message:"Password reset complete. The temporary password was sent to your verified contact."});
  }catch(e){console.error("PASSWORD COMPLETE",e);res.status(500).json({message:"Password reset failed"});}
});

module.exports=router;
