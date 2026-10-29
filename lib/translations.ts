import { Language } from './language';

export const dict = {
  // Navigation & App
  nav_league_table: { en: 'League Table', sk: 'Ligová tabuľka' },
  nav_team_analysis: { en: 'Team Analysis', sk: 'Analýza tímov' },
  nav_period_analysis: { en: 'Period Analysis', sk: 'Analýza období' },
  nav_fixtures: { en: 'Fixtures', sk: 'Vyžrebovanie' },
  nav_transfer_picks: { en: 'Transfer Picks', sk: 'Tipy na prestupy' },
  nav_top_managers: { en: 'Top Managers', sk: 'Top manažéri' },
  nav_player_stats: { en: 'Player Stats', sk: 'Štatistiky hráčov' },
  nav_optimal_squad: { en: 'Optimal 11', sk: 'Optimálna 11' },
  nav_my_team: { en: 'My Team', sk: 'Môj tím' },
  nav_scout: { en: 'FPL Scout', sk: 'FPL Skaut' },
  nav_sign_in: { en: 'Sign in', sk: 'Prihlásiť sa' },
  nav_sign_out: { en: 'Sign out', sk: 'Odhlásiť sa' },
  connecting_to_fpl: { en: 'Connecting to FPL...', sk: 'Pripájanie k FPL...' },
  sync_failed: { en: 'Sync Failed', sk: 'Synchronizácia zlyhala' },
  retry_sync: { en: 'Retry Sync', sk: 'Skúsiť znova' },

  // Dashboard
  dash_welcome: { en: 'Welcome to FPL Studio', sk: 'Vitajte v FPL Studio' },
  dash_welcome_sub: { 
    en: 'Advanced analytics, fixture swings, AI previews, and transfer planning for Fantasy Premier League.', 
    sk: 'Pokročilá analytika, zmena vyžrebovania, AI reporty a plánovanie prestupov pre Fantasy Premier League.' 
  },
  dash_ai_banner_title: { en: 'AI GW Preview', sk: 'AI Preview kola' },
  dash_ai_banner_desc: { 
    en: 'Get AI-generated gameweek reports, differential picks, and captaincy advice.', 
    sk: 'Získajte AI analýzy kôl, tipy na diferenciály a odporúčania na kapitána.' 
  },
  dash_open_scout: { en: 'Open Scout', sk: 'Otvoriť Skauta' },
  dash_target_fixtures: { en: 'Fixtures to Target (Next GW)', sk: 'Zápasy na zacielenie (Najbližšie kolo)' },
  dash_in_form_leaders: { en: 'In-Form Leaders', sk: 'Lídri formy' },
  dash_hidden_gems: { en: 'Hidden Gems', sk: 'Skryté klenoty' },
  dash_hidden_gems_sub: { 
    en: 'Low ownership players with strong recent form.', 
    sk: 'Málo vlastnení hráči s výbornou aktuálnou formou.' 
  },
  dash_swing_title: { en: 'Schedule Swing (Next 5 GWs)', sk: 'Zmena vyžrebovania (Najbližších 5 kôl)' },
  dash_swing_desc: { 
    en: 'Compares previous 5 fixtures difficulty with upcoming 5. Higher swing = easier upcoming run.', 
    sk: 'Porovnáva náročnosť posledných 5 kôl s nasledujúcimi 5. Vyšší swing = ľahší žreb.' 
  },
  dash_improving: { en: 'Improving', sk: 'Zlepšujúce sa' },
  dash_worsening: { en: 'Worsening', sk: 'Zhoršujúce sa' },
  dash_difficulty: { en: 'Difficulty', sk: 'Náročnosť' },
  dash_form: { en: 'Form', sk: 'Forma' },
  dash_points: { en: 'pts', sk: 'b.' },

  // Transfer Picks
  tp_algo_picks: { en: 'Transfer Algorithm Picks', sk: 'Tipy algoritmu na prestupy' },
  tp_next_gw_rankings: { en: 'Next GW Rankings', sk: 'Rebríček na najbližšie kolo' },
  tp_algo_desc_next: { 
    en: 'Optimized for next Gameweek only (form + next fixture).', 
    sk: 'Optimalizované len na najbližšie kolo (forma + najbližší zápas).' 
  },
  tp_algo_desc_5: { 
    en: 'Ranks players using current form + upcoming 5 fixtures.', 
    sk: 'Hodnotí hráčov podľa aktuálnej formy a nasledujúcich 5 zápasov.' 
  },
  tp_the_algo: { en: 'The Algorithm', sk: 'Algoritmus' },
  tp_algo_expl_next: { 
    en: 'Optimized for the immediate gameweek. Combines fixture difficulty, predicted minutes, and current form.', 
    sk: 'Optimalizované pre bezprostredné kolo. Kombinuje náročnosť zápasu, očakávané minúty a formu.' 
  },
  tp_algo_expl_5: { 
    en: 'Balanced strategy evaluating immediate form and the difficulty of the next 5 opponents.', 
    sk: 'Vyvážená stratégia hodnotiaca okamžitú formu a náročnosť ďalších 5 súperov.' 
  },
  tp_horizon_next: { en: 'Next GW', sk: 'Najbližšie kolo' },
  tp_horizon_next5: { en: 'Next 5 GWs', sk: 'Najbližších 5 kôl' },
  tp_pos_all: { en: 'All', sk: 'Všetci' },
  tp_pos_gkp: { en: 'GKP', sk: 'BRAN' },
  tp_pos_def: { en: 'DEF', sk: 'OBR' },
  tp_pos_mid: { en: 'MID', sk: 'ZÁL' },
  tp_pos_fwd: { en: 'FWD', sk: 'ÚTO' },
  tp_th_player: { en: 'Player', sk: 'Hráč' },
  tp_th_index: { en: 'INDEX', sk: 'INDEX' },
  tp_th_gw_score: { en: 'GW SCORE', sk: 'GW SKÓRE' },
  tp_th_price: { en: 'Price', sk: 'Cena' },
  tp_th_ownership: { en: 'Ownership', sk: 'Vlastníctvo' },
  tp_th_form: { en: 'Form', sk: 'Forma' },
  tp_th_start: { en: 'Start', sk: 'Základ' },
  tp_th_goal_odds: { en: 'Goal Odds', sk: 'Šanca na gól' },
  tp_th_assist_odds: { en: 'Assist Odds', sk: 'Šanca na asist.' },
  tp_th_ga_odds: { en: 'G+A Odds', sk: 'Šanca na G+A' },
  tp_odds_btn: { en: 'Odds', sk: 'Kurzy' },
  tp_odds_mode_goal: { en: 'Goal', sk: 'Gól' },
  tp_odds_mode_assist: { en: 'Assist', sk: 'Asistencia' },
  tp_odds_mode_ga: { en: 'G+A', sk: 'Gól + Asist.' },
  tp_th_diff: { en: 'Diff', sk: 'Nároč.' },
  tp_top100_badge: { en: 'Top 100', sk: 'Top 100' },
  tp_top100_own: { en: 'own', sk: 'vlastní' },
  tp_click_detail: { 
    en: 'Click to view player detail, league rankings and gameweek history', 
    sk: 'Kliknutím zobrazíte detail hráča, rebríčky a históriu' 
  },
  tp_index_tooltip: { 
    en: 'Transfer Index combines form, fixture difficulty and playing certainty. Higher = better.', 
    sk: 'Transfer Index je kombinované skóre formy, náročnosti žrebu a istoty štartu. Vyššie = lepšie.' 
  },
  tp_start_tooltip: { 
    en: 'Expected starting probability for next gameweek', 
    sk: 'Odhadovaná pravdepodobnosť štartu v základe' 
  },
  tp_goal_prob_tooltip: { 
    en: 'Probability to score a goal in next gameweek', 
    sk: 'Pravdepodobnosť strelenia gólu v najbližšom kole' 
  },
  tp_assist_prob_tooltip: { 
    en: 'Probability to provide an assist in next gameweek', 
    sk: 'Pravdepodobnosť asistencie v najbližšom kole' 
  },
  tp_ga_prob_tooltip: { 
    en: 'Probability to score or assist (Goal Involvement) in next gameweek', 
    sk: 'Pravdepodobnosť strelenia gólu alebo asistencie (kanadský bod)' 
  },
  tp_card_next_fix: { en: 'Next Fixture', sk: 'Najbližší zápas' },
  tp_card_upcoming_fix: { en: 'Upcoming Fixtures', sk: 'Nasledujúce zápasy' },

  // Fixtures
  fix_title: { en: 'Fixture Difficulty Ratings', sk: 'Náročnosť vyžrebovania (FDR)' },
  fix_sub: { 
    en: 'Visualise upcoming schedules and identify fixture swings.', 
    sk: 'Prehľad nadchádzajúceho vyžrebovania a zmien v náročnosti zápasov.' 
  },
  fix_gameweek: { en: 'Gameweek', sk: 'Kolo' },
  fix_sort_by: { en: 'Sort by', sk: 'Zoradiť podľa' },

  // Common
  home_short: { en: 'H', sk: 'D' },
  away_short: { en: 'A', sk: 'V' }
} as const;

export type TranslationKey = keyof typeof dict;

export function t(key: TranslationKey, lang: Language): string {
  const item = dict[key];
  if (!item) return key;
  return item[lang] || item['en'] || key;
}
