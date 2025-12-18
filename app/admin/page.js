'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [agencies, setAgencies] = useState([])
  const [profiles, setProfiles] = useState([])
  const [creatorData, setCreatorData] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('agencies')
  const router = useRouter()

  const [newAgencyName, setNewAgencyName] = useState('')

  useEffect(() => {
    checkAdmin()
  }, [])

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }
    setUser(user)

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profileData || profileData.role !== 'admin') {
      router.push('/dashboard')
      return
    }

    setProfile(profileData)
    await fetchAll()
    setLoading(false)
  }

  const fetchAll = async () => {
    const { data: agencyList } = await supabase.from('agencies').select('*').order('name')
    setAgencies(agencyList || [])

    const { data: profileList } = await supabase.from('profiles').select('*, agencies(name)')
    setProfiles(profileList || [])

    const { data: dataList } = await supabase
      .from('creator_data')
      .select('period, agency_id, agencies(name)')
      .order('created_at', { ascending: false })
    
    const grouped = {}
    dataList?.forEach(d => {
      const key = `${d.period}-${d.agency_id}`
      if (!grouped[key]) {
        grouped[key] = { period: d.period, agency_id: d.agency_id, agency_name: d.agencies?.name, count: 0 }
      }
      grouped[key].count++
    })
    setCreatorData(Object.values(grouped))
  }

  const addAgency = async () => {
    if (!newAgencyName.trim()) return alert('에이전시 이름을 입력하세요')
    const { error } = await supabase.from('agencies').insert({ name: newAgencyName.trim() })
    if (error) alert('추가 실패: ' + error.message)
    else { setNewAgencyName(''); fetchAll() }
  }

  const deleteAgency = async (id, name) => {
    if (!confirm(`"${name}" 에이전시를 삭제하시겠습니까?\n\n⚠️ 관련 데이터도 모두 삭제됩니다!`)) return
    await supabase.from('creator_data').delete().eq('agency_id', id)
    await supabase.from('profiles').delete().eq('agency_id', id)
    const { error } = await supabase.from('agencies').delete().eq('id', id)
    if (error) alert('삭제 실패: ' + error.message)
    else fetchAll()
  }

  const updateUserAgency = async (userId, agencyId) => {
    const { error } = await supabase.from('profiles').update({ agency_id: agencyId || null }).eq('id', userId)
    if (error) alert('변경 실패: ' + error.message)
    else fetchAll()
  }

  const updateUserRole = async (userId, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
    if (error) alert('변경 실패: ' + error.message)
    else fetchAll()
  }

  const deleteUser = async (userId, email) => {
    if (!confirm(`"${email}" 사용자를 삭제하시겠습니까?`)) return
    const { error } = await supabase.from('profiles').delete().eq('id', userId)
    if (error) alert('삭제 실패: ' + error.message)
    else fetchAll()
  }

  const deleteData = async (period, agencyId, agencyName) => {
    if (!confirm(`"${agencyName} - ${period}" 데이터를 삭제하시겠습니까?`)) return
    const { error } = await supabase.from('creator_data').delete().eq('period', period).eq('agency_id', agencyId)
    if (error) alert('삭제 실패: ' + error.message)
    else fetchAll()
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="text-white">로딩 중...</div></div>
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur border-b border-slate-700/50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center text-xl">⚙️</div>
            <div>
              <h1 className="font-bold">관리자 페이지</h1>
              <p className="text-xs text-slate-400">{profile?.email}</p>
            </div>
          </div>
          <button onClick={() => router.push('/dashboard')} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm">← 대시보드</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-1 mb-6 bg-slate-800/50 p-1 rounded-xl w-fit">
          <button onClick={() => setTab('agencies')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'agencies' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>🏢 에이전시</button>
          <button onClick={() => setTab('users')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'users' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>👤 사용자</button>
          <button onClick={() => setTab('data')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'data' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>📊 데이터</button>
        </div>

        {tab === 'agencies' && (
          <div className="space-y-6">
            <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-6">
              <h3 className="font-semibold mb-4">➕ 새 에이전시 추가</h3>
              <div className="flex gap-3">
                <input type="text" value={newAgencyName} onChange={(e) => setNewAgencyName(e.target.value)} placeholder="에이전시 이름" className="flex-1 px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white" />
                <button onClick={addAgency} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-medium">추가</button>
              </div>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-700/30 font-semibold">🏢 에이전시 목록 ({agencies.length}개)</div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-700/30 text-slate-400"><th className="text-left px-4 py-3">이름</th><th className="text-right px-4 py-3">작업</th></tr></thead>
                <tbody>
                  {agencies.map(a => (
                    <tr key={a.id} className="border-b border-slate-700/20 hover:bg-slate-700/20">
                      <td className="px-4 py-3 font-medium">{a.name}</td>
                      <td className="px-4 py-3 text-right"><button onClick={() => deleteAgency(a.id, a.name)} className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-xs">삭제</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="space-y-6">
            <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-4">
              <p className="text-sm text-slate-400">💡 새 사용자는 <strong>Supabase → Authentication → Users</strong>에서 추가 후, 아래에서 에이전시와 역할을 지정하세요.</p>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-700/30 font-semibold">👤 사용자 목록 ({profiles.length}명)</div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-700/30 text-slate-400"><th className="text-left px-4 py-3">이메일</th><th className="text-left px-4 py-3">에이전시</th><th className="text-left px-4 py-3">역할</th><th className="text-right px-4 py-3">작업</th></tr></thead>
                <tbody>
                  {profiles.map(p => (
                    <tr key={p.id} className="border-b border-slate-700/20 hover:bg-slate-700/20">
                      <td className="px-4 py-3 font-medium">{p.email}</td>
                      <td className="px-4 py-3">
                        <select value={p.agency_id || ''} onChange={(e) => updateUserAgency(p.id, e.target.value)} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm">
                          <option value="">미지정</option>
                          {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select value={p.role || 'user'} onChange={(e) => updateUserRole(p.id, e.target.value)} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm">
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right"><button onClick={() => deleteUser(p.id, p.email)} className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-xs">삭제</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'data' && (
          <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-700/30 font-semibold">📊 업로드된 데이터 ({creatorData.length}개)</div>
            {creatorData.length === 0 ? <div className="p-8 text-center text-slate-400">업로드된 데이터가 없습니다</div> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-700/30 text-slate-400"><th className="text-left px-4 py-3">기간</th><th className="text-left px-4 py-3">에이전시</th><th className="text-right px-4 py-3">데이터 수</th><th className="text-right px-4 py-3">작업</th></tr></thead>
                <tbody>
                  {creatorData.map((d, i) => (
                    <tr key={i} className="border-b border-slate-700/20 hover:bg-slate-700/20">
                      <td className="px-4 py-3 font-medium">{d.period}</td>
                      <td className="px-4 py-3">{d.agency_name}</td>
                      <td className="px-4 py-3 text-right">{d.count}개</td>
                      <td className="px-4 py-3 text-right"><button onClick={() => deleteData(d.period, d.agency_id, d.agency_name)} className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-xs">삭제</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
