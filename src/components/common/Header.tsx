import Link from "next/link";
import { IconActivity } from "@tabler/icons-react";

export function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <IconActivity className="size-5 text-primary" />
          <span>RTDI 即時異常監控</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            儀表板
          </Link>
        </nav>
      </div>
    </header>
  );
}
