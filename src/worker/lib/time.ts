const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Start of the current day in India (swipe limits reset at IST midnight). */
export function startOfIstDay(now = Date.now()): Date {
	const ist = now + IST_OFFSET_MS;
	const dayStart = ist - (ist % (24 * 60 * 60 * 1000));
	return new Date(dayStart - IST_OFFSET_MS);
}

export function ageFrom(birthDate: string, now = new Date()): number {
	const [y, m, d] = birthDate.split("-").map(Number);
	let age = now.getUTCFullYear() - y;
	const beforeBirthday =
		now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d);
	if (beforeBirthday) age -= 1;
	return age;
}
