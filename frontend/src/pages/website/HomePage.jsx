import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import EnquiryForm from '../../components/website/EnquiryForm'
import { SectionTag } from '../../components/common'

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } }
const stagger = { show: { transition: { staggerChildren: 0.1 } } }

function useCounter(target, duration = 1600) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration])
  return count
}

const BENEFITS = [
  { icon:'Save', title:'Massive Savings', desc:'Reduce electricity bills by 70-90%. Typical payback in 4-6 years with panels lasting 25+ years.' },
  { icon:'Eco', title:'Eco-Friendly', desc:'Zero carbon emissions. Each 5kW system offsets around 6 tons of CO2 annually.' },
  { icon:'Sub', title:'Govt. Subsidy', desc:'Avail major central subsidy support on eligible residential installations.' },
  { icon:'Val', title:'Property Value', desc:'Solar panels can increase property value and improve long-term return.' },
  { icon:'Pow', title:'Energy Independence', desc:'With battery backup, enjoy uninterrupted power even during outages.' },
  { icon:'AMC', title:'Low Maintenance', desc:'Annual cleaning and routine checks keep your system performing at its best.' },
]

const TESTIMONIALS = [
  { text:'Mahaveer Multi Engineering installed a 5kW system at our factory. Electricity bills dropped by 70 percent and the team was very professional.', name:'Rajesh Mehta', loc:'Pune, Maharashtra', rating:5 },
  { text:'Excellent service from consultation to installation. Their CRM kept us updated at every step of the process.', name:'Priya Nair', loc:'Bangalore, Karnataka', rating:5 },
  { text:'After subsidy processing our home system became a great investment. We expect break-even in under four years.', name:'Sunil Sharma', loc:'Jaipur, Rajasthan', rating:5 },
]

