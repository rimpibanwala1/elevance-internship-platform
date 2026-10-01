import {useState} from "react";
import {API} from "../api";
function Login({go,onLogin}){
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[challenge,setChallenge]=useState(null),[otp,setOtp]=useState(""),[busy,setBusy]=useState(false);
 const submit=async()=>{
  if(!email||!password)return alert("Email and password are required.");
  setBusy(true);
  try{
   const r=await fetch(`${API}/api/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
   const d=await r.json();
   if(!r.ok)throw new Error(d.message);
   if(d.requiresOtp){setChallenge(d.challengeId);if(d.demoOtp)setOtp(d.demoOtp);alert(d.demoOtp?`${d.message} Demo OTP: ${d.demoOtp}`:d.message);return;}
   onLogin(d);
  }catch(e){alert(e.message)}finally{setBusy(false)}
 };
 const verify=async()=>{
  setBusy(true);
  try{
   const r=await fetch(`${API}/api/auth/verify-login-otp`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeId:challenge,otp})});
   const d=await r.json();if(!r.ok)throw new Error(d.message);onLogin(d);
  }catch(e){alert(e.message)}finally{setBusy(false)}
 };
 return <div className="card p-4 mx-auto form-box shadow-sm">
  <h3>{challenge?"Verify Login OTP 🔐":"Login 🔐"}</h3>
  {!challenge?<><input className="form-control my-2" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
   <input className="form-control my-2" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/>
   <button className="btn btn-primary mt-2" disabled={busy} onClick={submit}>{busy?"Checking...":"Login"}</button>
   <button className="btn btn-link" onClick={()=>go("forgot")}>Forgot Password?</button>
   <button className="btn btn-link" onClick={()=>go("register")}>Create New Account</button></>
   :<><p className="text-muted">Enter the OTP sent to your registered email.</p><input className="form-control mb-3" inputMode="numeric" maxLength="6" placeholder="6-digit OTP" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,""))}/><button className="btn btn-primary" disabled={busy} onClick={verify}>{busy?"Verifying...":"Verify & Login"}</button><button className="btn btn-link" onClick={()=>setChallenge(null)}>Back</button></>}
 </div>
}
export default Login;
