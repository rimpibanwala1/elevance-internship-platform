const router=require("express").Router();
const pool=require("../db");
const auth=require("../middleware/auth");
const multer=require("multer");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const PDFDocument=require("pdfkit");
const Razorpay=require("razorpay");
const {generateOtp,verifyOtp}=require("../utils/otp");
const {sendOtpEmail,sendEmail}=require("../utils/email");
const {current}=require("./subscription");

const dir=path.join(__dirname,"..","uploads","resumes");
fs.mkdirSync(dir,{recursive:true});
const upload=multer({dest:dir,limits:{fileSize:5*1024*1024}});

const resumeChallenges=new Map();

function rp(){return process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET?new Razorpay({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET}):null;}
function inWindow(){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const n=Number(parts.find(x=>x.type==="hour").value)*60+Number(parts.find(x=>x.type==="minute").value);
  return n>=300&&n<=705;
}
function text(v){return String(v||"").trim();}
function generatePdf(data,filePath){
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({margin:45});
    const stream=fs.createWriteStream(filePath);
    doc.pipe(stream);
    const color=data.color||"#1d4ed8";
    if(data.photo_url){
      const photoPath=path.join(__dirname,"..",data.photo_url.replace("/uploads/","uploads/"));
      if(fs.existsSync(photoPath)) doc.image(photoPath,{fit:[70,70],align:"center"});
    }
    doc.fillColor(color).font(data.font||"Helvetica").fontSize(24).text(text(data.fullName)||"Student", {align:"center"});
    doc.fontSize(10).fillColor("#555").text([text(data.email),text(data.phone)].filter(Boolean).join(" • "),{align:"center"});
    doc.moveDown();
    const sections=[
      ["Career Objective",data.careerObjective],["Education",data.education],["Skills",data.skills],
      ["Work Experience",data.workExperience],["Internships",data.internships],["Projects",data.projects],
      ["Certifications",data.certifications],["Achievements",data.achievements],["Languages",data.languages],
      ["Social Links",data.socialLinks],["References",data.references]
    ];
    for(const [heading,value] of sections){
      if(text(value)){
        doc.moveDown(.45).fillColor(color).fontSize(13).text(heading);
        doc.moveDown(.1).fillColor("#222").fontSize(10).text(text(value),{lineGap:2});
      }
    }
    doc.end();
    stream.on("finish",resolve);stream.on("error",reject);
  });
}

router.get("/",auth,async(req,res)=>{
  const r=await pool.query("SELECT * FROM resumes WHERE user_id=$1 ORDER BY created_at DESC",[req.user.id]);
  res.json(r.rows);
});

router.get("/history",auth,async(req,res)=>{
  const r=await pool.query(
    `SELECT rp.*,r.title,r.template FROM resume_payments rp LEFT JOIN resumes r ON r.id=rp.resume_id
     WHERE rp.user_id=$1 ORDER BY rp.created_at DESC`,[req.user.id]);
  const d=await pool.query("SELECT * FROM resume_downloads WHERE user_id=$1 ORDER BY downloaded_at DESC",[req.user.id]);
  res.json({payments:r.rows,downloads:d.rows});
});

router.post("/otp",auth,async(req,res)=>{
  try{
    const s=await current(req.user.id);
    const plan=String(s.plan_name||"Free").trim();
    const paid=await pool.query(
      `SELECT plan_name,renewal_date FROM subscriptions
       WHERE user_id=$1 AND status='active'
         AND LOWER(TRIM(plan_name)) IN ('bronze','silver','gold')
         AND (renewal_date IS NULL OR renewal_date>=NOW())
       ORDER BY start_date DESC LIMIT 1`,[req.user.id]);
    if(!paid.rows.length)return res.status(403).json({message:`Resume Builder requires a paid subscription. Your current plan is ${plan}. Please purchase Bronze, Silver or Gold first.`});
    const u=await pool.query("SELECT email FROM users WHERE id=$1",[req.user.id]);
    const challengeId=crypto.randomUUID(),{otp}=generateOtp(challengeId,"resume");
    resumeChallenges.set(challengeId,{userId:req.user.id,verified:false,expiresAt:Date.now()+5*60*1000});
    await sendOtpEmail(u.rows[0].email,otp,"Resume Builder");
    res.json({message:"Resume verification OTP sent to your registered email.",challengeId,...(process.env.DEV_SHOW_OTP==="true"?{demoOtp:otp}: {})});
  }catch(e){if(e.code==="OTP_COOLDOWN")return res.status(429).json({message:e.message});console.error(e);res.status(500).json({message:"Could not send resume OTP"});}
});

router.post("/verify-otp",auth,async(req,res)=>{
  const c=resumeChallenges.get(req.body.challengeId);
  if(!c||c.userId!==req.user.id||Date.now()>c.expiresAt)return res.status(400).json({message:"OTP expired. Please request a new OTP."});
  const r=verifyOtp(req.body.challengeId,"resume",req.body.otp);
  if(!r.ok)return res.status(400).json({message:r.message});
  c.verified=true;resumeChallenges.set(req.body.challengeId,c);
  res.json({message:"Resume OTP verified. Payment is now enabled."});
});

