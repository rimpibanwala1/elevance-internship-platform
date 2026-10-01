import {useEffect,useState} from "react";
import {API,authHeaders} from "../api";

function Profile({friends,go}){
  const [user,setUser]=useState(null),[edit,setEdit]=useState(false),[name,setName]=useState(""),[mobile,setMobile]=useState(""),[photo,setPhoto]=useState(null),[saving,setSaving]=useState(false),[uploading,setUploading]=useState(false);
  const load=async()=>{try{const r=await fetch(`${API}/api/profile`,{headers:authHeaders()});const d=await r.json();if(!r.ok)throw new Error(d.message);setUser(d);setName(d.full_name||"");setMobile(d.mobile||"")}catch(e){console.log(e)}};
  useEffect(()=>{load()},[]);
  const save=async()=>{setSaving(true);try{const r=await fetch(`${API}/api/profile`,{method:"PUT",headers:authHeaders(true),body:JSON.stringify({fullName:name,mobile})});const d=await r.json();if(!r.ok)throw new Error(d.message);setEdit(false);await load();alert(d.message)}catch(e){alert(e.message)}finally{setSaving(false)}};
  const uploadPhoto=async()=>{if(!photo)return alert("Please select a profile picture first.");setUploading(true);try{const fd=new FormData();fd.append("photo",photo);const r=await fetch(`${API}/api/profile/photo`,{method:"POST",headers:{Authorization:`Bearer ${localStorage.getItem("token")}`},body:fd});const d=await r.json();if(!r.ok)throw new Error(d.message);setPhoto(null);await load();alert(d.message)}catch(e){alert(e.message)}finally{setUploading(false)}};
  const removePhoto=async()=>{if(!confirm("Remove profile picture?"))return;const r=await fetch(`${API}/api/profile/photo`,{method:"DELETE",headers:authHeaders()});const d=await r.json();if(!r.ok)return alert(d.message);load()};
  if(!user)return <div className="card p-4">Loading profile...</div>;
  const photoUrl=user.profile_photo_url?`${API}${user.profile_photo_url}`:null;
  return <div className="card p-4 shadow-sm">
    <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
      <div className="d-flex gap-3 align-items-center">
        {photoUrl?<img src={photoUrl} alt="Profile" className="rounded-circle border" style={{width:100,height:100,objectFit:"cover"}}/>:<div className="rounded-circle bg-light border d-flex align-items-center justify-content-center" style={{width:100,height:100,fontSize:42}}>👤</div>}
        <div><span className="badge text-bg-primary mb-2">{user.plan||"Free"} Plan</span><h2 className="mb-1">My Profile 👤</h2><small className="text-muted">@{user.username||"student"+user.id}</small></div>
      </div>
      <button className="btn btn-outline-primary" onClick={()=>setEdit(!edit)}>{edit?"Cancel":"Edit Profile ✏️"}</button>
    </div>
    <div className="card bg-light border-0 p-3 mt-4"><h5>Profile Picture 📷</h5><div className="d-flex gap-2 flex-wrap align-items-center"><input className="form-control" style={{maxWidth:420}} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>setPhoto(e.target.files?.[0]||null)}/><button className="btn btn-primary" disabled={!photo||uploading} onClick={uploadPhoto}>{uploading?"Uploading...":"Upload Photo"}</button>{photoUrl&&<button className="btn btn-outline-danger" onClick={removePhoto}>Remove</button>}</div><small className="text-muted d-block mt-2">JPG, PNG, WEBP or GIF · maximum 5 MB.</small></div>
    {!edit?<><div className="row mt-3"><div className="col-md-6"><p><b>Name:</b> {user.full_name}</p><p><b>Email:</b> {user.email}</p><p><b>Mobile:</b> {user.mobile||"Not added"}</p></div><div className="col-md-6"><p><b>Friends:</b> {user.friends??friends}</p><p><b>Language:</b> {user.language}</p><p><b>Member since:</b> {new Date(user.created_at).toLocaleDateString()}</p></div></div><div className="d-flex flex-wrap gap-2 mt-3"><button className="btn btn-outline-primary" onClick={()=>go("subscription")}>Subscriptions 💳</button><button className="btn btn-outline-primary" onClick={()=>go("applications")}>Internship Applications 🎓</button><button className="btn btn-outline-primary" onClick={()=>go("resume")}>Resume Builder 📄</button><button className="btn btn-outline-primary" onClick={()=>go("language")}>Language 🌐</button><button className="btn btn-outline-primary" onClick={()=>go("history")}>Login History 🔒</button><button className="btn btn-outline-primary" onClick={()=>go("notifications")}>Notifications 🔔</button></div></>:<><label className="form-label mt-3">Full Name</label><input className="form-control mb-2" value={name} onChange={e=>setName(e.target.value)}/><label className="form-label">Email</label><input className="form-control mb-2" value={user.email} disabled/><label className="form-label">Mobile</label><input className="form-control mb-3" value={mobile} onChange={e=>setMobile(e.target.value)}/><button className="btn btn-success" disabled={saving} onClick={save}>{saving?"Saving...":"Save Changes ✅"}</button></>}
  </div>;
}
export default Profile;
