const express=require("express");
const cors=require("cors");
const path=require("path");
const fs=require("fs");
const pool=require("./db");
require("dotenv").config();

const app=express();
const port=Number(process.env.PORT||5000);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://elevance-internship-platform.vercel.app",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));
app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true}));
app.use("/uploads",express.static(path.join(__dirname,"uploads")));

app.get("/",(req,res)=>res.json({message:"Internship Platform API is running 🚀"}));
app.get("/db-test",async(req,res)=>{
  try{const pool=require("./db");await pool.query("SELECT NOW()");res.json({message:"Database connected ✅"});}
  catch(e){res.status(500).json({message:"Database connection failed",error:e.message});}
});

app.use("/api/auth",require("./routes/auth"));
app.use("/api/posts",require("./routes/posts"));
app.use("/api/friends",require("./routes/friends"));
app.use("/api/profile",require("./routes/profile"));
app.use("/api/password",require("./routes/password"));
app.use("/api/resume",require("./routes/resume"));
app.use("/api/subscription",require("./routes/subscription"));
app.use("/api/applications",require("./routes/applications"));
app.use("/api/payment",require("./routes/payment"));
app.use("/api/notifications",require("./routes/notifications"));
app.use("/api/language",require("./routes/language"));
app.use("/api/login-history",require("./routes/loginHistory"));

app.use((err,req,res,next)=>{
  console.error("UNHANDLED ERROR",err);
  res.status(500).json({message:err.message||"Server error"});
});
async function start(){
  try{
    const schema=fs.readFileSync(path.join(__dirname,"schema.sql"),"utf8");
    await pool.query(schema);
    console.log("Database schema ready ✅");
  }catch(e){console.error("Database initialization failed:",e.message);}
  app.listen(port,()=>console.log(`Server running on http://localhost:${port}`));
}
start();
