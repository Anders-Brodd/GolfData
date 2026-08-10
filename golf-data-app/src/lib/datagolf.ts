export class DataGolfAPI {
  private apiKey: string;
  private baseUrl = 'https://feeds.datagolf.com';

  constructor() {
    this.apiKey = process.env.DATAGOLF_API_KEY || '';
    if (!this.apiKey) {
      console.warn('DATAGOLF_API_KEY is missing');
    }
  }

  async getFantasyProjections(tour = 'pga', site = 'draftkings', slate = 'main') {
    const url = `${this.baseUrl}/preds/fantasy-projection-defaults?tour=${tour}&site=${site}&slate=${slate}&file_format=json&key=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DataGolf getFantasyProjections failed: ${res.statusText}`);
    return res.json();
  }

  async getPlayerSkill(display = 'value') {
    const url = `${this.baseUrl}/preds/skill-ratings?display=${display}&file_format=json&key=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DataGolf getPlayerSkill failed: ${res.statusText}`);
    return res.json();
  }

  async getTourSchedules(tour = 'pga') {
    const url = `${this.baseUrl}/get-schedule?tour=${tour}&file_format=json&key=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DataGolf getTourSchedules failed: ${res.statusText}`);
    return res.json();
  }

  async getHistoricalRawRounds(year: string, tour = 'pga') {
    const url = `${this.baseUrl}/historical-raw-data/rounds?tour=${tour}&event_id=all&year=${year}&file_format=json&key=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DataGolf getHistoricalRawRounds failed: ${res.statusText}`);
    return res.json();
  }
}
