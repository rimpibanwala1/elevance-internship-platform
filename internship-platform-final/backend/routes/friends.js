const router=require("express").Router();
const pool=require("../db");
const auth=require("../middleware/auth");

router.get("/users",auth,async(req,res)=>{
  const r=await pool.query(
    `SELECT u.id,u.username,u.full_name,u.email,u.profile_photo_url,
      EXISTS(SELECT 1 FROM followers f WHERE f.follower_id=$1 AND f.following_id=u.id) AS following,
      EXISTS(SELECT 1 FROM friendships fr WHERE fr.status='accepted' AND ((fr.sender_id=$1 AND fr.receiver_id=u.id) OR (fr.receiver_id=$1 AND fr.sender_id=u.id))) AS friend,
      EXISTS(SELECT 1 FROM friendships fr WHERE fr.status='pending' AND fr.sender_id=$1 AND fr.receiver_id=u.id) AS request_sent
     FROM users u WHERE u.id<>$1 ORDER BY u.full_name`,
    [req.user.id]);
  res.json(r.rows);
});

router.post("/:userId/request",auth,async(req,res)=>{
  try{
    const receiver=Number(req.params.userId);
    if(!Number.isInteger(receiver)||receiver===req.user.id)return res.status(400).json({message:"Invalid friend request"});
    const existing=await pool.query(
      `SELECT * FROM friendships WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1) LIMIT 1`,
      [req.user.id,receiver]);
    if(existing.rows[0]?.status==="accepted")return res.status(409).json({message:"You are already friends"});
    if(existing.rows[0]?.status==="pending")return res.status(409).json({message:"Friend request already pending"});
    const r=await pool.query(
      `INSERT INTO friendships(sender_id,receiver_id,status) VALUES($1,$2,'pending') RETURNING *`,
      [req.user.id,receiver]);
    await pool.query(
      `INSERT INTO notifications(user_id,sender_id,type,message) VALUES($1,$2,'friend_request','You received a new friend request 👥')`,
      [receiver,req.user.id]);
    res.status(201).json({message:"Friend request sent 👥",friendship:r.rows[0]});
  }catch(e){console.error(e);res.status(500).json({message:"Failed to send friend request"});}
});

router.get("/requests",auth,async(req,res)=>{
  const r=await pool.query(
    `SELECT f.id,f.status,f.created_at,u.id AS user_id,u.full_name,u.email
     FROM friendships f JOIN users u ON u.id=f.sender_id
     WHERE f.receiver_id=$1 AND f.status='pending' ORDER BY f.created_at DESC`,
    [req.user.id]);
  res.json(r.rows);
});

router.put("/:friendshipId/accept",auth,async(req,res)=>{
  try{
    const id=Number(req.params.friendshipId);
    const r=await pool.query(
      `UPDATE friendships SET status='accepted' WHERE id=$1 AND receiver_id=$2 AND status='pending' RETURNING *`,
      [id,req.user.id]);
    if(!r.rows.length)return res.status(404).json({message:"Friend request not found"});
    const f=r.rows[0];
    await pool.query(
      `INSERT INTO notifications(user_id,sender_id,type,message) VALUES($1,$2,'friend_request_accepted','Your friend request was accepted 👥')`,
      [f.sender_id,req.user.id]);
    res.json({message:"Friend request accepted 👥",friendship:f});
  }catch(e){console.error(e);res.status(500).json({message:"Failed to accept friend request"});}
});

router.get("/list",auth,async(req,res)=>{
  const r=await pool.query(
    `SELECT f.id,u.id AS user_id,u.full_name,u.email
     FROM friendships f JOIN users u ON u.id=CASE WHEN f.sender_id=$1 THEN f.receiver_id ELSE f.sender_id END
     WHERE (f.sender_id=$1 OR f.receiver_id=$1) AND f.status='accepted'
     ORDER BY u.full_name`,
    [req.user.id]);
  res.json(r.rows);
});

router.post("/:userId/follow",auth,async(req,res)=>{
  try{
    const target=Number(req.params.userId);
    if(target===req.user.id)return res.status(400).json({message:"You cannot follow yourself"});
    const r=await pool.query(
      `INSERT INTO followers(follower_id,following_id) VALUES($1,$2) ON CONFLICT(follower_id,following_id) DO NOTHING RETURNING id`,
      [req.user.id,target]);
    if(r.rows.length)await pool.query(
      `INSERT INTO notifications(user_id,sender_id,type,message) VALUES($1,$2,'follow','Someone started following you 👤')`,
      [target,req.user.id]);
    res.json({message:"Following successfully 👤",following:true});
  }catch(e){console.error(e);res.status(500).json({message:"Follow failed"});}
});

router.delete("/:userId/follow",auth,async(req,res)=>{
  await pool.query("DELETE FROM followers WHERE follower_id=$1 AND following_id=$2",[req.user.id,Number(req.params.userId)]);
  res.json({message:"Unfollowed successfully",following:false});
});

router.get("/following",auth,async(req,res)=>{
  const r=await pool.query(
    `SELECT u.id AS user_id,u.full_name,u.email FROM followers f JOIN users u ON u.id=f.following_id WHERE f.follower_id=$1 ORDER BY u.full_name`,
    [req.user.id]);
  res.json(r.rows);
});

module.exports=router;
