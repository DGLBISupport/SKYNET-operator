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
      <body>{children}</body>
    </html>
  )
}
