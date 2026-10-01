export const metadata = {
  title: 'BidPilot',
  description: 'Job-ad budget optimizer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
