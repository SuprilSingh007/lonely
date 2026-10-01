export type Subcategory = { id: string; name: string; emoji: string; blurb: string };
export type Category = Subcategory & { subcategories: Subcategory[] };
export type Suburb = { id: string; name: string; city: string };

export type AppConfig = {
	appName: string;
	dailySwipeLimit: number;
	suburbs: Suburb[];
	categories: Category[];
};

export type Swipes = { used: number; limit: number; left: number };

export type Membership = {
	subcategoryId: string;
	summary: string;
	summarySource: "ai" | "template";
	updatedAt: string;
	name: string;
	emoji: string;
	categoryId: string;
};

export type Me = {
	user: { id: string; handle: string; phoneNumber: string | null; isAdmin: boolean } | null;
	profile: { suburbId: string; birthDate: string; age: number } | null;
	memberships: Membership[];
	swipes: Swipes;
};

export type Prompt = {
	id: string;
	question: string;
	kind: "single" | "multi";
	options: string[];
	maxSelect: number;
};

export type SubcategoryDetail = {
	subcategory: Subcategory & { active: boolean };
	category: { id: string; name: string; emoji: string } | null;
	prompts: Prompt[];
	membership: { answers: Record<string, string[]>; summary: string; summarySource: string } | null;
};

export type DeckCard = { userId: string; handle: string; summary: string };

export type ChatListItem = {
	id: string;
	other: { id: string; handle: string };
	subcategory: { id: string; name: string; emoji: string };
	theySwipedFirst: boolean;
	lastMessage: { body: string; mine: boolean; at: number } | null;
	activityAt: number;
	unread: boolean;
};

export type ChatMessage = {
	id: string;
	senderId: string;
	body: string;
	createdAt: number;
	clientId?: string;
	pending?: boolean;
};

export type ChatDetail = {
	chat: {
		id: string;
		theySwipedFirst: boolean;
		createdAt: number;
		subcategory: { id: string; name: string; emoji: string } | null;
		blockedByMe: boolean;
		otherLastReadAt: number | null;
	};
	me: { id: string; summary: string | null };
	other: { id: string; handle: string; age: number | null; suburb: string | null; summary: string | null };
	messages: ChatMessage[];
};
