import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaBatteryFull, FaBolt, FaChevronDown, FaClock, FaIndustry, FaLeaf, FaLightbulb, FaSearch, FaShieldAlt, FaSolarPanel, FaTools, FaWater } from 'react-icons/fa'
import { SectionTag } from '../../components/common'

const categories = [
  {
    title: 'Solar Panels',
    desc: 'High-efficiency mono and bifacial panels for homes, businesses, and industrial rooftops.',
    image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=900&q=80',
    icon: <FaSolarPanel />,
  },
  {
    title: 'Solar Inverters',
    desc: 'Reliable on-grid and hybrid inverters with smart monitoring and strong conversion efficiency.',
    image: 'https://images.unsplash.com/photo-1624397640148-949b1732bb0a?auto=format&fit=crop&w=900&q=80',
    icon: <FaBolt />,
  },
  {
    title: 'Solar Batteries',
    desc: 'Long-life backup storage for homes and business continuity during power cuts.',
    image: 'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=900&q=80',
    icon: <FaBatteryFull />,
  },
  {
    title: 'Solar Water Heaters',
    desc: 'Low-maintenance hot water systems for residences, hotels, hostels, and institutions.',
    image: 'https://images.unsplash.com/photo-1613665813446-82a78c468a1d?auto=format&fit=crop&w=900&q=80',
    icon: <FaWater />,
  },
  {
    title: 'Solar Street Lights',
    desc: 'Automatic dusk-to-dawn solar lighting for campuses, streets, farms, and societies.',
    image: 'https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&w=900&q=80',
    icon: <FaLightbulb />,
  },
  {
    title: 'Rooftop Solar Systems',
    desc: 'Complete engineered rooftop systems with design, installation, net metering, and support.',
    image: 'https://images.unsplash.com/photo-1613665813446-82a78c468a1d?auto=format&fit=crop&w=900&q=80',
    icon: <FaLeaf />,
  },
]

