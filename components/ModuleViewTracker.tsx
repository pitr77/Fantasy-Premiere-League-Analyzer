"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/ga";

// Since our SPA changes views via state and reflects them in AnalyticsTracker path logic,
// but doesn't necessarily change the actual browser URL pathname (unless we use router),
// we need to be careful. In this app, App.tsx passes currentView to AnalyticsTracker.
// However, the user request specifically asked for usePathname.
// In this repo, Next.js is used, but mostly as a wrapper for the SPA.

import { usePathname } from "next/navigation";

const MODULE_BY_PATH: Record<string, string> = {
    "/dashboard": "dashboard",
    "/league-table": "league_table",
    "/team-analysis": "team_analysis",
    "/period-analysis": "period_analysis",
    "/fixtures": "fixtures",
    "/transfer-picks": "transfer_picks",
};

function getModule(pathname: string) {
    return MODULE_BY_PATH[pathname] ?? "unknown";
}

function isLoggedIn() {
    try {
        // Checking Supabase auth token in localStorage as requested
        return localStorage.getItem("sb-access-token") ? 1 : 0;
    } catch {
        return 0;
    }
}

export default function ModuleViewTracker() {
    const pathname = usePathname();
    const lastPath = useRef<string | null>(null);

    useEffect(() => {
        if (!pathname) return;
        if (lastPath.current === pathname) return;
        lastPath.current = pathname;

        track("view_module", {
            module: getModule(pathname),
            path: pathname,
            source: "nav",
            is_logged_in: isLoggedIn(),
        });
    }, [pathname]);

    return null;
}
