const router=require("express").Router();
const pool=require("../db");
const auth=require("../middleware/auth");
const {current,PLANS}=require("./subscription");

router.get("/",auth,async(req,res)=>{
  const r=await pool.query(
    `SELECT a.*,r.title AS resume_title FROM internship_applications a
     LEFT JOIN resumes r ON r.id=a.resume_id WHERE a.user_id=$1 ORDER BY a.applied_at DESC`,
    [req.user.id]);
  const s=await current(req.user.id);
  res.json({applications:r.rows,subscription:s});
});

router.post("/",auth,async(req,res)=>{
  try{
    const {internshipTitle,companyName,applicationUrl,resumeId}=req.body;
    if(!internshipTitle?.trim())return res.status(400).json({message:"Internship title is required"});
    const s=await current(req.user.id);
    const limit=s.application_limit;
    if(limit!==null && Number(s.applications_used||0)>=Number(limit))
      return res.status(403).json({message:`Your ${s.plan_name} monthly application limit is exhausted. Upgrade or wait for renewal.`});
    const r=await pool.query(
      `INSERT INTO internship_applications(user_id,internship_title,company_name,application_url,resume_id)
       VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.id,internshipTitle.trim(),companyName?.trim()||null,applicationUrl?.trim()||null,resumeId||null]);
    await pool.query("UPDATE subscriptions SET applications_used=applications_used+1 WHERE user_id=$1 AND status='active'",[req.user.id]);
    res.status(201).json({message:"Internship application recorded successfully 🎓",application:r.rows[0]});
  }catch(e){console.error(e);res.status(500).json({message:"Application failed"});}
});
module.exports=router;
