import {useEffect,useState} from "react";
import {API,authHeaders,token} from "../api";

function PublicSpace({friends,setFriends}){
  const [posts,setPosts]=useState([]),[users,setUsers]=useState([]),[requests,setRequests]=useState([]),[following,setFollowing]=useState({});
  const [content,setContent]=useState(""),[hashtag,setHashtag]=useState(""),[privacy,setPrivacy]=useState("public"),[media,setMedia]=useState(null),[search,setSearch]=useState("");
  const [comment,setComment]=useState({}),[comments,setComments]=useState({}),[editing,setEditing]=useState(null),[editText,setEditText]=useState("");
  const [sharePost,setSharePost]=useState(null),[shareStatus,setShareStatus]=useState("");

  const loadPosts=async()=>{
    try{
      const r=await fetch(`${API}/api/posts?search=${encodeURIComponent(search)}`,{headers:authHeaders()});
      const d=await r.json(); if(r.ok)setPosts(d);
    }catch{}
  };
  const load=async()=>{
    const t=token(); if(!t)return;
    try{
      const [u,r,f,fl]=await Promise.all(["/api/friends/users","/api/friends/requests","/api/friends/list","/api/friends/following"].map(x=>fetch(API+x,{headers:authHeaders()})));
      const [ud,rd,fd,fld]=await Promise.all([u.json(),r.json(),f.json(),fl.json()]);
      if(u.ok)setUsers(ud); if(r.ok)setRequests(rd);
      if(f.ok){setFriends(fd.length)}
      if(fl.ok){const m={};fld.forEach(x=>m[x.user_id]=true);setFollowing(m)}
    }catch(e){console.log(e)}
  };
  useEffect(()=>{loadPosts();load()},[]);
  useEffect(()=>{
    const postId=new URLSearchParams(window.location.search).get("post");
    if(postId && posts.length){
      const el=document.getElementById(`post-${postId}`);
      if(el){el.scrollIntoView({behavior:"smooth",block:"center"});el.classList.add("border-primary");setTimeout(()=>el.classList.remove("border-primary"),2500);}
    }
  },[posts]);

  const limit=friends===0?0:friends===1?1:friends<=5?2:friends<=10?5:Infinity;
  const create=async()=>{
    if(!token())return alert("Please login first.");
    if(!content.trim()&&!media)return alert("Add text or media.");
    const fd=new FormData(); fd.append("content",content); fd.append("hashtag",hashtag); fd.append("privacy",privacy); if(media)fd.append("media",media);
    try{
      const r=await fetch(`${API}/api/posts`,{method:"POST",headers:{Authorization:`Bearer ${token()}`},body:fd});
      const d=await r.json(); if(!r.ok)throw new Error(d.message);
      setContent("");setHashtag("");setMedia(null);loadPosts();
    }catch(e){alert(e.message)}
  };
  const act=async(path,method="POST",body)=>{
    try{
      const r=await fetch(API+path,{method,headers:authHeaders(!!body),body:body?JSON.stringify(body):undefined});
      const d=await r.json(); if(!r.ok)throw new Error(d.message); return d;
    }catch(e){alert(e.message);return null}
  };
  const sendReq=async id=>{if(await act(`/api/friends/${id}/request`))load()};
  const accept=async id=>{if(await act(`/api/friends/${id}/accept`,"PUT"))load()};
  const follow=async id=>{const d=await act(`/api/friends/${id}/follow`,following[id]?"DELETE":"POST");if(d)setFollowing({...following,[id]:!following[id]})};
  const like=async p=>{if(await act(`/api/posts/${p.id}/like`,p.liked?"DELETE":"POST"))loadPosts()};
  const save=async p=>{if(await act(`/api/posts/${p.id}/save`,p.saved?"DELETE":"POST"))loadPosts()};

  const openShare=async p=>{
    const d=await act(`/api/posts/${p.id}/share`);
    if(!d)return;
    setSharePost({...p,shareUrl:d.shareUrl||`${location.origin}/?post=${p.id}`});
    setShareStatus("Share recorded. Choose how you want to share it.");
    loadPosts();
  };
  const copyShare=async()=>{
    if(!sharePost)return;
    try{await navigator.clipboard.writeText(sharePost.shareUrl);setShareStatus("Link copied successfully. You can paste it anywhere.");}
    catch{setShareStatus(`Copy this link: ${sharePost.shareUrl}`)}
  };
  const nativeShare=async()=>{
    if(!sharePost)return;
    if(!navigator.share){return copyShare()}
    try{await navigator.share({title:"Internship Platform post",text:"Check out this post",url:sharePost.shareUrl});setShareStatus("Post shared successfully.")}
    catch(e){if(e?.name!=="AbortError")setShareStatus("Sharing was cancelled or unavailable.")}
  };

  const loadComments=async id=>{
    const r=await fetch(`${API}/api/posts/${id}/comments`);const d=await r.json();if(r.ok)setComments({...comments,[id]:d});
  };
  const addComment=async p=>{const v=(comment[p.id]||"").trim();if(!v)return;const d=await act(`/api/posts/${p.id}/comments`,"POST",{comment:v});if(d){setComment({...comment,[p.id]:""});await loadComments(p.id);loadPosts()}};
  const report=async p=>{const reason=prompt("Reason for report:","Inappropriate content");if(reason!==null)await act(`/api/posts/${p.id}/report`,"POST",{reason})};
  const update=async id=>{const d=await act(`/api/posts/${id}`,"PUT",{content:editText,hashtag:""});if(d){setEditing(null);loadPosts()}};
  const del=async id=>{if(confirm("Delete this post?")){if(await act(`/api/posts/${id}`,"DELETE"))loadPosts()}};

  return <div>
    <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2"><h2>Public Space 🌍</h2><div className="d-flex gap-2"><input className="form-control" placeholder="Search posts, #hashtag..." value={search} onChange={e=>setSearch(e.target.value)}/><button className="btn btn-outline-primary" onClick={loadPosts}>Search</button></div></div>
    <div className="alert alert-info">Friends: <b>{friends}</b> · Posts today allowed: <b>{limit===Infinity?"Unlimited":limit}</b> · Friends are prioritized in your feed.</div>
    {requests.length>0&&<div className="card p-3 mb-3"><h5>Friend Requests 👥</h5>{requests.map(r=><div className="d-flex justify-content-between border rounded p-2 mb-2" key={r.id}><span><b>{r.full_name}</b><small className="d-block text-muted">{r.email}</small></span><button className="btn btn-success btn-sm" onClick={()=>accept(r.id)}>Accept</button></div>)}</div>}
    <div className="card p-3 mb-4"><h5>Create Post</h5><textarea className="form-control mb-2" rows="3" placeholder="What's on your mind? Mention @username or use #hashtag." value={content} onChange={e=>setContent(e.target.value)}/><div className="row g-2"><div className="col-md-5"><input className="form-control" placeholder="#hashtag" value={hashtag} onChange={e=>setHashtag(e.target.value)}/></div><div className="col-md-3"><select className="form-select" value={privacy} onChange={e=>setPrivacy(e.target.value)}><option value="public">Public</option><option value="friends">Friends only</option></select></div><div className="col-md-4"><input className="form-control" type="file" accept="image/*,video/*" onChange={e=>setMedia(e.target.files?.[0]||null)}/></div></div><button className="btn btn-primary mt-2" onClick={create}>Create Post 🎉</button></div>
    <div className="card p-3 mb-4"><h5>Students 👨‍🎓</h5>{users.map(u=><div key={u.id} className="d-flex justify-content-between align-items-center border rounded p-2 mb-2"><span><b>{u.full_name}</b><small className="d-block text-muted">@{u.username} · {u.email}</small></span><div className="d-flex gap-2">{u.friend?<button className="btn btn-success btn-sm" disabled>Friend ✓</button>:u.request_sent?<button className="btn btn-secondary btn-sm" disabled>Pending</button>:<button className="btn btn-outline-primary btn-sm" onClick={()=>sendReq(u.id)}>Add Friend</button>}<button className={`btn btn-sm ${following[u.id]?"btn-primary":"btn-outline-primary"}`} onClick={()=>follow(u.id)}>{following[u.id]?"Following ✓":"Follow"}</button></div></div>)}</div>
    {posts.map(p=><div id={`post-${p.id}`} className="card mb-3 shadow-sm" key={p.id} onMouseEnter={()=>fetch(`${API}/api/posts/${p.id}/view`,{method:"POST"})}><div className="card-body"><div className="d-flex justify-content-between"><div className="d-flex align-items-center gap-2">{p.profile_photo_url?<img src={`${API}${p.profile_photo_url}`} alt="" className="rounded-circle border" style={{width:42,height:42,objectFit:"cover"}}/>:<div className="rounded-circle bg-light border d-flex align-items-center justify-content-center" style={{width:42,height:42}}>👤</div>}<div><h5 className="mb-0">{p.full_name||"Student"}</h5><small className="text-muted">{new Date(p.created_at).toLocaleString()} · {p.friend_count_at_post} friends at posting</small></div></div><span className="badge text-bg-light">{p.privacy}</span></div>
      {editing===p.id?<><textarea className="form-control mt-3" value={editText} onChange={e=>setEditText(e.target.value)}/><button className="btn btn-success btn-sm mt-2" onClick={()=>update(p.id)}>Save</button> <button className="btn btn-secondary btn-sm mt-2" onClick={()=>setEditing(null)}>Cancel</button></>:<>{p.display_content&&<p className="mt-3">{p.display_content}</p>}{p.hashtag&&<p className="text-primary">#{p.hashtag.replace(/^#/,'')}</p>}</>}
      {p.media_url&&<div className="mb-3">{p.media_type?.startsWith("image")?<img src={`${API}${p.media_url}`} className="img-fluid rounded" alt="post"/>:<video src={`${API}${p.media_url}`} controls className="w-100 rounded"/>}</div>}
      <div className="d-flex gap-2 flex-wrap"><button className={`btn btn-sm ${p.liked?"btn-danger":"btn-outline-danger"}`} onClick={()=>like(p)}>{p.liked?"❤️ Liked":"❤️ Like"} {p.likes_count||0}</button><button className="btn btn-outline-secondary btn-sm" onClick={()=>{document.getElementById(`c-${p.id}`)?.focus();loadComments(p.id)}}>💬 {p.comments_count||0}</button><button className="btn btn-outline-primary btn-sm" onClick={()=>openShare(p)}>↗ Share {p.shares_count||0}</button><button className={`btn btn-sm ${p.saved?"btn-success":"btn-outline-success"}`} onClick={()=>save(p)}>🔖 {p.saved?"Saved":"Save"}</button><button className="btn btn-outline-warning btn-sm" onClick={()=>report(p)}>⚠ Report</button>{Number(p.user_id)===Number(JSON.parse(localStorage.getItem("user")||"null")?.id)&&<><button className="btn btn-outline-secondary btn-sm" onClick={()=>{setEditing(p.id);setEditText(p.display_content||"")}}>Edit</button><button className="btn btn-outline-danger btn-sm" onClick={()=>del(p.id)}>Delete</button></>}</div>
      <div className="mt-3"><input id={`c-${p.id}`} className="form-control" placeholder="Write a comment..." value={comment[p.id]||""} onChange={e=>setComment({...comment,[p.id]:e.target.value})}/><button className="btn btn-secondary btn-sm mt-2" onClick={()=>addComment(p)}>Add Comment</button>{(comments[p.id]||[]).map(c=><div className="border rounded p-2 mt-2" key={c.id}><b>{c.full_name}</b>: {c.comment}<small className="d-block text-muted">{new Date(c.created_at).toLocaleString()}</small></div>)}</div>
    </div></div>)}
    {sharePost&&<div className="modal d-block" tabIndex="-1" role="dialog" style={{background:"rgba(0,0,0,.45)"}}><div className="modal-dialog modal-dialog-centered"><div className="modal-content"><div className="modal-header"><h5 className="modal-title">Share Post ↗</h5><button className="btn-close" onClick={()=>setSharePost(null)} aria-label="Close"/></div><div className="modal-body"><p>{shareStatus}</p><input className="form-control" value={sharePost.shareUrl} readOnly/><div className="d-flex gap-2 flex-wrap mt-3"><button className="btn btn-primary" onClick={nativeShare}>Share via device</button><button className="btn btn-outline-primary" onClick={copyShare}>Copy link</button></div></div><div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setSharePost(null)}>Close</button></div></div></div></div>}
  </div>;
}
export default PublicSpace;
