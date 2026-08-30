import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import Logo from "./ui/logo";
import { isAuthenticated, getUser, clearAuth } from "../lib/auth";

export function Header() {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const authed = isAuthenticated();
  const user = getUser();

  function handleLogout() {
    clearAuth();
    setShowMenu(false);
    navigate("/login");
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-neutral-950/80 backdrop-blur-md px-5 py-4">
      <nav className="flex w-full items-center justify-between">
        <Link to="/" className="flex items-center gap-1.5">
          <Logo className="size-6 text-white" />
          <span className="text-base font-medium bg-gradient-to-r from-pink-500 to-red-600 bg-clip-text text-transparent">
            GetHired
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {authed && (
            <>
              <Link
                to="/dashboard"
                className="text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Resumes
              </Link>
              <Link
                to="/interview"
                className="text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Interview
              </Link>
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex items-center gap-2 text-sm text-neutral-300 hover:text-white transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center text-[11px] font-medium">
                    {user?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 py-1">
                      <div className="px-4 py-2 border-b border-neutral-800">
                        <p className="text-sm font-medium text-neutral-200">{user?.name}</p>
                        <p className="text-[11px] text-neutral-500">{user?.email}</p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-neutral-400 hover:text-red-400 hover:bg-neutral-800/50 transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
          {!authed && (
            <>
              <Link
                to="/login"
                className="text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="text-sm px-4 py-1.5 bg-gradient-to-r from-pink-500 to-red-600 text-white rounded-lg hover:from-pink-600 hover:to-red-700 transition-all"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
