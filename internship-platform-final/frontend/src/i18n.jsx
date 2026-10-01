import {createContext,useContext,useMemo,useState} from "react";
const dictionaries={
  English:{home:"Home",publicSpace:"Public Space",profile:"Profile",subscription:"Subscriptions",resume:"Resume Builder",language:"Language",history:"Login History",notifications:"Notifications",applications:"Applications",login:"Login",logout:"Logout"},
  Hindi:{home:"होम",publicSpace:"पब्लिक स्पेस",profile:"प्रोफ़ाइल",subscription:"सब्सक्रिप्शन",resume:"रिज़्यूमे बिल्डर",language:"भाषा",history:"लॉगिन हिस्ट्री",notifications:"नोटिफिकेशन",applications:"आवेदन",login:"लॉगिन",logout:"लॉगआउट"},
  Spanish:{home:"Inicio",publicSpace:"Espacio público",profile:"Perfil",subscription:"Suscripciones",resume:"Creador de CV",language:"Idioma",history:"Historial de inicio",notifications:"Notificaciones",applications:"Solicitudes",login:"Iniciar sesión",logout:"Cerrar sesión"},
  Portuguese:{home:"Início",publicSpace:"Espaço público",profile:"Perfil",subscription:"Assinaturas",resume:"Criador de currículo",language:"Idioma",history:"Histórico de login",notifications:"Notificações",applications:"Candidaturas",login:"Entrar",logout:"Sair"},
  Chinese:{home:"首页",publicSpace:"公共空间",profile:"个人资料",subscription:"订阅",resume:"简历生成器",language:"语言",history:"登录记录",notifications:"通知",applications:"申请",login:"登录",logout:"退出"},
  French:{home:"Accueil",publicSpace:"Espace public",profile:"Profil",subscription:"Abonnements",resume:"Créateur de CV",language:"Langue",history:"Historique de connexion",notifications:"Notifications",applications:"Candidatures",login:"Connexion",logout:"Déconnexion"}
};
const C=createContext();
export function I18nProvider({children,initial="English"}) {
  const [language,setLanguage]=useState(initial);
  const value=useMemo(()=>({language,setLanguage,t:(key)=>dictionaries[language]?.[key]||dictionaries.English[key]||key}),[language]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export const useI18n=()=>useContext(C);
export const supportedLanguages=Object.keys(dictionaries);
