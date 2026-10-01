const ADJECTIVES = [
	"Caffeinated", "Philosophical", "Sleepy", "Spicy", "Curious", "Dramatic", "Sneaky", "Wobbly",
	"Overthinking", "Monsoon", "Midnight", "Chatty", "Sarcastic", "Cosmic", "Tangy", "Bookish",
	"Restless", "Sunny", "Moody", "Zesty", "Nerdy", "Chill", "Fizzy", "Grumpy", "Jolly", "Lanky",
	"Mellow", "Nimble", "Peppy", "Quirky", "Rogue", "Snappy", "Thrifty", "Unbothered", "Witty",
	"Breezy", "Crunchy", "Dreamy", "Electric", "Feisty", "Gentle", "Humble", "Inky", "Jazzy",
	"Kooky", "Loud", "Mischievous", "Noisy", "Offbeat", "Plucky", "Retro", "Salty", "Tiny",
	"Velvet", "Wandering", "Zen", "Brave", "Clumsy", "Daring", "Earnest",
];

const NOUNS = [
	"Pangolin", "Samosa", "Otter", "Vadapav", "Peacock", "Mango", "Narwhal", "Chakli", "Koel",
	"Pigeon", "Tamarind", "Sloth", "Rickshaw", "Modak", "Hornbill", "Falooda", "Llama", "Jalebi",
	"Gecko", "Bhel", "Firefly", "Squirrel", "Kulfi", "Panda", "Misal", "Owl", "Poha", "Walrus",
	"Chutney", "Yak", "Dosa", "Lemur", "Barfi", "Toucan", "Pakoda", "Quokka", "Ladoo", "Mongoose",
	"Cutting", "Tortoise", "Papad", "Flamingo", "Thepla", "Badger", "Kachori", "Penguin", "Shrikhand",
	"Platypus", "Puranpoli", "Axolotl", "Sabudana", "Capybara", "Dhokla", "Meerkat", "Rasgulla",
	"Hedgehog", "Kokum", "Chameleon", "Bhakri", "Raccoon",
];

function pick<T>(list: T[]): T {
	return list[crypto.getRandomValues(new Uint32Array(1))[0] % list.length];
}

/** e.g. "Caffeinated Pangolin 27". Fixed at sign-up and never user-editable. */
export function generateHandle(): string {
	const n = 10 + (crypto.getRandomValues(new Uint32Array(1))[0] % 90);
	return `${pick(ADJECTIVES)} ${pick(NOUNS)} ${n}`;
}
