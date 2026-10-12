/**
 * Pnara live-chat widget client (vanilla TypeScript, no dependencies).
 *
 * Bootstrapped from `LiveChat.astro`, which owns the markup + styles. This
 * module owns state, API calls, polling, and safe DOM rendering.
 *
 * Rendering rule: message text is NEVER injected as HTML. Text is split with
 * `tokenizeMessage()` (shared with the backend validation module) and rendered
 * with `textContent`; links/phones become real anchors with sanitized hrefs.
 */
import {
	mergeMessages,
	tokenizeMessage,
	validateMessageText,
	validateOnboarding,
} from "../../../shared/chat-shared.js";
import type { ChatMessage } from "../../../shared/chat-shared.js";

export interface ChatWidgetOptions {
	apiBase: string;
	pollIntervalMs?: number;
}

interface PendingMsg {
	clientMsgId: string;
	text: string;
	status: "sending" | "failed";
	error?: string;
}

const TOKEN_KEY = "pnara_chat_token";
const SEEN_KEY = "pnara_chat_seen";
const DEFAULT_POLL_MS = 4000;
const MAX_POLL_MS = 30000;

const FIELD_LABELS: Record<string, string> = {
	firstName: "نام",
	lastName: "نام خانوادگی",
	cafeName: "نام کافه",
	phone: "شماره موبایل",
};

function fieldErrorText(code: string, label: string): string {
	if (code === "required") return `${label} الزامی است.`;
	if (code === "too_long") return `${label} خیلی طولانی است.`;
	if (code === "invalid_mobile")
		return "شماره موبایل معتبر نیست. مثال: 09120000000";
	return "این فیلد معتبر نیست.";
}

