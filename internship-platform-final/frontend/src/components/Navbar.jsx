import {useI18n} from "../i18n";
function Navbar({go,back,canBack,logout,loggedIn}){
 const {t}=useI18n();
 return <nav className="navbar navbar-expand-lg navbar-dark app-nav px-3 sticky-top">
  <div className="container-fluid">
   <div className="d-flex align-items-center gap-2 flex-wrap">
    {canBack&&<button className="btn btn-outline-light btn-sm" onClick={back}>← Back</button>}
    <button className="navbar-brand fw-bold btn btn-link text-white text-decoration-none" onClick={()=>go("home")}>Internship Platform 🚀</button>
   </div>
   <div className="d-flex flex-wrap gap-2 align-items-center">
    <button className="btn btn-light btn-sm" onClick={()=>go("home")}>{t("home")}</button>
    <button className="btn btn-light btn-sm" onClick={()=>go("public")}>{t("publicSpace")}</button>
    {loggedIn && <>
      <button className="btn btn-light btn-sm" onClick={()=>go("applications")}>{t("applications")}</button>
      <button className="btn btn-light btn-sm" onClick={()=>go("profile")}>{t("profile")}</button>
      <button className="btn btn-light btn-sm" onClick={()=>go("notifications")}>🔔</button>
    </>}
    {!loggedIn?<button className="btn btn-warning btn-sm" onClick={()=>go("login")}>{t("login")}</button>
      :<button className="btn btn-outline-light btn-sm" onClick={logout}>{t("logout")}</button>}
   </div>
  </div>
 </nav>;
}
export default Navbar;
