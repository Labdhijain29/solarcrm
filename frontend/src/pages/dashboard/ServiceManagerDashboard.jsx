import { useEffect, useMemo, useState } from 'react'
import { FaBolt, FaCheckCircle, FaExclamationTriangle, FaSolarPanel, FaTools } from 'react-icons/fa'
import { EmptyState, MetricCard, PageHeader, Spinner } from '../../components/common'
import { enquiriesAPI, leadsAPI } from '../../services/api'

const SERVICE_TYPES = ['Panel Cleaning', 'Inverter Check', 'Wiring Inspection', 'Generation Drop', 'Net Meter Issue']
const PRIORITIES = ['High', 'Medium', 'Low']
const STATUSES = ['Open', 'Scheduled', 'In Progress', 'Resolved']

const getTicketMeta = (lead, index) => ({
  type: SERVICE_TYPES[index % SERVICE_TYPES.length],
  priority: PRIORITIES[index % PRIORITIES.length],
  status: STATUSES[index % STATUSES.length],
  technician: ['Ramesh', 'Aman', 'Iqbal', 'Karan'][index % 4],
  due: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN'),
  systemAge: `${(index % 5) + 1} yr`,
  generation: `${Math.max(72, 98 - index * 3)}%`,
  site: `${lead.capacity || '3kW'} ${lead.roofType || 'Rooftop'} System`,
})

