import {useEffect,useState} from "react";
import Navbar from "./components/Navbar";
import Home from "./components/Home";
import Login from "./components/Login";
import Register from "./components/Register";
import ForgotPassword from "./components/ForgotPassword";
import ChangePassword from "./components/ChangePassword";
import PublicSpace from "./components/PublicSpace";
import Profile from "./components/Profile";
import Subscription from "./components/Subscription";
import ResumeBuilder from "./components/ResumeBuilder";
import Language from "./components/Language";
import LoginHistory from "./components/LoginHistory";
import Notifications from "./components/Notifications";
import Applications from "./components/Applications";
import {API} from "./api";
import {I18nProvider} from "./i18n";

function App(){
  const [page,setPage]=useState(()=>new URLSearchParams(window.location.search).has("post")?"public":"home");
  const [friends,setFriends]=useState(0);
  const [language,setLanguage]=useState(localStorage.getItem("language")||"English");
  const [mustChange,setMustChange]=useState(localStorage.getItem("mustChangePassword")==="true");
  const [history,setHistory]=useState([new URLSearchParams(window.location.search).has("post")?"public":"home"]);

  useEffect(()=>{
    const load=async()=>{
      const t=localStorage.getItem("token"); if(!t)return;
      try{
        const r=await fetch(`${API}/api/profile`,{headers:{Authorization:`Bearer ${t}`}});
        const d=await r.json();
        if(r.ok){setFriends(Number(d.friends||0));if(d.language){setLanguage(d.language);localStorage.setItem("language",d.language);}}
      }catch{}
    };load();
  },[]);

  const go=(next)=>{
    setPage(next);
    setHistory(h=>h[h.length-1]===next?h:[...h,next]);
  };
  const back=()=>{
    setHistory(h=>{
      if(h.length<=1)return h;
      const next=h[h.length-2];
      setPage(next);
      return h.slice(0,-1);
    });
  };

  const loginSuccess=(data)=>{
    localStorage.setItem("token",data.token);
    localStorage.setItem("user",JSON.stringify(data.user||{}));
    localStorage.setItem("mustChangePassword",String(!!data.mustChangePassword));
    setMustChange(!!data.mustChangePassword);
    setLanguage(data.user?.language||"English");
    localStorage.setItem("language",data.user?.language||"English");
    setPage(data.mustChangePassword?"changePassword":"profile");
    setHistory([data.mustChangePassword?"changePassword":"profile"]);
  };

  const logout=()=>{localStorage.removeItem("token");localStorage.removeItem("mustChangePassword");localStorage.removeItem("user");setPage("home");setHistory(["home"]);};

  const pages={
    home:<Home go={go}/>,
    login:<Login go={go} onLogin={loginSuccess}/>,
    register:<Register go={go}/>,
    forgot:<ForgotPassword go={go}/>,
    changePassword:<ChangePassword onDone={()=>{localStorage.setItem("mustChangePassword","false");setMustChange(false);setPage("profile");setHistory(["profile"]);}}/>,
    public:<PublicSpace friends={friends} setFriends={setFriends}/>,
    profile:<Profile friends={friends} go={go}/>,
    subscription:<Subscription/>,
    resume:<ResumeBuilder/>,
    language:<Language onLanguage={l=>{setLanguage(l);localStorage.setItem("language",l);}}/>,
    history:<LoginHistory/>,
    notifications:<Notifications/>,
    applications:<Applications/>
  };

  return <I18nProvider key={language} initial={language}>
    <Navbar go={go} back={back} canBack={history.length>1} logout={logout} loggedIn={!!localStorage.getItem("token")}/>
    {mustChange && page!=="changePassword" ? <main className="container py-4"><div className="alert alert-warning">Please change your temporary password before continuing.</div>{pages.changePassword}</main>
      : <main className="container py-4">{pages[page]||pages.home}</main>}
  </I18nProvider>;
}
export default App;
