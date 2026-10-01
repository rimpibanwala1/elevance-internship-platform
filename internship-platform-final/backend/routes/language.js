const router=require("express").Router();
const pool=require("../db");
const auth=require("../middleware/auth");
const {generateOtp,verifyOtp}=require("../utils/otp");
const {sendOtpEmail}=require("../utils/email");
const {requestMeta}=require("../utils/security");
const crypto=require("crypto");
const challenges=new Map();
const languages=["English","Spanish","Hindi","Portuguese","Chinese","French"];

router.get("/",auth,async(req,res)=>{
  const r=await pool.query("SELECT language FROM users WHERE id=$1",[req.user.id]);
  res.json({language:r.rows[0]?.language||"English",languages});
});
router.post("/request-french",auth,async(req,res)=>{
  try{
    const u=await pool.query("SELECT email FROM users WHERE id=$1",[req.user.id]);
    const id=crypto.randomUUID(),{otp}=generateOtp(id,"language");
    challenges.set(id,{userId:req.user.id,expiresAt:Date.now()+5*60*1000});
    await sendOtpEmail(u.rows[0].email,otp,"French language change");
    res.json({message:"OTP sent to your registered email.",challengeId:id,...(process.env.DEV_SHOW_OTP==="true"?{demoOtp:otp}: {})});
  }catch(e){if(e.code==="OTP_COOLDOWN")return res.status(429).json({message:e.message});res.status(500).json({message:"Could not send language OTP"});}
});
router.put("/",auth,async(req,res)=>{
  try{
    const {language,challengeId,otp}=req.body;
    if(!languages.includes(language))return res.status(400).json({message:"Unsupported language"});
    if(language==="French"){
      const c=challenges.get(challengeId);
      if(!c||c.userId!==req.user.id)return res.status(403).json({message:"French language requires OTP verification"});
      const v=verifyOtp(challengeId,"language",otp);
      if(!v.ok)return res.status(400).json({message:v.message});
      challenges.delete(challengeId);
    }
    await pool.query("UPDATE users SET language=$1 WHERE id=$2",[language,req.user.id]);
    const m=requestMeta(req);
    await pool.query(
      `INSERT INTO language_history(user_id,selected_language,ip_address,browser,device)
       VALUES($1,$2,$3,$4,$5)`,
      [req.user.id,language,m.ipAddress,m.browser,`${m.deviceType}${m.deviceModel?` (${m.deviceModel})`:""}`]);
    res.json({message:"Language updated successfully",language});
  }catch(e){console.error(e);res.status(500).json({message:"Language update failed"});}
});
router.get("/history",auth,async(req,res)=>{const r=await pool.query("SELECT * FROM language_history WHERE user_id=$1 ORDER BY created_at DESC",[req.user.id]);res.json(r.rows);});
module.exports=router;