router.post("/order",auth,async(req,res)=>{
  try{
    const c=resumeChallenges.get(req.body.challengeId);
    if(!c||c.userId!==req.user.id||!c.verified)return res.status(403).json({message:"Verify email OTP before payment."});
    if(!inWindow())return res.status(403).json({message:"Payments are available only between 5:00 AM and 11:45 AM IST."});
    const rpay=rp();
    if(!rpay&&process.env.PAYMENT_MODE!=="mock")return res.status(503).json({message:"Razorpay is not configured. Add Test Mode keys in .env."});
    if(!rpay)return res.json({mock:true,orderId:`mock_resume_${Date.now()}`,amount:5000,keyId:null});
    const order=await rpay.orders.create({amount:5000,currency:"INR",receipt:`resume_${req.user.id}_${Date.now()}`,notes:{userId:String(req.user.id)}});
    res.json({mock:false,orderId:order.id,amount:order.amount,keyId:process.env.RAZORPAY_KEY_ID});
  }catch(e){console.error(e);res.status(500).json({message:"Could not create resume payment order"});}
});

router.post("/generate",auth,upload.single("photo"),async(req,res)=>{
  try{
    const {challengeId,orderId,paymentId,signature}=req.body;
    const c=resumeChallenges.get(challengeId);
    if(!c||c.userId!==req.user.id||!c.verified)return res.status(403).json({message:"Email OTP verification is required."});
    if(!inWindow())return res.status(403).json({message:"Payments are available only between 5:00 AM and 11:45 AM IST."});
    if(rp()){
      if(!orderId||!paymentId||!signature)return res.status(400).json({message:"Payment verification details are required"});
      const expected=crypto.createHmac("sha256",process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
      if(expected!==signature)return res.status(400).json({message:"Payment verification failed"});
    }else if(process.env.PAYMENT_MODE!=="mock")return res.status(503).json({message:"Razorpay is not configured"});
    const required=["title","fullName","email"];
    for(const k of required)if(!text(req.body[k]))return res.status(400).json({message:`${k} is required`});
    if(paymentId){
      const duplicate=await pool.query("SELECT invoice_number,transaction_id FROM resume_payments WHERE user_id=$1 AND transaction_id=$2 AND status='success' LIMIT 1",[req.user.id,paymentId]);
      if(duplicate.rows.length)return res.status(409).json({message:"This resume payment has already been processed.",invoice:duplicate.rows[0].invoice_number});
    }

    await pool.query("UPDATE resumes SET is_default=FALSE WHERE user_id=$1",[req.user.id]);
    const photoUrl=req.file?`/uploads/resumes/${path.basename(req.file.path)}`:null;
    const result=await pool.query(
      `INSERT INTO resumes(user_id,title,template,color,font,photo_url,full_name,email,phone,career_objective,education,skills,work_experience,internships,projects,certifications,achievements,languages,social_links,references_text,is_default)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,TRUE) RETURNING *`,
      [req.user.id,text(req.body.title),text(req.body.template)||"ATS Template 1",text(req.body.color)||"#1d4ed8",text(req.body.font)||"Helvetica",photoUrl,
       text(req.body.fullName),text(req.body.email),text(req.body.phone),text(req.body.careerObjective),text(req.body.education),text(req.body.skills),text(req.body.workExperience),text(req.body.internships),text(req.body.projects),text(req.body.certifications),text(req.body.achievements),text(req.body.languages),text(req.body.socialLinks),text(req.body.references)]);
    const resume=result.rows[0];
    const filename=`resume-${resume.id}.pdf`,filePath=path.join(dir,filename);
    await generatePdf(resume,filePath);
    const pdfUrl=`/uploads/resumes/${filename}`;
    await pool.query("UPDATE resumes SET pdf_url=$1 WHERE id=$2",[pdfUrl,resume.id]);
    const invoice=`INV-RES-${Date.now()}`;
    const transactionId=paymentId||`MOCK-${Date.now()}`;
    await pool.query(
      `INSERT INTO resume_payments(user_id,resume_id,amount,transaction_id,status,invoice_number) VALUES($1,$2,50,$3,'success',$4)`,
      [req.user.id,resume.id,transactionId,invoice]);
    const u=await pool.query("SELECT email,full_name FROM users WHERE id=$1",[req.user.id]);
    await sendEmail(u.rows[0].email,`Resume invoice ${invoice}`,
      `<div style="font-family:Arial"><h2>Resume generation receipt</h2><p>Student: ${u.rows[0].full_name}</p><p>Invoice: ${invoice}</p><p>Transaction ID: ${transactionId}</p><p>Amount: ₹50</p><p>Resume: ${resume.title}</p></div>`);
    resumeChallenges.delete(challengeId);
    res.status(201).json({message:"Resume generated successfully 📄🎉",resume:{...resume,pdf_url:pdfUrl},invoice,transactionId});
  }catch(e){console.error("RESUME GENERATE",e);res.status(500).json({message:"Resume generation failed"});}
});

router.post("/:id/default",auth,async(req,res)=>{
  const id=Number(req.params.id);
  const r=await pool.query("SELECT id FROM resumes WHERE id=$1 AND user_id=$2",[id,req.user.id]);
  if(!r.rows.length)return res.status(404).json({message:"Resume not found"});
  await pool.query("UPDATE resumes SET is_default=FALSE WHERE user_id=$1",[req.user.id]);
  await pool.query("UPDATE resumes SET is_default=TRUE WHERE id=$1",[id]);
  res.json({message:"Default resume updated"});
});

router.post("/:id/download",auth,async(req,res)=>{
  const id=Number(req.params.id);
  const r=await pool.query("SELECT pdf_url FROM resumes WHERE id=$1 AND user_id=$2",[id,req.user.id]);
  if(!r.rows.length||!r.rows[0].pdf_url)return res.status(404).json({message:"Generated PDF not found"});
  await pool.query("INSERT INTO resume_downloads(user_id,resume_id) VALUES($1,$2)",[req.user.id,id]);
  res.json({url:r.rows[0].pdf_url});
});

module.exports=router;
