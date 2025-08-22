import React from 'react'
import Card from '../ui/Card.jsx'
const DEPT_ORDER = ['Providers','MA','Front Desk','Spa']
const scoreDept = (d) => { const i = DEPT_ORDER.indexOf(d||''); return i >= 0 ? i : 99 }
function sortBy(col, asc){ return (a,b)=> (''+(a[col]??'')).localeCompare((''+(b[col]??'')), undefined, {numeric:true,sensitivity:'base'}) * (asc?1:-1) }
export default function PhoneDirectory({ data, query }){
  if(!data) return <div>Loading...</div>
  const all = data.phone.items || []
  const [selLoc, setSelLoc] = React.useState(new Set())
  const [selDept, setSelDept] = React.useState(new Set())
  const [sort, setSort] = React.useState({col:null, asc:true})
  const [localQ, setLocalQ] = React.useState('')
  const globalQ = (query||'').toLowerCase()
  const q = (localQ || globalQ).toLowerCase()
  const toggle = (set, value) => { const next=new Set(set); next.has(value)?next.delete(value):next.add(value); return next }
  const locations = Array.from(new Set(all.map(r=>r.location).filter(Boolean))).sort()
  const depts = Array.from(new Set(all.map(r=>r.dept).filter(Boolean))).sort((a,b)=> scoreDept(a)-scoreDept(b) || a.localeCompare(b))
  let items = all
  if(selLoc.size>0) items = items.filter(r=>selLoc.has(r.location))
  if(selDept.size>0) items = items.filter(r=>selDept.has(r.dept))
  if(q) items = items.filter(r => [r.name, r.ext, r.location, r.dept].join(' ').toLowerCase().includes(q))
  items = [...items].sort((a,b)=> scoreDept(a.dept)-scoreDept(b.dept) || (a.name||'').localeCompare(b.name||''))
  if(sort.col){ items = items.sort(sortBy(sort.col, sort.asc)) }
  const Pill = ({label, active, onClick}) => <button onClick={onClick} className={`pill ${active?'on':'off'}`}>{label}</button>
  const header = (label, col) => <th onClick={()=>setSort({col, asc: sort.col===col ? !sort.asc : true})} className='px-3 py-2 cursor-pointer text-left select-none'>{label}{sort.col===col ? (sort.asc ? ' ▲' : ' ▼') : ''}</th>
  return (<div className='space-y-4'>
    <Card title='Filters'>
      <div className='flex flex-wrap gap-2 items-center'>
        <div className='font-semibold mr-2'>Location:</div>
        {locations.map(v=> <Pill key={v} label={v} active={selLoc.has(v)} onClick={()=>setSelLoc(toggle(selLoc,v))}/>)}
      </div>
      <div className='flex flex-wrap gap-2 items-center mt-3'>
        <div className='font-semibold mr-2'>Dept:</div>
        {depts.map(v=> <Pill key={v} label={v} active={selDept.has(v)} onClick={()=>setSelDept(toggle(selDept,v))}/>)}
      </div>
      <div className='mt-3'>
        <input className='border rounded-xl px-3 py-2 w-full sm:w-80' placeholder='Quick search (name, ext, dept, location)' value={localQ} onChange={e=>setLocalQ(e.target.value)} />
      </div>
    </Card>
    <div className='overflow-auto rounded-xl border bg-white table-zebra'>
      <table className='w-full text-sm'>
        <thead className='bg-gray-50 border-b'>
          <tr>{header('Name','name')}{header('Ext','ext')}{header('Location','location')}{header('Dept','dept')}</tr>
        </thead>
        <tbody>
          {items.map((r,i)=>(
            <tr key={i} className='border-b last:border-0'>
              <td className='px-3 py-2'>{r.name}</td>
              <td className='px-3 py-2'>{r.ext}</td>
              <td className='px-3 py-2'>{r.location}</td>
              <td className='px-3 py-2'>{r.dept}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>)
}