import {useState} from "react";import {API} from "../api";
function Register({go}){
 const [f,setF]=useState({fullName:"",email:"",mobile:"",password:"",confirm:""}),[busy,setBusy]=useState(false);
 const set=(k,v)=>setF({...f,[k]:v});
 const submit=async()=>{if(f.password!==f.confirm)return alert("Passwords do not match");setBusy(true);try{const r=await fetch(`${API}/api/auth/register`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fullName:f.fullName,email:f.email,mobile:f.mobile,password:f.password})});const d=await r.json();if(!r.ok)throw new Error(d.message);alert(d.message);go("login")}catch(e){alert(e.message)}finally{setBusy(false)}};
 return <div className="card p-4 mx-auto form-box shadow-sm"><h3>Create Account 👤</h3>{[["fullName","Full Name"],["email","Email"],["mobile","Mobile Number"],["password","Password"],["confirm","Confirm Password"]].map(([k,p])=><input key={k} className="form-control my-2" type={k.includes("password")||k==="confirm"?"password":k==="email"?"email":"text"} placeholder={p} value={f[k]} onChange={e=>set(k,e.target.value)}/>)}<button className="btn btn-primary mt-2" onClick={submit} disabled={busy}>{busy?"Creating...":"Register"}</button><button className="btn btn-link" onClick={()=>go("login")}>Already have an account? Login</button></div>
}
export default Register;
