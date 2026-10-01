const router=require("express").Router();
const pool=require("../db");
const auth=require("../middleware/auth");
const multer=require("multer");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const uploadDir=path.join(__dirname,"..","uploads");
fs.mkdirSync(uploadDir,{recursive:true});
const upload=multer({
  storage:multer.diskStorage({
    destination:uploadDir,
    filename:(req,file,cb)=>cb(null,`${Date.now()}-${crypto.randomBytes(8).toString("hex")}${path.extname(file.originalname)}`)
  }),
  limits:{fileSize:25*1024*1024},
  fileFilter:(req,file,cb)=>{
    if(!/^image\/|^video\//.test(file.mimetype))return cb(new Error("Only image/video files are allowed"));
    cb(null,true);
  }
});

const rate=new Map();
const badWords=["porn","pornography","hatecrime","terrorist"];
const postLimit=()=>Number(process.env.POST_RATE_MAX||5);
const windowMs=()=>Number(process.env.POST_RATE_WINDOW_SECONDS||60)*1000;

function metaText(req){return (req.body.content||req.body.text_content||"").trim();}
function cleanHashtag(v){return (v||"").trim().slice(0,100);}
function checkContent(text){return badWords.some(w=>new RegExp(`\\b${w}\\b`,"i").test(text));}

async function friendCount(userId){
  const r=await pool.query(
    `SELECT COUNT(*)::int AS count FROM friendships WHERE status='accepted' AND (sender_id=$1 OR receiver_id=$1)`,
    [userId]);
  return r.rows[0].count;
}
function allowedLimit(friends){
  if(friends===0)return 0;if(friends===1)return 1;if(friends<=5)return 2;if(friends<=10)return 5;return Infinity;
}
async function notify(userId,senderId,type,message){
  if(userId===senderId)return;
  await pool.query(`INSERT INTO notifications(user_id,sender_id,type,message) VALUES($1,$2,$3,$4)`,[userId,senderId,type,message]);
}

router.post("/",auth,upload.single("media"),async(req,res)=>{
  try{
    const text=metaText(req), hashtag=cleanHashtag(req.body.hashtag);
    const privacy=["public","friends"].includes(req.body.privacy)?req.body.privacy:"public";
    if(!text && !req.file)return res.status(400).json({message:"Add text, image, or video."});
    if(checkContent(text))return res.status(400).json({message:"Post rejected by content validation."});

    const now=Date.now(), arr=rate.get(req.user.id)||[];
    const recent=arr.filter(t=>now-t<windowMs());
    if(recent.length>=postLimit())return res.status(429).json({message:"Posting too quickly. Please wait before creating another post."});

    const friends=await friendCount(req.user.id), limit=allowedLimit(friends);
    const count=await pool.query(
      `SELECT COUNT(*)::int AS count FROM posts WHERE user_id=$1 AND created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'`,
      [req.user.id]);
    if(count.rows[0].count>=limit)return res.status(429).json({message:limit===0?"You need at least 1 accepted friend to post.":"Daily posting limit reached."});

    const mediaHash=req.file?crypto.createHash("sha256").update(fs.readFileSync(req.file.path)).digest("hex"):null;
    if(mediaHash){
      const duplicate=await pool.query("SELECT id FROM posts WHERE user_id=$1 AND media_hash=$2 LIMIT 1",[req.user.id,mediaHash]);
      if(duplicate.rows.length){fs.unlinkSync(req.file.path);return res.status(409).json({message:"You have already uploaded this media."});}
    }
    if(text){
      const duplicate=await pool.query(
        `SELECT id FROM posts WHERE user_id=$1 AND COALESCE(content,text_content)=$2 AND created_at>NOW()-INTERVAL '10 minutes' LIMIT 1`,
        [req.user.id,text]);
      if(duplicate.rows.length){if(req.file)fs.unlinkSync(req.file.path);return res.status(409).json({message:"Duplicate post detected."});}
    }

    const mediaUrl=req.file?`/uploads/${path.basename(req.file.path)}`:null;
    const r=await pool.query(
      `INSERT INTO posts(user_id,content,text_content,hashtag,media_url,media_type,media_hash,privacy,friend_count_at_post)
       VALUES($1,$2,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id,text||null,hashtag||null,mediaUrl,req.file?.mimetype||null,mediaHash,privacy,friends]);
    rate.set(req.user.id,[...recent,now]);

    const mentions=[...text.matchAll(/@([A-Za-z0-9_]+)/g)].map(m=>m[1]);
    for(const username of mentions){
      const u=await pool.query("SELECT id FROM users WHERE lower(username)=$1",[username.toLowerCase()]);
      if(u.rows[0])await notify(u.rows[0].id,req.user.id,"mention","You were mentioned in a post.");
    }

    const post=r.rows[0];
    res.status(201).json({message:"Post created successfully 🎉",post:{...post,full_name:(await pool.query("SELECT full_name FROM users WHERE id=$1",[req.user.id])).rows[0].full_name,likes_count:0,comments_count:0,shares_count:0}});
  }catch(e){console.error("CREATE POST",e);res.status(500).json({message:e.message||"Failed to create post"});}
});

router.get("/",async(req,res)=>{
  try{
    const token=req.headers.authorization?.startsWith("Bearer ")?req.headers.authorization.slice(7):null;
    let userId=null; const jwt=require("jsonwebtoken");
    if(token){try{userId=jwt.verify(token,process.env.JWT_SECRET).id;}catch{}}
    const search=(req.query.search||"").trim(), hashtag=(req.query.hashtag||"").trim();
    const params=[]; let current=0;
    if(userId){params.push(userId);current=params.length;}
    let where=userId
      ? `(p.privacy='public' OR p.user_id=$${current} OR EXISTS(SELECT 1 FROM friendships pf WHERE pf.status='accepted' AND ((pf.sender_id=$${current} AND pf.receiver_id=p.user_id) OR (pf.receiver_id=$${current} AND pf.sender_id=p.user_id))))`
      : `p.privacy='public'`;
    if(search){params.push(`%${search}%`);where+=` AND (COALESCE(p.content,p.text_content) ILIKE $${params.length} OR p.hashtag ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`;}
    if(hashtag){params.push(`%${hashtag}%`);where+=` AND p.hashtag ILIKE $${params.length}`;}
    const sql=`SELECT p.*,COALESCE(p.content,p.text_content) AS display_content,u.full_name,u.email,u.profile_photo_url,
      COUNT(DISTINCT l.id)::int AS likes_count,COUNT(DISTINCT c.id)::int AS comments_count,COUNT(DISTINCT s.id)::int AS shares_count,
      ${userId?`EXISTS(SELECT 1 FROM post_likes ml WHERE ml.post_id=p.id AND ml.user_id=$${current})`:"FALSE"} AS liked,
      ${userId?`EXISTS(SELECT 1 FROM saved_posts ms WHERE ms.post_id=p.id AND ms.user_id=$${current})`:"FALSE"} AS saved,
      ${userId?`CASE WHEN EXISTS(SELECT 1 FROM friendships f WHERE f.status='accepted' AND ((f.sender_id=$${current} AND f.receiver_id=p.user_id) OR (f.receiver_id=$${current} AND f.sender_id=p.user_id))) THEN 0 ELSE 1 END`:"1"} AS friend_priority
      FROM posts p JOIN users u ON u.id=p.user_id
      LEFT JOIN post_likes l ON l.post_id=p.id
      LEFT JOIN post_comments c ON c.post_id=p.id
      LEFT JOIN post_shares s ON s.post_id=p.id
      WHERE ${where} GROUP BY p.id,u.full_name,u.email,u.profile_photo_url
      ORDER BY friend_priority ASC,(likes_count + comments_count*2 + shares_count*3) DESC,p.created_at DESC LIMIT 100`;
    const r=await pool.query(sql,params);res.json(r.rows);
  }catch(e){console.error("GET POSTS",e);res.status(500).json({message:"Failed to load posts"});}
});

router.post("/:postId/view",auth,async(req,res)=>{
  try{
    const postId=Number(req.params.postId);
    const r=await pool.query("UPDATE posts SET views_count=COALESCE(views_count,0)+1 WHERE id=$1 RETURNING views_count",[postId]);
    if(!r.rows.length)return res.status(404).json({message:"Post not found"});
    res.json({views:r.rows[0].views_count});
  }catch(e){res.status(500).json({message:"View tracking failed"});}
});

router.get("/saved/list",auth,async(req,res)=>{
  const r=await pool.query(
    `SELECT p.*,u.full_name FROM saved_posts sp JOIN posts p ON p.id=sp.post_id JOIN users u ON u.id=p.user_id WHERE sp.user_id=$1 ORDER BY sp.created_at DESC`,
    [req.user.id]);res.json(r.rows);
});

router.get("/:postId/comments",async(req,res)=>{
  const r=await pool.query(
    `SELECT c.id,c.comment,c.created_at,u.full_name,u.id AS user_id
     FROM post_comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=$1 ORDER BY c.created_at ASC`,
    [Number(req.params.postId)]);res.json(r.rows);
});

router.post("/:postId/like",auth,async(req,res)=>{
  try{
    const postId=Number(req.params.postId);
    const ins=await pool.query(`INSERT INTO post_likes(post_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id`,[postId,req.user.id]);
    const p=await pool.query("SELECT user_id FROM posts WHERE id=$1",[postId]);
    if(ins.rows.length&&p.rows.length)await notify(p.rows[0].user_id,req.user.id,"like","Someone liked your post ❤️");
    const c=await pool.query("SELECT COUNT(*)::int AS n FROM post_likes WHERE post_id=$1",[postId]);
    res.json({liked:true,likes:c.rows[0].n});
  }catch(e){res.status(500).json({message:"Like failed"});}
});
router.delete("/:postId/like",auth,async(req,res)=>{
  const postId=Number(req.params.postId);
  await pool.query("DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2",[postId,req.user.id]);
  const c=await pool.query("SELECT COUNT(*)::int AS n FROM post_likes WHERE post_id=$1",[postId]);
  res.json({liked:false,likes:c.rows[0].n});
});
router.post("/:postId/comments",auth,async(req,res)=>{
  try{
    const postId=Number(req.params.postId), text=(req.body.comment||"").trim();
    if(!text)return res.status(400).json({message:"Comment cannot be empty"});
    if(checkContent(text))return res.status(400).json({message:"Comment rejected by content validation."});
    const r=await pool.query(`INSERT INTO post_comments(post_id,user_id,comment) VALUES($1,$2,$3) RETURNING id,comment,created_at`,[postId,req.user.id,text]);
    await pool.query("UPDATE posts SET comments_count=(SELECT COUNT(*) FROM post_comments WHERE post_id=$1),updated_at=NOW() WHERE id=$1",[postId]);
    const p=await pool.query("SELECT user_id FROM posts WHERE id=$1",[postId]);
    if(p.rows.length)await notify(p.rows[0].user_id,req.user.id,"comment","Someone commented on your post 💬");
    res.status(201).json({comment:{...r.rows[0],full_name:"You"}});
  }catch(e){console.error(e);res.status(500).json({message:"Comment failed"});}
});
router.post("/:postId/share",auth,async(req,res)=>{
  try{
    const postId=Number(req.params.postId);
    await pool.query("INSERT INTO post_shares(post_id,user_id) VALUES($1,$2) ON CONFLICT(post_id,user_id) DO NOTHING",[postId,req.user.id]);
    await pool.query("UPDATE posts SET shares_count=(SELECT COUNT(*) FROM post_shares WHERE post_id=$1),updated_at=NOW() WHERE id=$1",[postId]);
    const p=await pool.query("SELECT user_id FROM posts WHERE id=$1",[postId]);
    if(p.rows.length)await notify(p.rows[0].user_id,req.user.id,"share","Someone shared your post ↗️");
    const shareOrigin=req.headers.origin || process.env.FRONTEND_URL || "http://localhost:5173";
    res.json({message:"Post share recorded successfully",shares:(await pool.query("SELECT COUNT(*)::int n FROM post_shares WHERE post_id=$1",[postId])).rows[0].n,shareUrl:`${shareOrigin}/?post=${postId}`});
  }catch(e){res.status(500).json({message:"Share failed"});}
});
router.post("/:postId/save",auth,async(req,res)=>{await pool.query("INSERT INTO saved_posts(post_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[Number(req.params.postId),req.user.id]);res.json({saved:true});});
router.delete("/:postId/save",auth,async(req,res)=>{await pool.query("DELETE FROM saved_posts WHERE post_id=$1 AND user_id=$2",[Number(req.params.postId),req.user.id]);res.json({saved:false});});
router.post("/:postId/report",auth,async(req,res)=>{
  try{await pool.query("INSERT INTO reports(post_id,user_id,reason) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[Number(req.params.postId),req.user.id,(req.body.reason||"Content report").slice(0,500)]);res.json({message:"Report submitted. Thank you."});}
  catch(e){res.status(500).json({message:"Report failed"});}
});
router.post("/:postId/view",async(req,res)=>{await pool.query("UPDATE posts SET views_count=views_count+1 WHERE id=$1",[Number(req.params.postId)]);res.json({ok:true});});

router.put("/:postId",auth,async(req,res)=>{
  try{
    const postId=Number(req.params.postId), text=(req.body.content||"").trim();
    const r=await pool.query("SELECT * FROM posts WHERE id=$1 AND user_id=$2",[postId,req.user.id]);
    if(!r.rows.length)return res.status(404).json({message:"Post not found"});
    const mins=Number(process.env.POST_EDIT_DELETE_MINUTES||30);
    if(Date.now()-new Date(r.rows[0].created_at).getTime()>mins*60000)return res.status(403).json({message:`Posts can only be edited within ${mins} minutes.`});
    if(!text)return res.status(400).json({message:"Content cannot be empty"});
    await pool.query("UPDATE posts SET content=$1,text_content=$1,hashtag=$2,updated_at=NOW() WHERE id=$3",[text,(req.body.hashtag||"").trim(),postId]);
    res.json({message:"Post updated successfully"});
  }catch(e){res.status(500).json({message:"Update failed"});}
});
router.delete("/:postId",auth,async(req,res)=>{
  try{
    const postId=Number(req.params.postId),r=await pool.query("SELECT * FROM posts WHERE id=$1 AND user_id=$2",[postId,req.user.id]);
    if(!r.rows.length)return res.status(404).json({message:"Post not found"});
    const mins=Number(process.env.POST_EDIT_DELETE_MINUTES||30);
    if(Date.now()-new Date(r.rows[0].created_at).getTime()>mins*60000)return res.status(403).json({message:`Posts can only be deleted within ${mins} minutes.`});
    if(r.rows[0].media_url)try{fs.unlinkSync(path.join(__dirname,"..",r.rows[0].media_url.replace("/uploads/","uploads/")))}catch{}
    await pool.query("DELETE FROM posts WHERE id=$1",[postId]);res.json({message:"Post deleted successfully"});
  }catch(e){res.status(500).json({message:"Delete failed"});}
});

module.exports=router;
