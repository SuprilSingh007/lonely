import { waitUntil } from "cloudflare:workers";
import { getDb, schema } from "../db";
import type { AppEnv } from "../types";

/**
 * Delivers sign-in OTPs.
 * - "console": logs the code and stores it in `dev_otp` (readable via /api/dev/otp on localhost only).
 * - "twilio": sends a real SMS through Twilio's Messages API.
 */
export async function deliverOtp(env: AppEnv, phoneNumber: string, code: string) {
	const provider = env.SMS_PROVIDER;
	if (provider === "twilio") {
		const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM_NUMBER: from } = env;
		if (!sid || !token || !from) throw new Error("Twilio secrets are not configured");
		// Don't hold the response open (and leak timing) while the SMS goes out.
		waitUntil(
			fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
				method: "POST",
				headers: {
					authorization: `Basic ${btoa(`${sid}:${token}`)}`,
					"content-type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					To: phoneNumber,
					From: from,
					Body: `${code} is your ${env.APP_NAME} code. It expires in 5 minutes.`,
				}),
			}).then(async (res) => {
				if (!res.ok) console.error("Twilio send failed", res.status, await res.text());
			}),
		);
		return;
	}

	console.log(`[otp] ${phoneNumber} → ${code}`);
	const db = getDb(env.DB);
	await db
		.insert(schema.devOtp)
		.values({ phoneNumber, code, createdAt: new Date() })
		.onConflictDoUpdate({
			target: schema.devOtp.phoneNumber,
			set: { code, createdAt: new Date() },
		});
}
