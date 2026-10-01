export const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const token = () => localStorage.getItem("token");
export const authHeaders = (json=false) => ({
  ...(json ? {"Content-Type":"application/json"} : {}),
  ...(token() ? {Authorization:`Bearer ${token()}`} : {})
});
export async function api(path, options={}) {
  const res=await fetch(`${API}${path}`,{credentials:"include",...options});
  let data={};
  try{data=await res.json();}catch{}
  if(res.status===401){
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("mustChangePassword");
    if(!location.pathname.includes("login")) location.reload();
    throw new Error(data.message || "Session expired. Please login again.");
  }
  if(!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}
