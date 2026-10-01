import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AppConfig, ChatListItem, Me } from "@/lib/types";

export function useConfig() {
	return useQuery({ queryKey: ["config"], queryFn: () => api<AppConfig>("/config"), staleTime: 5 * 60_000 });
}

export function useMe() {
	return useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me"), staleTime: 30_000 });
}

/** Inbox, polled so new swipes/messages show up without a socket per chat. */
export function useChats(enabled = true) {
	return useQuery({
		queryKey: ["chats"],
		queryFn: () => api<{ chats: ChatListItem[]; unreadCount: number }>("/chats"),
		refetchInterval: 8_000,
		enabled,
	});
}
