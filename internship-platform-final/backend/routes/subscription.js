const router=require("express").Router();
const pool=require("../db");
const auth=require("../middleware/auth");
const Razorpay=require("razorpay");
const crypto=require("crypto");
const {sendEmail}=require("../utils/email");

const PLANS={
  Free:{amount:0,limit:1},
  Bronze:{amount:100,limit:3},
  Silver:{amount:300,limit:5},
  Gold:{amount:1000,limit:null}
};

function paymentWindow(){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const h=Number(parts.find(x=>x.type==="hour").value),m=Number(parts.find(x=>x.type==="minute").value);
  return h*60+m>=300 && h*60+m<=705;
}
function razorpay(){
  if(!process.env.RAZORPAY_KEY_ID||!process.env.RAZORPAY_KEY_SECRET)return null;
  return new Razorpay({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET});
}

async function current(userId){
  const r=await pool.query(
    `SELECT * FROM subscriptions WHERE user_id=$1 AND status='active' ORDER BY start_date DESC LIMIT 1`,
    [userId]);
  if(!r.rows.length)return {plan_name:"Free",amount:0,application_limit:1,applications_used:0,status:"active",renewal_date:null};
  const s=r.rows[0];
  if(s.renewal_date && new Date(s.renewal_date)<new Date()){
    const plan=PLANS[s.plan_name]||PLANS.Free;
    await pool.query("UPDATE subscriptions SET status='expired' WHERE id=$1",[s.id]);
    return {plan_name:"Free",amount:0,application_limit:1,applications_used:0,status:"active",renewal_date:null};
  }
  return s;
}

router.get("/",auth,async(req,res)=>{
  try{
    const s=await current(req.user.id);
    const history=await pool.query("SELECT * FROM subscriptions WHERE user_id=$1 ORDER BY start_date DESC",[req.user.id]);
    const payments=await pool.query("SELECT * FROM payments WHERE user_id=$1 ORDER BY created_at DESC",[req.user.id]);
    res.json({subscription:s,history:history.rows,payments:payments.rows});
  }catch(e){console.error(e);res.status(500).json({message:"Failed to load subscription"});}
});

router.post("/order",auth,async(req,res)=>{
  try{
    const {plan}=req.body, p=PLANS[plan];
    if(!p)return res.status(400).json({message:"Invalid subscription plan"});
    if(p.amount===0)return res.json({mock:true,orderId:null,amount:0,keyId:null});
    if(!paymentWindow())return res.status(403).json({message:"Payments are available only between 5:00 AM and 11:45 AM IST."});
    const rp=razorpay();
    if(!rp && process.env.PAYMENT_MODE!=="mock")return res.status(503).json({message:"Razorpay is not configured. Add Test Mode keys in .env."});
    if(!rp)return res.json({mock:true,orderId:`mock_sub_${Date.now()}`,amount:p.amount*100,keyId:null});
    const order=await rp.orders.create({amount:p.amount*100,currency:"INR",receipt:`sub_${req.user.id}_${Date.now()}`,notes:{userId:String(req.user.id),plan}});
    await pool.query(
      `INSERT INTO payments(user_id,amount,plan_name,provider_order_id,status,metadata) VALUES($1,$2,$3,$4,'created',$5)`,
      [req.user.id,p.amount,plan,order.id,JSON.stringify({type:"subscription"})]);
    res.json({mock:false,orderId:order.id,amount:order.amount,keyId:process.env.RAZORPAY_KEY_ID});
  }catch(e){console.error(e);res.status(500).json({message:"Could not create payment order"});}
});

router.post("/activate",auth,async(req,res)=>{
  try{
    const {plan,orderId,paymentId,signature}=req.body,p=PLANS[plan];
    if(!p)return res.status(400).json({message:"Invalid plan"});
    if(p.amount>0){
      if(!paymentWindow())return res.status(403).json({message:"Payments are available only between 5:00 AM and 11:45 AM IST."});
      if(razorpay()){
        if(!orderId||!paymentId||!signature)return res.status(400).json({message:"Payment verification details are required"});
        const expected=crypto.createHmac("sha256",process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
        if(expected!==signature)return res.status(400).json({message:"Payment verification failed"});
      } else if(process.env.PAYMENT_MODE!=="mock") return res.status(503).json({message:"Razorpay is not configured"});
    }
    if(paymentId){
      const duplicate=await pool.query("SELECT invoice_number,transaction_id FROM payments WHERE user_id=$1 AND provider_payment_id=$2 AND status='success' LIMIT 1",[req.user.id,paymentId]);
      if(duplicate.rows.length)return res.status(409).json({message:"This payment has already been processed.",invoice:duplicate.rows[0].invoice_number,transactionId:duplicate.rows[0].transaction_id});
    }
    const existing=await current(req.user.id);
    await pool.query("UPDATE subscriptions SET status='expired' WHERE user_id=$1 AND status='active'",[req.user.id]);
    const renewal=new Date();renewal.setMonth(renewal.getMonth()+1);
    const r=await pool.query(
      `INSERT INTO subscriptions(user_id,plan_name,amount,application_limit,applications_used,status,start_date,renewal_date)
       VALUES($1,$2,$3,$4,0,'active',NOW(),$5) RETURNING *`,
      [req.user.id,plan,p.amount,p.limit,renewal]);
    const invoice=`INV-SUB-${Date.now()}`;
    const transactionId=paymentId||`MOCK-${Date.now()}`;
    await pool.query(
      `INSERT INTO payments(user_id,amount,plan_name,transaction_id,provider_order_id,provider_payment_id,status,invoice_number,metadata)
       VALUES($1,$2,$3,$4,$5,$6,'success',$7,$8)`,
      [req.user.id,p.amount,plan,transactionId,orderId||null,paymentId||null,invoice,JSON.stringify({type:"subscription",renewal:renewal.toISOString()})]);
    const u=await pool.query("SELECT email,full_name FROM users WHERE id=$1",[req.user.id]);
    await sendEmail(u.rows[0].email,`Subscription invoice ${invoice}`,
      `<div style="font-family:Arial"><h2>Subscription confirmation</h2><p>Hi ${u.rows[0].full_name}, your ${plan} plan is active.</p><p>Invoice: ${invoice}</p><p>Transaction ID: ${transactionId}</p><p>Amount: ₹${p.amount}</p><p>Valid until: ${renewal.toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</p><p>Billing email: ${u.rows[0].email}</p></div>`);
    res.json({message:`${plan} plan activated successfully 💳`,subscription:r.rows[0],invoice,transactionId});
  }catch(e){console.error(e);res.status(500).json({message:"Subscription activation failed"});}
});

router.post("/cancel",auth,async(req,res)=>{
  await pool.query("UPDATE subscriptions SET status='cancelled' WHERE user_id=$1 AND status='active'",[req.user.id]);
  res.json({message:"Subscription cancelled. Access remains until the current renewal date where applicable."});
});

router.current=current;
router.PLANS=PLANS;
module.exports=router;
