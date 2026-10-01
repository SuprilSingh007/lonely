export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

type Options = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown };

/** JSON fetch against the Hono API; throws ApiError with the server's message. */
export async function api<T>(path: string, { method = "GET", body }: Options = {}): Promise<T> {
	const res = await fetch(`/api${path}`, {
		method,
		credentials: "include",
		headers: body === undefined ? undefined : { "content-type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const data = (await res.json().catch(() => ({}))) as { error?: string };
	if (!res.ok) {
		throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
	}
	return data as T;
}

export function errorMessage(error: unknown) {
	if (error instanceof ApiError || error instanceof Error) return error.message;
	return "Something went wrong";
}
