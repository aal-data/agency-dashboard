'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [agencies, setAgencies] = useState([])
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('all')
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [tab, setTab] = useState('overview')
  const [uploadModal, setUploadModal] = useState(false)
  const [uploadPeriod, setUploadPeriod] = useState('')
  const [uploadAgency, setUploadAgency] = useState('')
  const router = useRouter()

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }
    setUser(user)

    // 프로필 가져오기
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*, agencies(*)')
      .eq('id', user.id)
      .single()

    setProfile(profileData)

    // 에이전시 목록
    const { data: agencyList } = await supabase.from('agencies').select('*')
    setAgencies(agencyList || [])

    // 데이터 가져오기
    await fetchData()
    setLoading(false)
  }

  const fetchData = async () => {
    const { data: creatorData } = await supabase
      .from('creator_data')
      .select('*, agencies(name)')
      .order('diamonds', { ascending: false })

    setData(creatorData || [])
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      const bstr = evt.target.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const wsname = wb.SheetNames[0]
      const ws = wb.Sheets[wsname]
      const jsonData = XLSX.utils.sheet_to_json(ws)

      // 데이터 변환 및 저장
      const rows = jsonData.map(row => ({
        period: uploadPeriod,
        agency_id: uploadAgency,
        creator_id: row['크리에이터 ID']?.toString() || '',
        creator_username: row['크리에이터 아이디'] || '',
        group_name: row['그룹'] || '',
        agent: row['에이전트'] || '',
        days_joined: parseInt(row['가입 일수']) || 0,
        diamonds: parseInt(row['다이아몬드']) || 0,
        last_month_diamonds: parseInt(row['지난달 다이아몬드']) || 0,
        new_followers: parseInt(row['새 팔로워 수']) || 0,
        live_hours: row['라이브 진행 시간'] || '',
        live_days: parseInt(row['유효 라이브 진행 일수']) || 0,
      }))

      const { error } = await supabase.from('creator_data').insert(rows)

      if (error) {
        alert('업로드 실패: ' + error.message)
      } else {
        alert(`${rows.length}개 데이터 업로드 완료!`)
        setUploadModal(false)
        fetchData()
      }
    }
    reader.readAsBinaryString(file)
  }

  const fmt = (n) => {
    if (!n) return '0'
    if (n >= 100000000) return (n/100000000).toFixed(1) + '억'
    if (n >= 10000) return (n/10000).toFixed(1) + '만'
    return n.toLocaleString()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">로딩 중...</div>
      </div>
    )
  }

  // 필터링
  const filteredData = data.filter(r => {
    if (selectedPeriod !== 'all' && r.period !== selectedPeriod) return false
    if (selectedGroup !== 'all' && r.group_name !== selectedGroup) return false
    return true
  })

  const periods = ['all', ...new Set(data.map(r => r.period).filter(Boolean))]
  const groups = ['all', ...new Set(data.map(r => r.group_name).filter(Boolean))]

  // 통계
  const stats = {
    totalDiamonds: filteredData.reduce((s, r) => s + (r.diamonds || 0), 0),
    totalCreators: filteredData.length,
    totalFollowers: filteredData.reduce((s, r) => s + (r.new_followers || 0), 0),
    newCreators: filteredData.filter(r => r.days_joined <= 30).length,
  }

  // 그룹별 집계
  const groupStats = groups.slice(1).map(g => {
    const rows = filteredData.filter(r => r.group_name === g)
    return {
      name: g,
      diamonds: rows.reduce((s, r) => s + (r.diamonds || 0), 0),
      count: rows.length,
    }
  }).sort((a, b) => b.diamonds - a.diamonds)

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-xl">💎</div>
            <div>
              <h1 className="font-bold">{profile?.agencies?.name || '대시보드'}</h1>
              <p className="text-xs text-slate-400">{profile?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => setUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium"
              >
                📤 데이터 업로드
              </button>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl text-sm"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 업로드 모달 */}
      {uploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">📤 데이터 업로드</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">기간 구분</label>
                <input
                  type="text"
                  value={uploadPeriod}
                  onChange={(e) => setUploadPeriod(e.target.value)}
                  placeholder="예: 12월1주, 11월"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">에이전시</label>
                <select
                  value={uploadAgency}
                  onChange={(e) => setUploadAgency(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white"
                >
                  <option value="">선택하세요</option>
                  {agencies.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">엑셀 파일</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white"
                />
              </div>
              <button
                onClick={() => setUploadModal(false)}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 메인 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 필터 */}
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-slate-800/40 rounded-2xl border border-slate-700/30">
          <span className="text-slate-400 text-sm">📆 기간:</span>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm"
          >
            <option value="all">전체</option>
            {periods.slice(1).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <span className="text-slate-600">|</span>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm"
          >
            <option value="all">전체 그룹</option>
            {groups.slice(1).map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-indigo-600/20 to-indigo-900/20 border border-indigo-500/30 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2 text-slate-400 text-sm">💎 총 다이아몬드</div>
            <div className="text-2xl font-bold">{fmt(stats.totalDiamonds)}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-600/20 to-purple-900/20 border border-purple-500/30 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2 text-slate-400 text-sm">👥 크리에이터</div>
            <div className="text-2xl font-bold">{stats.totalCreators}명</div>
          </div>
          <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-900/20 border border-emerald-500/30 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2 text-slate-400 text-sm">🆕 신규</div>
            <div className="text-2xl font-bold">{stats.newCreators}명</div>
          </div>
          <div className="bg-gradient-to-br from-amber-600/20 to-amber-900/20 border border-amber-500/30 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2 text-slate-400 text-sm">➕ 팔로워</div>
            <div className="text-2xl font-bold">{fmt(stats.totalFollowers)}</div>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 mb-4 bg-slate-800/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setTab('overview')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'overview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            📊 그룹별 현황
          </button>
          <button
            onClick={() => setTab('creators')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'creators' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            👤 크리에이터
          </button>
        </div>

        {/* 그룹별 현황 */}
        {tab === 'overview' && (
          <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-700/30 font-semibold">📋 그룹별 현황</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/30 text-slate-400">
                  <th className="text-left px-4 py-3">그룹</th>
                  <th className="text-right px-4 py-3">다이아몬드</th>
                  <th className="text-right px-4 py-3">크리에이터</th>
                </tr>
              </thead>
              <tbody>
                {groupStats.map(g => (
                  <tr key={g.name} className="border-b border-slate-700/20 hover:bg-slate-700/20">
                    <td className="px-4 py-3 font-medium">{g.name}</td>
                    <td className="px-4 py-3 text-right">{fmt(g.diamonds)}</td>
                    <td className="px-4 py-3 text-right">{g.count}명</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 크리에이터 목록 */}
        {tab === 'creators' && (
          <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-700/30 font-semibold">👤 크리에이터 목록</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/30 text-slate-400">
                    <th className="text-left px-4 py-3">크리에이터</th>
                    <th className="text-left px-4 py-3">그룹</th>
                    <th className="text-right px-4 py-3">다이아몬드</th>
                    <th className="text-right px-4 py-3">팔로워</th>
                    <th className="text-center px-4 py-3">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-b border-slate-700/20 hover:bg-slate-700/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.creator_username}</div>
                        <div className="text-xs text-slate-500">{r.agent}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{r.group_name}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmt(r.diamonds)}</td>
                      <td className="px-4 py-3 text-right text-slate-400">+{fmt(r.new_followers)}</td>
                      <td className="px-4 py-3 text-center">
                        {r.days_joined <= 30 && (
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">NEW</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
