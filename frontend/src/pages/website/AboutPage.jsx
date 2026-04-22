import EnquiryForm from '../../components/website/EnquiryForm'
import { SectionTag } from '../../components/common'

const team = [
  { name:'Dr. Arjun Sharma', role:'Founder & CEO', icon:'CEO', desc:'20+ years in renewable energy and long-term solar strategy.' },
  { name:'Priya Verma', role:'CTO', icon:'CTO', desc:'Deep expertise in photovoltaic technology and performance engineering.' },
  { name:'Rohit Patel', role:'COO', icon:'OPS', desc:'Leads nationwide delivery and customer operations.' },
  { name:'Sneha Gupta', role:'CFO', icon:'FIN', desc:'Green finance specialist managing solar project funding.' },
]

export function AboutPage() {
  return (
    <div className="site-page">
      <div className="site-container site-section">
        <SectionTag>About SolarPro</SectionTag>
        <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'clamp(30px,4vw,48px)', fontWeight:800, marginBottom:16 }}>Powering India's Solar Revolution</h1>
        <p style={{ fontSize:16, color:'var(--muted)', lineHeight:1.8, marginBottom:48, maxWidth:680 }}>
          Founded in 2015, Mahaveer Multi Engeering has grown into one of the country’s trusted solar energy companies, helping homes and businesses adopt clean, affordable energy.
        </p>

        <div className="site-grid-auto" style={{ marginBottom:56 }}>
          {[
            { icon:'MIS', title:'Our Mission', desc:'Make solar energy accessible to every Indian household and business.' },
            { icon:'VIS', title:'Our Vision', desc:'A carbon-neutral India powered by rooftop solar and clean storage systems.' },
            { icon:'VAL', title:'Our Values', desc:'Integrity, quality, transparency, and a strong customer-first approach.' },
          ].map(item => (
            <div key={item.title} className="service-card">
              <div style={{ width:56, height:56, borderRadius:16, background:'linear-gradient(135deg,rgba(245,158,11,.15),rgba(249,115,22,.08))', border:'1px solid rgba(245,158,11,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, marginBottom:18 }}>{item.icon}</div>
              <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:19, fontWeight:700, marginBottom:8 }}>{item.title}</h3>
              <p style={{ fontSize:14, color:'var(--muted)', lineHeight:1.7 }}>{item.desc}</p>
            </div>
          ))}
        </div>

        <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:'clamp(26px,3.5vw,30px)', fontWeight:800, marginBottom:24 }}>Leadership Team</h2>
        <div className="site-grid-auto-sm" style={{ marginBottom:48 }}>
          {team.map(member => (
            <div key={member.name} className="crm-card" style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
              <div style={{ width:56, height:56, borderRadius:16, background:'linear-gradient(135deg,rgba(245,158,11,.2),rgba(249,115,22,.1))', border:'1px solid rgba(245,158,11,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, flexShrink:0 }}>{member.icon}</div>
              <div>
                <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>{member.name}</div>
                <span className="badge badge-sun" style={{ marginBottom:8, display:'inline-block' }}>{member.role}</span>
                <p style={{ fontSize:13, color:'var(--muted)', lineHeight:1.6 }}>{member.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="crm-card" style={{ background:'linear-gradient(135deg,rgba(245,158,11,.06),rgba(249,115,22,.03))', border:'1px solid rgba(245,158,11,.15)', marginBottom:40 }}>
          <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700, marginBottom:16 }}>Awards & Certifications</h3>
          <div className="site-grid-auto-sm">
            {['MNRE Certified Installer', 'ISO 9001:2015', 'NABCEP Certified', 'Best Solar Company 2024'].map(item => (
              <div key={item} style={{ textAlign:'center', padding:'12px 8px' }}>
                <div style={{ fontSize:28, marginBottom:8, fontWeight:700, color:'var(--sun)' }}>AW</div>
                <div style={{ fontSize:13, fontWeight:500 }}>{item}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="site-grid-2">
          <div className="crm-card">
            <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700, marginBottom:12 }}>Why Customers Trust Us</h3>
            <div className="site-stack">
              {[
                'Clear project communication from enquiry to installation',
                'Experienced solar engineering and service team',
                'Reliable after-sales support and maintenance response',
                'Strong process visibility through our CRM platform',
              ].map(item => (
                <div key={item} style={{ fontSize:14, color:'var(--muted)', lineHeight:1.7 }}>{item}</div>
              ))}
            </div>
          </div>

          <EnquiryForm compact />
        </div>
      </div>
    </div>
  )
}

const SERVICES = [
  { icon:'RES', title:'Residential Solar', price:'From Rs 1.2 Lakh', desc:'Complete rooftop solar for homes including design, supply, installation and support.', features:['On-grid 1kW-10kW systems', 'Battery backup options', '25-year panel warranty', 'Annual maintenance included'] },
  { icon:'COM', title:'Commercial Solar', price:'From Rs 8 Lakh', desc:'High-capacity solar for commercial establishments and office buildings.', features:['10kW-500kW capacity', 'Custom financial modelling', 'Net metering support', 'Priority support'] },
  { icon:'IND', title:'Industrial Solar', price:'Custom Pricing', desc:'Large-scale solar farms and industrial rooftop solutions with monitoring.', features:['500kW-50MW projects', 'SCADA monitoring', 'Third-party O&M', 'Power purchase planning'] },
  { icon:'BAT', title:'Battery Storage', price:'From Rs 60,000', desc:'Advanced battery storage for reliable backup and better energy control.', features:['Lithium-ion batteries', '5kWh-100kWh capacity', 'Smart BMS system', '10-year warranty'] },
  { icon:'AMC', title:'Maintenance & AMC', price:'From Rs 3,000/yr', desc:'Annual maintenance contracts to keep systems healthy and efficient.', features:['Quarterly cleaning', 'Performance monitoring', 'Panel inspection', 'Inverter servicing'] },
  { icon:'CON', title:'Consulting', price:'Free Assessment', desc:'Expert solar consulting for homes, businesses, and institutions.', features:['Site assessment', 'ROI calculation', 'Technology recommendation', 'Regulatory guidance'] },
]

export function ServicesPage() {
  return (
    <div className="site-page">
      <div className="site-container site-section">
        <SectionTag>Our Services</SectionTag>
        <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'clamp(30px,4vw,48px)', fontWeight:800, marginBottom:8 }}>Complete Solar Solutions</h1>
        <p style={{ fontSize:15, color:'var(--muted)', marginBottom:40, maxWidth:560, lineHeight:1.7 }}>From residential rooftops to industrial solar farms, we deliver end-to-end solar energy solutions.</p>
        <div className="site-grid-auto">
          {SERVICES.map(service => (
            <div key={service.title} className="service-card">
              <div style={{ width:56, height:56, borderRadius:16, background:'linear-gradient(135deg,rgba(245,158,11,.15),rgba(249,115,22,.08))', border:'1px solid rgba(245,158,11,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, marginBottom:18 }}>{service.icon}</div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:10, flexWrap:'wrap' }}>
                <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:18, fontWeight:700 }}>{service.title}</h3>
                <span className="badge badge-sun">{service.price}</span>
              </div>
              <p style={{ fontSize:14, color:'var(--muted)', lineHeight:1.7, marginBottom:14 }}>{service.desc}</p>
              <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:6 }}>
                {service.features.map(feature => (
                  <li key={feature} style={{ fontSize:12, color:'var(--muted)', display:'flex', gap:6 }}>
                    <span style={{ color:'var(--green)' }}>OK</span> {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ContactPage() {
  return (
    <div className="site-page">
      <div className="site-container site-section">
        <SectionTag>Contact Us</SectionTag>
        <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'clamp(30px,4vw,48px)', fontWeight:800, marginBottom:8 }}>Get in Touch</h1>
        <p style={{ fontSize:15, color:'var(--muted)', marginBottom:40 }}>Our team is ready to help you go solar. Reach out today.</p>

        <div className="site-grid-2">
          <div>
            <EnquiryForm />
            <div className="crm-card" style={{ marginTop:20 }}>
              <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:700, marginBottom:16 }}>Contact Information</h3>
              {[
                ['Phone', '1800-XXX-XXXX (Toll Free)'],
                ['Email', 'info@solarproindia.com'],
                ['Head Office', 'Solar Tower, BKC, Mumbai - 400051'],
                ['Hours', 'Mon-Sat: 9AM - 6PM'],
              ].map(([label, value]) => (
                <div key={label} className="site-info-row" style={{ marginBottom:14 }}>
                  <div className="site-info-label">{label}</div>
                  <div style={{ fontSize:13, fontWeight:500 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, minHeight:280, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'var(--muted)', marginBottom:16, padding:'24px', textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:12, fontWeight:700 }}>MAP</div>
              <div style={{ fontWeight:600, marginBottom:6 }}>Interactive Map</div>
              <div style={{ fontSize:13 }}>Solar Tower, BKC, Mumbai</div>
              <div style={{ fontSize:12, marginTop:6, color:'var(--dim)' }}>Connect Google Maps API in production</div>
            </div>
            <div className="crm-card">
              <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:15, fontWeight:700, marginBottom:14 }}>Our Offices</h3>
              {['Mumbai (HQ)', 'Delhi', 'Bangalore', 'Pune', 'Hyderabad', 'Jaipur'].map(city => (
                <div key={city} style={{ display:'flex', gap:8, alignItems:'center', padding:'9px 0', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
                  <span style={{ fontSize:13, fontWeight:500 }}>{city}</span>
                  <span className="badge badge-green" style={{ marginLeft:'auto' }}>Open</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AboutPage
