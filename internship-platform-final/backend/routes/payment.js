const router=require("express").Router();
const pool=require("../db");
const auth=require("../middleware/auth");

router.get("/",auth,async(req,res)=>{
  const r=await pool.query("SELECT * FROM payments WHERE user_id=$1 ORDER BY created_at DESC",[req.user.id]);
  res.json(r.rows);
});
router.get("/resume",auth,async(req,res)=>{
  const r=await pool.query("SELECT * FROM resume_payments WHERE user_id=$1 ORDER BY created_at DESC",[req.user.id]);
  res.json(r.rows);
});
module.exports=router;
