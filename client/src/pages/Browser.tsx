import React, { useState, useRef, useEffect, useMemo } from "react";
import { useToast } from '@/hooks/use-toast';
import axios from "axios";

const HOME_URL = ""; // Leave blank for a custom home page
const API_ENDPOINT = "/api/router?url=";
const nodeVersion = "v22.19.0"; // Replace with actual version if needed

const hints = [
    `The current uptime is... 70 years...`,
    "Did you know this app uses React?",
    "Tip: You can press Enter to load a URL.",
    "Your browsing is sandboxed for safety.",
    "Powered by SlmRouter.",
    "When in doubt, hit reload and pray it didn't crash the app!",
    "Try the back and forward buttons!",
    "Stuck? Click the home button.",
    "You can open links in a new tab.",
    "Enjoy your browsing experience!",
    "This is a mini web browser.",
    "Feel free to explore the web!",
    "Loading... please wait.",
    "Need help? Add me on SnapChat! (mason.dean69).",
    "Tip: URLs without http/https will default to https://",
    "This app is built with love and React.",
    "Your privacy is important to us.",
    "Have fun browsing the web!",
    "Remember to bookmark your favorite sites!",
    "Stay safe online and avoid suspicious links.",
    "This browser supports modern web standards.",
    "You can navigate using the buttons above.",
    "Enjoy a seamless browsing experience!",
    "Feel free to customize your browsing experience.",
    "This app is continuously improved with user feedback.",
    "Explore the web with confidence!",
    "Your feedback helps us make this app better.",
    "Thank you for using our mini browser!",
    "Happy browsing! 🌐",
    "Did you know that it took me 3 months to make this app?",
    "HELP! IM LOCKED IN THIS EFFICIENT APP! GOD IF ONLY IT HAD A BACK BUTTON!",
    `The current time is ${new Date().toLocaleTimeString()}.`,
    `The servers are running on Node.js ${nodeVersion}.`,
    `This app is running React version ${React.version}.`,
    `The current server latency is approximately ${Math.floor(Math.random() * 100) + 50}ms. (Just kidding, I didn't feel like coding that)`,
];