function uuid(): string {
	try {
		if (typeof crypto !== "undefined" && "randomUUID" in crypto)
			return crypto.randomUUID();
	} catch {
		/* fall through */
	}
	const b = new Uint8Array(16);
	crypto.getRandomValues(b);
	return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function timeFmt(): Intl.DateTimeFormat {
	try {
		return new Intl.DateTimeFormat("fa-IR", {
			hour: "2-digit",
			minute: "2-digit",
			day: "numeric",
			month: "short",
		});
	} catch {
		return new Intl.DateTimeFormat(undefined, {
			hour: "2-digit",
			minute: "2-digit",
		});
	}
}

interface Elements {
	root: HTMLElement;
	fab: HTMLButtonElement;
	badge: HTMLElement;
	panel: HTMLElement;
	closeBtn: HTMLButtonElement;
	minBtn: HTMLButtonElement;
	loading: HTMLElement;
	onboarding: HTMLElement;
	form: HTMLFormElement;
	thread: HTMLElement;
	log: HTMLElement;
	closedNotice: HTMLElement;
	composer: HTMLFormElement;
	input: HTMLInputElement;
	sendBtn: HTMLButtonElement;
	sendError: HTMLElement;
	errorScreen: HTMLElement;
	errorText: HTMLElement;
	retryBtn: HTMLButtonElement;
	newPill: HTMLButtonElement;
	srStatus: HTMLElement;
	inputs: Record<string, HTMLInputElement>;
	fieldErrors: Record<string, HTMLElement>;
}

function query<T extends HTMLElement>(root: ParentNode, sel: string): T | null {
	return root.querySelector(sel) as T | null;
}

export function initLiveChat(
	root: HTMLElement,
	options: ChatWidgetOptions,
): () => void {
	const els = collectElements(root);
	if (!els) return () => undefined;
	const apiBase = options.apiBase.replace(/\/$/, "");
	const pollBase =
		options.pollIntervalMs && options.pollIntervalMs > 0
			? options.pollIntervalMs
			: DEFAULT_POLL_MS;

	const fmt = timeFmt();
	const state = {
		open: false,
		screen: "loading" as "loading" | "onboarding" | "thread" | "error",
		token: loadToken(),
		visitor: null as null | {
			firstName: string;
			lastName: string;
			cafeName: string;
			phone: string;
		},
		conversation: null as null | {
			id: string;
			shortRef: string;
			status: string;
		},
		messages: [] as ChatMessage[],
		after: 0,
		pendings: new Map<string, PendingMsg>(),
		pollTimer: 0,
		pollInFlight: false,
		pollBackoffMs: pollBase,
		submitting: false,
		lastFocus: null as HTMLElement | null,
		announcedIds: new Set<number>(),
	};

	const renderAll = (): void => {
		showScreen(state.screen);
		renderThread();
		renderBadge();
	};

	// ------------------------------------------------------------- API layer
	const headers = (): HeadersInit => {
		const h: Record<string, string> = { "Content-Type": "application/json" };
		if (state.token) h["X-Visitor-Token"] = state.token;
		return h;
	};

	async function api<T>(
		path: string,
		init?: RequestInit,
	): Promise<{ status: number; body: T }> {
		const res = await fetch(`${apiBase}${path}`, {
			credentials: "include",
			...init,
			headers: { ...headers(), ...(init?.headers || {}) },
		});
		let body = {} as T;
		try {
			body = (await res.json()) as T;
		} catch {
			body = {} as T;
		}
		return { status: res.status, body };
	}

	interface SessionBody {
		success?: boolean;
		visitor?: {
			firstName: string;
			lastName: string;
			cafeName: string;
			phone: string;
		} | null;
		conversation?: { id: string; shortRef: string; status: string } | null;
		messages?: ChatMessage[];
		needsOnboarding?: boolean;
		visitorToken?: string;
		errors?: Record<string, string>;
		message?: string;
	}

	function adoptSession(body: SessionBody): void {
		if (body.visitorToken) saveToken(body.visitorToken);
		state.visitor = body.visitor ?? null;
		state.conversation = body.conversation ?? null;
		if (body.messages) {
			state.messages = mergeMessages([], body.messages);
			state.after = state.messages.length
				? state.messages[state.messages.length - 1].id
				: 0;
		}
		state.screen =
			state.visitor && state.conversation ? "thread" : "onboarding";
	}

	async function bootstrap(): Promise<void> {
		state.screen = "loading";
		renderAll();
		try {
			const { status, body } = await api<SessionBody>("/api/chat/session", {
				method: "GET",
			});
			if (status === 403 || status === 503) {
				showFatal(
					status === 503
						? "سرویس گفتگو موقتاً در دسترس نیست. لطفاً بعداً تلاش کنید."
						: "دسترسی مجاز نیست.",
				);
				return;
			}
			adoptSession(body);
		} catch {
			showFatal(
				"اتصال به سرویس گفتگو برقرار نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.",
			);
			return;
		}
		renderAll();
		if (state.visitor && state.conversation) {
			markSeen();
			void pollNow();
		}
	}

	// ---------------------------------------------------------------- polling
	function shouldPoll(): boolean {
		return (
			state.open &&
			state.screen === "thread" &&
			!document.hidden &&
			navigator.onLine &&
			!!state.conversation
		);
	}

	function schedulePoll(delayMs: number): void {
		window.clearTimeout(state.pollTimer);
		state.pollTimer = window.setTimeout(() => void pollTick(), delayMs);
	}

	async function pollTick(): Promise<void> {
		if (!shouldPoll() || state.pollInFlight) {
			if (shouldPoll()) schedulePoll(pollBase);
			return;
		}
		await pollNow();
		if (shouldPoll()) schedulePoll(state.pollBackoffMs);
	}

	interface PollBody {
		success?: boolean;
		messages?: ChatMessage[];
		nextAfter?: number;
		status?: string;
	}

	async function pollNow(): Promise<void> {
		if (state.pollInFlight || !state.conversation) return;
		state.pollInFlight = true;
		try {
			const { status, body } = await api<PollBody>(
				`/api/chat/conversations/current/messages?after=${state.after}&limit=50`,
				{ method: "GET" },
			);
			if (status === 401) {
				clearToken();
				state.visitor = null;
				state.conversation = null;
				state.screen = "onboarding";
				renderAll();
				return;
			}
			if (status === 429) {
				state.pollBackoffMs = Math.min(state.pollBackoffMs * 2, MAX_POLL_MS);
				return;
			}
			if (!body.success) return;
			state.pollBackoffMs = pollBase;
			if (typeof body.status === "string" && state.conversation)
				state.conversation.status = body.status;
			const incoming = body.messages ?? [];
			if (incoming.length > 0) {
				const hadSupport = incoming.some((m) => m.sender === "support");
				state.messages = mergeMessages(state.messages, incoming);
				state.after =
					typeof body.nextAfter === "number"
						? body.nextAfter
						: state.messages[state.messages.length - 1].id;
				renderThread();
				renderBadge();
				if (hadSupport) announceNewSupport(incoming);
			} else if (typeof body.nextAfter === "number") {
				state.after = Math.max(state.after, body.nextAfter);
			}
			renderClosedState();
		} catch {
			// Transient network failure: keep the thread visible, back off quietly.
			state.pollBackoffMs = Math.min(state.pollBackoffMs * 2, MAX_POLL_MS);
			showSendError("اتصال قطع شد. پیام‌های جدید به‌صورت خودکار بررسی می‌شوند.");
		} finally {
			state.pollInFlight = false;
		}
	}

	function announceNewSupport(incoming: ChatMessage[]): void {
		const fresh = incoming.filter(
			(m) => m.sender === "support" && !state.announcedIds.has(m.id),
		);
		for (const m of fresh) state.announcedIds.add(m.id);
		// Avoid announcement spam during polling: one concise live-region update.
		if (fresh.length > 0 && state.open && els) {
			els.srStatus.textContent =
				fresh.length === 1
					? "پیام جدید از پشتیبانی دریافت شد."
					: `${fresh.length} پیام جدید از پشتیبانی دریافت شد.`;
		}
	}

	// ----------------------------------------------------------------- sending
	interface SendBody {
		success?: boolean;
		message?: ChatMessage | null;
		deduped?: boolean;
		status?: string;
		message2?: string;
	}

	async function sendMessage(text: string, clientMsgId: string): Promise<void> {
		const pending = state.pendings.get(clientMsgId);
		if (pending) pending.status = "sending";
		hideSendError();
		renderThread();
		try {
			const { status, body } = await api<SendBody & { message?: string }>(
				"/api/chat/conversations/current/messages",
				{
					method: "POST",
					body: JSON.stringify({ text, clientMsgId }),
				},
			);
			if (status === 429) {
				throw new Error(
					"سرعت ارسال زیاد است. چند لحظه صبر کنید و دوباره تلاش کنید.",
				);
			}
			const b = body as {
				success?: boolean;
				message?: ChatMessage | string | null;
				deduped?: boolean;
				status?: string;
			};
			if (!b.success || !b.message || typeof b.message === "string") {
				if (
					status === 401 ||
					(b as { code?: string }).code === "needs_onboarding"
				) {
					state.screen = "onboarding";
					renderAll();
					throw new Error("لطفاً ابتدا فرم معرفی را تکمیل کنید.");
				}
				throw new Error(
					typeof b.message === "string" ? b.message : "ارسال پیام انجام نشد.",
				);
			}
			state.pendings.delete(clientMsgId);
			state.messages = mergeMessages(state.messages, [b.message]);
			state.after = Math.max(state.after, b.message.id);
			if (b.status && state.conversation) state.conversation.status = b.status;
			markSeen();
			renderThread();
			renderBadge();
			void pollNow();
		} catch (e) {
			const p = state.pendings.get(clientMsgId);
			if (p) {
				p.status = "failed";
				p.error = e instanceof Error ? e.message : "ارسال پیام انجام نشد.";
			}
			showSendError(e instanceof Error ? e.message : "ارسال پیام انجام نشد.");
			renderThread();
		}
	}

	// --------------------------------------------------------------- rendering
	function showScreen(screen: typeof state.screen): void {
		if (!els) return;
		els.loading.classList.toggle("is-hidden", screen !== "loading");
		els.onboarding.classList.toggle("is-hidden", screen !== "onboarding");
		els.thread.classList.toggle("is-hidden", screen !== "thread");
		els.errorScreen.classList.toggle("is-hidden", screen !== "error");
	}

	function showFatal(text: string): void {
		state.screen = "error";
		if (els) {
			els.errorText.textContent = text;
			showScreen("error");
		}
	}

	function showSendError(text: string): void {
		if (!els) return;
		els.sendError.textContent = text;
		els.sendError.classList.remove("is-hidden");
	}

	function hideSendError(): void {
		if (!els) return;
		els.sendError.textContent = "";
		els.sendError.classList.add("is-hidden");
	}

	function renderClosedState(): void {
		if (!els) return;
		const closed = state.conversation?.status === "closed";
		els.closedNotice.classList.toggle("is-hidden", !closed);
		els.input.disabled = false; // closed threads accept a new message (reopens)
		els.input.placeholder = closed
			? "گفتگو بسته شده؛ پیام جدید بفرستید تا باز شود…"
			: "پیام خود را بنویسید…";
	}

	function isNearBottom(): boolean {
		if (!els) return true;
		const { scrollTop, scrollHeight, clientHeight } = els.log;
		return scrollHeight - (scrollTop + clientHeight) < 96;
	}

	function renderThread(): void {
		if (!els || state.screen !== "thread") return;
		const stick = isNearBottom();
		els.log.textContent = "";

		if (state.messages.length === 0 && state.pendings.size === 0) {
			const empty = document.createElement("div");
			empty.className = "pnara-chat-empty";
			empty.textContent =
				"گفتگوی جدید — پیام خود را بنویسید تا پشتیبانی پاسخ دهد.";
			els.log.appendChild(empty);
		}

		for (const m of state.messages) els.log.appendChild(messageNode(m));
		for (const p of state.pendings.values())
			els.log.appendChild(pendingNode(p));

		renderClosedState();
		if (els) els.newPill.classList.add("is-hidden");
		if (stick) els.log.scrollTop = els.log.scrollHeight;
		else if (els) {
			// There are unread messages below only if we appended while scrolled up.
			els.newPill.classList.remove("is-hidden");
		}
		updateSendState();
	}

	function updateSendState(): void {
		if (!els) return;
		const sending = [...state.pendings.values()].some(
			(p) => p.status === "sending",
		);
		els.sendBtn.disabled = sending && els.input.value.trim() === "";
		els.sendBtn.setAttribute("aria-busy", sending ? "true" : "false");
	}

	function messageNode(m: ChatMessage): HTMLElement {
		const wrap = document.createElement("div");
		wrap.className = `pnara-chat-msg is-${m.sender}`;
		wrap.dataset.mid = String(m.id);

		const bubble = document.createElement("div");
		bubble.className = "pnara-chat-bubble";
		bubble.setAttribute("dir", "auto");
		appendTokens(bubble, m.text);
		wrap.appendChild(bubble);

		const meta = document.createElement("div");
		meta.className = "pnara-chat-meta";
		const who = document.createElement("span");
		who.className = "pnara-chat-who";
		who.textContent =
			m.sender === "visitor"
				? "شما"
				: m.sender === "support"
					? m.senderName
						? `پشتیبانی (${m.senderName})`
						: "پشتیبانی"
					: "سیستم";
		meta.appendChild(who);
		const time = document.createElement("time");
		time.className = "pnara-chat-time";
		try {
			const d = new Date(m.createdAt);
			time.dateTime = d.toISOString();
			time.textContent = fmt.format(d);
		} catch {
			time.textContent = "";
		}
		meta.appendChild(time);
		wrap.appendChild(meta);
		return wrap;
	}

	function pendingNode(p: PendingMsg): HTMLElement {
		const wrap = document.createElement("div");
		wrap.className = "pnara-chat-msg is-visitor is-pending";
		const bubble = document.createElement("div");
		bubble.className = "pnara-chat-bubble";
		bubble.setAttribute("dir", "auto");
		appendTokens(bubble, p.text);
		wrap.appendChild(bubble);
		const meta = document.createElement("div");
		meta.className = "pnara-chat-meta";
		const st = document.createElement("span");
		st.className = "pnara-chat-state";
		if (p.status === "sending") {
			st.textContent = "در حال ارسال…";
		} else {
			st.textContent = "ارسال نشد.";
			const retry = document.createElement("button");
			retry.type = "button";
			retry.className = "pnara-chat-retry";
			retry.textContent = "تلاش مجدد";
			retry.addEventListener(
				"click",
				() => void sendMessage(p.text, p.clientMsgId),
			);
			meta.appendChild(st);
			meta.appendChild(retry);
			wrap.appendChild(meta);
			return wrap;
		}
		meta.appendChild(st);
		wrap.appendChild(meta);
		return wrap;
	}

	/** Map tokenized text to safe DOM nodes (textContent only). Exported for tests via {@link renderTokensForTest}. */
	function appendTokens(parent: HTMLElement, text: string): void {
		for (const t of tokenizeMessage(text)) {
			if (t.kind === "text") {
				parent.appendChild(document.createTextNode(t.text));
			} else {
				const a = document.createElement("a");
				a.textContent = t.text;
				a.setAttribute("href", t.kind === "link" ? safeHref(t.href) : t.href);
				if (t.kind === "link") {
					a.setAttribute("target", "_blank");
					a.setAttribute("rel", "noopener noreferrer nofollow");
				}
				a.setAttribute("dir", "ltr");
				a.className = "pnara-chat-link";
				parent.appendChild(a);
			}
		}
	}

	function safeHref(href: string): string {
		try {
			const u = new URL(href);
			if (u.protocol === "http:" || u.protocol === "https:")
				return u.toString();
		} catch {
			/* fall through */
		}
		return "#";
	}

	// ------------------------------------------------------------------- badge
	function loadSeen(): { convId: string; lastId: number } {
		try {
			const raw = localStorage.getItem(SEEN_KEY);
			if (raw) return JSON.parse(raw) as { convId: string; lastId: number };
		} catch {
			/* ignore */
		}
		return { convId: "", lastId: 0 };
	}

	function markSeen(): void {
		if (!state.conversation || state.messages.length === 0) return;
		try {
			localStorage.setItem(
				SEEN_KEY,
				JSON.stringify({ convId: state.conversation.id, lastId: state.after }),
			);
		} catch {
			/* ignore */
		}
		renderBadge();
	}

	function unreadCount(): number {
		if (!state.conversation || state.open) return 0;
		const seen = loadSeen();
		if (seen.convId !== state.conversation.id) {
			return state.messages.filter((m) => m.sender === "support").length;
		}
		return state.messages.filter(
			(m) => m.sender === "support" && m.id > seen.lastId,
		).length;
	}

	function renderBadge(): void {
		if (!els) return;
		const n = unreadCount();
		els.badge.textContent = n > 99 ? "۹۹+" : n > 0 ? toFaDigits(n) : "";
		els.badge.classList.toggle("is-hidden", n === 0);
		els.fab.setAttribute(
			"aria-label",
			n > 0
				? `گفتگو با پشتیبانی، ${toFaDigits(n)} پیام خوانده‌نشده`
				: "گفتگو با پشتیبانی",
		);
	}

	function toFaDigits(n: number): string {
		try {
			return new Intl.NumberFormat("fa-IR").format(n);
		} catch {
			return String(n);
		}
	}

	// ------------------------------------------------------------- open / close
	function setOpen(open: boolean): void {
		state.open = open;
		if (!els) return;
		els.panel.classList.toggle("is-open", open);
		els.panel.setAttribute("aria-hidden", open ? "false" : "true");
		els.fab.setAttribute("aria-expanded", open ? "true" : "false");
		if (open) {
			state.lastFocus = document.activeElement as HTMLElement | null;
			markSeen();
			renderThread();
			renderBadge();
			const target =
				state.screen === "onboarding" ? els.inputs.firstName : els.input;
			window.setTimeout(() => target?.focus({ preventScroll: true }), 60);
			if (state.screen === "thread") {
				void pollNow();
				schedulePoll(state.pollBackoffMs);
			}
		} else {
			window.clearTimeout(state.pollTimer);
			state.lastFocus?.focus?.({ preventScroll: true });
		}
	}

	// ------------------------------------------------------------------ events
	function collectElements(root: HTMLElement): Elements | null {
		const get = <T extends HTMLElement>(sel: string): T | null =>
			query<T>(root, sel);
		const fab = get<HTMLButtonElement>("[data-chat-fab]");
		const panel = get<HTMLElement>("[data-chat-panel]");
		if (!fab || !panel) return null;
		const req = <T extends HTMLElement>(sel: string): T => {
			const el = get<T>(sel);
			if (!el) throw new Error(`live-chat: missing element ${sel}`);
			return el;
		};
		return {
			root,
			fab,
			badge: req("[data-chat-badge]"),
			panel,
			closeBtn: req("[data-chat-close]"),
			minBtn: req("[data-chat-min]"),
			loading: req("[data-chat-loading]"),
			onboarding: req("[data-chat-onboarding]"),
			form: req<HTMLFormElement>("[data-chat-form]"),
			thread: req("[data-chat-thread]"),
			log: req("[data-chat-log]"),
			closedNotice: req("[data-chat-closed]"),
			composer: req<HTMLFormElement>("[data-chat-composer]"),
			input: req<HTMLInputElement>("[data-chat-input]"),
			sendBtn: req<HTMLButtonElement>("[data-chat-send]"),
			sendError: req("[data-chat-send-error]"),
			errorScreen: req("[data-chat-error]"),
			errorText: req("[data-chat-error-text]"),
			retryBtn: req<HTMLButtonElement>("[data-chat-retry]"),
			newPill: req<HTMLButtonElement>("[data-chat-new-pill]"),
			srStatus: req("[data-chat-sr]"),
			inputs: {
				firstName: req<HTMLInputElement>("#pnara-chat-firstname"),
				lastName: req<HTMLInputElement>("#pnara-chat-lastname"),
				cafeName: req<HTMLInputElement>("#pnara-chat-cafename"),
				phone: req<HTMLInputElement>("#pnara-chat-phone"),
			},
			fieldErrors: {
				firstName: req("#pnara-chat-err-firstname"),
				lastName: req("#pnara-chat-err-lastname"),
				cafeName: req("#pnara-chat-err-cafename"),
				phone: req("#pnara-chat-err-phone"),
			},
		};
	}

	function clearFieldErrors(): void {
		if (!els) return;
		for (const key of Object.keys(els.fieldErrors)) {
			const errEl = els.fieldErrors[key];
			const input = els.inputs[key];
			if (errEl) {
				errEl.textContent = "";
				errEl.classList.add("is-hidden");
			}
			if (input) input.removeAttribute("aria-invalid");
		}
	}

	function showFieldErrors(errors: Record<string, string | undefined>): void {
		if (!els) return;
		let first: HTMLInputElement | null = null;
		for (const [key, code] of Object.entries(errors)) {
			if (!code) continue;
			const errEl = els.fieldErrors[key];
			const input = els.inputs[key];
			if (!input || !errEl) continue;
			errEl.textContent = fieldErrorText(code, FIELD_LABELS[key] ?? key);
			errEl.classList.remove("is-hidden");
			input.setAttribute("aria-invalid", "true");
			first = first ?? input;
		}
		first?.focus({ preventScroll: true });
	}

	els.fab.addEventListener("click", () => setOpen(!state.open));
	els.closeBtn.addEventListener("click", () => setOpen(false));
	els.minBtn.addEventListener("click", () => setOpen(false));
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && state.open) setOpen(false);
	});
	els.newPill.addEventListener("click", () => {
		els.log.scrollTop = els.log.scrollHeight;
		els.newPill.classList.add("is-hidden");
		markSeen();
	});
	els.log.addEventListener("scroll", () => {
		if (isNearBottom()) {
			els.newPill.classList.add("is-hidden");
			markSeen();
		}
	});
	document.addEventListener("visibilitychange", () => {
		if (!document.hidden && shouldPoll()) {
			void pollNow();
			schedulePoll(state.pollBackoffMs);
		} else {
			window.clearTimeout(state.pollTimer);
		}
	});
	window.addEventListener("online", () => {
		hideSendError();
		if (state.screen === "error") void bootstrap();
		else if (shouldPoll()) void pollNow();
	});
	els.retryBtn.addEventListener("click", () => void bootstrap());

	els.form.addEventListener("submit", (e) => {
		e.preventDefault();
		if (state.submitting || !els) return;
		clearFieldErrors();
		const raw = {
			firstName: els.inputs.firstName.value,
			lastName: els.inputs.lastName.value,
			cafeName: els.inputs.cafeName.value,
			phone: els.inputs.phone.value,
		};
		const check = validateOnboarding(raw);
		if (!check.ok) {
			showFieldErrors(check.errors);
			return;
		}
		state.submitting = true;
		const btn = els.form.querySelector<HTMLButtonElement>("[data-chat-submit]");
		btn?.setAttribute("aria-busy", "true");
		if (btn) btn.disabled = true;
		api<SessionBody>("/api/chat/session", {
			method: "POST",
			body: JSON.stringify(check.value),
		})
			.then(({ status, body }) => {
				if (!body.success) {
					if (body.errors) showFieldErrors(body.errors);
					else showFieldErrors({ phone: "required" });
					void status;
					return;
				}
				adoptSession(body);
				renderAll();
				markSeen();
				if (state.screen === "thread") void pollNow();
			})
			.catch(() => {
				showFatal(
					"اتصال به سرویس گفتگو برقرار نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.",
				);
			})
			.finally(() => {
				state.submitting = false;
				btn?.setAttribute("aria-busy", "false");
				if (btn) btn.disabled = false;
			});
	});

	els.composer.addEventListener("submit", (e) => {
		e.preventDefault();
		const text = els.input.value;
		const check = validateMessageText(text);
		if (!check.ok) {
			showSendError(
				check.error === "too_long"
					? "پیام خیلی طولانی است (حداکثر ۲۰۰۰ نویسه)."
					: "اول پیام خود را بنویسید.",
			);
			return;
		}
		const clientMsgId = uuid();
		state.pendings.set(clientMsgId, {
			clientMsgId,
			text: check.value,
			status: "sending",
		});
		els.input.value = "";
		updateSendState();
		void sendMessage(check.value, clientMsgId);
	});

	els.input.addEventListener("input", () => {
		hideSendError();
		updateSendState();
	});

	// Token helpers -----------------------------------------------------------
	function loadToken(): string {
		try {
			return localStorage.getItem(TOKEN_KEY) ?? "";
		} catch {
			return "";
		}
	}
	function saveToken(t: string): void {
		state.token = t;
		try {
			localStorage.setItem(TOKEN_KEY, t);
		} catch {
			/* cookie fallback still applies via credentials:include */
		}
	}
	function clearToken(): void {
		state.token = "";
		try {
			localStorage.removeItem(TOKEN_KEY);
		} catch {
			/* ignore */
		}
	}

	// Defer bootstrap so the widget never slows the first paint.
	const start = (): void => void bootstrap();
	const idleCb = (
		window as unknown as { requestIdleCallback?: (cb: () => void) => void }
	).requestIdleCallback;
	if (typeof idleCb === "function") idleCb(start);
	else window.setTimeout(start, 800);

	return () => {
		window.clearTimeout(state.pollTimer);
	};
}
