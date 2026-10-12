export interface OnboardingValue {
	firstName: string;
	lastName: string;
	cafeName: string;
	phone: string;
}
export type OnboardingErrors = {
	firstName?: string;
	lastName?: string;
	cafeName?: string;
	phone?: string;
	[k: string]: string | undefined;
};
export interface ChatMessage {
	id: number;
	sender: string;
	senderName?: string | null;
	text: string;
	clientMsgId?: string | null;
	createdAt: string;
}
export type MessageToken =
	| { kind: "text"; text: string }
	| { kind: "link"; text: string; href: string }
	| { kind: "phone"; text: string; href: string };
export declare const LIMITS: {
	NAME_MAX: number;
	CAFE_MAX: number;
	MESSAGE_MAX: number;
	BODY_MAX_BYTES: number;
};
export declare function normalizeDigits(value: unknown): string;
export declare function normalizePhoneNumber(raw: unknown): string;
export declare function isValidIranMobile(raw: unknown): boolean;
export declare function validateOnboarding(
	input: unknown,
):
	| { ok: true; errors: Record<string, never>; value: OnboardingValue }
	| { ok: false; errors: OnboardingErrors };
export declare function validateMessageText(
	raw: unknown,
): { ok: true; value: string } | { ok: false; error: string };
export declare function isValidClientMsgId(v: unknown): boolean;
export declare function mergeMessages(
	existing: ChatMessage[],
	incoming: ChatMessage[],
): ChatMessage[];
export declare function shortRef(conversationId: unknown): string;
export declare function tokenizeMessage(raw: unknown): MessageToken[];
