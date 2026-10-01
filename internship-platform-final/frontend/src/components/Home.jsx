function Home({go}){
 return <div className="hero-panel text-center">
  <span className="badge text-bg-primary mb-3">Student Career Platform</span>
  <h1>Build your career. Find internships. Grow together. 🎓</h1>
  <p className="lead">A secure internship community with social discovery, subscriptions, applications and a premium resume builder.</p>
  <div className="d-flex justify-content-center gap-2 flex-wrap mt-4">
   <button className="btn btn-primary btn-lg" onClick={()=>go("public")}>Explore Public Space 🌍</button>
   <button className="btn btn-outline-primary btn-lg" onClick={()=>go("applications")}>Internship Applications</button>
  </div>
  <div className="row g-3 mt-4 text-start">
   {["Public Space & Friends","Subscription & Quotas","Premium Resume Builder","Security & Login History"].map(x=><div className="col-md-6" key={x}><div className="feature-card"><strong>{x}</strong><p className="text-muted mb-0 mt-1">Integrated into one student platform.</p></div></div>)}
  </div>
 </div>;
}
export default Home;
