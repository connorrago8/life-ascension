/** Gallery only. The dev indicator sits on the nav in 390px captures. */
export default function CompanionGalleryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{'nextjs-portal{display:none !important}html{scrollbar-width:none}html::-webkit-scrollbar{display:none}'}</style>
      {children}
    </>
  );
}
