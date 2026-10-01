import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/brand";
import { ApiError } from "@/lib/api";
import { LandingPage } from "@/pages/landing";
import { LoginPage } from "@/pages/login";
import { OnboardingPage } from "@/pages/onboarding";
import { DiscoverPage } from "@/pages/discover";
import { DeckPage } from "@/pages/deck";
import { InterestsPage } from "@/pages/interests";
import { InterestEditPage } from "@/pages/interest-edit";
import { ChatsIndexPane, ChatsLayout } from "@/pages/chats";
import { ChatRoomPage } from "@/pages/chat-room";
import { MePage } from "@/pages/me";
import "./index.css";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: true,
			retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
		},
	},
});

const router = createBrowserRouter([
	{ path: "/", element: <LandingPage /> },
	{ path: "/login", element: <LoginPage /> },
	{ path: "/onboarding", element: <OnboardingPage /> },
	{
		element: <AppShell />,
		children: [
			{ path: "/discover", element: <DiscoverPage /> },
			{ path: "/discover/:suburbId/:subId", element: <DeckPage /> },
			{ path: "/interests", element: <InterestsPage /> },
			{ path: "/interests/:subId", element: <InterestEditPage /> },
			{
				path: "/chats",
				element: <ChatsLayout />,
				children: [
					{ index: true, element: <ChatsIndexPane /> },
					{ path: ":id", element: <ChatRoomPage /> },
				],
			},
			{ path: "/me", element: <MePage /> },
			// Only curators need the admin panel, so it loads on demand.
			{ path: "/admin", lazy: () => import("@/pages/admin").then((m) => ({ Component: m.AdminPage })) },
		],
	},
	{
		path: "*",
		element: (
			<div className="grid min-h-dvh place-items-center bg-dots">
				<EmptyState emoji="🧭" title="Lost in Pune traffic?" action={<a className="font-bold underline" href="/">Take me home</a>}>
					That page doesn't exist.
				</EmptyState>
			</div>
		),
	},
]);

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<TooltipProvider>
				<RouterProvider router={router} />
				<Toaster position="top-center" />
			</TooltipProvider>
		</QueryClientProvider>
	</StrictMode>,
);
