const router=require("express").Router();
const pool=require("../db");
const auth=require("../middleware/auth");

router.get("/",auth,async(req,res)=>{
  const r=await pool.query(
    `SELECT n.*,u.full_name AS sender_name FROM notifications n
     LEFT JOIN users u ON u.id=n.sender_id WHERE n.user_id=$1 ORDER BY n.created_at DESC LIMIT 100`,
    [req.user.id]);res.json(r.rows);
});
router.put("/:id/read",auth,async(req,res)=>{
  const r=await pool.query("UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2 RETURNING *",[Number(req.params.id),req.user.id]);
  if(!r.rows.length)return res.status(404).json({message:"Notification not found"});
  res.json({message:"Notification marked as read",notification:r.rows[0]});
});
router.put("/read-all",auth,async(req,res)=>{await pool.query("UPDATE notifications SET is_read=TRUE WHERE user_id=$1",[req.user.id]);res.json({message:"All notifications marked as read"});});
module.exports=router;
