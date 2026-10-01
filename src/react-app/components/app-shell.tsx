import { NavLink, Navigate, Outlet, useLocation, useMatch } from "react-router";
import { Compass, MessageCircleHeart, Shapes, Shield, Smile } from "lucide-react";
import { cn } from "cn";
import { Logo, Splash } from "@/components/brand";
import { useChats, useMe } from "@/hooks/use-app-data";

const NAV = [
	{ to: "/discover", label: "Discover", icon: Compass },
	{ to: "/interests", label: "Interests", icon: Shapes },
	{ to: "/chats", label: "Chats", icon: MessageCircleHeart },
	{ to: "/me", label: "Me", icon: Smile },
];

/** Gate for signed-in, onboarded users + responsive navigation (design.md §7). */
export function AppShell() {
	const me = useMe();
	const location = useLocation();
	const inChatRoom = useMatch("/chats/:id");
	const chats = useChats(Boolean(me.data?.profile));

	if (me.isPending) return <Splash />;
	if (!me.data?.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
	if (!me.data.profile) return <Navigate to="/onboarding" replace />;

	const unread = chats.data?.unreadCount ?? 0;
	const nav = me.data.user.isAdmin ? [...NAV, { to: "/admin", label: "Admin", icon: Shield }] : NAV;

	return (
		<div className="min-h-dvh bg-dots lg:grid lg:grid-cols-[248px_1fr]">
			{/* Desktop sidebar */}
			<aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r-2 border-ink bg-paper p-6 lg:flex">
				<NavLink to="/discover" aria-label="Ghulo Milo home">
					<Logo />
				</NavLink>
				<nav className="flex flex-col gap-2" aria-label="Main">
					{nav.map(({ to, label, icon: Icon }) => (
						<NavLink
							key={to}
							to={to}
							className={({ isActive }) =>
								cn(
									"flex items-center gap-3 rounded-full border-2 px-4 py-2.5 font-semibold transition-all",
									isActive
										? "border-ink bg-coral text-white shadow-pop-sm"
										: "border-transparent hover:border-ink hover:bg-card",
								)
							}
						>
							<Icon className="size-5" />
							{label}
							{to === "/chats" && unread > 0 && (
								<span className="ml-auto grid min-w-6 place-items-center rounded-full border-2 border-ink bg-mint px-1.5 text-xs font-bold text-ink">
									{unread}
								</span>
							)}
						</NavLink>
					))}
				</nav>
				<div className="mt-auto rounded-2xl bg-lilac p-4 text-sm pop-sm">
					<p className="font-display text-base font-bold">{me.data.user.handle}</p>
					<p className="text-muted-foreground">That's you. Nobody sees your name, photo or number.</p>
				</div>
			</aside>

			<div className="flex min-h-dvh min-w-0 flex-col">
				{/* Mobile top bar (hidden inside a chat, which has its own header) */}
				{!inChatRoom && (
					<header className="sticky top-0 z-30 flex items-center justify-between border-b-2 border-ink bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
						<NavLink to="/discover" aria-label="Ghulo Milo home">
							<Logo />
						</NavLink>
						<span className="max-w-[45%] truncate rounded-full bg-card px-3 py-1 text-xs font-bold pop-sm">
							{me.data.user.handle}
						</span>
					</header>
				)}

				<main
					className={cn(
						"mx-auto w-full max-w-[1100px] flex-1",
						inChatRoom ? "" : "px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12",
					)}
				>
					<Outlet />
				</main>

				{/* Mobile floating tab bar */}
				{!inChatRoom && (
					<nav
						aria-label="Main"
						className="fixed inset-x-3 bottom-3 z-40 mb-[env(safe-area-inset-bottom)] flex justify-around rounded-full border-2 border-ink bg-card p-1.5 shadow-pop lg:hidden"
					>
						{nav.map(({ to, label, icon: Icon }) => (
							<NavLink
								key={to}
								to={to}
								className={({ isActive }) =>
									cn(
										"relative flex min-w-14 flex-col items-center gap-0.5 rounded-full px-2 py-1.5 text-[11px] font-semibold",
										isActive ? "text-ink" : "text-muted-foreground",
									)
								}
							>
								{({ isActive }) => (
									<>
										<span
											className={cn(
												"grid h-8 w-12 place-items-center rounded-full border-2 transition-all",
												isActive ? "border-ink bg-coral text-white" : "border-transparent",
											)}
										>
											<Icon className="size-5" />
										</span>
										{label}
										{to === "/chats" && unread > 0 && (
											<span className="absolute top-0.5 right-1.5 grid size-5 place-items-center rounded-full border-2 border-ink bg-mint text-[10px] font-bold text-ink">
												{unread > 9 ? "9+" : unread}
											</span>
										)}
									</>
								)}
							</NavLink>
						))}
					</nav>
				)}
			</div>
		</div>
	);
}
