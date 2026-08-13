import { Toaster } from "sonner";

export const metadata = {
  title: 'SKYNET  Parcel Allocation System',
  description: 'SKYNET Parcel Allocation System',
  icons: {
    icon: '/logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="preload" href="/domex_logo.webp" as="image" type="image/webp" />
        <link rel="preload" href="/pick_me_logo.webp" as="image" type="image/webp" />
        <link rel="preload" href="/domex_logo.png" as="image" type="image/png" />
        <link rel="preload" href="/pick_me_logo.png" as="image" type="image/png" />
        <style dangerouslySetInnerHTML={{
          __html: `
            * {
              font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            }
            html, body, button, input, select, textarea, div, span, label, table, td, th, p, h1, h2, h3, h4, h5, h6, a, code, pre {
              font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            }
          `
        }} />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "'Inter', sans-serif" }}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
