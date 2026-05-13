import { Link } from 'react-router-dom'
import mahaveerSolarLogo from '../../assets/mahaveer-solar-logo.svg'

const footerColumns = [
  { heading: 'Solutions', links: ['Residential Solar', 'Commercial Solar', 'Industrial Solar', 'Battery Storage'] },
  { heading: 'Company', links: ['About Us', 'Our Team', 'Careers', 'Press'] },
  { heading: 'Support', links: ['Contact Us', 'FAQ', 'Warranty', 'Documentation'] },
]

const offices = [
  'Ratlam (HQ)',
  'Mandsaur',
  'Dewas',
  'Jhabua',
  'Barnagar',
  'Nagda',
  'Badnawar',
  'Dhar',
  'Piploda',
]

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-container">
        <div className="site-footer-grid">
          <div>
            <Link to="/" className="site-footer-brand">
              <img src={mahaveerSolarLogo} alt="Mahavir Solar" />
              <span>Mahaveer Multi Engineering</span>
            </Link>
            <p className="site-footer-copy">
              Trusted solar energy solutions provider making clean energy accessible across India.
            </p>
          </div>

          {footerColumns.map((column) => (
            <div key={column.heading}>
              <h4 className="site-footer-heading">{column.heading}</h4>
              <ul className="site-footer-list">
                {column.links.map((link) => (
                  <li key={link}>{link}</li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="site-footer-heading">Offices</h4>
            <ul className="site-footer-list">
              {offices.map((office) => (
                <li key={office}>{office}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="site-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Mahaveer Multi Engineering Pvt. Ltd. All rights reserved.</span>
          <span>Powered by clean energy</span>
        </div>
      </div>
    </footer>
  )
}
