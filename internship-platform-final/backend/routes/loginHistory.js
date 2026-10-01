const router=require("express").Router();
const pool=require("../db");
const auth=require("../middleware/auth");
router.get("/",auth,async(req,res)=>{
  const r=await pool.query(
    `SELECT id,browser,operating_system,device_type,device_model,ip_address,location,login_status,login_date
     FROM login_history WHERE user_id=$1 ORDER BY login_date DESC LIMIT 100`,[req.user.id]);
  res.json(r.rows);
});
module.exports=router;