const products = [
  { name: 'Mono PERC Solar Panel', capacity: '540W', warranty: '25 Years', type: 'Residential', price: 'Starting From Rs. 13,500', image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=900&q=80', features: ['High module efficiency', 'PID resistant', 'Strong low-light output'] },
  { name: 'TOPCon Bifacial Panel', capacity: '575W', warranty: '30 Years', type: 'Commercial', price: 'Starting From Rs. 16,800', image: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=900&q=80', features: ['Dual-side generation', 'Premium degradation rate', 'Great for large roofs'] },
  { name: 'On-Grid Solar Inverter', capacity: '5kW', warranty: '10 Years', type: 'Residential', price: 'Starting From Rs. 42,000', image: 'https://images.unsplash.com/photo-1624397640148-949b1732bb0a?auto=format&fit=crop&w=900&q=80', features: ['Wi-Fi monitoring', 'High conversion efficiency', 'Compact wall mount'] },
  { name: 'Hybrid Solar Inverter', capacity: '10kW', warranty: '10 Years', type: 'Commercial', price: 'Starting From Rs. 1,15,000', image: 'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=900&q=80', features: ['Battery-ready', 'Backup priority modes', 'Smart load control'] },
  { name: 'Lithium Solar Battery', capacity: '5kWh', warranty: '8 Years', type: 'Residential', price: 'Starting From Rs. 85,000', image: 'https://images.unsplash.com/photo-1568399672948-9cf1fcd1b9ab?auto=format&fit=crop&w=900&q=80', features: ['Long cycle life', 'Built-in BMS', 'Fast charging'] },
  { name: 'Industrial Rooftop Kit', capacity: '50kW+', warranty: '25 Years', type: 'Industrial', price: 'Custom Pricing', image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=900&q=80', features: ['Engineered structure', 'Generation monitoring', 'Net metering support'] },
]

const features = [
  { icon: <FaBolt />, title: 'High Efficiency', desc: 'Premium components selected for reliable generation in Indian weather.' },
  { icon: <FaShieldAlt />, title: '25 Year Warranty', desc: 'Long-term panel warranty and dependable brand-backed equipment.' },
  { icon: <FaLeaf />, title: 'Government Subsidy Support', desc: 'Guidance for eligible residential subsidy and documentation flow.' },
  { icon: <FaTools />, title: 'Low Maintenance', desc: 'Simple upkeep with professional AMC and performance inspection options.' },
  { icon: <FaClock />, title: 'Fast Installation', desc: 'Structured project planning keeps installation clean, quick, and visible.' },
  { icon: <FaIndustry />, title: 'Trusted Service', desc: 'Experienced engineering team with service support after handover.' },
]

const faqs = [
  ['Which solar product is best for my home?', 'For most homes, an on-grid rooftop solar system with high-efficiency panels is the best starting point. Battery backup can be added where power cuts are frequent.'],
  ['How long do solar panels last?', 'Quality solar panels typically carry a 25-year performance warranty and continue generating power beyond that with gradual efficiency reduction.'],
  ['Do you help with subsidy and net metering?', 'Yes. Our team supports eligible subsidy guidance, documentation, net metering coordination, and stage-wise project updates.'],
  ['Can commercial and industrial sites get custom systems?', 'Yes. We design commercial and industrial systems based on roof space, connected load, monthly consumption, and return-on-investment targets.'],
]

const filters = ['All', 'Residential', 'Commercial', 'Industrial']

function ProductCategoryCard({ item }) {
  return (
    <div className="products-category-card">
      <img src={item.image} alt={item.title} loading="lazy" />
      <div className="products-category-content">
        <div className="products-icon-chip">{item.icon}</div>
        <h3>{item.title}</h3>
        <p>{item.desc}</p>
        <button className="btn btn-ghost btn-sm">View Details</button>
      </div>
    </div>
  )
}

function ProductCard({ item, onEnquire }) {
  return (
    <div className="products-card">
      <img src={item.image} alt={item.name} loading="lazy" />
      <div className="products-card-body">
        <span className="badge badge-sun">{item.type}</span>
        <h3>{item.name}</h3>
        <div className="products-spec-row">
          <span>{item.capacity}</span>
          <span>{item.warranty}</span>
        </div>
        <ul>
          {item.features.map(feature => <li key={feature}>{feature}</li>)}
        </ul>
        <div className="products-card-footer">
          <strong>{item.price}</strong>
          <button className="btn btn-primary btn-sm" onClick={onEnquire}>Enquire Now</button>
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ item }) {
  return (
    <div className="service-card products-feature-card">
      <div className="products-icon-chip">{item.icon}</div>
      <h3>{item.title}</h3>
      <p>{item.desc}</p>
    </div>
  )
}

function FaqItem({ item, open, onToggle }) {
  return (
    <button className={`products-faq-item ${open ? 'open' : ''}`} onClick={onToggle}>
      <span>
        <strong>{item[0]}</strong>
        {open && <small>{item[1]}</small>}
      </span>
      <FaChevronDown />
    </button>
  )
}

export default function ProductsPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [openFaq, setOpenFaq] = useState(0)

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase()
    return products.filter(product => {
      const matchesFilter = filter === 'All' || product.type === filter
      const matchesSearch = !term || [product.name, product.capacity, product.type, ...product.features].join(' ').toLowerCase().includes(term)
      return matchesFilter && matchesSearch
    })
  }, [filter, query])

  return (
    <div className="site-page products-page">
      <section className="products-hero">
        <img src="https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1800&q=80" alt="Solar products installed on a rooftop" />
        <div className="products-hero-overlay" />
        <div className="site-container products-hero-content">
          <SectionTag>Solar Products</SectionTag>
          <h1>Our Solar Products</h1>
          <p>Smart solar solutions for homes, commercial rooftops, and industrial energy needs, backed by trusted equipment and installation support.</p>
          <button className="btn btn-primary" onClick={() => navigate('/contact')}>Get Free Quote</button>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <div className="products-section-head">
            <SectionTag>Categories</SectionTag>
            <h2>Explore Solar Product Categories</h2>
          </div>
          <div className="site-grid-auto">
            {categories.map(item => <ProductCategoryCard key={item.title} item={item} />)}
          </div>
        </div>
      </section>

      <section className="site-section products-muted-section">
        <div className="site-container">
          <div className="products-section-head">
            <SectionTag>Featured Products</SectionTag>
            <h2>Popular Systems And Components</h2>
          </div>
          <div className="products-filter-bar">
            <div className="products-search">
              <FaSearch />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products, capacity, features..." />
            </div>
            <div className="products-tabs">
              {filters.map(item => (
                <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>
              ))}
            </div>
          </div>
          <div className="site-grid-auto">
            {visibleProducts.map(item => <ProductCard key={item.name} item={item} onEnquire={() => navigate('/contact')} />)}
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <div className="products-section-head">
            <SectionTag>Why Choose Us</SectionTag>
            <h2>Products Selected For Long-Term Performance</h2>
          </div>
          <div className="site-grid-auto-sm">
            {features.map(item => <FeatureCard key={item.title} item={item} />)}
          </div>
        </div>
      </section>

      <section className="site-section products-muted-section">
        <div className="site-container site-grid-2">
          <div>
            <SectionTag>FAQ</SectionTag>
            <h2 className="products-side-heading">Solar Product Questions</h2>
            <p className="products-side-copy">Answers to the common questions customers ask before selecting their solar products.</p>
          </div>
          <div className="products-faq-list">
            {faqs.map((item, index) => (
              <FaqItem key={item[0]} item={item} open={openFaq === index} onToggle={() => setOpenFaq(openFaq === index ? -1 : index)} />
            ))}
          </div>
        </div>
      </section>

      <section className="site-section products-final-cta">
        <div className="site-container">
          <h2>Ready to Switch to Solar?</h2>
          <p>Talk to our team and get a practical solar recommendation for your site.</p>
          <div>
            <button className="btn btn-primary" onClick={() => navigate('/contact')}>Contact Us</button>
            <button className="btn btn-ghost" onClick={() => navigate('/contact')}>Book Consultation</button>
          </div>
        </div>
      </section>
    </div>
  )
}