export default function ServiceManagerDashboard() {
  const [leads, setLeads] = useState([])
  const [enquiries, setEnquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([leadsAPI.getAll(), enquiriesAPI.getAll()])
      .then(([leadsRes, enquiriesRes]) => {
        setLeads(leadsRes.data.data || [])
        setEnquiries(enquiriesRes.data.data || [])
      })
      .catch(err => {
        console.error(err)
        setError(err.response?.data?.message || 'Could not load service data')
      })
      .finally(() => setLoading(false))
  }, [])

  const serviceEnquiries = useMemo(
    () => enquiries.filter(enquiry => enquiry.enquiryType === 'Service Enquiry'),
    [enquiries]
  )

  const installedSystems = useMemo(() => {
    const serviceReady = leads.filter(lead => ['Installation', 'Net Metering', 'Subsidy', 'Completed'].includes(lead.currentStage))
    return serviceReady.length ? serviceReady : leads.slice(0, 8)
  }, [leads])

  const tickets = useMemo(() => (
    installedSystems.slice(0, 8).map((lead, index) => ({
      ...lead,
      service: getTicketMeta(lead, index),
    }))
  ), [installedSystems])

  const highPriority = tickets.filter(ticket => ticket.service.priority === 'High').length
  const scheduled = tickets.filter(ticket => ticket.service.status === 'Scheduled').length
  const resolved = tickets.filter(ticket => ticket.service.status === 'Resolved').length
  const completedLeads = leads.filter((lead) => lead.status === 'completed').length

  return (
    <div className="dashboard-page">
      <PageHeader
        icon={<FaTools />}
        title="Service Manager Dashboard"
        subtitle="Service enquiries plus solar maintenance, visit scheduling, and system health"
      />

      <div className="dashboard-grid-metrics">
        <MetricCard icon={<FaTools />} label="Service Enquiries" value={serviceEnquiries.length} changeColor="var(--sun)" />
        <MetricCard icon={<FaCheckCircle />} label="Completed Leads" value={completedLeads} changeColor="var(--green)" />
        <MetricCard icon={<FaExclamationTriangle />} label="High Priority" value={highPriority} changeColor="var(--red)" />
        <MetricCard icon={<FaSolarPanel />} label="Scheduled Visits" value={scheduled} changeColor="var(--blue)" />
        <MetricCard icon={<FaCheckCircle />} label="Resolved" value={resolved} changeColor="var(--green)" />
      </div>

      {error && (
        <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.2)', borderRadius:8, padding:'10px 12px', fontSize:13, color:'var(--red)', marginBottom:16 }}>
          {error}
        </div>
      )}

      <div className="crm-card" style={{ marginBottom:16 }}>
        <h3 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Service Enquiries</h3>
        {loading ? <Spinner /> : serviceEnquiries.length === 0 ? (
          <EmptyState icon={<FaTools />} title="No service enquiries" subtitle="New website service requests will appear here automatically." />
        ) : (
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>{['Customer', 'Contact', 'Email', 'Address', 'State', 'City', 'Pincode', 'Status'].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {serviceEnquiries.map(enquiry => (
                  <tr key={enquiry._id}>
                    <td style={{ fontWeight:600 }}>{enquiry.name}</td>
                    <td style={{ fontSize:12 }}>{enquiry.contact || enquiry.phone || '-'}</td>
                    <td style={{ fontSize:12 }}>{enquiry.email || '-'}</td>
                    <td style={{ fontSize:12, maxWidth:200, whiteSpace:'normal' }}>{enquiry.address || '-'}</td>
                    <td style={{ fontSize:12 }}>{enquiry.state || '-'}</td>
                    <td style={{ fontSize:12 }}>{enquiry.city || '-'}</td>
                    <td style={{ fontSize:12 }}>{enquiry.pincode || '-'}</td>
                    <td><span className={`badge ${enquiry.status === 'new' ? 'badge-sun' : enquiry.status === 'contacted' ? 'badge-blue' : enquiry.status === 'closed' ? 'badge-gray' : 'badge-green'}`}>{enquiry.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="crm-mobile-cards">
              {serviceEnquiries.map(enquiry => (
                <div key={enquiry._id} className="crm-mobile-card">
                  <div className="dashboard-split-row" style={{ marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600 }}>{enquiry.name}</div>
                      <div style={{ fontSize:12, color:'var(--muted)' }}>{enquiry.contact || enquiry.phone || '-'}</div>
                    </div>
                    <span className={`badge ${enquiry.status === 'new' ? 'badge-sun' : enquiry.status === 'contacted' ? 'badge-blue' : enquiry.status === 'closed' ? 'badge-gray' : 'badge-green'}`}>{enquiry.status}</span>
                  </div>
                  {[
                    ['Email', enquiry.email || '-'],
                    ['State', enquiry.state || '-'],
                    ['City', enquiry.city || '-'],
                    ['Pincode', enquiry.pincode || '-'],
                  ].map(([label, value]) => (
                    <div key={label} className="crm-mobile-row">
                      <span className="crm-mobile-label">{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                  <div style={{ paddingTop:8, fontSize:12, color:'var(--muted)' }}>{enquiry.address || '-'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-grid-sidebar" style={{ marginBottom:16 }}>
        <div className="crm-card">
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Service Tickets</h3>
          {loading ? <Spinner /> : tickets.length === 0 ? (
            <EmptyState icon={<FaTools />} title="No service tickets" subtitle="Installed solar systems will appear here for service tracking" />
          ) : (
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>{['Customer', 'System', 'Issue', 'Priority', 'Status', 'Technician', 'Due Date'].map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {tickets.map(ticket => (
                    <tr key={ticket._id}>
                      <td>
                        <div style={{ fontWeight:600 }}>{ticket.name}</div>
                        <div style={{ fontSize:11, color:'var(--muted)' }}>{ticket.city || 'Site'} | {ticket.phone}</div>
                      </td>
                      <td style={{ fontSize:12 }}>{ticket.service.site}</td>
                      <td style={{ fontSize:12 }}>{ticket.service.type}</td>
                      <td><span className={`badge ${ticket.service.priority === 'High' ? 'badge-red' : ticket.service.priority === 'Medium' ? 'badge-sun' : 'badge-green'}`}>{ticket.service.priority}</span></td>
                      <td><span className="badge badge-indigo">{ticket.service.status}</span></td>
                      <td style={{ fontSize:12 }}>{ticket.service.technician}</td>
                      <td style={{ fontSize:12, color:'var(--muted)' }}>{ticket.service.due}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="crm-mobile-cards">
                {tickets.map(ticket => (
                  <div key={ticket._id} className="crm-mobile-card">
                    <div className="dashboard-split-row" style={{ marginBottom:10 }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:600 }}>{ticket.name}</div>
                        <div style={{ fontSize:12, color:'var(--muted)' }}>{ticket.city || 'Site'} | {ticket.phone}</div>
                      </div>
                      <span className="badge badge-indigo">{ticket.service.status}</span>
                    </div>
                    {[
                      ['System', ticket.service.site],
                      ['Issue', ticket.service.type],
                      ['Priority', ticket.service.priority],
                      ['Technician', ticket.service.technician],
                      ['Due', ticket.service.due],
                    ].map(([label, value]) => (
                      <div key={label} className="crm-mobile-row">
                        <span className="crm-mobile-label">{label}</span>
                        <span>{value}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="crm-card">
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Service Requirements</h3>
          {[
            ['Panel cleaning', 'Dust loss check and cleaning schedule'],
            ['Inverter health', 'Fault code, generation, and warranty check'],
            ['AC/DC wiring', 'Loose joint, earthing, MCB, SPD inspection'],
            ['Net meter support', 'Export reading and meter complaint follow-up'],
            ['Customer visit', 'Technician assignment and completion photo'],
          ].map(([title, subtitle]) => (
            <div key={title} style={{ padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:13, fontWeight:700 }}>{title}</div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>{subtitle}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="crm-card">
        <h3 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Installed System Health</h3>
        {loading ? <Spinner /> : tickets.length === 0 ? (
          <EmptyState icon={<FaBolt />} title="No installed systems" subtitle="Completed or installation-stage customers will be tracked here" />
        ) : (
          <div className="dashboard-grid-cards">
            {tickets.slice(0, 6).map(ticket => (
              <div key={ticket._id} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:10, marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700 }}>{ticket.name}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>{ticket.city || 'Service Site'}</div>
                  </div>
                  <span className="badge badge-green">{ticket.service.generation}</span>
                </div>
                <div style={{ fontSize:12, color:'var(--muted)', marginBottom:8 }}>{ticket.service.site}</div>
                <div className="dashboard-mini-grid-2" style={{ fontSize:12 }}>
                  <div>
                    <div style={{ color:'var(--muted)' }}>System Age</div>
                    <div style={{ fontWeight:700 }}>{ticket.service.systemAge}</div>
                  </div>
                  <div>
                    <div style={{ color:'var(--muted)' }}>Next Check</div>
                    <div style={{ fontWeight:700 }}>{ticket.service.due}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
