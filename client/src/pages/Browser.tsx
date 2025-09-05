import React, { useState, useRef, useEffect } from "react";
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
    const [url, setUrl] = useState(HOME_URL);
    const [inputValue, setInputValue] = useState(HOME_URL);
    const [historyStack, setHistoryStack] = useState<string[]>(HOME_URL ? [HOME_URL] : []);
    const [historyIndex, setHistoryIndex] = useState(HOME_URL ? 0 : -1);
    const [loading, setLoading] = useState(false);
    const [loadingDots, setLoadingDots] = useState(".");
    const [hintIndex, setHintIndex] = useState(0);
    const [hintVisible, setHintVisible] = useState(true);
    const iframeRef = useRef<HTMLIFrameElement>(null);

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
        setUrl(formattedUrl);
        setInputValue(formattedUrl);

        if (addToHistory) {
            const newHistory = historyStack.slice(0, historyIndex + 1);
            newHistory.push(formattedUrl);
            setHistoryStack(newHistory);
            setHistoryIndex(newHistory.length - 1);
        }
    }

    function goBack() {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setUrl(historyStack[newIndex]);
            setInputValue(historyStack[newIndex]);
        }
    }

    function goForward() {
        if (historyIndex < historyStack.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setUrl(historyStack[newIndex]);
            setInputValue(historyStack[newIndex]);
        }
    }

    function reload() {
        if (iframeRef.current && url) {
            setLoading(true);
            iframeRef.current.src = getServeUrl(url);
        }
    }

    function goHome() {
        setUrl("");
        setInputValue("");
        setHistoryStack([]);
        setHistoryIndex(-1);
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        setInputValue(e.target.value);
    }

    function handleInputKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            loadURL(inputValue);
        }
    }

    function handleGoClick() {
        loadURL(inputValue);
    }

    // Show loading overlay when url changes (for iframe)
    useEffect(() => {
        if (url) setLoading(true);
        // eslint-disable-next-line
    }, [url]);

    // Animate loading dots
    useEffect(() => {
        if (!loading) return;
        const interval = setInterval(() => {
            setLoadingDots(prev =>
                prev === "." ? ".." : prev === ".." ? "..." : "."
            );
        }, 400);
        return () => clearInterval(interval);
    }, [loading]);

    // Animate hints with fade in/out
    useEffect(() => {
        if (!loading) return;
        setHintVisible(true);
        const fadeOutDelay = 2200;
        const fadeInDelay = 500;
        let fadeTimeout: NodeJS.Timeout;
        let nextTimeout: NodeJS.Timeout;

        function showNextHint() {
            setHintVisible(false);
            fadeTimeout = setTimeout(() => {
                setHintIndex(i => (i + 1) % hints.length);
                setHintVisible(true);
                nextTimeout = setTimeout(showNextHint, fadeOutDelay);
            }, fadeInDelay);
        }

        nextTimeout = setTimeout(showNextHint, fadeOutDelay);

        return () => {
            clearTimeout(fadeTimeout);
            clearTimeout(nextTimeout);
        };
    }, [loading]);

    // Keep url and historyIndex in sync, and guard against negative index
    useEffect(() => {
        if (historyIndex >= 0 && historyStack[historyIndex]) {
            setUrl(historyStack[historyIndex]);
            setInputValue(historyStack[historyIndex]);
        } else if (historyIndex === -1) {
            setUrl("");
            setInputValue("");
        }
        // eslint-disable-next-line
    }, [historyIndex]);

    // Hide loading overlay when iframe loads, and show loading for in-iframe navigation
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const handleLoad = () => setLoading(false);
        const handleBeforeUnload = () => setLoading(true);

        // Try to show loading for in-iframe navigation (works only for same-origin)
        iframe.addEventListener("load", handleLoad);

        // For cross-origin, we can't listen to navigation start, but we can try to show loading on load/unload
        // This is a best-effort: for most cross-origin, only load event is available
        iframe.contentWindow?.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            iframe.removeEventListener("load", handleLoad);
            iframe.contentWindow?.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [url]);

    return (
        <div style={{
            height: "100vh",
            width: "100vw",
            display: "flex",
            flexDirection: "column",
            margin: 0,
            padding: 0,
            fontFamily: "Arial, sans-serif"
        }}>
            <header style={{
                display: "flex",
                alignItems: "center",
                padding: "5px 10px",
                background: "#2c3e50",
                color: "white",
                gap: "5px"
            }}>
                <button onClick={goBack} disabled={historyIndex <= 0} style={buttonStyle}>◀</button>
                <button onClick={goForward} disabled={historyIndex >= historyStack.length - 1} style={buttonStyle}>▶</button>
                <button onClick={reload} disabled={!url} style={buttonStyle}>⟳</button>
                <button onClick={goHome} style={buttonStyle}>🏠</button>
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyPress={handleInputKeyPress}
                    placeholder="Enter URL and press Enter"
                    style={{
                        flex: 1,
                        padding: "5px 10px",
                        borderRadius: "4px",
                        border: "none",
                        fontSize: "1em",
                        color: "#2c3e50",
                        fontFamily: "Consolas, 'Courier New', monospace"
                    }}
                />
                <button onClick={handleGoClick} style={buttonStyle}>Go</button>
            </header>
            <div style={{ position: "relative", flex: 1, width: "100%" }}>
                {loading && (
                    <div style={{
                        position: "absolute",
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: "rgba(44,62,80,0.5)",
                        zIndex: 10,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: "2em",
                        fontWeight: "bold",
                        pointerEvents: "none"
                    }}>
                        <div>Loading{loadingDots}</div>
                        <div
                            style={{
                                marginTop: "1em",
                                fontSize: "0.5em",
                                textAlign: "center",
                                maxWidth: "300px",
                                opacity: hintVisible ? 1 : 0,
                                transition: "opacity 0.3s"
                            }}>
                            {hints[hintIndex]}
                        </div>
                    </div>
                )}
                {url ? (
                    <iframe
                        ref={iframeRef}
                        title="browserFrame"
                        src={getServeUrl(url)}
                        style={{
                            flex: 1,
                            border: "none",
                            width: "100%",
                            height: "100%",
                            background: "#fff"
                        }}
                        sandbox="allow-scripts allow-same-origin"
                    />
                ) : (
                    <div
                        style={{
                            flex: 1,
                            border: "none",
                            width: "100%",
                            height: "100%",
                            overflow: "auto",
                            background: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}
                    >
                        <div style={{
                            textAlign: "center",
                            width: "100%",
                            color: "#2c3e50"
                        }}>
                            <h1 style={{ fontSize: "2.5em", margin: "0.5em 0" }}>Welcome to SlmBrowser</h1>
                            <p style={{ fontSize: "1.2em", marginBottom: "2em" }}>
                                Enter a URL above and press <b>Go</b> or <b>Enter</b> to start browsing!
                            </p>
                            <div style={{
                                fontSize: "4em",
                                marginBottom: "1em"
                            }}>🌐</div>
                            <p style={{ color: "#888" }}>
                                Powered by SlmRouter
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const buttonStyle: React.CSSProperties = {
    padding: "5px 10px",
    borderRadius: "4px",
    border: "none",
    background: "#34495e",
    color: "white",
    cursor: "pointer"
};