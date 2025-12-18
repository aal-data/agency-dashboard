import './globals.css'

export const metadata = {
  title: 'Agency Dashboard',
  description: '에이전시 크리에이터 데이터 대시보드',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
