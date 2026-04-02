import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import PublicNav from "./PublicNav";
import PublicFooter from "./PublicFooter";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function PublicLayout() {
  return (
    <div className="vector-public-page">
      <ScrollToTop />
      <PublicNav />
      <Outlet />
      <PublicFooter />
    </div>
  );
}
