export class DataGolfAPI {
  private apiKey: string;
  private baseUrl = 'https://feeds.datagolf.com';

  constructor() {
    this.apiKey = process.env.DATAGOLF_API_KEY || '';
    if (!this.apiKey) {
      console.warn('DATAGOLF_API_KEY is missing');
    }
  }

  async getProjections(tour = 'pga') {
    const url = `${this.baseUrl}/preds/get-td?tour=${tour}&file_format=json&key=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DataGolf getProjections failed: ${res.statusText}`);
    return res.json();
  }

  async getPreTournamentOdds(tour = 'pga') {
    const url = `${this.baseUrl}/preds/pre-tournament?tour=${tour}&odds_format=decimal&file_format=json&key=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DataGolf getPreTournamentOdds failed: ${res.statusText}`);
    return res.json();
  }
}
