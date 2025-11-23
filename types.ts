export interface FPLPlayer {
  id: number;
  first_name: string;
  second_name: string;
  web_name: string;
  team: number; // Team ID
  element_type: number; // 1: GKP, 2: DEF, 3: MID, 4: FWD
  now_cost: number; // Price = value / 10
  total_points: number;
  points_per_game: string;
  selected_by_percent: string;
  form: string;
  ict_index: string;
  photo: string;
}

export interface FPLTeam {
  id: number;
  name: string;
  short_name: string;
  strength: number;
  pulse_id: number;
}

export interface FPLEvent {
  id: number;
  name: string;
  deadline_time: string;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
}

export interface FPLFixture {
  id: number;
  event: number;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  kickoff_time: string;
  finished: boolean;
  team_h_score: number | null;
  team_a_score: number | null;
}

export interface BootstrapStatic {
  elements: FPLPlayer[];
  teams: FPLTeam[];
  events: FPLEvent[];
  element_types: { id: number; singular_name_short: string }[];
}

export interface ScoutAdvice {
  analysis: string;
  recommendedTransfers: string[];
  captaincyPick: string;
}
