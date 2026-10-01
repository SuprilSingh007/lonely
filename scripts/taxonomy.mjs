/**
 * Launch taxonomy for Pune: suburbs, categories → subcategories, and the
 * structured prompts for each subcategory. `npm run db:gen-seed` turns this
 * into migrations/0001_seed_taxonomy.sql. After launch, the admin panel is the
 * place to edit taxonomy; this file only seeds a fresh database.
 *
 * Prompt `template` is the no-AI fallback sentence; `{answer}` is replaced by
 * the chosen option(s).
 */

export const suburbs = [
	{ id: "wagholi", name: "Wagholi" },
	{ id: "hadapsar", name: "Hadapsar" },
	{ id: "wakad", name: "Wakad" },
	{ id: "baner", name: "Baner" },
];

const single = (question, options, template) => ({ question, kind: "single", options, maxSelect: 1, template });
const multi = (question, options, template, maxSelect = 2) => ({ question, kind: "multi", options, maxSelect, template });

export const categories = [
	{
		id: "entrepreneurship",
		name: "Entrepreneurship & Money",
		emoji: "🚀",
		blurb: "Founders, wannabe founders and spreadsheet romantics.",
		subcategories: [
			{
				id: "nikhil-kamath-podcast",
				name: "Nikhil Kamath's WTF podcast",
				emoji: "🎙️",
				blurb: "For people who have opinions on episode 47.",
				prompts: [
					single("Which kind of episode sticks with you most?", ["The ones about failure", "The ones about money", "The ones about health", "The founder origin stories", "The ones about AI"], "Episodes that stick: {answer}."),
					single("Your honest listening style?", ["Every episode, full length", "Only the guests I know", "1.5x while commuting", "Clips on Instagram, sorry"], "Listens: {answer}."),
					single("Hot take you'd defend over cutting chai:", ["UPI beats crypto", "College is optional now", "D2C is overhyped", "Bootstrapping > VC money", "Tier-2 cities are the future"], "Will defend \"{answer}\" over cutting chai."),
				],
			},
			{
				id: "indie-hacking",
				name: "Indie hacking & side projects",
				emoji: "🛠️",
				blurb: "Shipping things at 2am, fixing them at 3am.",
				prompts: [
					single("Where's your side project right now?", ["Just an idea in Notes", "Half-built, abandoned", "Launched, zero users", "Launched, a few users", "Making real money"], "Side project status: {answer}."),
					multi("What do you love building?", ["SaaS tools", "Mobile apps", "Newsletters", "Communities", "Physical products", "Games"], "Loves building: {answer}."),
					single("Biggest weakness as a builder?", ["Marketing", "Finishing things", "Picking one idea", "Design", "Pricing"], "Admitted weak spot: {answer}."),
				],
			},
			{
				id: "personal-finance",
				name: "Investing & personal finance",
				emoji: "📈",
				blurb: "SIPs, spreadsheets and the eternal FD debate.",
				prompts: [
					single("Your investing personality?", ["Index fund and chill", "Stock picker", "Real estate believer", "Gold and FD loyalist", "Still figuring it out"], "Investing personality: {answer}."),
					single("Money book that changed you?", ["Psychology of Money", "Rich Dad Poor Dad", "Let's Talk Money", "The Intelligent Investor", "Haven't read one yet"], "Shaped by \"{answer}\"."),
					single("Most controversial money opinion?", ["Renting beats buying", "Insurance is not investment", "Crypto deserves 5%", "Lifestyle creep is fine", "Early retirement is overrated"], "Quietly believes \"{answer}\"."),
				],
			},
		],
	},
	{
		id: "books",
		name: "Books & Ideas",
		emoji: "📚",
		blurb: "Margins full of notes, TBR piles out of control.",
		subcategories: [
			{
				id: "marathi-literature",
				name: "Marathi literature",
				emoji: "📖",
				blurb: "Pu La, Kusumagraj and long arguments about both.",
				prompts: [
					single("Who are you reading on a lazy Sunday?", ["Pu La Deshpande", "V. P. Kale", "Ratnakar Matkari", "Narayan Dharap", "Contemporary poets"], "Lazy-Sunday author: {answer}."),
					single("Favourite form?", ["Short stories", "Poetry", "Novels", "Plays", "Essays"], "Falls hardest for: {answer}."),
					single("Reading habit?", ["Paperbacks only", "Kindle", "Audiobooks", "Library regular", "Rereads old favourites"], "Reading habit: {answer}."),
				],
			},
			{
				id: "non-fiction-nerds",
				name: "Non-fiction nerds",
				emoji: "🧠",
				blurb: "Ask them about Sapiens. Actually, don't.",
				prompts: [
					multi("Topics you can't stop reading about?", ["History", "Psychology", "Economics", "Science", "Biographies", "Geopolitics"], "Can't stop reading about: {answer}."),
					single("Book you recommend too often?", ["Sapiens", "Atomic Habits", "Thinking, Fast and Slow", "Why We Sleep", "The Gene"], "Recommends \"{answer}\" a little too often."),
					single("How do you take notes?", ["Underline everything", "Notion database", "Don't, I remember", "Tweet threads", "Tell friends at dinner"], "Note-taking style: {answer}."),
				],
			},
			{
				id: "philosophy",
				name: "Philosophy & big questions",
				emoji: "🤔",
				blurb: "Is a vada pav a sandwich? Let's discuss for three hours.",
				prompts: [
					single("Which school of thought feels like home?", ["Stoicism", "Existentialism", "Vedanta", "Buddhism", "Absurdism", "Still shopping"], "Philosophical home: {answer}."),
					single("The question that keeps you up:", ["Free will", "Meaning of life", "Consciousness", "Ethics of AI", "What is a good life"], "Lies awake thinking about: {answer}."),
					single("Debate style?", ["Devil's advocate", "Socratic questions", "Quote-heavy", "Calm listener", "Loud and passionate"], "Debate style: {answer}."),
				],
			},
		],
	},
	{
		id: "music",
		name: "Music",
		emoji: "🎧",
		blurb: "Headphones in, opinions out.",
		subcategories: [
			{
				id: "indian-indie",
				name: "Indian indie",
				emoji: "🎸",
				blurb: "Prateek Kuhad crying sessions welcome.",
				prompts: [
					multi("Artists on repeat?", ["Prateek Kuhad", "When Chai Met Toast", "The Local Train", "Anuv Jain", "Seedhe Maut", "Ritviz"], "On repeat: {answer}."),
					single("Gig habit?", ["Every weekend gig", "Big concerts only", "Bedroom listener", "Plays guitar along", "Discovers bands first"], "Gig habit: {answer}."),
					single("Best setting for indie music?", ["Rainy drive to Lonavala", "Late-night work", "Sunset terrace", "Solo café", "Shared earphones"], "Indie hits hardest on a: {answer}."),
				],
			},
			{
				id: "hindustani-classical",
				name: "Hindustani classical",
				emoji: "🎶",
				blurb: "Sawai Gandharva season is our Christmas.",
				prompts: [
					single("Your relationship with classical?", ["Trained for years", "Learning now", "Devoted listener", "Curious beginner"], "Relationship with classical: {answer}."),
					single("Raga for a monsoon evening?", ["Miyan ki Malhar", "Yaman", "Bhimpalasi", "Darbari", "Bageshri"], "Monsoon-evening raga: {answer}."),
					single("Instrument that gets you?", ["Sitar", "Sarod", "Bansuri", "Tabla", "Vocals", "Santoor"], "Melts for: {answer}."),
				],
			},
			{
				id: "making-beats",
				name: "Making beats",
				emoji: "🎛️",
				blurb: "FL Studio, Ableton or a phone and a dream.",
				prompts: [
					single("Your setup?", ["Ableton", "FL Studio", "Logic", "Phone apps", "Hardware only"], "Beat lab: {answer}."),
					multi("Genres you produce?", ["Lo-fi", "Hip-hop", "House", "Bollywood remixes", "Ambient", "Indie pop"], "Cooks up: {answer}."),
					single("Where are you at?", ["Just started", "Finished a few tracks", "Released on Spotify", "Doing gigs"], "Producer status: {answer}."),
				],
			},
		],
	},
	{
		id: "outdoors",
		name: "Outdoors & Fitness",
		emoji: "🥾",
		blurb: "Sahyadris on weekends, sore legs on Mondays.",
		subcategories: [
			{
				id: "sahyadri-treks",
				name: "Sahyadri treks & forts",
				emoji: "⛰️",
				blurb: "Sinhagad at sunrise counts as cardio and therapy.",
				prompts: [
					single("Favourite fort?", ["Sinhagad", "Rajgad", "Torna", "Harihar", "Lohagad", "Kalsubai peak"], "Would climb {answer} again tomorrow."),
					single("Trek style?", ["Night treks", "Sunrise summits", "Monsoon waterfalls", "Solo with a playlist", "Big group chaos"], "Trek style: {answer}."),
					single("Mandatory trek snack?", ["Kanda bhaji at the top", "Nimbu sharbat", "Parle-G", "Dry fruits like a pro", "Maggi at the base"], "Non-negotiable trek snack: {answer}."),
				],
			},
			{
				id: "running",
				name: "Running",
				emoji: "🏃",
				blurb: "5am alarms and finisher medals.",
				prompts: [
					single("Your distance?", ["Just started 5Ks", "10K regular", "Half marathons", "Full marathons", "Ultra, send help"], "Distance: {answer}."),
					single("Where do you run?", ["Riverside paths", "Society loops", "Treadmill", "Hill routes", "Wherever the playlist takes me"], "Running turf: {answer}."),
					single("Why do you run?", ["Clear my head", "Chasing a PB", "Social run club", "Food permission", "Started for a bet"], "Runs because: {answer}."),
				],
			},
			{
				id: "cycling",
				name: "Cycling",
				emoji: "🚲",
				blurb: "Weekend rides to Khadakwasla and beyond.",
				prompts: [
					single("Your ride?", ["Road bike", "MTB", "Hybrid", "Electric", "Rented on weekends"], "Ride of choice: {answer}."),
					single("Ideal Sunday ride?", ["Khadakwasla loop", "Mulshi road", "City café hopping", "Long highway miles", "Trails and mud"], "Ideal Sunday ride: {answer}."),
					single("Cycling personality?", ["Strava segment hunter", "Chai-stop enthusiast", "Gear nerd", "Commuter", "Solo meditator"], "Cycling personality: {answer}."),
				],
			},
		],
	},
	{
		id: "tech",
		name: "Tech & Building",
		emoji: "💻",
		blurb: "Terminal tabs open, side quests pending.",
		subcategories: [
			{
				id: "ai-tinkering",
				name: "AI tinkering",
				emoji: "🤖",
				blurb: "Prompting, fine-tuning, and arguing about agents.",
				prompts: [
					multi("What are you tinkering with?", ["Chatbots", "Agents", "Image models", "Local LLMs", "Voice AI", "AI for Indian languages"], "Currently tinkering with: {answer}."),
					single("Your AI stance?", ["Accelerate everything", "Cautiously excited", "Mostly skeptical", "Just here for the memes"], "AI stance: {answer}."),
					single("Most useful thing AI did for you?", ["Wrote my code", "Explained a concept", "Planned a trip", "Fixed my resume", "Helped me cook"], "Best AI moment: {answer}."),
				],
			},
			{
				id: "open-source",
				name: "Open source",
				emoji: "🐙",
				blurb: "Green squares and good first issues.",
				prompts: [
					single("Your open-source life?", ["Maintainer", "Regular contributor", "Made one PR once", "Want to start", "Mostly star repos"], "Open-source life: {answer}."),
					multi("Languages you love?", ["Python", "TypeScript", "Go", "Rust", "Java", "C++"], "Writes for fun in: {answer}."),
					single("Tabs or spaces?", ["Tabs", "Spaces", "Whatever the formatter says", "Don't start this"], "On tabs vs spaces: {answer}."),
				],
			},
			{
				id: "mechanical-keyboards",
				name: "Mechanical keyboards",
				emoji: "⌨️",
				blurb: "Thock or clack, choose wisely.",
				prompts: [
					single("Switch preference?", ["Linear", "Tactile", "Clicky", "Silent", "I just like keycaps"], "Switch loyalty: {answer}."),
					single("Layout?", ["Full size", "TKL", "75%", "60%", "Split ergonomic"], "Layout: {answer}."),
					single("How deep is the rabbit hole?", ["One nice board", "Two or three", "I build my own", "I've lost count"], "Keyboard collection: {answer}."),
				],
			},
		],
	},
	{
		id: "screen",
		name: "Films & Shows",
		emoji: "🎬",
		blurb: "Letterboxd logs and strong reviews.",
		subcategories: [
			{
				id: "marathi-cinema",
				name: "Marathi cinema",
				emoji: "🎞️",
				blurb: "From Sairat to Shwaas and everything between.",
				prompts: [
					single("A Marathi film everyone should see?", ["Sairat", "Court", "Shwaas", "Natsamrat", "Killa", "Fandry"], "Will make you watch {answer}."),
					single("Theatre or OTT?", ["First-day theatre", "Waits for OTT", "Only festival screenings", "Natak over cinema"], "Watches: {answer}."),
					single("What makes a film great?", ["Writing", "Acting", "Music", "Cinematography", "Ending that wrecks you"], "Great films live and die by: {answer}."),
				],
			},
			{
				id: "anime",
				name: "Anime",
				emoji: "🍥",
				blurb: "Subs over dubs (mostly).",
				prompts: [
					multi("Your anime era?", ["Naruto days", "Attack on Titan", "One Piece forever", "Studio Ghibli", "Jujutsu Kaisen", "Slice of life"], "Anime era: {answer}."),
					single("Subs or dubs?", ["Subs only", "Dubs are fine", "Hindi dubs nostalgia", "Read the manga instead"], "Subs vs dubs: {answer}."),
					single("Watching style?", ["Binge a season overnight", "Weekly with the hype", "Rewatch comfort shows", "Only finished series"], "Watches: {answer}."),
				],
			},
			{
				id: "true-crime-docs",
				name: "True crime & docs",
				emoji: "🕵️",
				blurb: "Armchair detectives assemble.",
				prompts: [
					single("Your doc genre?", ["True crime", "Nature", "Scams and frauds", "Sports", "History", "Food"], "Doc obsession: {answer}."),
					single("Format?", ["Netflix series", "YouTube deep dives", "Podcasts", "Long-form articles"], "Consumes it via: {answer}."),
					single("Detective energy?", ["Solves it in episode 1", "Gets scared, keeps watching", "Researches after", "Just likes the music"], "Detective energy: {answer}."),
				],
			},
		],
	},
];
