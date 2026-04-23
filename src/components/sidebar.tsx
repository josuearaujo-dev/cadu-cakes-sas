 "use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ChartColumn,
  ClipboardList,
  FolderCog,
  LayoutGrid,
  LogOut,
  ReceiptText,
  Wallet,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { clearFinanceCompanyIdCache } from "@/lib/supabase/finance-repository";

const links = [
  { href: "/", label: "Painel", icon: LayoutGrid },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/pagamentos", label: "Pagamentos", icon: Wallet },
  { href: "/cheques", label: "Cheques", icon: ClipboardList },
  { href: "/insights", label: "Insights", icon: ChartColumn },
  { href: "/lancamentos", label: "Lançamentos", icon: ReceiptText },
  { href: "/cadastros", label: "Cadastros & Config.", icon: FolderCog },
] satisfies { href: string; label: string; icon: LucideIcon }[];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);

  async function handleSignOut() {
    clearFinanceCompanyIdCache();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }

  return (
    <aside className={`sidebar glass ${collapsed ? "collapsed" : ""}`}>
      <div className="brand">
        <Image
          src="/logo-perfil-1024.png"
          alt="Logo Cadu Cakes"
          width={42}
          height={42}
        />
        <div className="brand-copy">
          <h1>Cadu Cakes</h1>
          <p>Gestao Financeira</p>
        </div>
        <button
          type="button"
          className="menu-toggle"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? "Expandir menu" : "Retrair menu"}
        >
          {collapsed ? ">" : "<"}
        </button>
      </div>
      <nav className="menu">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`menu-link ${pathname === link.href || pathname.startsWith(`${link.href}/`) ? "active" : ""}`}
          >
            <span className="menu-icon" aria-hidden>
              <link.icon size={18} strokeWidth={2.2} />
            </span>
            <span className="menu-label">{link.label}</span>
          </Link>
        ))}
      </nav>
      <button type="button" className="menu-link logout-link" onClick={handleSignOut}>
        <span className="menu-icon" aria-hidden>
          <LogOut size={18} strokeWidth={2.2} />
        </span>
        <span className="menu-label">Sair</span>
      </button>
    </aside>
  );
}
