import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'FPL Studio — AI-Powered Fantasy Premier League Analytics';
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#090d16',
                    padding: '70px 80px',
                    justifyContent: 'space-between',
                    backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(139, 92, 246, 0.35) 0%, rgba(15, 23, 42, 0.95) 55%, rgba(16, 185, 129, 0.15) 100%)',
                    fontFamily: 'sans-serif',
                }}
            >
                {/* Header Branding */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div
                            style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '16px',
                                background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 10px 25px rgba(139, 92, 246, 0.4)',
                                color: '#ffffff',
                                fontSize: '28px',
                                fontWeight: 900,
                            }}
                        >
                            ⚡
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '32px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.5px' }}>
                                FPL Studio
                            </span>
                            <span style={{ fontSize: '15px', color: '#94a3b8', fontWeight: 600 }}>
                                fplstudio.com
                            </span>
                        </div>
                    </div>

                    <div
                        style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            color: '#60a5fa',
                            padding: '8px 18px',
                            borderRadius: '999px',
                            fontSize: '15px',
                            fontWeight: 800,
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase',
                        }}
                    >
                        Free FPL Intelligence
                    </div>
                </div>

                {/* Hero Title & Subtitle */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '1000px' }}>
                    <div
                        style={{
                            fontSize: '56px',
                            fontWeight: 900,
                            lineHeight: 1.1,
                            color: '#ffffff',
                            letterSpacing: '-1.5px',
                        }}
                    >
                        AI-Powered Fantasy Premier League Analytics
                    </div>
                    <div
                        style={{
                            fontSize: '22px',
                            color: '#94a3b8',
                            lineHeight: 1.4,
                            fontWeight: 500,
                        }}
                    >
                        Top 100 Manager Tracking · Dynamic FDR Matrix · Bookmaker Odds Integration · Squad Strategy Simulator
                    </div>
                </div>

                {/* Feature Pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <div
                        style={{
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            color: '#34d399',
                            padding: '10px 18px',
                            borderRadius: '12px',
                            fontSize: '16px',
                            fontWeight: 700,
                        }}
                    >
                        🔥 Top 100 Template & Transfers
                    </div>
                    <div
                        style={{
                            background: 'rgba(139, 92, 246, 0.12)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            color: '#c084fc',
                            padding: '10px 18px',
                            borderRadius: '12px',
                            fontSize: '16px',
                            fontWeight: 700,
                        }}
                    >
                        📊 Dynamic FDR Fixture Matrix
                    </div>
                    <div
                        style={{
                            background: 'rgba(245, 158, 11, 0.12)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            color: '#fbbf24',
                            padding: '10px 18px',
                            borderRadius: '12px',
                            fontSize: '16px',
                            fontWeight: 700,
                        }}
                    >
                        🎲 Clean Sheet & Goal Odds
                    </div>
                    <div
                        style={{
                            background: 'rgba(59, 130, 246, 0.12)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            color: '#60a5fa',
                            padding: '10px 18px',
                            borderRadius: '12px',
                            fontSize: '16px',
                            fontWeight: 700,
                        }}
                    >
                        🤖 Gemini AI Weekly Scout
                    </div>
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}
