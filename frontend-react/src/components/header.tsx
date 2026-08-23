import { Link } from "react-router-dom";
import Logo from "./ui/logo";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-neutral-950/80 backdrop-blur-md px-5 py-4">
      <nav className="mx-auto flex max-w-7xl w-full items-center justify-start">
        <Link to="/" className="flex items-center gap-1.5">
          <Logo className="size-6 text-white" />
          <span className="text-base font-medium bg-gradient-to-r from-pink-500 to-red-600 bg-clip-text text-transparent">InterviewReady</span>
        </Link>
      </nav>
    </header>
  );
}
