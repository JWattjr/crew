import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import NewCrew from '@/pages/NewCrew'
import CrewDashboard from '@/pages/CrewDashboard'
import PayPage from '@/pages/PayPage'
import MyCrews from '@/pages/MyCrews'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public pay page — no nav chrome needed */}
        <Route path="/pay/:address" element={<Layout><PayPage /></Layout>} />
        {/* Main app */}
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/new" element={<Layout><NewCrew /></Layout>} />
        <Route path="/crew/:address" element={<Layout><CrewDashboard /></Layout>} />
        <Route path="/crews" element={<Layout><MyCrews /></Layout>} />
        <Route path="*" element={<Layout><Home /></Layout>} />
      </Routes>
    </BrowserRouter>
  )
}
