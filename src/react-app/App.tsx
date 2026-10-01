import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

function App() {
	const [name, setName] = useState<string | null>(null);

	return (
		<main className="flex min-h-svh items-center justify-center p-6">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Lonely</CardTitle>
					<CardDescription>
						React + Hono on Cloudflare Workers, styled with shadcn/ui.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					<Button
						onClick={() => {
							fetch("/api/")
								.then((res) => res.json() as Promise<{ name: string }>)
								.then((data) => setName(data.name));
						}}
					>
						Ping the API
					</Button>
					<p className="text-sm text-muted-foreground">
						Name from API: {name ?? "—"}
					</p>
				</CardContent>
			</Card>
		</main>
	);
}

export default App;