export default function Browser() {
    // Tab state: each tab has its own url, inputValue, historyStack, historyIndex, loading, loadingDots, pageMeta
    const [tabs, setTabs] = useState([
        {
            url: HOME_URL,
            inputValue: HOME_URL,
            historyStack: HOME_URL ? [HOME_URL] : [],
            historyIndex: HOME_URL ? 0 : -1,
            loading: false,
            loadingDots: ".",
            pageMeta: { title: null, favicon: null },
        },
    ]);
    const [currentTab, setCurrentTab] = useState(0);
    const [hintIndex, setHintIndex] = useState(0);
    const [hintVisible, setHintVisible] = useState(true);
    // One ref per tab so each tab's iframe DOM/JS state is preserved
    const iframeRefs = useMemo(() => tabs.map(() => React.createRef<HTMLIFrameElement>()), [tabs.length]);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const toastState = useToast();
    const [bookmarks, setBookmarks] = useState<any[]>([]);

    // Helper to get/set current tab state
    const tab = tabs[currentTab];
    function setTabState(newState: Partial<typeof tab>) {
        setTabs(tabs => tabs.map((t, i) => i === currentTab ? { ...t, ...newState } : t));
    }

    function loadBookmarks() {
        try {
            const raw = localStorage.getItem('slm-bookmarks');
            const list = raw ? JSON.parse(raw) : [];
            setBookmarks(Array.isArray(list) ? list : []);
        } catch (e) {
            setBookmarks([]);
        }
    }

    function getServeUrl(targetUrl: string) {
        return API_ENDPOINT + btoa(encodeURIComponent(targetUrl));
    }

    function normalizeUrlOrSearch(input: string): string {
        // If input looks like a URL (has a dot and no spaces), treat as URL
        const hasDot = /\./.test(input);
        const hasSpace = /\s/.test(input);
        const isLikelyUrl = hasDot && !hasSpace;
        if (isLikelyUrl) {
            // Add protocol if missing
            if (!/^https?:\/\//i.test(input)) {
                return "https://" + input;
            }
            return input;
        }
        // Otherwise, treat as search query
        const encoded = encodeURIComponent(input.trim());
        return `https://www.bing.com/search?q=${encoded}`;
    }

    function loadURL(newUrl: string, addToHistory = true) {
        let formattedUrl = normalizeUrlOrSearch(newUrl);
        setTabState({ url: formattedUrl, inputValue: formattedUrl });
        if (addToHistory) {
            const newHistory = tab.historyStack.slice(0, tab.historyIndex + 1);
            newHistory.push(formattedUrl);
            setTabState({ historyStack: newHistory, historyIndex: newHistory.length - 1 });
        }
    }

    function goBack() {
        if (tab.historyIndex > 0) {
            const newIndex = tab.historyIndex - 1;
            setTabState({
                historyIndex: newIndex,
                url: tab.historyStack[newIndex],
                inputValue: tab.historyStack[newIndex],
            });
        }
    }

    function goForward() {
        if (tab.historyIndex < tab.historyStack.length - 1) {
            const newIndex = tab.historyIndex + 1;
            setTabState({
                historyIndex: newIndex,
                url: tab.historyStack[newIndex],
                inputValue: tab.historyStack[newIndex],
            });
        }
    }

    function reload() {
        const iframe = iframeRefs[currentTab]?.current;
        if (iframe && tab.url) {
            setTabState({ loading: true });
            iframe.src = getServeUrl(tab.url);
        }
    }

    function goHome() {
        setTabState({ url: "", inputValue: "", historyStack: [], historyIndex: -1 });
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        setTabState({ inputValue: e.target.value });
    }

    function handleInputKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            loadURL(tab.inputValue);
        }
    }

    function handleGoClick() {
        loadURL(tab.inputValue);
    }

    // Resolve the actual target URL from the iframe (same logic used elsewhere)
    async function resolveIframeTarget(): Promise<string | null> {
        const iframe = iframeRefs[currentTab]?.current;
        if (!iframe) return null;
        try {
            const winHref = iframe.contentWindow?.location?.href;
            if (winHref) {
                try {
                    const parsed = new URL(winHref, window.location.href);
                    const q = parsed.searchParams.get('url');
                    if (q) return decodeURIComponent(atob(q));
                    return winHref;
                } catch (e) {
                    return winHref;
                }
            }
        } catch (err) {
            // cross-origin — fallback to iframe.src parsing
            try {
                const parsed2 = new URL(iframe.src, window.location.href);
                const q2 = parsed2.searchParams.get('url');
                if (q2) return decodeURIComponent(atob(q2));
                return parsed2.href;
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    // Bookmark the currently displayed page: save to localStorage
    async function bookmarkCurrent() {
        try {
            const iframe = iframeRefs[currentTab]?.current;
            if (!iframe) return toastState.toast({ title: 'No page', description: 'No page to bookmark', variant: 'destructive' });

            const target = await resolveIframeTarget();
            const bookmark = {
                id: Date.now().toString(),
                createdAt: new Date().toISOString(),
                iframeSrc: iframe.src || null,
                targetUrl: target,
                title: tab.pageMeta?.title || null,
                favicon: tab.pageMeta?.favicon || null,
            };

            const key = 'slm-bookmarks';
            const raw = localStorage.getItem(key);
            let list: any[] = [];
            try { list = raw ? JSON.parse(raw) : []; } catch (e) { list = []; }

            // avoid duplicates: same targetUrl or iframeSrc
            const exists = list.find((b: any) => (b.targetUrl && b.targetUrl === bookmark.targetUrl) || (b.iframeSrc && b.iframeSrc === bookmark.iframeSrc));
            if (exists) return toastState.toast({ title: 'Already bookmarked', description: 'This page is already in your bookmarks' });

            list.unshift(bookmark);
            localStorage.setItem(key, JSON.stringify(list));
            loadBookmarks();
            toastState.toast({ title: 'Bookmarked', description: bookmark.title || bookmark.targetUrl || 'Saved to bookmarks' });
        } catch (e) {
            console.error('bookmark error', e);
            toastState.toast({ title: 'Error', description: 'Failed to bookmark', variant: 'destructive' });
        }
    }

    // Show loading overlay when url changes (for iframe)
    useEffect(() => {
        // When url changes for current tab, set loading true
        if (tab.url) setTabState({ loading: true });
        // eslint-disable-next-line
    }, [tab.url, currentTab]);

    // fetch page meta (title + favicon) via server when url changes
    useEffect(() => {
        let mounted = true;
        async function doFetch() {
            if (!tab.url) {
                if (mounted) setTabState({ pageMeta: { title: null, favicon: null } });
                return;
            }
            try {
                const encoded = btoa(encodeURIComponent(tab.url));
                const r = await fetch(`/api/meta?url=${encoded}`);
                const j = await r.json();
                if (!mounted) return;
                setTabState({ pageMeta: { title: j.title || null, favicon: j.favicon || null } });
            } catch (e) {
                if (mounted) setTabState({ pageMeta: { title: null, favicon: null } });
            }
        }
        doFetch();
        return () => { mounted = false; };
    }, [tab.url, currentTab]);

    // when loading changes, show a temporary loading title and refetch meta when loading completes
    useEffect(() => {
        let mounted = true;
        if (tab.loading) {
            setTabState({ pageMeta: { ...(tab.pageMeta || {}), title: `Loading${tab.loadingDots}` } });
            return () => { mounted = false; };
        }
        async function refresh() {
            if (!tab.url) {
                if (mounted) setTabState({ pageMeta: { title: null, favicon: null } });
                return;
            }
            try {
                const encoded = btoa(encodeURIComponent(tab.url));
                const r = await fetch(`/api/meta?url=${encoded}`);
                const j = await r.json();
                if (!mounted) return;
                setTabState({ pageMeta: { title: j.title || null, favicon: j.favicon || null } });
            } catch (e) {
                if (mounted) setTabState({ pageMeta: { title: null, favicon: null } });
            }
        }
        refresh();
        return () => { mounted = false; };
    }, [tab.loading, tab.loadingDots, currentTab]);

    // Poll current iframe every 10 seconds: refresh meta (title + favicon) and
    // update state if the title or favicon changed. This will trigger the
    // existing effect that reloads the favicon link tags with a cache buster.
    useEffect(() => {
        if (!tab.url) return;
        let mounted = true;
        const interval = setInterval(async () => {
            try {
                const target = await resolveIframeTarget();
                if (!target) return;
                const encoded = btoa(encodeURIComponent(target));
                const resp = await fetch(`/api/meta?url=${encoded}`);
                if (!resp.ok) return;
                const j = await resp.json();
                if (!mounted) return;
                const newTitle = j.title || null;
                const newFavicon = j.favicon || null;
                const curTitle = tab.pageMeta?.title || null;
                const curFavicon = tab.pageMeta?.favicon || null;
                if (newTitle !== curTitle || newFavicon !== curFavicon) {
                    setTabState({ pageMeta: { title: newTitle, favicon: newFavicon } });
                }
            } catch (e) {
                // ignore polling errors
            }
        }, 10000);
        return () => { mounted = false; clearInterval(interval); };
    }, [currentTab, tab.url, tab.pageMeta?.title, tab.pageMeta?.favicon]);

    // Animate loading dots
    useEffect(() => {
        if (!tab.loading) return;
        const interval = setInterval(() => {
            setTabState({ loadingDots: tab.loadingDots === "." ? ".." : tab.loadingDots === ".." ? "..." : "." });
        }, 400);
        return () => clearInterval(interval);
    }, [tab.loading, tab.loadingDots, currentTab]);

    // Rotate hints every 5 seconds, choosing a random index and doing a short fade
    useEffect(() => {
        setHintVisible(true);
        let fadeTimeout: ReturnType<typeof setTimeout> | null = null;

        const interval = setInterval(() => {
            // fade out
            setHintVisible(false);
            fadeTimeout = setTimeout(() => {
                // pick a random hint index
                const idx = Math.floor(Math.random() * hints.length);
                setHintIndex(idx);
                // fade in
                setHintVisible(true);
            }, 1000); // fade duration: 1s
        }, 5000); // rotate every 5 seconds

        return () => {
            if (fadeTimeout) clearTimeout(fadeTimeout);
            clearInterval(interval);
        };
    }, []);

    // Keep url and historyIndex in sync, and guard against negative index
    useEffect(() => {
        // Keep url and inputValue in sync with historyIndex for current tab
        if (tab.historyIndex >= 0 && tab.historyStack[tab.historyIndex]) {
            setTabState({ url: tab.historyStack[tab.historyIndex], inputValue: tab.historyStack[tab.historyIndex] });
        } else if (tab.historyIndex === -1) {
            setTabState({ url: "", inputValue: "" });
        }
        // eslint-disable-next-line
    }, [tab.historyIndex, currentTab]);

    // Attach listeners to the current tab's iframe only so events are accurate per-tab
    useEffect(() => {
        const iframe = iframeRefs[currentTab]?.current;
        if (!iframe) return;
        const handleLoad = async () => {
            setTabState({ loading: false });
            let actualTarget: string | null = null;
            try {
                const winHref = iframe.contentWindow?.location?.href;
                if (winHref) {
                    try {
                        const parsed = new URL(winHref, window.location.href);
                        const q = parsed.searchParams.get('url');
                        if (q) actualTarget = decodeURIComponent(atob(q));
                        else actualTarget = winHref;
                    } catch (e) {
                        actualTarget = winHref;
                    }
                }
            } catch (err) {
                try {
                    const parsed2 = new URL(iframe.src, window.location.href);
                    const q2 = parsed2.searchParams.get('url');
                    if (q2) actualTarget = decodeURIComponent(atob(q2));
                    else actualTarget = parsed2.href;
                } catch (e) {
                    actualTarget = null;
                }
            }
            if (actualTarget) {
                try {
                    const encoded = btoa(encodeURIComponent(actualTarget));
                    const resp = await fetch(`/api/meta?url=${encoded}`);
                    if (resp.ok) {
                        const j = await resp.json();
                        setTabState({ pageMeta: { title: j.title || null, favicon: j.favicon || null } });
                    } else {
                        setTabState({ pageMeta: { title: null, favicon: null } });
                    }
                } catch (e) {
                    setTabState({ pageMeta: { title: null, favicon: null } });
                }
            }
        };
        const handleBeforeUnload = () => setTabState({ loading: true });
        iframe.addEventListener("load", handleLoad);
        let attachedBeforeUnload = false;
        try {
            void iframe.contentWindow?.location?.href;
            iframe.contentWindow?.addEventListener("beforeunload", handleBeforeUnload);
            attachedBeforeUnload = true;
        } catch (err) {
            attachedBeforeUnload = false;
        }
        return () => {
            iframe.removeEventListener("load", handleLoad);
            if (attachedBeforeUnload) {
                try {
                    iframe.contentWindow?.removeEventListener("beforeunload", handleBeforeUnload);
                } catch (e) {}
            }
        };
    }, [currentTab, tab.url]);

    // Update document.title and favicon when pageMeta changes
    useEffect(() => {
        try {
            const title = tab.pageMeta?.title ? `${tab.pageMeta.title} - SlmBrowser` : 'SlmBrowser';
            const favicon = tab.pageMeta?.favicon || '/favicon.ico';
            const setLink = (rel: string) => {
                let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
                if (!el) {
                    el = document.createElement('link');
                    el.rel = rel;
                    document.head.appendChild(el);
                }
                el.href = `${favicon}?_=${Date.now()}`;
            };
            setLink('icon');
            setLink('shortcut icon');
        } catch (e) {}
    }, [tab.pageMeta, currentTab]);

    // load theme from localStorage and apply
    useEffect(() => {
        try {
            const stored = localStorage.getItem('slm-theme');
            if (stored === 'dark' || stored === 'light') setTheme(stored);
        } catch (e) {
            /* ignore */
        }
    }, []);

    // load bookmarks on mount
    useEffect(() => {
        loadBookmarks();
    }, []);

    // persist theme and apply simple document-level attribute for CSS hooks
    useEffect(() => {
        try {
            localStorage.setItem('slm-theme', theme);
            document.documentElement.setAttribute('data-theme', theme);
            document.body.style.background = theme === 'dark' ? '#071024' : '#ffffff';
        } catch (e) {
            /* ignore */
        }
    }, [theme]);

    return (
        <div style={appStyle}>
            {/* Tab bar */}
            <div style={{...tabBarStyle, background: theme === 'dark' ? '#0b1220' : tabBarStyle.background, color: theme === 'dark' ? '#e6e7eb' : undefined}}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {tabs.map((t, i) => (
                        <div
                            key={i}
                            style={{
                                ...((i === currentTab) ? tabStyleActive : tabStyle),
                                display: 'flex', alignItems: 'center', gap: 8, position: 'relative', minWidth: 80, maxWidth: 220, cursor: 'pointer',
                                background: i === currentTab ? (theme === 'dark' ? '#1a2332' : '#fff') : 'transparent',
                                border: i === currentTab ? '1px solid #2563eb' : 'none',
                            }}
                            onClick={() => setCurrentTab(i)}
                        >
                            <img src={t.pageMeta?.favicon || '/favicon.ico'} alt="favicon" style={{ width: 16, height: 16 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{t.pageMeta?.title || 'New Tab'}</span>
                            {tabs.length > 1 && (
                                <button
                                    onClick={e => { e.stopPropagation();
                                        setTabs(tabs => {
                                            if (tabs.length === 1) return tabs;
                                            const newTabs = tabs.filter((_, idx) => idx !== i);
                                            let newCurrent = currentTab;
                                            if (currentTab === i) newCurrent = Math.max(0, i - 1);
                                            else if (currentTab > i) newCurrent = currentTab - 1;
                                            setCurrentTab(newCurrent);
                                            return newTabs;
                                        });
                                    }}
                                    style={{ marginLeft: 4, background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14, padding: 0 }}
                                    title="Close tab"
                                >×</button>
                            )}
                        </div>
                    ))}
                    {/* Add tab button */}
                    <div
                        style={{ ...tabStyle, fontWeight: 600, fontSize: 20, cursor: tabs.length < 9 ? 'pointer' : 'not-allowed', opacity: tabs.length < 9 ? 1 : 0.4 }}
                        onClick={() => {
                            if (tabs.length >= 9) return;
                            setTabs(tabs => [...tabs, {
                                url: HOME_URL,
                                inputValue: HOME_URL,
                                historyStack: HOME_URL ? [HOME_URL] : [],
                                historyIndex: HOME_URL ? 0 : -1,
                                loading: false,
                                loadingDots: ".",
                                pageMeta: { title: null, favicon: null },
                            }]);
                            setCurrentTab(tabs.length);
                        }}
                        title={tabs.length < 9 ? 'New Tab' : 'Max 9 tabs'}
                    >+
                    </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ opacity: 0.6, fontSize: 12, marginRight: 8 }}>{new URL(tab.url || 'https://slmrouter.online', window.location.href).hostname || 'slmrouter'}</div>
                    <button
                        aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
                        title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
                        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                        style={{
                            border: 'none',
                            background: 'transparent',
                            padding: 0,
                            cursor: 'pointer',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px', borderRadius: 999, background: theme === 'dark' ? '#0b1220' : '#fff', border: '1px solid #d1d5db' }}>
                            <span style={{ fontSize: 14, opacity: theme === 'light' ? 1 : 0.5 }}>☀️</span>
                            <div style={{ width: 44, height: 24, borderRadius: 999, background: theme === 'dark' ? '#334155' : '#e6e6e6', position: 'relative', padding: 2 }}>
                                <div style={{ position: 'absolute', top: 2, left: theme === 'light' ? 2 : 20, width: 20, height: 20, borderRadius: 999, background: theme === 'dark' ? '#0b1220' : '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left 160ms ease' }} />
                            </div>
                            <span style={{ fontSize: 14, opacity: theme === 'dark' ? 1 : 0.5 }}>🌙</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div style={{...toolbarStyle, background: theme === 'dark' ? '#071428' : toolbarStyle.background, borderBottom: theme === 'dark' ? '1px solid #0f1724' : toolbarStyle.borderBottom}}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button onClick={goBack} disabled={tab.historyIndex <= 0} style={iconButtonStyle} aria-label="Back">◀</button>
                    <button onClick={goForward} disabled={tab.historyIndex >= tab.historyStack.length - 1} style={iconButtonStyle} aria-label="Forward">▶</button>
                    <button onClick={reload} disabled={!tab.url} style={iconButtonStyle} aria-label="Reload">⟳</button>
                    <button onClick={goHome} style={iconButtonStyle} aria-label="Home">🏠</button>
                </div>

                <div style={addressBarWrapStyle}>
                    <div style={{...lockStyle, background: theme === 'dark' ? '#0b1220' : lockStyle.background, color: theme === 'dark' ? '#9aa7ff' : lockStyle.color}}>🔒</div>
                    <input
                        type="text"
                        value={tab.inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleInputKeyPress}
                        placeholder="Search or enter address"
                        style={{...addressBarStyle, background: theme === 'dark' ? '#031023' : addressBarStyle.background, color: theme === 'dark' ? '#e6eefb' : undefined, border: theme === 'dark' ? '1px solid #203041' : addressBarStyle.border}}
                    />
                    <button onClick={handleGoClick} style={goButtonStyle}>Go</button>
                    <button onClick={() => bookmarkCurrent()} style={iconButtonStyle} title="Bookmark">☆</button>
                </div>
            </div>

            {/* Content area */}
            <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Loading overlay */}
                {tab.loading && (
                    <div style={{...loadingOverlayStyle, color: theme === 'dark' ? '#e6eefb' : undefined}}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ fontSize: 18, fontWeight: 600 }}>Loading{tab.loadingDots}</div>
                            <div style={{ marginTop: 8, fontSize: 12, maxWidth: 420, textAlign: 'center', opacity: hintVisible ? 0.9 : 0, transition: 'opacity 1s ease' }}>{hints[hintIndex]}</div>
                        </div>
                    </div>
                )}

                {/* Iframe or start page */}
                <div style={{ flex: 1, position: 'relative' }}>
                    {/* Render one iframe per tab; keep others hidden so their state persists */}
                    {tabs.map((t, i) => (
                        t.url ? (
                            <iframe
                                key={i}
                                ref={iframeRefs[i]}
                                title={`browserFrame${i}`}
                                src={getServeUrl(t.url)}
                                style={{ width: '100%', height: '100%', border: 'none', background: '#fff', display: i === currentTab ? 'block' : 'none' }}
                                sandbox="allow-scripts allow-same-origin allow-popups"
                            />
                        ) : null
                    ))}
                    {!tab.url && (
                        <div style={{...startPageStyle, color: theme === 'dark' ? '#e6eefb' : startPageStyle.color}}>
                            <h1 style={{ margin: 0, fontSize: 32 }}>Welcome to SlmBrowser</h1>
                            <p style={{ color: '#666' }}>Enter a URL above and press <strong>Enter</strong> or click <strong>Go</strong> to start browsing.</p>
                            <div style={{ marginTop: 18, color: '#aaa', opacity: hintVisible ? 1 : 0, transition: 'opacity 1s ease' }}>Tips: {hints[hintIndex]}</div>

                            {/* Bookmarks area */}
                            <div style={{ marginTop: 28, width: '100%', maxWidth: 960 }}>
                                <h2 style={{ fontSize: 18, marginBottom: 12 }}>Bookmarks:</h2>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                                    {bookmarks.length === 0 && (
                                        <div style={{ color: '#999' }}>No bookmarks yet — click the star to add one.</div>
                                    )}
                                    {bookmarks.map((b) => (
                                        <div
                                            key={b.id}
                                            style={{
                                                padding: 12,
                                                borderRadius: 8,
                                                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0,0,0,0.06)',
                                                color: theme === 'dark' ? '#071428' : '#f8fafc',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 8,
                                                border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid rgba(255, 255, 255, 0.04)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <img src={b.favicon || '/favicon.ico'} alt="favicon" style={{ width: 28, height: 28, borderRadius: 6 }} />
                                                <div style={{ overflow: 'hidden' }}>
                                                    <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: 160, color: theme === 'dark' ? '#f8fafc' : '#071428' }}>{b.title || b.targetUrl || 'Untitled'}</div>
                                                    <div style={{ fontSize: 12, color: theme === 'dark' ? '#d1d5db' : '#25415a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: 160 }}>{b.targetUrl || b.iframeSrc}</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                                <button style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff' }} onClick={() => { loadURL(b.targetUrl || b.iframeSrc || ''); }}>
                                                    Open
                                                </button>
                                                <button style={{ padding: '8px', borderRadius: 6, border: '1px solid #e6e6e6', background: 'red' }} onClick={() => {
                                                    // delete
                                                    const raw = localStorage.getItem('slm-bookmarks');
                                                    let list = raw ? JSON.parse(raw) : [];
                                                    list = list.filter((it: any) => it.id !== b.id);
                                                    localStorage.setItem('slm-bookmarks', JSON.stringify(list));
                                                    loadBookmarks();
                                                    toastState.toast({ title: 'Removed', description: 'Bookmark removed' });
                                                }}>
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* status bar removed */}
            </div>
        </div>
    );
}

// Styles
const appStyle: React.CSSProperties = {
    height: '100vh',
    width: '100vw',
    display: 'flex',
    flexDirection: 'column',
    margin: 0,
    padding: 0,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial"
};

const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    background: '#f3f4f6',
    borderBottom: '1px solid #e6e6e6'
};
const tabStyle: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: 6,
    background: 'transparent',
    color: '#444'
};
const tabStyleActive: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: 6,
    background: '#fff',
    boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
    color: '#111',
    fontWeight: 600
};

const toolbarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    background: '#ffffff',
    borderBottom: '1px solid #e6e6e6',
    boxShadow: '0 1px 0 rgba(0,0,0,0.02)'
};

const addressBarWrapStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1
};

const lockStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#eef2ff',
    color: '#4f46e5',
    fontSize: 14
};

const addressBarStyle: React.CSSProperties = {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #e6e6e6',
    fontSize: 14,
    outline: 'none'
};

const goButtonStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 8,
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    cursor: 'pointer'
};

const iconButtonStyle: React.CSSProperties = {
    padding: '6px 8px',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: '#374151',
    cursor: 'pointer'
};

const loadingOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 50,
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none'
};

const startPageStyle: React.CSSProperties = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    color: '#222'
};

// status bar removed