export default function HomePage() {
  const navigate = useNavigate()
  const installs = useCounter(5200)
  const mw = useCounter(28)
  const states = useCounter(18)
  const customers = useCounter(15000)

  return (
    <div>
      <section className="hero-section">
        <div className="hero-glow" />
        <div className="hero-grid-overlay" />

        <div className="site-container site-hero-grid">
          <motion.div variants={stagger} initial="hidden" animate="show" className="hero-copy">
            <motion.div variants={fadeUp}>
              <div className="hero-kicker">
                India's Trusted Solar Company
              </div>
            </motion.div>
            <motion.h1 variants={fadeUp} className="hero-title">
              Power Your Home With <span className="gradient-text">Clean Solar</span> Energy
            </motion.h1>
            <motion.p variants={fadeUp} className="hero-lead">
              Cut electricity bills, increase property value, and move toward a more sustainable future with professional solar installation.
            </motion.p>
            <motion.div variants={fadeUp} style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <button className="btn btn-primary" style={{ padding:'14px 28px', fontSize:15 }} onClick={() => navigate('/contact')}>Get Free Quote</button>
              <button className="btn btn-ghost" style={{ padding:'14px 28px', fontSize:15 }} onClick={() => navigate('/services')}>Our Services</button>
            </motion.div>
          </motion.div>

          <motion.div initial={{ opacity:0, scale:.9 }} animate={{ opacity:1, scale:1 }} transition={{ duration:.6, delay:.2 }} className="hero-visual-wrap">
            <div className="hero-panel">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} style={{ minHeight:64, background:'linear-gradient(135deg,#1a2a4a,#0f1a30)', border:'1px solid rgba(59,130,246,.3)', borderRadius:8, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2, padding:6 }}>
                    {Array.from({ length: 9 }, (_, j) => (
                      <div key={j} style={{ background:'linear-gradient(135deg,#1e3a5f,#162d4e)', borderRadius:2, border:'1px solid rgba(59,130,246,.2)' }} />
                    ))}
                  </div>
                ))}
              </div>
              <div className="hero-sun-chip">Sun</div>
            </div>
          </motion.div>
        </div>
      </section>

      <div style={{ background:'var(--card2)', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)', padding:'20px 24px' }}>
        <div className="site-container site-stats-grid">
          {[
            { num:`${installs.toLocaleString()}+`, label:'Installations Done' },
            { num:`${mw}MW+`, label:'Capacity Installed' },
            { num:states, label:'States Served' },
            { num:`${customers.toLocaleString()}+`, label:'Happy Customers' },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign:'center' }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontSize:30, fontWeight:800, background:'linear-gradient(135deg,var(--sun),var(--orange))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>{stat.num}</div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <section className="site-section">
        <div className="site-container">
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <SectionTag>Why Solar?</SectionTag>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:'clamp(28px,4vw,42px)', fontWeight:800, marginBottom:14 }}>Benefits of Going Solar</h2>
            <p style={{ fontSize:16, color:'var(--muted)', maxWidth:520, margin:'0 auto', lineHeight:1.7 }}>Solar energy is one of the smartest long-term investments for homes and businesses.</p>
          </div>
          <div className="site-grid-auto">
            {BENEFITS.map((benefit, i) => (
              <motion.div key={benefit.title} className="service-card" initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} transition={{ delay: i * 0.07 }} viewport={{ once:true }}>
                <div style={{ width:56, height:56, borderRadius:16, background:'linear-gradient(135deg,rgba(245,158,11,.15),rgba(249,115,22,.08))', border:'1px solid rgba(245,158,11,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, marginBottom:18 }}>{benefit.icon}</div>
                <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:19, fontWeight:700, marginBottom:8 }}>{benefit.title}</h3>
                <p style={{ fontSize:14, color:'var(--muted)', lineHeight:1.7 }}>{benefit.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section" style={{ background:'var(--bg2)', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
        <div className="site-container site-grid-2" style={{ alignItems:'start' }}>
          <div>
            <SectionTag>Quick Enquiry</SectionTag>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:'clamp(24px,3vw,36px)', fontWeight:800, marginBottom:8 }}>Get Your Free Solar Assessment</h2>
            <p style={{ fontSize:14, color:'var(--muted)', marginBottom:24, lineHeight:1.7 }}>Tell us about your requirements and we will suggest the right solar solution for you.</p>
            <EnquiryForm />
          </div>
          <div>
            <SectionTag>Testimonials</SectionTag>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:'clamp(24px,3vw,36px)', fontWeight:800, marginBottom:24 }}>What Our Customers Say</h2>
            <div className="site-stack">
              {TESTIMONIALS.map((item, i) => (
                <motion.div key={i} initial={{ opacity:0, x:20 }} whileInView={{ opacity:1, x:0 }} transition={{ delay: i * 0.1 }} viewport={{ once:true }} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:22 }}>
                  <div style={{ color:'var(--sun)', fontSize:13, letterSpacing:2, marginBottom:10 }}>{'★'.repeat(item.rating)}</div>
                  <p style={{ fontSize:14, color:'var(--muted)', lineHeight:1.7, marginBottom:14, fontStyle:'italic' }}>"{item.text}"</p>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#6366F1,#3B82F6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff' }}>{item.name.split(' ').map(n => n[0]).join('')}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{item.name}</div>
                      <div style={{ fontSize:11, color:'var(--dim)' }}>{item.loc}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="site-section" style={{ textAlign:'center' }}>
        <div className="site-container" style={{ maxWidth:600 }}>
          <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:'clamp(28px,4vw,44px)', fontWeight:800, marginBottom:16 }}>Ready to Switch to Solar?</h2>
          <p style={{ fontSize:16, color:'var(--muted)', marginBottom:32, lineHeight:1.7 }}>Join thousands of customers already saving with solar energy.</p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <button className="btn btn-primary" style={{ padding:'14px 32px', fontSize:15 }} onClick={() => navigate('/contact')}>Get Free Quote</button>
            <button className="btn btn-ghost" style={{ padding:'14px 32px', fontSize:15 }} onClick={() => navigate('/about')}>Learn About Us</button>
          </div>
        </div>
      </section>

    </div>
  )
}
