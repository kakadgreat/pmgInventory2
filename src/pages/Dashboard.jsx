import React from 'react'
import Card from '../ui/Card.jsx'
import { Link } from 'react-router-dom'
export default function Dashboard({ data }){
  if(!data) return <div>Loading...</div>
  return (<div className='space-y-4'>
    <div className='grid md:grid-cols-4 gap-4'>
      <Card title='Quick Links'><ul className='list-disc ml-5'><li><Link className='underline' to='/phone'>Phone Directory</Link></li><li><Link className='underline' to='/facilities'>Facilities Rolodex</Link></li><li><Link className='underline' to='/offices'>Locations</Link></li></ul></Card>
      <Card title='Staff Tools'><ul className='list-disc ml-5'><li><a className='underline' href='https://www.prestigemedicalgroup.org/locations' target='_blank' rel='noreferrer'>PMG Locations (public)</a></li><li><a className='underline' href='https://www.prestigemedspa.org/resources/events-specials' target='_blank' rel='noreferrer'>MedSpa Events (public)</a></li></ul></Card>
      <Card title='Directory Editor'><div><Link className='underline' to='/phone/edit'>Add/Remove Entries</Link></div></Card>
      <Card title='Contact IT'><div>Inacomp — 770-255-1022</div><div>Epic Help Desk — 404-605-3000</div></Card>
    </div>
  </div>)
}