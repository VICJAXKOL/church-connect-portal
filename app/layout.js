import '../src/index.css'
import '../src/App.css'

export const metadata = {
  title: 'Church Connect Portal',
  description: 'Glory Center Community Church member portal',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
