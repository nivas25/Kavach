export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-gray-800 relative selection:bg-kavach-gold selection:text-white">
      {children}
    </div>
  );
}
