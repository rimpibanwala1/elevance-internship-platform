const router=require("express").Router();
const pool=require("../db");
const auth=require("../middleware/auth");
const multer=require("multer");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const dir=path.join(__dirname,"..","uploads","profiles");
fs.mkdirSync(dir,{recursive:true});
const upload=multer({
  storage:multer.diskStorage({
    destination:dir,
    filename:(req,file,cb)=>cb(null,`${req.user.id}-${Date.now()}-${crypto.randomBytes(5).toString("hex")}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits:{fileSize:5*1024*1024},
  fileFilter:(req,file,cb)=>cb(null,/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype))
});

router.get("/",auth,async(req,res)=>{
  try{
    const r=await pool.query(
      `SELECT u.id,u.username,u.full_name,u.email,u.mobile,u.language,u.profile_photo_url,u.created_at,
       (SELECT COUNT(*)::int FROM friendships f WHERE f.status='accepted' AND (f.sender_id=u.id OR f.receiver_id=u.id)) AS friends,
       COALESCE((SELECT s.plan_name FROM subscriptions s WHERE s.user_id=u.id AND s.status='active' ORDER BY s.start_date DESC LIMIT 1),'Free') AS plan
       FROM users u WHERE u.id=$1`,[req.user.id]);
    if(!r.rows.length)return res.status(404).json({message:"User not found"});
    res.json(r.rows[0]);
  }catch(e){console.error(e);res.status(500).json({message:"Could not load profile"});}
});

router.put("/",auth,async(req,res)=>{
  const {fullName,mobile}=req.body;
  if(!fullName?.trim())return res.status(400).json({message:"Name is required"});
  try{
    const r=await pool.query(`UPDATE users SET full_name=$1,mobile=$2 WHERE id=$3 RETURNING id,full_name,email,mobile,language,profile_photo_url`,
      [fullName.trim(),mobile?.trim()||null,req.user.id]);
    res.json({message:"Profile updated successfully",user:r.rows[0]});
  }catch(e){if(e.code==="23505")return res.status(409).json({message:"Mobile already exists"});res.status(500).json({message:"Profile update failed"});}
});

router.post("/photo",auth,upload.single("photo"),async(req,res)=>{
  try{
    if(!req.file)return res.status(400).json({message:"Please select a JPG, PNG, WEBP or GIF image (max 5 MB)."});
    const old=await pool.query("SELECT profile_photo_url FROM users WHERE id=$1",[req.user.id]);
    const url=`/uploads/profiles/${path.basename(req.file.path)}`;
    await pool.query("UPDATE users SET profile_photo_url=$1 WHERE id=$2",[url,req.user.id]);
    const oldUrl=old.rows[0]?.profile_photo_url;
    if(oldUrl?.startsWith("/uploads/profiles/")){
      const oldPath=path.join(__dirname,"..",oldUrl.replace(/^\/uploads\//,"uploads/"));
      if(oldPath!==req.file.path)fs.unlink(oldPath,()=>{});
    }
    res.json({message:"Profile picture updated successfully 📷",profilePhotoUrl:url});
  }catch(e){if(req.file)fs.unlink(req.file.path,()=>{});console.error(e);res.status(500).json({message:"Profile picture upload failed"});}
});

router.delete("/photo",auth,async(req,res)=>{
  try{
    const r=await pool.query("SELECT profile_photo_url FROM users WHERE id=$1",[req.user.id]);
    await pool.query("UPDATE users SET profile_photo_url=NULL WHERE id=$1",[req.user.id]);
    const url=r.rows[0]?.profile_photo_url;
    if(url?.startsWith("/uploads/profiles/"))fs.unlink(path.join(__dirname,"..",url.replace(/^\//,"")),()=>{});
    res.json({message:"Profile picture removed",profilePhotoUrl:null});
  }catch(e){res.status(500).json({message:"Could not remove profile picture"});}
});
module.exports=router;
